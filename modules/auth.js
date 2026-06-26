// authentication module (auth.js)

let authInstance = null;
let firebaseAuth = null;
let currentMockUser = null;
let authCallbacks = [];

// Helper to load Firebase Auth dynamically
async function initFirebaseAuth(config) {
    try {
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
        const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
        const { getFirestore, doc, setDoc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        
        const app = initializeApp(config);
        firebaseAuth = getAuth(app);
        const db = getFirestore(app);

        onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
            if (firebaseUser) {
                // Fetch user role and points from firestore
                try {
                    const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
                    let userData = userDoc.exists() ? userDoc.data() : null;
                    
                    if (!userData) {
                        userData = {
                            uid: firebaseUser.uid,
                            email: firebaseUser.email,
                            displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
                            role: 'citizen',
                            points: 0,
                            badges: ['Civic Beginner'],
                            createdAt: new Date().toISOString()
                        };
                        await setDoc(doc(db, "users", firebaseUser.uid), userData);
                    }
                    
                    notifyAuthChange(userData);
                } catch (e) {
                    console.error("Firestore user fetch error: ", e);
                    notifyAuthChange({
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
                        role: 'citizen',
                        points: 0,
                        badges: ['Civic Beginner']
                    });
                }
            } else {
                notifyAuthChange(null);
            }
        });

        authInstance = {
            login: async (email, password) => {
                const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
                const userDoc = await getDoc(doc(db, "users", credential.user.uid));
                return userDoc.exists() ? userDoc.data() : { uid: credential.user.uid, email: credential.user.email, role: 'citizen' };
            },
            register: async (email, password, displayName, role) => {
                const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
                await updateProfile(credential.user, { displayName });
                
                const userData = {
                    uid: credential.user.uid,
                    email,
                    displayName,
                    role: role || 'citizen',
                    points: 0,
                    badges: ['Civic Beginner'],
                    createdAt: new Date().toISOString()
                };
                
                await setDoc(doc(db, "users", credential.user.uid), userData);
                
                // Add to leaderboard collection in Firestore
                await setDoc(doc(db, "leaderboard", credential.user.uid), {
                    uid: credential.user.uid,
                    displayName,
                    points: 0,
                    badges: ['Civic Beginner']
                });

                return userData;
            },
            logout: async () => {
                await signOut(firebaseAuth);
            },
            updatePoints: async (uid, newPoints, newBadges) => {
                try {
                    await setDoc(doc(db, "users", uid), { points: newPoints, badges: newBadges }, { merge: true });
                    await setDoc(doc(db, "leaderboard", uid), { points: newPoints, badges: newBadges }, { merge: true });
                } catch (e) {
                    console.error("Failed to update points in firestore:", e);
                }
            }
        };
        console.log("Firebase Auth initialized successfully.");
        return true;
    } catch (error) {
        console.error("Failed to initialize Firebase Auth:", error);
        return false;
    }
}

// Initialise mock authentication logic
function initMockAuth() {
    // Get stored mock users
    let mockUsers = JSON.parse(localStorage.getItem('community_hero_users')) || {};
    
    // Check if session has current user
    const savedUser = JSON.parse(localStorage.getItem('community_hero_current_user'));
    if (savedUser) {
        currentMockUser = savedUser;
        // Run callbacks asynchronously
        setTimeout(() => notifyAuthChange(currentMockUser), 100);
    } else {
        setTimeout(() => notifyAuthChange(null), 100);
    }

    authInstance = {
        login: async (email, password) => {
            const user = Object.values(mockUsers).find(u => u.email === email && u.password === password);
            if (!user) {
                throw new Error("Invalid email or password");
            }
            
            const sessionUser = { ...user };
            delete sessionUser.password;
            
            currentMockUser = sessionUser;
            localStorage.setItem('community_hero_current_user', JSON.stringify(sessionUser));
            notifyAuthChange(sessionUser);
            return sessionUser;
        },
        register: async (email, password, displayName, role) => {
            const exists = Object.values(mockUsers).some(u => u.email === email);
            if (exists) {
                throw new Error("Email already registered");
            }
            
            const uid = 'mock_uid_' + Math.random().toString(36).substr(2, 9);
            const newUser = {
                uid,
                email,
                password, // stored simply for mock authentication purposes
                displayName,
                role: role || 'citizen',
                points: 0,
                badges: ['Civic Beginner'],
                createdAt: new Date().toISOString()
            };
            
            mockUsers[uid] = newUser;
            localStorage.setItem('community_hero_users', JSON.stringify(mockUsers));
            
            // Update leaderboard mock
            let leaderboard = JSON.parse(localStorage.getItem('community_hero_leaderboard')) || [];
            leaderboard.push({
                uid,
                displayName,
                points: 0,
                badges: ['Civic Beginner']
            });
            localStorage.setItem('community_hero_leaderboard', JSON.stringify(leaderboard));

            const sessionUser = { ...newUser };
            delete sessionUser.password;
            
            currentMockUser = sessionUser;
            localStorage.setItem('community_hero_current_user', JSON.stringify(sessionUser));
            notifyAuthChange(sessionUser);
            return sessionUser;
        },
        logout: async () => {
            currentMockUser = null;
            localStorage.removeItem('community_hero_current_user');
            notifyAuthChange(null);
        },
        updatePoints: async (uid, newPoints, newBadges) => {
            if (currentMockUser && currentMockUser.uid === uid) {
                currentMockUser.points = newPoints;
                currentMockUser.badges = newBadges;
                localStorage.setItem('community_hero_current_user', JSON.stringify(currentMockUser));
            }
            
            if (mockUsers[uid]) {
                mockUsers[uid].points = newPoints;
                mockUsers[uid].badges = newBadges;
                localStorage.setItem('community_hero_users', JSON.stringify(mockUsers));
            }
            
            let leaderboard = JSON.parse(localStorage.getItem('community_hero_leaderboard')) || [];
            const userIndex = leaderboard.findIndex(u => u.uid === uid);
            if (userIndex !== -1) {
                leaderboard[userIndex].points = newPoints;
                leaderboard[userIndex].badges = newBadges;
            } else {
                leaderboard.push({
                    uid,
                    displayName: currentMockUser ? currentMockUser.displayName : "Hero User",
                    points: newPoints,
                    badges: newBadges
                });
            }
            localStorage.setItem('community_hero_leaderboard', JSON.stringify(leaderboard));
            
            // Re-broadcast
            notifyAuthChange(currentMockUser);
        }
    };
    console.log("Mock Auth initialized successfully.");
    return true;
}

function notifyAuthChange(user) {
    authCallbacks.forEach(cb => cb(user));
}

// Exported wrapper functions
export async function initialize(config) {
    if (config && config.apiKey && config.projectId) {
        const success = await initFirebaseAuth(config);
        if (success) return;
    }
    initMockAuth();
}

export function onAuthStateChangedEvent(callback) {
    authCallbacks.push(callback);
    // Call immediately with current state if initialized
    if (firebaseAuth) {
        // Handled by Firebase onAuthStateChanged
    } else {
        callback(currentMockUser);
    }
}

export async function loginUser(email, password) {
    if (!authInstance) throw new Error("Auth not initialized");
    return authInstance.login(email, password);
}

export async function registerUser(email, password, displayName, role) {
    if (!authInstance) throw new Error("Auth not initialized");
    return authInstance.register(email, password, displayName, role);
}

export async function logoutUser() {
    if (!authInstance) throw new Error("Auth not initialized");
    return authInstance.logout();
}

export async function addPoints(uid, amount) {
    if (!authInstance) throw new Error("Auth not initialized");
    
    // Fetch current profile points
    let currentPoints = 0;
    let badges = ['Civic Beginner'];
    
    if (firebaseAuth) {
        try {
            const { getFirestore, doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            const db = getFirestore();
            const userDoc = await getDoc(doc(db, "users", uid));
            if (userDoc.exists()) {
                currentPoints = userDoc.data().points || 0;
                badges = userDoc.data().badges || ['Civic Beginner'];
            }
        } catch (e) {
            console.error("Failed to read user points from firestore: ", e);
        }
    } else {
        const savedUser = JSON.parse(localStorage.getItem('community_hero_current_user'));
        if (savedUser && savedUser.uid === uid) {
            currentPoints = savedUser.points || 0;
            badges = savedUser.badges || ['Civic Beginner'];
        }
    }
    
    const newPoints = currentPoints + amount;
    
    // Badges thresholds:
    // Civic Champion >= 200
    // Top Reporter >= 100
    // Verifier >= 50
    // Community Hero >= 20
    const newBadges = [...badges];
    if (newPoints >= 20 && !newBadges.includes('Community Hero')) {
        newBadges.push('Community Hero');
    }
    if (newPoints >= 50 && !newBadges.includes('Verifier')) {
        newBadges.push('Verifier');
    }
    if (newPoints >= 100 && !newBadges.includes('Top Reporter')) {
        newBadges.push('Top Reporter');
    }
    if (newPoints >= 200 && !newBadges.includes('Civic Champion')) {
        newBadges.push('Civic Champion');
    }
    
    await authInstance.updatePoints(uid, newPoints, newBadges);
    return { points: newPoints, badges: newBadges };
}
