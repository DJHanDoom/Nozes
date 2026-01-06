/**
 * Multi-Provider API Integration
 * Supports: OpenAI, Claude (Anthropic), and HuggingFace Inference API
 */

interface AIResponse {
    text: string;
}

/**
 * Call OpenAI API (GPT models)
 */
async function callOpenAI(
    apiKey: string,
    model: string,
    systemInstruction: string,
    userPrompt: string
): Promise<AIResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: [
                { role: 'system', content: systemInstruction },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' },
            max_tokens: 16000,
            temperature: 0.7
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API Error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return { text: data.choices[0].message.content };
}

/**
 * Call Claude API (Anthropic)
 */
async function callClaude(
    apiKey: string,
    model: string,
    systemInstruction: string,
    userPrompt: string
): Promise<AIResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: model,
            max_tokens: 16000,
            system: systemInstruction,
            messages: [
                { role: 'user', content: userPrompt }
            ]
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API Error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return { text: data.content[0].text };
}

/**
 * Call HuggingFace Inference API
 */
async function callHuggingFace(
    apiKey: string,
    model: string,
    systemInstruction: string,
    userPrompt: string
): Promise<AIResponse> {
    // Use proxy in dev mode to avoid CORS, direct URL in prod
    // API is fully OpenAI-compatible: https://router.huggingface.co/v1/chat/completions
    // Model ID is passed in the body
    const baseUrl = import.meta.env.DEV ? '/hf-api' : 'https://router.huggingface.co/v1';

    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: [
                { role: 'system', content: systemInstruction + "\n\nIMPORTANT: Output ONLY valid JSON. Ensure the JSON is complete and not truncated." },
                { role: 'user', content: userPrompt }
            ],
            max_tokens: 32000,
            temperature: 0.5,
            presence_penalty: 0.0,
            frequency_penalty: 0.0,
            stream: false
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`HuggingFace API Error (${response.status}): ${error}`);
    }

    const data = await response.json();
    console.log("[HuggingFace] Raw Response:", data.choices[0].message.content);
    return { text: data.choices[0].message.content };
}

export { callOpenAI, callClaude, callHuggingFace };
