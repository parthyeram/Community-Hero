const MODEL = "gemini-1.5-flash";
const CATEGORIES = "'Pothole', 'Water Leakage', 'Streetlight Damage', 'Waste Management', 'Road Damage', 'Public Safety', 'Infrastructure Damage', 'Other'";

function buildGeminiBody(eventBody) {
    const { action } = eventBody;

    if (action === "analyzeImage") {
        const prompt = `Analyze this community issue photo. Based on the photo and this description if provided: "${eventBody.descriptionText || ""}", classify the issue. Respond strictly with a JSON object containing the keys: 'category' (must be one of: ${CATEGORIES}), 'severity' ('Low', 'Medium', 'High'), 'priority' ('Low', 'Medium', 'High', 'Critical'), and 'summary' (a concise 1-sentence summary of the problem). Do not return markdown wrappers.`;

        return {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: eventBody.mimeType || "image/jpeg",
                            data: eventBody.imageData
                        }
                    }
                ]
            }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        };
    }

    if (action === "analyzeText") {
        const prompt = `Based on this description of a community issue: "${eventBody.descriptionText || ""}", classify the issue. Respond strictly with a JSON object containing the keys: 'category' (must be one of: ${CATEGORIES}), 'severity' ('Low', 'Medium', 'High'), 'priority' ('Low', 'Medium', 'High', 'Critical'), and 'summary' (a concise 1-sentence summary of the problem). Do not return markdown wrappers.`;

        return {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        };
    }

    if (action === "generateInsights") {
        const prompt = `You are a civic planning AI. Based on the following list of community issues logged in the neighborhood: ${JSON.stringify(eventBody.issuesSummary || [])}, analyze trends, predict future issues, identify hotspots, and provide resolution recommendations. Respond strictly with a JSON object containing keys: 'hotspots' (array of 3 strings), 'trends' (array of 3 strings), 'predictions' (array of 3 strings), and 'recommendations' (array of 3 strings). Keep sentences short and punchy. Do not return markdown wrappers.`;

        return {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        };
    }

    throw new Error("Unsupported Gemini action");
}

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
    }

    try {
        const geminiBody = buildGeminiBody(req.body || {});
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(geminiBody)
        });

        if (!response.ok) {
            const detail = await response.text();
            return res.status(response.status).json({ error: "Gemini request failed", detail });
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            return res.status(502).json({ error: "Gemini returned an empty response" });
        }

        return res.status(200).json(JSON.parse(text));
    } catch (error) {
        return res.status(500).json({ error: error.message || "Gemini proxy error" });
    }
};
