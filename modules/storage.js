// storage module (storage.js)

// Helper to downscale image for localStorage persistence
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Set reasonable dimensions for a thumbnail
                const MAX_WIDTH = 400;
                const MAX_HEIGHT = 300;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Get compressed base64
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

export async function uploadMedia(file, config) {
    // If Cloudinary is configured
    if (config && config.cloudName && config.uploadPreset) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', config.uploadPreset);

            const url = `https://api.cloudinary.com/v1_1/${config.cloudName}/upload`;
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error("Cloudinary upload request failed");
            }

            const data = await response.json();
            return {
                url: data.secure_url,
                type: data.resource_type // 'image' or 'video'
            };
        } catch (e) {
            console.error("Cloudinary upload failed, falling back to local storage compression:", e);
        }
    }

    // Local Storage Mock Upload Fallback
    const isVideo = file.type.startsWith('video/');
    if (isVideo) {
        // Videos are too large to store in localStorage; return a default video mock or temporary URL
        return {
            url: "https://www.w3schools.com/html/mov_bbb.mp4", // Bunny video as placeholder
            type: "video"
        };
    } else {
        try {
            // Compress and return dataUrl
            const compressedBase64 = await compressImage(file);
            return {
                url: compressedBase64,
                type: "image"
            };
        } catch (error) {
            console.error("Image compression fallback failed:", error);
            // Default fallback image
            return {
                url: "https://images.unsplash.com/photo-1599740831644-67bc0224a56a?auto=format&fit=crop&w=600&q=80",
                type: "image"
            };
        }
    }
}
