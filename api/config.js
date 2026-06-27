module.exports = async (req, res) => {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    return res.status(200).json({
        firebase: {
            apiKey: process.env.FIREBASE_API_KEY || "",
            authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
            projectId: process.env.FIREBASE_PROJECT_ID || "",
            appId: process.env.FIREBASE_APP_ID || ""
        },
        cloudinary: {
            cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
            uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || ""
        }
    });
};
