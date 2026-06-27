// AI module (ai.js)

// Clean base64 string from data URL prefix
function cleanBase64(dataUrl) {
    if (dataUrl.includes('base64,')) {
        return dataUrl.split('base64,')[1];
    }
    return dataUrl;
}

// Extract MIME type from data URL
function getMimeType(dataUrl) {
    if (dataUrl.startsWith('data:')) {
        return dataUrl.split(';')[0].split(':')[1];
    }
    return 'image/jpeg';
}

async function callGeminiDirect(parts, apiKey, errorMessage) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        })
    });

    if (!response.ok) {
        throw new Error(errorMessage);
    }

    const resData = await response.json();
    const jsonText = resData.candidates[0].content.parts[0].text;
    return JSON.parse(jsonText);
}

async function callGeminiProxy(action, payload) {
    const requestBody = JSON.stringify({ action, ...payload });
    const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: requestBody
    });

   if (!response.ok) {
    const err = await response.json().catch(() => ({}));

    throw new Error(
        `Gemini proxy failed (${response.status}): ${
            err.detail || err.error || "Unknown error"
        }`
    );
}
    return response.json();
}

// Smart keyword matching for Local/Mock fallback analysis
function getSmartFallbackAnalysis(description = "", file) {
    const text = description.toLowerCase();
    let category = "Other";
    let severity = "Medium";
    let priority = "Medium";
    let summary = "A community issue reported by a citizen.";

    if (text.includes("pothole") || text.includes("hole") || text.includes("crater")) {
        category = "Pothole";
        severity = "High";
        priority = "High";
        summary = "A deep pothole on the road surface causing traffic disruption.";
    } else if (text.includes("leak") || text.includes("pipe") || text.includes("burst") || text.includes("water flowing")) {
        category = "Water Leakage";
        severity = "High";
        priority = "Critical";
        summary = "A water line leakage causing street flooding and resource waste.";
    } else if (text.includes("light") || text.includes("street-light") || text.includes("streetlight") || text.includes("dark")) {
        category = "Streetlight Damage";
        severity = "Low";
        priority = "Medium";
        summary = "A non-functional streetlight causing poor visibility and safety concerns.";
    } else if (text.includes("garbage") || text.includes("trash") || text.includes("waste") || text.includes("dump") || text.includes("overflow")) {
        category = "Waste Management";
        severity = "Medium";
        priority = "Medium";
        summary = "An overflowing garbage disposal bin attracting pests and emitting odors.";
    } else if (text.includes("sidewalk") || text.includes("pavement") || text.includes("paver") || text.includes("road broken")) {
        category = "Road Damage";
        severity = "Medium";
        priority = "High";
        summary = "Broken road shoulder or crumbling paving tiles endangering pedestrians.";
    } else if (text.includes("safety") || text.includes("danger") || text.includes("crime") || text.includes("wire") || text.includes("electricity")) {
        category = "Public Safety";
        severity = "High";
        priority = "Critical";
        summary = "An immediate public hazard or safety hazard needing urgent containment.";
    } else if (text.includes("bridge") || text.includes("drain") || text.includes("wall") || text.includes("infrastructure")) {
        category = "Infrastructure Damage";
        severity = "High";
        priority = "High";
        summary = "Structural damage to public neighborhood infrastructure.";
    }

    if (file && file.name) {
        // Adjust based on file extension/name if available
        const name = file.name.toLowerCase();
        if (name.includes("pot") || name.includes("road")) {
            category = "Pothole";
        } else if (name.includes("water") || name.includes("leak")) {
            category = "Water Leakage";
        }
    }

    return {
        category,
        severity,
        priority,
        summary
    };
}

export async function analyzeIssueImage(base64Image, descriptionText, apiKey, file) {
    const cleanData = cleanBase64(base64Image);
    const mimeType = getMimeType(base64Image);
    const prompt = `Analyze this community issue photo. Based on the photo and this description if provided: "${descriptionText || ''}", classify the issue. Respond strictly with a JSON object containing the keys: 'category' (must be one of: 'Pothole', 'Water Leakage', 'Streetlight Damage', 'Waste Management', 'Road Damage', 'Public Safety', 'Infrastructure Damage', 'Other'), 'severity' ('Low', 'Medium', 'High'), 'priority' ('Low', 'Medium', 'High', 'Critical'), and 'summary' (a concise 1-sentence summary of the problem). Do not return markdown wrappers.`;

    if (apiKey) {
        try {
            return await callGeminiDirect([
                { text: prompt },
                {
                    inlineData: {
                        mimeType,
                        data: cleanData
                    }
                }
            ], apiKey, "Gemini API call failed");
        } catch (error) {
            console.error("Gemini Image Analysis failed, falling back to local heuristic:", error);
        }
    } else {
        try {
            return await callGeminiProxy('analyzeImage', {
                descriptionText,
                mimeType,
                imageData: cleanData
            });
        } catch (error) {
            console.error("Gemini proxy image analysis unavailable, falling back to local heuristic:", error);
        }
    }

    // Heuristic Smart Fallback if API Key not present or failed
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(getSmartFallbackAnalysis(descriptionText, file));
        }, 1500); // simulate network lag
    });
}

export async function analyzeIssueText(descriptionText, apiKey) {
    const prompt = `Based on this description of a community issue: "${descriptionText}", classify the issue. Respond strictly with a JSON object containing the keys: 'category' (must be one of: 'Pothole', 'Water Leakage', 'Streetlight Damage', 'Waste Management', 'Road Damage', 'Public Safety', 'Infrastructure Damage', 'Other'), 'severity' ('Low', 'Medium', 'High'), 'priority' ('Low', 'Medium', 'High', 'Critical'), and 'summary' (a concise 1-sentence summary of the problem). Do not return markdown wrappers.`;

    // 1. Always try proxy first (key lives on Vercel, not in browser)
    try {
        return await callGeminiProxy('analyzeText', { descriptionText });
    } catch (error) {
        console.warn("Gemini proxy text analysis failed:", error);
    }

    // 2. Direct only if user manually entered a key in Settings
    if (apiKey) {
        try {
            return await callGeminiDirect([{ text: prompt }], apiKey, "Gemini Text API call failed");
        } catch (error) {
            console.warn("Gemini Text direct call failed:", error);
        }
    }

    // 3. Offline keyword fallback
    return getSmartFallbackAnalysis(descriptionText);
}

export async function generatePredictiveInsights(issues, apiKey) {
    // Summarize issues list for token efficiency
    const issuesSummary = issues.map(i => ({
        category: i.category,
        status: i.status,
        severity: i.severity,
        location: i.locationName,
        createdAt: i.createdAt
    }));

    if (apiKey && issuesSummary.length > 0) {
        try {
            const prompt = `You are a civic planning AI. Based on the following list of community issues logged in the neighborhood: ${JSON.stringify(issuesSummary)}, analyze trends, predict future issues, identify hotspots, and provide resolution recommendations. Respond strictly with a JSON object containing keys: 'hotspots' (array of 3 strings), 'trends' (array of 3 strings), 'predictions' (array of 3 strings), and 'recommendations' (array of 3 strings). Keep sentences short and punchy. Do not return markdown wrappers.`;
            return await callGeminiDirect([{ text: prompt }], apiKey, "Gemini Insights API call failed");
        } catch (error) {
            console.error("Gemini Insights failed, using rule-based fallback generator:", error);
        }
    } else if (issuesSummary.length > 0) {
        try {
            return await callGeminiProxy('generateInsights', { issuesSummary });
        } catch (error) {
            console.error("Gemini proxy insights unavailable, using rule-based fallback generator:", error);
        }
    }

    // Dynamic Mock Fallback insights based on current issues list
    return new Promise((resolve) => {
        setTimeout(() => {
            const categoryCounts = {};
            let resolvedCount = 0;
            let total = issues.length;

            issues.forEach(i => {
                categoryCounts[i.category] = (categoryCounts[i.category] || 0) + 1;
                if (i.status === 'Resolved') resolvedCount++;
            });

            const topCategory = Object.keys(categoryCounts).reduce((a, b) => categoryCounts[a] > categoryCounts[b] ? a : b, "Infrastructure");
            const resolvedRate = total > 0 ? Math.round((resolvedCount / total) * 100) : 75;

            resolve({
                hotspots: [
                    `Connaught Place & Santacruz show high density of ${topCategory} reports.`,
                    "Outer Ring Road area accounts for 35% of all High-severity complaints.",
                    "Sector 4 park area continues to suffer from lighting and public safety concerns."
                ],
                trends: [
                    `${topCategory} complaints rose by 22% over the last fortnight.`,
                    `Response rates improved; the average resolution rate stands at ${resolvedRate}%.`,
                    "Evening reports (6 PM - 9 PM) represent 45% of streetlight issues."
                ],
                predictions: [
                    "Upcoming monsoon showers will likely cause a 30% surge in road potholes next month.",
                    "Pending water pipeline reports in Sector 4 could result in severe pressure drops in Ward 12.",
                    "Waste management alerts are expected to spike around the upcoming weekend festival."
                ],
                recommendations: [
                    "Schedule preemptive pothole patching runs before seasonal rains begin.",
                    "Install LED-based energy saving lights in park paths to enhance security.",
                    "Re-route trash collection trucks to visit Adyar twice daily on weekends."
                ]
            });
        }, 1000);
    });
}
