const { GoogleGenerativeAI } = require("@google/generative-ai");

// Make sure to set GEMINI_API_KEY in your .env file
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.warn("WARNING: GEMINI_API_KEY is not set in environment variables.");
}
const genAI = new GoogleGenerativeAI(apiKey || 'dummy_key_for_now');

async function generateQuestions(role, difficulty = 'intermediate', count = 5) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const prompt = `You are an expert technical interviewer. Generate exactly ${count} interview questions for a ${difficulty} level ${role} position.
        
Return ONLY a valid JSON array of strings containing the questions. Do not include markdown formatting like \`\`\`json or \`\`\`.
Example format:
[
  "What is your experience with...",
  "Can you explain how..."
]`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();
        
        // Clean up markdown code blocks if the model still returns them
        const cleanedText = responseText.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/```$/, '').trim();
        
        try {
            return JSON.parse(cleanedText);
        } catch (e) {
            console.error("Failed to parse JSON response:", cleanedText);
            // Fallback: try to extract questions if JSON parsing fails
            return responseText.split('\n')
                .filter(line => line.match(/^[0-9]+[.)]|-/))
                .map(line => line.replace(/^[0-9]+[.)]\s*|-\s*/, '').trim())
                .slice(0, count);
        }
    } catch (error) {
        console.error("Gemini API Error (Generate Questions):", error);
        // Fallback questions if API fails
        return [
            `Can you describe a challenging problem you solved as a ${role}?`,
            `What are the most important skills for a ${role}?`,
            `How do you stay updated with the latest trends in your field?`,
            `Describe a time when you had to work with a difficult team member.`,
            `Where do you see yourself in 5 years?`
        ];
    }
}

async function evaluateAnswer(question, answer, role) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const prompt = `You are an expert interviewer evaluating a candidate for a ${role} position.
        
Question asked: "${question}"
Candidate's answer: "${answer}"

Evaluate the answer based on:
1. Relevance to the question
2. Clarity and communication
3. Technical correctness/depth

Return ONLY a valid JSON object. Do not include markdown formatting.
Format:
{
  "score": 8, // A number from 1 to 10
  "feedback": "A short, constructive paragraph on what was good and what could be improved.",
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1"],
  "betterAnswer": "An example of a stronger, more complete answer."
}`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();
        
        const cleanedText = responseText.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/```$/, '').trim();
        
        try {
            return JSON.parse(cleanedText);
        } catch (e) {
            console.error("Failed to parse JSON evaluation:", cleanedText);
            throw new Error("Invalid response format from AI");
        }
    } catch (error) {
        console.error("Gemini API Error (Evaluate Answer):", error);
        // Fallback evaluation if API fails
        return {
            score: 7,
            feedback: "Good attempt, but could use more specific examples.",
            strengths: ["Attempted to answer the question"],
            weaknesses: ["Lacked depth"],
            betterAnswer: "A comprehensive answer would detail specific technologies, outcomes, and your direct contribution to the result."
        };
    }
}

module.exports = {
    generateQuestions,
    evaluateAnswer
};
