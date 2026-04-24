const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { generateQuestions, evaluateAnswer } = require('./aiService');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Session memory (in a real app, use a database)
const sessions = {};

// Start an interview session
app.post('/api/start-interview', async (req, res) => {
    const { role, difficulty } = req.body;
    
    if (!role) {
        return res.status(400).json({ error: 'Role is required' });
    }

    try {
        const questions = await generateQuestions(role, difficulty || 'intermediate');
        const sessionId = Date.now().toString();
        
        sessions[sessionId] = {
            role,
            difficulty,
            questions,
            currentQuestionIndex: 0,
            answers: [],
            evaluations: []
        };

        res.json({
            sessionId,
            message: 'Interview started',
            questionCount: questions.length,
            firstQuestion: questions[0]
        });
    } catch (error) {
        console.error('Error starting interview:', error);
        res.status(500).json({ error: 'Failed to start interview' });
    }
});

// Submit an answer
app.post('/api/submit-answer', async (req, res) => {
    const { sessionId, answer } = req.body;

    if (!sessionId || !sessions[sessionId]) {
        return res.status(400).json({ error: 'Invalid or missing session ID' });
    }

    if (!answer) {
        return res.status(400).json({ error: 'Answer is required' });
    }

    const session = sessions[sessionId];
    const currentQuestion = session.questions[session.currentQuestionIndex];

    try {
        const evaluation = await evaluateAnswer(currentQuestion, answer, session.role);
        
        session.answers.push(answer);
        session.evaluations.push(evaluation);
        session.currentQuestionIndex++;

        const isComplete = session.currentQuestionIndex >= session.questions.length;
        
        res.json({
            evaluation,
            nextQuestion: isComplete ? null : session.questions[session.currentQuestionIndex],
            isComplete
        });
    } catch (error) {
        console.error('Error evaluating answer:', error);
        res.status(500).json({ error: 'Failed to evaluate answer' });
    }
});

// Get session summary
app.get('/api/summary/:sessionId', (req, res) => {
    const { sessionId } = req.params;

    if (!sessionId || !sessions[sessionId]) {
        return res.status(400).json({ error: 'Invalid or missing session ID' });
    }

    const session = sessions[sessionId];
    
    // Calculate overall score
    let totalScore = 0;
    session.evaluations.forEach(eval => {
        totalScore += eval.score;
    });
    
    const averageScore = session.evaluations.length > 0 
        ? Math.round((totalScore / session.evaluations.length) * 10) / 10 
        : 0;

    res.json({
        role: session.role,
        averageScore,
        details: session.questions.map((q, i) => ({
            question: q,
            answer: session.answers[i] || null,
            evaluation: session.evaluations[i] || null
        }))
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
