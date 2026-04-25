export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    
    const { prompt, systemPrompt } = req.body;
    
    // For ultimate security, these are moved to Vercel Environment Variables
    const keys = [];
    if (process.env.GROQ_API_KEY_1) keys.push(process.env.GROQ_API_KEY_1);
    if (process.env.GROQ_API_KEY_2) keys.push(process.env.GROQ_API_KEY_2);
    
    // Fallback just in case you named it GROQ_API_KEY
    if (keys.length === 0 && process.env.GROQ_API_KEY) keys.push(process.env.GROQ_API_KEY);
    
    if (keys.length === 0) {
        return res.status(500).json({ error: 'Missing GROQ_API_KEY_1 environment variable. Please set it in Vercel.' });
    }

    // Rotate keys dynamically to prevent exhaustion
    const key = keys[Math.floor(Math.random() * keys.length)];
    
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile', // Updated to the latest supported Groq Llama 3.3 model
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 1500
            })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'Error from Groq');
        }

        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        console.error("Groq API Error:", error);
        res.status(500).json({ error: error.message });
    }
}
