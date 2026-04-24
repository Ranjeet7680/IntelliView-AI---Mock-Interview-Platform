// State
let state = {
    sessionId: null,
    role: '',
    difficulty: '',
    currentQuestion: null,
    totalQuestions: 0,
    currentIndex: 0,
    isInterviewActive: false
};

// API Base URL - adjust if needed
const API_URL = 'http://localhost:5000/api';

// DOM Elements
const views = {
    setup: document.getElementById('view-setup'),
    interview: document.getElementById('view-interview'),
    summary: document.getElementById('view-summary')
};

const navBtns = {
    setup: document.getElementById('nav-setup'),
    dashboard: document.getElementById('nav-dashboard')
};

// Setup Form Elements
const setupForm = document.getElementById('setup-form');
const roleInput = document.getElementById('role-input');
const difficultySelect = document.getElementById('difficulty-select');

// Interview Elements
const roleBadge = document.getElementById('current-role-badge');
const progressBar = document.getElementById('interview-progress');
const questionCounter = document.getElementById('question-counter');
const questionText = document.getElementById('current-question');
const answerInput = document.getElementById('answer-input');
const submitBtn = document.getElementById('submit-answer-btn');
const skipBtn = document.getElementById('skip-btn');
const voiceBtn = document.getElementById('voice-btn');

// Feedback Panel Elements
const feedbackPanel = document.getElementById('live-feedback-panel');
const liveScore = document.getElementById('live-score');
const liveFeedbackText = document.getElementById('live-feedback-text');
const liveStrengths = document.getElementById('live-strengths');
const liveWeaknesses = document.getElementById('live-weaknesses');
const liveBetterAnswer = document.getElementById('live-better-answer');
const nextQuestionBtn = document.getElementById('next-question-btn');

// Summary Elements
const finalScoreEl = document.getElementById('final-score');
const qAnsweredEl = document.getElementById('questions-answered');
const summaryRoleEl = document.getElementById('summary-role');
const qaHistoryContainer = document.getElementById('qa-history-container');
const newSessionBtn = document.getElementById('new-session-btn');

// Loader
const loader = document.getElementById('loading-overlay');
const loaderText = document.getElementById('loading-text');

// --- Navigation & View Management ---

function switchView(viewName) {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    views[viewName].classList.remove('hidden');
    
    // Update nav active states
    if (viewName === 'setup' || viewName === 'interview') {
        navBtns.setup.classList.add('active');
        navBtns.dashboard.classList.remove('active');
    } else if (viewName === 'summary') {
        navBtns.setup.classList.remove('active');
        navBtns.dashboard.classList.add('active');
    }
}

function showLoader(msg = "Loading...") {
    loaderText.textContent = msg;
    loader.classList.remove('hidden');
}

function hideLoader() {
    loader.classList.add('hidden');
}

// --- API Calls ---

async function startInterview(role, difficulty) {
    showLoader("Generating role-specific questions via AI...");
    try {
        const response = await fetch(`${API_URL}/start-interview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role, difficulty })
        });
        
        if (!response.ok) throw new Error("Failed to start session");
        
        const data = await response.json();
        
        state.sessionId = data.sessionId;
        state.role = role;
        state.difficulty = difficulty;
        state.totalQuestions = data.questionCount;
        state.currentIndex = 0;
        state.currentQuestion = data.firstQuestion;
        state.isInterviewActive = true;
        
        setupInterviewUI();
        switchView('interview');
    } catch (err) {
        console.error(err);
        alert("Error starting interview. Please ensure the backend server is running.");
    } finally {
        hideLoader();
    }
}

async function submitAnswer(answer) {
    if (!answer.trim()) {
        alert("Please provide an answer before submitting.");
        return;
    }

    showLoader("AI is evaluating your response...");
    
    // Disable inputs
    answerInput.disabled = true;
    submitBtn.disabled = true;
    skipBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_URL}/submit-answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: state.sessionId,
                answer: answer
            })
        });
        
        if (!response.ok) throw new Error("Failed to evaluate answer");
        
        const data = await response.json();
        
        // Show feedback
        displayFeedback(data.evaluation);
        
        // Update state for next step
        state.isComplete = data.isComplete;
        if (!data.isComplete) {
            state.nextQuestionTemp = data.nextQuestion;
        }
        
    } catch (err) {
        console.error(err);
        alert("Error evaluating answer. Please try again.");
        answerInput.disabled = false;
        submitBtn.disabled = false;
        skipBtn.disabled = false;
    } finally {
        hideLoader();
    }
}

async function loadSummary() {
    showLoader("Generating performance report...");
    try {
        const response = await fetch(`${API_URL}/summary/${state.sessionId}`);
        if (!response.ok) throw new Error("Failed to fetch summary");
        
        const data = await response.json();
        
        summaryRoleEl.textContent = data.role;
        finalScoreEl.textContent = data.averageScore;
        qAnsweredEl.textContent = data.details.filter(d => d.answer).length;
        
        // Render QA History
        qaHistoryContainer.innerHTML = '';
        data.details.forEach((item, index) => {
            if (!item.answer) return; // Skip unanswered
            
            const html = `
                <div class="qa-item">
                    <div class="qa-question">Q${index + 1}: ${item.question}</div>
                    <div style="margin: 0.5rem 0; padding-left: 1rem; border-left: 2px solid var(--border-color); color: var(--text-muted); font-size: 0.9rem;">
                        <strong>Your Answer:</strong> ${item.answer}
                    </div>
                    ${item.evaluation ? `
                    <div style="margin-top: 1rem; font-size: 0.9rem;">
                        <span class="qa-score">Score: ${item.evaluation.score}/10</span>
                        <p><strong>Feedback:</strong> ${item.evaluation.feedback}</p>
                    </div>
                    ` : ''}
                </div>
            `;
            qaHistoryContainer.insertAdjacentHTML('beforeend', html);
        });
        
        switchView('summary');
    } catch (err) {
        console.error(err);
        alert("Error loading summary.");
    } finally {
        hideLoader();
    }
}

// --- UI Updaters ---

function setupInterviewUI() {
    roleBadge.textContent = state.role;
    updateProgress();
    questionText.textContent = state.currentQuestion;
    answerInput.value = '';
    answerInput.disabled = false;
    submitBtn.disabled = false;
    skipBtn.disabled = false;
    feedbackPanel.classList.add('hidden');
}

function updateProgress() {
    const p = (state.currentIndex / state.totalQuestions) * 100;
    progressBar.style.width = `${p}%`;
    questionCounter.textContent = `Question ${state.currentIndex + 1} of ${state.totalQuestions}`;
}

function displayFeedback(evaluation) {
    liveScore.textContent = `${evaluation.score}/10`;
    
    // Change color based on score
    if (evaluation.score >= 8) liveScore.style.color = 'var(--success)';
    else if (evaluation.score >= 5) liveScore.style.color = 'var(--warning)';
    else liveScore.style.color = 'var(--danger)';
    liveScore.style.borderColor = liveScore.style.color;

    liveFeedbackText.textContent = evaluation.feedback;
    
    liveStrengths.innerHTML = '';
    if (evaluation.strengths) {
        evaluation.strengths.forEach(s => {
            liveStrengths.insertAdjacentHTML('beforeend', `<span class="tag tag-strength">+ ${s}</span>`);
        });
    }

    liveWeaknesses.innerHTML = '';
    if (evaluation.weaknesses) {
        evaluation.weaknesses.forEach(w => {
            liveWeaknesses.insertAdjacentHTML('beforeend', `<span class="tag tag-weakness">- ${w}</span>`);
        });
    }

    liveBetterAnswer.textContent = evaluation.betterAnswer || "No alternative provided.";
    
    // Show panel
    feedbackPanel.classList.remove('hidden');
    
    // Change Next button text if it's the last question
    if (state.isComplete) {
        nextQuestionBtn.textContent = "Finish Interview & See Report";
    } else {
        nextQuestionBtn.textContent = "Next Question";
    }
}

function advanceToNextQuestion() {
    if (state.isComplete) {
        loadSummary();
    } else {
        state.currentIndex++;
        state.currentQuestion = state.nextQuestionTemp;
        setupInterviewUI();
    }
}

// --- Event Listeners ---

setupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    startInterview(roleInput.value, difficultySelect.value);
});

submitBtn.addEventListener('click', () => {
    submitAnswer(answerInput.value);
});

skipBtn.addEventListener('click', () => {
    // Treat skip as an empty/poor answer for scoring, or just mark it skipped.
    // For simplicity, we submit a dummy "I don't know" to keep flow consistent.
    if(confirm("Are you sure you want to skip? This will affect your score.")) {
        submitAnswer("I don't know the answer to this question.");
    }
});

nextQuestionBtn.addEventListener('click', advanceToNextQuestion);

newSessionBtn.addEventListener('click', () => {
    roleInput.value = '';
    state = { isInterviewActive: false };
    switchView('setup');
});

// Basic Speech Recognition (Web Speech API)
let recognition;
if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    
    let isRecording = false;
    
    recognition.onresult = (event) => {
        let final_transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                final_transcript += event.results[i][0].transcript;
                answerInput.value += final_transcript + ' ';
            }
        }
    };
    
    recognition.onend = () => {
        isRecording = false;
        voiceBtn.classList.remove('recording');
        voiceBtn.style.color = '';
    };

    voiceBtn.addEventListener('click', () => {
        if (isRecording) {
            recognition.stop();
        } else {
            recognition.start();
            isRecording = true;
            voiceBtn.classList.add('recording');
            voiceBtn.style.color = 'var(--danger)'; // Visual indicator
        }
    });
} else {
    voiceBtn.style.display = 'none'; // Hide if not supported
}
