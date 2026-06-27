// main application orchestrator (app.js)
import * as Auth from './modules/auth.js';
import * as Db from './modules/db.js';
import * as Storage from './modules/storage.js';
import * as Ai from './modules/ai.js';
import * as Map from './modules/map.js';
import * as Dashboard from './modules/dashboard.js';
import * as Gamification from './modules/gamification.js';

// Global state
let currentUser = null;
let currentConfig = {};
let allIssues = [];
let pickerMapInstance = null;
let pickerMarker = null;
let explorerMapInstance = null;

// Initialise Application
async function initApp() {
    // Load config keys from localStorage
    await loadConfig();

    // Initialize modules
    await Auth.initialize(currentConfig.firebase);
    await Db.initialize(currentConfig.firebase);
    
    // Bind navigation active class on scroll
    window.addEventListener('scroll', () => {
        const nav = document.getElementById('main-nav');
        if (window.scrollY > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    });

    // Listen to Auth state changes
    Auth.onAuthStateChangedEvent(handleAuthStateChanged);

    // Initialise SPA views and forms
    initSPARouting();
    initSettingsForm();
    initAuthForms();
    initReportForm();
    initMapFiltersAndSearch();

    // Default view
    navigateTo('home');
}

// -------------------------------------------------------------
// CONFIGURATION MANAGER
// -------------------------------------------------------------
async function loadConfig() {
    const defaultConfig = {
        firebase: { apiKey: "", authDomain: "", projectId: "", appId: "" },
        cloudinary: { cloudName: "", uploadPreset: "" },
        gemini: { apiKey: "" }
    };

    let deploymentConfig = {};
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            deploymentConfig = await response.json();
        }
    } catch (error) {
        console.warn("Shared deployment config unavailable, using local settings fallback:", error);
    }

    const saved = localStorage.getItem('community_hero_config');
    const localConfig = saved ? JSON.parse(saved) : {};

    currentConfig = {
        firebase: {
            ...defaultConfig.firebase,
            ...(localConfig.firebase || {}),
            ...(deploymentConfig.firebase || {})
        },
        cloudinary: {
            ...defaultConfig.cloudinary,
            ...(localConfig.cloudinary || {}),
            ...(deploymentConfig.cloudinary || {})
        },
        gemini: {
            ...defaultConfig.gemini,
            ...(localConfig.gemini || {})
        }
    };
}

function saveConfig(config) {
    localStorage.setItem('community_hero_config', JSON.stringify(config));
    currentConfig = config;
    alert("Configuration saved! Re-initializing database & authentication...");
    window.location.reload();
}

window.showSettingsModal = () => {
    document.getElementById('cfg-firebase-apiKey').value = currentConfig.firebase?.apiKey || "";
    document.getElementById('cfg-firebase-projectId').value = currentConfig.firebase?.projectId || "";
    document.getElementById('cfg-firebase-appId').value = currentConfig.firebase?.appId || "";
    document.getElementById('cfg-cloudinary-cloudName').value = currentConfig.cloudinary?.cloudName || "";
    document.getElementById('cfg-cloudinary-preset').value = currentConfig.cloudinary?.uploadPreset || "";
    document.getElementById('cfg-gemini-key').value = currentConfig.gemini?.apiKey || "";
    
    document.getElementById('settings-modal').style.display = 'flex';
};

window.closeSettingsModal = () => {
    document.getElementById('settings-modal').style.display = 'none';
};

window.clearSettingsConfig = () => {
    if (confirm("Are you sure you want to delete all custom API keys? This will revert the app to offline mock mode.")) {
        localStorage.removeItem('community_hero_config');
        localStorage.removeItem('community_hero_current_user');
        window.location.reload();
    }
};

function initSettingsForm() {
    const form = document.getElementById('settings-config-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const config = {
            firebase: {
                apiKey: document.getElementById('cfg-firebase-apiKey').value.trim(),
                projectId: document.getElementById('cfg-firebase-projectId').value.trim(),
                appId: document.getElementById('cfg-firebase-appId').value.trim()
            },
            cloudinary: {
                cloudName: document.getElementById('cfg-cloudinary-cloudName').value.trim(),
                uploadPreset: document.getElementById('cfg-cloudinary-preset').value.trim()
            },
            gemini: {
                apiKey: document.getElementById('cfg-gemini-key').value.trim()
            }
        };
        saveConfig(config);
        window.closeSettingsModal();
    });
}

// -------------------------------------------------------------
// SPA ROUTING & NAVIGATION
// -------------------------------------------------------------
const views = ['home', 'map', 'report', 'dashboard', 'leaderboard', 'profile', 'details'];

window.navigateTo = async (viewName) => {
    views.forEach(v => {
        const sec = document.getElementById(`view-${v}`);
        const link = document.getElementById(`nav-${v}`);
        if (sec) sec.classList.remove('active');
        if (link) link.classList.remove('active');
    });

    const activeSec = document.getElementById(`view-${viewName}`);
    const activeLink = document.getElementById(`nav-${viewName}`);
    if (activeSec) activeSec.classList.add('active');
    if (activeLink) activeLink.classList.add('active');

    // Scroll to top on navigation
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Handle view-specific render triggers
    if (viewName === 'map') {
        setTimeout(async () => {
            explorerMapInstance = Map.initMap('map');
            allIssues = await Db.getIssues();
            renderMapMarkers(allIssues);
        }, 100);
    } else if (viewName === 'dashboard') {
        loadDashboardData();
    } else if (viewName === 'leaderboard') {
        loadLeaderboard();
    } else if (viewName === 'profile') {
        loadUserProfile();
    } else if (viewName === 'report') {
        initPickerMap();
    } else if (viewName === 'home') {
        loadHomeData();
    }
};

function initSPARouting() {
    lucide.createIcons();
}

async function loadHomeData() {
    const issues = await Db.getIssues();
    const resolved = issues.filter(i => i.status === 'Resolved').length;
    
    document.getElementById('hero-stat-resolved').textContent = resolved;
    
    // Accumulate total points on leaderboard
    const leaderboard = await Db.getLeaderboard();
    const totalPoints = leaderboard.reduce((acc, user) => acc + (user.points || 0), 0);
    document.getElementById('hero-stat-points').textContent = totalPoints.toLocaleString();
}

// -------------------------------------------------------------
// AUTHENTICATION MANAGEMENT
// -------------------------------------------------------------
function handleAuthStateChanged(user) {
    currentUser = user;
    const loginBtn = document.getElementById('nav-login-btn');
    const profileLink = document.getElementById('nav-profile');
    const profileNavBadge = document.getElementById('nav-user-profile');
    
    if (user) {
        loginBtn.style.display = 'none';
        profileLink.style.display = 'inline-block';
        profileNavBadge.style.display = 'flex';
        
        document.getElementById('nav-user-avatar').textContent = user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U';
        document.getElementById('nav-user-points').textContent = `${user.points || 0} pts`;
    } else {
        loginBtn.style.display = 'inline-block';
        profileLink.style.display = 'none';
        profileNavBadge.style.display = 'none';
    }
    lucide.createIcons();
}

window.showAuthModal = (formType) => {
    document.getElementById('auth-modal').style.display = 'flex';
    window.switchAuthForm(formType);
};

window.closeAuthModal = () => {
    document.getElementById('auth-modal').style.display = 'none';
};

window.switchAuthForm = (formType) => {
    const loginForm = document.getElementById('auth-login-form');
    const signupForm = document.getElementById('auth-signup-form');
    const title = document.getElementById('auth-modal-title');
    
    if (formType === 'login') {
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
        title.textContent = 'Sign In';
    } else {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
        title.textContent = 'Register Account';
    }
};

function initAuthForms() {
    const loginForm = document.getElementById('auth-login-form');
    const signupForm = document.getElementById('auth-signup-form');
    const logoutBtn = document.getElementById('profile-logout-btn');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const pass = document.getElementById('login-password').value;

        try {
            await Auth.loginUser(email, pass);
            window.closeAuthModal();
            loginForm.reset();
        } catch (err) {
            alert("Error: " + err.message);
        }
    });

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const pass = document.getElementById('signup-password').value;
        const role = document.getElementById('signup-role').value;

        try {
            await Auth.registerUser(email, pass, name, role);
            window.closeAuthModal();
            signupForm.reset();
        } catch (err) {
            alert("Error: " + err.message);
        }
    });

    logoutBtn.addEventListener('click', async () => {
        await Auth.logoutUser();
        navigateTo('home');
    });
}

// -------------------------------------------------------------
// REPORT ISSUE VIEW LOGIC
// -------------------------------------------------------------
let isAiAnalyzing = false;
let uploadedFile = null;

function initPickerMap() {
    setTimeout(() => {
        if (pickerMapInstance) {
            pickerMapInstance.off();
            pickerMapInstance.remove();
        }

        // Default: Center of India
        pickerMapInstance = L.map('picker-map').setView([20.5937, 78.9629], 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(pickerMapInstance);

        pickerMapInstance.on('click', (e) => {
            const { lat, lng } = e.latlng;
            updatePickerLocation(lat, lng);
        });
    }, 100);
}

function updatePickerLocation(lat, lng) {
    document.getElementById('issue-location-coords').value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    
    if (pickerMarker) {
        pickerMapInstance.removeLayer(pickerMarker);
    }

    pickerMarker = L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'picker-marker-dot',
            html: `<div style="background-color: var(--primary); width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px var(--primary)"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        })
    }).addTo(pickerMapInstance);
    
    pickerMapInstance.setView([lat, lng], 14);
}

function initReportForm() {
    const fileInput = document.getElementById('issue-media-input');
    const previewBox = document.getElementById('issue-img-preview');
    const aiLoadingBox = document.getElementById('ai-loading-box');
    const mediaZone = document.getElementById('media-drop-zone');
    const uploadStatus = document.getElementById('media-upload-status');
    const fileInfo = document.getElementById('media-file-info');
    
    // GPS auto-locate
    document.getElementById('gps-locate-btn').addEventListener('click', () => {
        if (navigator.geolocation) {
            document.getElementById('issue-location-coords').value = "Detecting GPS coordinates...";
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    Map.showLiveLocation(pickerMapInstance, latitude, longitude);
                    updatePickerLocation(latitude, longitude);
                },
                (err) => {
                    alert("Unable to retrieve GPS coordinates automatically. Please click coordinates directly on the picker map.");
                    document.getElementById('issue-location-coords').value = "";
                }
            );
        } else {
            alert("Geolocation is not supported by your browser.");
        }
    });

    // File Input / Preview handler
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        uploadedFile = file;
        uploadStatus.textContent = "File Selected Successfully!";
        fileInfo.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
        
        // Show local preview immediately
        if (file.type.startsWith('image/')) {
            const previewUrl = URL.createObjectURL(file);
            previewBox.src = previewUrl;
            previewBox.style.display = 'block';

            // Trigger client-side Gemini AI classification
            triggerAiCategorization(file);
        } else {
            previewBox.style.display = 'none';
        }
    });

    // Drag-and-Drop handles
    mediaZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        mediaZone.style.borderColor = 'var(--accent)';
    });

    mediaZone.addEventListener('dragleave', () => {
        mediaZone.style.borderColor = 'rgba(255, 255, 255, 0.12)';
    });

    mediaZone.addEventListener('drop', (e) => {
        e.preventDefault();
        mediaZone.style.borderColor = 'rgba(255, 255, 255, 0.12)';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            // Dispatch change event manually
            const event = new Event('change');
            fileInput.dispatchEvent(event);
        }
    });

    // Text-based AI classification suggestions
    const triggerTextAiAnalysis = async () => {
        if (isAiAnalyzing) return;

        const titleVal = document.getElementById('issue-title').value.trim();
        const descVal = document.getElementById('issue-desc').value.trim();
        const combined = `${titleVal}. ${descVal}`.trim();

        if (combined.length < 8) return;

        const currentCategory = document.getElementById('issue-category').value;
        if (uploadedFile && currentCategory && currentCategory !== 'Other') return;

        aiLoadingBox.style.display = 'flex';
        aiLoadingBox.querySelector('span').textContent = "AI is analyzing description to suggest category...";
        
        try {
            const analysis = await Ai.analyzeIssueText(combined, currentConfig.gemini?.apiKey);
            
            if (analysis.category) {
                document.getElementById('issue-category').value = analysis.category;
            }
            if (analysis.severity) {
                document.getElementById('issue-severity').value = analysis.severity;
            }
            
            // Subtle flash effect on suggestions box
            const suggestions = document.getElementById('ai-suggestions-row');
            suggestions.style.outline = '2px solid var(--accent)';
            setTimeout(() => suggestions.style.outline = 'none', 1000);
        } catch (e) {
            console.error("Text auto-classification failed:", e);
        } finally {
            aiLoadingBox.style.display = 'none';
            aiLoadingBox.querySelector('span').textContent = "Gemini AI is analyzing your image. Auto-categorizing...";
        }
    };

    document.getElementById('issue-title').addEventListener('blur', triggerTextAiAnalysis);
    document.getElementById('issue-desc').addEventListener('blur', triggerTextAiAnalysis);

    // Submit Report Issue Form
    const reportForm = document.getElementById('report-issue-form');
    reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!currentUser) {
            alert("You must be signed in to submit community reports!");
            showAuthModal('login');
            return;
        }

        if (isAiAnalyzing) {
            alert("Please wait while Gemini AI finishes analyzing the photo!");
            return;
        }

        const submitBtn = document.getElementById('submit-report-btn');
        const origBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i data-lucide="loader" class="spin"></i> Uploading & Saving Report...';
        submitBtn.disabled = true;
        lucide.createIcons();

        try {
            const coordsInput = document.getElementById('issue-location-coords').value;
            const parts = coordsInput.split(',').map(n => parseFloat(n.trim()));
            if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
                throw new Error("Invalid location coordinates selected. Please pick a point on the map.");
            }

            // 1. Upload file using storage module
            let mediaUrl = "https://images.unsplash.com/photo-1599740831644-67bc0224a56a?auto=format&fit=crop&w=600&q=80";
            let mediaType = "image";
            
            if (uploadedFile) {
                const res = await Storage.uploadMedia(uploadedFile, currentConfig.cloudinary);
                mediaUrl = res.url;
                mediaType = res.type;
            }

            // 2. Resolve coordinate location name
            let locationName = "Hyperlocal Coordinate Pinned";
            try {
                // Reverse geocoding using OSM Nominatim free API
                const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${parts[0]}&lon=${parts[1]}`;
                const geoRes = await fetch(geoUrl, { headers: { 'Accept-Language': 'en' } });
                if (geoRes.ok) {
                    const geoData = await geoRes.json();
                    locationName = geoData.display_name.split(',').slice(0, 3).join(', ');
                }
            } catch (e) {
                console.error("Nominatim reverse geocode lookup failed: ", e);
            }

            // 3. Assemble issue payload
            const issuePayload = {
                title: document.getElementById('issue-title').value.trim(),
                category: document.getElementById('issue-category').value,
                description: document.getElementById('issue-desc').value.trim(),
                lat: parts[0],
                lng: parts[1],
                locationName,
                severity: document.getElementById('issue-severity').value,
                priority: document.getElementById('issue-severity').value === 'High' || document.getElementById('issue-severity').value === 'Critical' ? 'High' : 'Medium',
                mediaUrl,
                mediaType,
                reporterName: currentUser.displayName,
                reporterId: currentUser.uid
            };

            // 4. Save to DB
            const savedIssue = await Db.addIssue(issuePayload);
            
            // 5. Award Points for report!
            await Gamification.awardPoints(currentUser.uid, 'report');

            // Reset form
            reportForm.reset();
            previewBox.style.display = 'none';
            uploadStatus.textContent = "Drag & drop or tap to upload";
            fileInfo.textContent = "Supports JPEG, PNG, MP4 up to 5MB";
            uploadedFile = null;

            // Re-fetch points
            navigateTo('map');
            
        } catch (err) {
            alert("Failed to submit report: " + err.message);
        } finally {
            submitBtn.innerHTML = origBtnText;
            submitBtn.disabled = false;
            lucide.createIcons();
        }
    });
}

// Client-side image analyzer trigger
async function triggerAiCategorization(file) {
    const aiLoadingBox = document.getElementById('ai-loading-box');
    isAiAnalyzing = true;
    aiLoadingBox.style.display = 'flex';
    
    // Read file as base64
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
        const base64 = reader.result;
        
        try {
            const analysis = await Ai.analyzeIssueImage(
                base64, 
                document.getElementById('issue-title').value || document.getElementById('issue-desc').value || "", 
                currentConfig.gemini?.apiKey,
                file
            );
            
            // Set auto classifications
            if (analysis.category) {
                document.getElementById('issue-category').value = analysis.category;
            }
            if (analysis.severity) {
                document.getElementById('issue-severity').value = analysis.severity;
            }
            if (analysis.summary && !document.getElementById('issue-desc').value) {
                document.getElementById('issue-desc').value = `[AI Auto-Summary]: ${analysis.summary}\n\n`;
            }
            
            // Subtle flash effect on suggestions box
            const suggestions = document.getElementById('ai-suggestions-row');
            suggestions.style.outline = '2px solid var(--accent)';
            setTimeout(() => suggestions.style.outline = 'none', 1000);
            
        } catch (e) {
            console.error("AI Auto-classification failed:", e);
        } finally {
            isAiAnalyzing = false;
            aiLoadingBox.style.display = 'none';
        }
    };
}

// -------------------------------------------------------------
// LIVE MAP FILTERS & GEOLOCATION SEARCH
// -------------------------------------------------------------
function initMapFiltersAndSearch() {
    const searchInput = document.getElementById('map-search-input');
    const filterCat = document.getElementById('filter-category');
    const filterStatus = document.getElementById('filter-status');
    const filterSev = document.getElementById('filter-severity');

    const handleFiltersChange = () => {
        let filtered = [...allIssues];
        
        const cat = filterCat.value;
        const status = filterStatus.value;
        const sev = filterSev.value;

        if (cat !== 'all') filtered = filtered.filter(i => i.category === cat);
        if (status !== 'all') filtered = filtered.filter(i => i.status === status);
        if (sev !== 'all') filtered = filtered.filter(i => i.severity === sev);

        renderMapMarkers(filtered);
    };

    filterCat.addEventListener('change', handleFiltersChange);
    filterStatus.addEventListener('change', handleFiltersChange);
    filterSev.addEventListener('change', handleFiltersChange);

    // Dynamic Nominatim Place Search
    let searchTimeout = null;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        if (query.length < 3) return;

        searchTimeout = setTimeout(async () => {
            const result = await Map.searchLocation(query);
            if (result) {
                Map.setCenter(result.lat, result.lng, 12);
            }
        }, 800);
    });

    // Locate user live location on the explorer map
    const locateBtn = document.getElementById('map-locate-btn');
    if (locateBtn) {
        locateBtn.addEventListener('click', () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const { latitude, longitude } = position.coords;
                        Map.showLiveLocation(explorerMapInstance, latitude, longitude);
                    },
                    (err) => {
                        alert("Unable to retrieve your current location. Please check your browser location permissions.");
                    }
                );
            } else {
                alert("Geolocation is not supported by your browser.");
            }
        });
    }
}

function renderMapMarkers(issuesList) {
    Map.renderIssuesOnMap(issuesList, (issue) => {
        // Handled via window popup trigger callback or standard binding
    });
}

// Global hook for Map details navigation
window.appViewDetails = (issueId) => {
    navigateTo('details');
    loadIssueDetails(issueId);
};

// -------------------------------------------------------------
// ISSUE DETAILS FEED NODE RENDER
// -------------------------------------------------------------
async function loadIssueDetails(id) {
    const root = document.getElementById('details-root');
    root.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 4rem;"><i data-lucide="loader" class="spin"></i> Loading report details...</div>`;
    lucide.createIcons();

    try {
        const issues = await Db.getIssues();
        const issue = issues.find(i => i.id === id);
        if (!issue) {
            root.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--danger); padding: 4rem;">Report node not found!</div>`;
            return;
        }

        const comments = await Db.getComments(id);
        
        // Calculate status badge style class
        let statusClass = 'status-open';
        if (issue.status === 'Verified') statusClass = 'status-verified';
        else if (issue.status === 'In Progress') statusClass = 'status-progress';
        else if (issue.status === 'Resolved') statusClass = 'status-resolved';

        // Check if user has upvoted or verified already
        const hasUpvoted = currentUser ? (issue.upvotedBy || []).includes(currentUser.uid) : false;
        const hasVerified = currentUser ? (issue.verifiedBy || []).includes(currentUser.uid) : false;
        const isAdmin = currentUser?.role === 'admin';

        // Render HTML structure
        root.innerHTML = `
            <!-- Left Side: Media and Location details -->
            <div>
                <img class="details-media" src="${issue.mediaUrl}" alt="${issue.title}">
                <div class="glass" style="padding: 1.5rem; border-radius: var(--radius); margin-top: 1.5rem;">
                    <h4 style="margin-bottom: 0.75rem; color: white;">Incident Geotag</h4>
                    <p style="color: var(--text-muted); font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <i data-lucide="map-pin" style="width: 16px; height: 16px;"></i> ${issue.locationName}
                    </p>
                    <p style="color: var(--text-muted); font-size: 0.8rem;">
                        Coordinates: ${issue.lat.toFixed(5)}, ${issue.lng.toFixed(5)}
                    </p>
                </div>
            </div>

            <!-- Right Side: Details, Actions, Comments -->
            <div>
                <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1rem;">
                    <span class="status-badge ${statusClass}">${issue.status}</span>
                    <span class="status-badge" style="background: rgba(255,255,255,0.06); color: var(--text-muted);">${issue.severity} Severity</span>
                    <span class="status-badge" style="background: rgba(6,182,212,0.12); color: var(--accent);">${issue.category}</span>
                </div>

                <h1 style="font-size: 1.75rem; color: white; margin-bottom: 1rem;">${issue.title}</h1>
                <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 1.5rem; line-height: 1.7;">${issue.description}</p>
                
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 2rem;">
                    Reported by: <strong>${issue.reporterName}</strong> &bull; ${new Date(issue.createdAt).toLocaleString()}
                </div>

                <!-- Admin Resolution Drawer -->
                ${isAdmin ? `
                <div class="glass" style="padding: 1.5rem; border-radius: var(--radius); border-color: rgba(245,158,11,0.2); margin-bottom: 2rem;">
                    <h4 style="color: var(--warning); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
                        <i data-lucide="shield-alert"></i> Ward Administrative Operations
                    </h4>
                    <label style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 0.5rem;">Update Report Incident Status</label>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn btn-outline btn-sm" onclick="window.adminSetStatus('${issue.id}', 'Open')">Open</button>
                        <button class="btn btn-outline btn-sm" onclick="window.adminSetStatus('${issue.id}', 'Verified')">Verified</button>
                        <button class="btn btn-outline btn-sm" onclick="window.adminSetStatus('${issue.id}', 'In Progress')">In Progress</button>
                        <button class="btn btn-success btn-sm" onclick="window.adminSetStatus('${issue.id}', 'Resolved')">Mark Resolved</button>
                    </div>
                </div>
                ` : ''}

                <!-- Community Verification Bar -->
                <div style="display: flex; gap: 1rem; margin-bottom: 2.5rem; flex-wrap: wrap;">
                    <button class="btn btn-outline" style="flex: 1;" onclick="window.detailsUpvote('${issue.id}')" ${hasUpvoted ? 'disabled' : ''}>
                        <i data-lucide="thumbs-up"></i> ${hasUpvoted ? 'Upvoted!' : `Upvote (${issue.upvotes || 0})`}
                    </button>
                    <button class="btn ${hasVerified ? 'btn-success' : 'btn-outline'}" style="flex: 1;" onclick="window.detailsVerify('${issue.id}')" ${hasVerified ? 'disabled' : ''}>
                        <i data-lucide="shield-check"></i> ${hasVerified ? 'Verified' : `Verify (${issue.verifiedCount || 0}/3)`}
                    </button>
                    
                    <button class="btn btn-outline" style="flex: 1;" onclick="window.detailsReportDuplicate('${issue.id}')">
                        <i data-lucide="copy"></i> Duplicate
                    </button>
                </div>

                <!-- Comments Box -->
                <div class="comments-box">
                    <h3 style="margin-bottom: 1rem; font-size: 1.15rem; color: white;">
                        Comments & Evidences (${comments.length})
                    </h3>
                    
                    <div class="comment-list" id="details-comment-list">
                        ${comments.map(c => `
                            <div class="comment-item">
                                <div class="comment-meta">
                                    <strong>${c.userName}</strong>
                                    <span>${new Date(c.createdAt).toLocaleDateString()}</span>
                                </div>
                                <p style="font-size: 0.85rem; color: var(--text);">${c.comment}</p>
                            </div>
                        `).join('')}
                        ${comments.length === 0 ? '<p style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem 0;">No comments yet. Provide evidence or updates!</p>' : ''}
                    </div>

                    <!-- Comment Input Form -->
                    <form id="comment-post-form" style="display: flex; gap: 0.5rem;">
                        <input type="text" id="new-comment-text" placeholder="Add additional evidence or comment..." required>
                        <button type="submit" class="btn btn-primary" style="padding: 0 1.5rem;">Post</button>
                    </form>
                </div>
            </div>
        `;
        lucide.createIcons();

        // Bind comment submit action
        const commentForm = document.getElementById('comment-post-form');
        commentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser) {
                alert("Please log in to add comments!");
                showAuthModal('login');
                return;
            }

            const commentInput = document.getElementById('new-comment-text');
            const commentText = commentInput.value.trim();
            if (!commentText) return;

            try {
                await Db.addComment(issue.id, {
                    userId: currentUser.uid,
                    userName: currentUser.displayName,
                    comment: commentText
                });

                // Award Gamification Points for comment! (+2)
                await Gamification.awardPoints(currentUser.uid, 'comment');
                
                commentInput.value = '';
                // Reload details view comments
                loadIssueDetails(issue.id);
            } catch (err) {
                alert("Failed to add comment: " + err.message);
            }
        });

    } catch (e) {
        root.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--danger); padding: 4rem;">Error: ${e.message}</div>`;
    }
}

// Global details button triggers
window.detailsUpvote = async (issueId) => {
    if (!currentUser) {
        alert("You must be logged in to upvote reports!");
        showAuthModal('login');
        return;
    }

    try {
        const success = await Db.upvoteIssue(issueId, currentUser.uid);
        if (success) {
            loadIssueDetails(issueId);
        } else {
            alert("You have already upvoted this report!");
        }
    } catch (e) {
        console.error(e);
    }
};

window.detailsVerify = async (issueId) => {
    if (!currentUser) {
        alert("You must be logged in to verify reports!");
        showAuthModal('login');
        return;
    }

    try {
        const success = await Db.verifyIssue(issueId, currentUser.uid);
        if (success) {
            // Award Gamification Points for verifying! (+5)
            await Gamification.awardPoints(currentUser.uid, 'verify');
            loadIssueDetails(issueId);
        } else {
            alert("You have already verified this report!");
        }
    } catch (e) {
        console.error(e);
    }
};

window.detailsReportDuplicate = async (issueId) => {
    const targetId = prompt("Enter the ID of the master issue this report duplicates (e.g. issue_seed_1):");
    if (!targetId) return;

    try {
        await Db.reportDuplicate(issueId, targetId);
        alert("Report marked as duplicate of " + targetId + " and marked resolved.");
        loadIssueDetails(issueId);
    } catch (e) {
        alert("Failed to mark duplicate: " + e.message);
    }
};

window.adminSetStatus = async (issueId, newStatus) => {
    try {
        await Db.updateIssueStatus(issueId, newStatus);
        loadIssueDetails(issueId);
    } catch (e) {
        alert("Failed to update status: " + e.message);
    }
};

// -------------------------------------------------------------
// ANALYTICS & DASHBOARD CHARTS & INSIGHTS
// -------------------------------------------------------------
async function loadDashboardData() {
    const issues = await Db.getIssues();
    const stats = Dashboard.computeStats(issues);

    document.getElementById('dash-total-issues').textContent = stats.total;
    document.getElementById('dash-open-issues').textContent = stats.open;
    document.getElementById('dash-resolved-issues').textContent = stats.resolved;
    document.getElementById('dash-avg-time').textContent = stats.avgResolutionTime;

    // Render ChartJS graphs
    const canvasElements = {
        categoryCanvas: document.getElementById('chart-categories'),
        monthlyCanvas: document.getElementById('chart-trends'),
        statusCanvas: document.getElementById('chart-status')
    };

    Dashboard.renderCharts(canvasElements, issues);

    // Call Gemini AI Predictive insights
    loadAIPredictiveInsights(issues);
}

async function loadAIPredictiveInsights(issues) {
    const container = document.getElementById('insights-container');
    container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem;">
            <i data-lucide="loader" class="spin" style="margin-bottom: 0.5rem;"></i>
            <p>Gemini is scanning database trends & compiling report forecast...</p>
        </div>
    `;
    lucide.createIcons();

    try {
        const insights = await Ai.generatePredictiveInsights(issues, currentConfig.gemini?.apiKey);
        
        container.innerHTML = `
            <!-- Hotspots -->
            <div class="insight-block">
                <div class="insight-bullet">📍</div>
                <div class="insight-text">
                    <h4>Community Hotspots</h4>
                    <ul>
                        ${insights.hotspots.map(h => `<li>${h}</li>`).join('')}
                    </ul>
                </div>
            </div>

            <!-- Problem Trends -->
            <div class="insight-block">
                <div class="insight-bullet">📈</div>
                <div class="insight-text">
                    <h4>Problem Trends</h4>
                    <ul>
                        ${insights.trends.map(t => `<li>${t}</li>`).join('')}
                    </ul>
                </div>
            </div>

            <!-- Future Predictions -->
            <div class="insight-block">
                <div class="insight-bullet">🔮</div>
                <div class="insight-text">
                    <h4>Future Issue Predictions</h4>
                    <ul>
                        ${insights.predictions.map(p => `<li>${p}</li>`).join('')}
                    </ul>
                </div>
            </div>

            <!-- Recommendations -->
            <div class="insight-block">
                <div class="insight-bullet">💡</div>
                <div class="insight-text">
                    <h4>Resolution Recommendations</h4>
                    <ul>
                        ${insights.recommendations.map(r => `<li>${r}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
        
    } catch (e) {
        container.innerHTML = `<div style="grid-column: 1 / -1; color: var(--danger); text-align: center; padding: 2rem;">Failed to load AI Insights: ${e.message}</div>`;
    }
    lucide.createIcons();
}

// -------------------------------------------------------------
// LEADERBOARD RENDER
// -------------------------------------------------------------
async function loadLeaderboard() {
    try {
        const list = await Db.getLeaderboard();
        Gamification.renderLeaderboardRows(
            '#leaderboard-table-body', 
            list, 
            currentUser ? currentUser.uid : null
        );
    } catch (e) {
        console.error("Leaderboard load failed:", e);
    }
}

// -------------------------------------------------------------
// USER PROFILE RENDER
// -------------------------------------------------------------
async function loadUserProfile() {
    if (!currentUser) return;

    // Load profile header details
    document.getElementById('profile-avatar').textContent = currentUser.displayName.charAt(0).toUpperCase();
    document.getElementById('profile-name').textContent = currentUser.displayName;
    document.getElementById('profile-email').textContent = currentUser.email;
    
    const roleTag = document.getElementById('profile-role');
    roleTag.textContent = currentUser.role === 'admin' ? 'Ward Admin' : 'Citizen';
    if (currentUser.role === 'admin') {
        roleTag.classList.add('admin');
    } else {
        roleTag.classList.remove('admin');
    }

    // Load profile points
    document.getElementById('profile-metric-points').textContent = currentUser.points || 0;

    // Render badges list
    const badgesBox = document.getElementById('profile-badges');
    badgesBox.innerHTML = (currentUser.badges || []).map(b => Gamification.getBadgeHtml(b)).join('');

    // Fetch and filter user's reports list
    const reportsContainer = document.getElementById('profile-reports-container');
    reportsContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 3rem;"><i data-lucide="loader" class="spin"></i> Loading your reports...</div>`;
    lucide.createIcons();

    try {
        const issues = await Db.getIssues();
        const userIssues = issues.filter(i => i.reporterId === currentUser.uid);
        
        document.getElementById('profile-metric-reports').textContent = userIssues.length;

        // Calculate upvotes given (approximate based on mock issues where uid is listed in upvotedBy)
        const upvotesGiven = issues.filter(i => (i.upvotedBy || []).includes(currentUser.uid)).length;
        document.getElementById('profile-metric-votes').textContent = upvotesGiven;

        reportsContainer.innerHTML = '';
        if (userIssues.length === 0) {
            reportsContainer.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); padding: 3rem; background: rgba(255,255,255,0.02); border-radius: var(--radius); border: 1px dashed rgba(255,255,255,0.08);">
                    <p style="margin-bottom: 1rem;">You haven't submitted any reports yet!</p>
                    <button class="btn btn-primary btn-sm" onclick="window.navigateTo('report')">Report An Issue</button>
                </div>
            `;
            return;
        }

        userIssues.forEach(issue => {
            const card = document.createElement('div');
            card.className = 'feed-item-card glass';

            let statusClass = 'status-open';
            if (issue.status === 'Verified') statusClass = 'status-verified';
            else if (issue.status === 'In Progress') statusClass = 'status-progress';
            else if (issue.status === 'Resolved') statusClass = 'status-resolved';

            card.innerHTML = `
                <img class="feed-item-img" src="${issue.mediaUrl}" alt="${issue.title}">
                <div>
                    <div class="feed-meta-row">
                        <span class="status-badge ${statusClass}">${issue.status}</span>
                        <span class="status-badge" style="background: rgba(255,255,255,0.06); color: var(--text-muted);">${issue.severity}</span>
                        <span class="status-badge" style="background: rgba(6,182,212,0.12); color: var(--accent);">${issue.category}</span>
                    </div>
                    <h4 class="feed-title" onclick="window.appViewDetails('${issue.id}')">${issue.title}</h4>
                    <p class="feed-desc">${issue.description}</p>
                    <div class="feed-action-bar">
                        <span style="font-size: 0.8rem; color: var(--text-muted);">${new Date(issue.createdAt).toLocaleDateString()} &bull; ${issue.locationName}</span>
                        <button class="btn btn-outline btn-sm" onclick="window.appViewDetails('${issue.id}')">View Details &rarr;</button>
                    </div>
                </div>
            `;
            reportsContainer.appendChild(card);
        });
        lucide.createIcons();

    } catch (e) {
        reportsContainer.innerHTML = `<div style="color: var(--danger); text-align: center; padding: 2rem;">Error: ${e.message}</div>`;
    }
}

// Start application
initApp();
