// database module (db.js)

let dbInstance = null;
let firebaseApp = null;
let firestoreDb = null;

// Seed data to initialize Mock Database with realistic data
const initialMockIssues = [
    {
        id: "issue_seed_1",
        title: "Severe Pothole on Outer Ring Road",
        category: "Pothole",
        description: "A major pothole has formed in the middle lane of the Outer Ring Road. It is causing sudden braking and poses a significant risk to motorcyclists, especially at night.",
        lat: 19.0760,
        lng: 72.8777,
        locationName: "Santacruz, Mumbai",
        severity: "High",
        priority: "Critical",
        status: "Open",
        mediaUrl: "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80",
        mediaType: "image",
        reporterName: "Rajesh V.",
        reporterId: "mock_uid_rajesh",
        upvotes: 14,
        upvotedBy: ["mock_uid_priya", "mock_uid_rahul"],
        verifiedCount: 2,
        verifiedBy: ["mock_uid_priya"],
        commentsCount: 3,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        resolvedAt: null
    },
    {
        id: "issue_seed_2",
        title: "Major Water Main Pipe Leakage",
        category: "Water Leakage",
        description: "Clean drinking water is bursting out of a main joint and flooding the road. Thousands of liters are being wasted. Reported to municipal line but no response yet.",
        lat: 28.6139,
        lng: 77.2090,
        locationName: "Connaught Place, New Delhi",
        severity: "Medium",
        priority: "High",
        status: "Verified",
        mediaUrl: "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=600&q=80",
        mediaType: "image",
        reporterName: "Amit S.",
        reporterId: "mock_uid_amit",
        upvotes: 8,
        upvotedBy: ["mock_uid_rajesh"],
        verifiedCount: 5,
        verifiedBy: ["mock_uid_rajesh", "mock_uid_rahul"],
        commentsCount: 1,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        resolvedAt: null
    },
    {
        id: "issue_seed_3",
        title: "Broken Streetlight Near Public Park",
        category: "Streetlight Damage",
        description: "Entire stretch of the road next to Sector 4 park is pitch dark due to a malfunctioning streetlight. Ladies and children feel unsafe walking in this area after 7 PM.",
        lat: 12.9716,
        lng: 77.5946,
        locationName: "Indiranagar, Bengaluru",
        severity: "Low",
        priority: "Medium",
        status: "In Progress",
        mediaUrl: "https://images.unsplash.com/photo-1508849789987-4e5333c12b78?auto=format&fit=crop&w=600&q=80",
        mediaType: "image",
        reporterName: "Priya K.",
        reporterId: "mock_uid_priya",
        upvotes: 19,
        upvotedBy: ["mock_uid_amit", "mock_uid_rajesh"],
        verifiedCount: 7,
        verifiedBy: ["mock_uid_amit", "mock_uid_rajesh", "mock_uid_rahul"],
        commentsCount: 4,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        resolvedAt: null
    },
    {
        id: "issue_seed_4",
        title: "Overflowing Garbage Dumpster",
        category: "Waste Management",
        description: "The community garbage bin hasn't been cleared for over a week. Stray dogs are scattering waste across the street, creating a severe health hazard and foul smell.",
        lat: 13.0827,
        lng: 80.2707,
        locationName: "Adyar, Chennai",
        severity: "High",
        priority: "High",
        status: "Resolved",
        mediaUrl: "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80",
        mediaType: "image",
        reporterName: "Rahul M.",
        reporterId: "mock_uid_rahul",
        upvotes: 25,
        upvotedBy: ["mock_uid_amit", "mock_uid_priya"],
        verifiedCount: 12,
        verifiedBy: ["mock_uid_amit", "mock_uid_priya"],
        commentsCount: 2,
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        resolvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() // resolved 1 day ago
    },
    {
        id: "issue_seed_5",
        title: "Crumbling Sidewalk Paver Blocks",
        category: "Road Damage",
        description: "Walkway tiles are broken and sticking out. A senior citizen fell last evening and got injured. Requires immediate relaying of the pavement tiles.",
        lat: 22.5726,
        lng: 88.3639,
        locationName: "Salt Lake, Kolkata",
        severity: "Medium",
        priority: "Medium",
        status: "Open",
        mediaUrl: "https://images.unsplash.com/photo-1599740831644-67bc0224a56a?auto=format&fit=crop&w=600&q=80",
        mediaType: "image",
        reporterName: "Siddharth S.",
        reporterId: "mock_uid_sid",
        upvotes: 5,
        upvotedBy: ["mock_uid_rahul"],
        verifiedCount: 1,
        verifiedBy: [],
        commentsCount: 0,
        createdAt: new Date().toISOString(),
        resolvedAt: null
    }
];

const initialMockComments = {
    "issue_seed_1": [
        { id: "c1", userId: "mock_uid_priya", userName: "Priya K.", comment: "Agreed, I ride my scooter past this point daily, it is extremely dangerous when it rains.", createdAt: new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000).toISOString() },
        { id: "c2", userId: "mock_uid_rahul", userName: "Rahul M.", comment: "I've uploaded an extra close-up picture of the pothole structure for references.", createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
        { id: "c3", userId: "mock_uid_admin", userName: "Admin (Ward 12)", comment: "This report has been forwarded to the road engineering team for immediate patching.", createdAt: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000).toISOString() }
    ],
    "issue_seed_2": [
        { id: "c4", userId: "mock_uid_rajesh", userName: "Rajesh V.", comment: "The water pressure is dropping in our block. This must be the main reason.", createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() }
    ],
    "issue_seed_3": [
        { id: "c5", userId: "mock_uid_amit", userName: "Amit S.", comment: "It makes walking near the park after dark very scary. Hope they replace the bulb soon.", createdAt: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000).toISOString() }
    ],
    "issue_seed_4": [
        { id: "c6", userId: "mock_uid_priya", userName: "Priya K.", comment: "Good news, the municipal garbage truck arrived this morning and cleared the dump. The area looks much cleaner now!", createdAt: new Date(Date.now() - 1.2 * 24 * 60 * 60 * 1000).toISOString() }
    ]
};

const initialLeaderboard = [
    { uid: "mock_uid_rajesh", displayName: "Rajesh V.", points: 155, badges: ["Community Hero", "Verifier"] },
    { uid: "mock_uid_priya", displayName: "Priya K.", points: 140, badges: ["Community Hero", "Verifier", "Top Reporter"] },
    { uid: "mock_uid_rahul", displayName: "Rahul M.", points: 125, badges: ["Community Hero", "Top Reporter"] },
    { uid: "mock_uid_amit", displayName: "Amit S.", points: 90, badges: ["Community Hero"] },
    { uid: "mock_uid_sid", displayName: "Siddharth S.", points: 30, badges: ["Civic Beginner"] }
];

// Helper to check and load dynamic Firestore module
async function initFirestore(config) {
    try {
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
        const { getFirestore, collection, addDoc, getDocs, doc, updateDoc, setDoc, getDoc, arrayUnion, query, orderBy } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        
        firebaseApp = initializeApp(config);
        firestoreDb = getFirestore(firebaseApp);

        dbInstance = {
            addIssue: async (issue) => {
                const issueRef = collection(firestoreDb, "issues");
                const docRef = await addDoc(issueRef, {
                    ...issue,
                    upvotes: 0,
                    upvotedBy: [],
                    verifiedCount: 0,
                    verifiedBy: [],
                    commentsCount: 0,
                    createdAt: new Date().toISOString(),
                    resolvedAt: null
                });
                return { id: docRef.id, ...issue };
            },
            getIssues: async () => {
                const q = query(collection(firestoreDb, "issues"), orderBy("createdAt", "desc"));
                const querySnapshot = await getDocs(q);
                let list = [];
                querySnapshot.forEach(doc => {
                    list.push({ id: doc.id, ...doc.data() });
                });
                return list;
            },
            updateIssueStatus: async (id, status) => {
                const issueRef = doc(firestoreDb, "issues", id);
                const updateData = { status };
                if (status === 'Resolved') {
                    updateData.resolvedAt = new Date().toISOString();
                }
                await updateDoc(issueRef, updateData);
            },
            upvoteIssue: async (id, userId) => {
                const issueRef = doc(firestoreDb, "issues", id);
                const issueSnap = await getDoc(issueRef);
                if (issueSnap.exists()) {
                    const data = issueSnap.data();
                    const upvotedBy = data.upvotedBy || [];
                    if (!upvotedBy.includes(userId)) {
                        await updateDoc(issueRef, {
                            upvotes: (data.upvotes || 0) + 1,
                            upvotedBy: arrayUnion(userId)
                        });
                        return true;
                    }
                }
                return false;
            },
            verifyIssue: async (id, userId) => {
                const issueRef = doc(firestoreDb, "issues", id);
                const issueSnap = await getDoc(issueRef);
                if (issueSnap.exists()) {
                    const data = issueSnap.data();
                    const verifiedBy = data.verifiedBy || [];
                    if (!verifiedBy.includes(userId)) {
                        const newVerifiedBy = [...verifiedBy, userId];
                        const newVerifiedCount = newVerifiedBy.length;
                        
                        let newStatus = data.status;
                        if (newStatus === "Open" && newVerifiedCount >= 3) {
                            newStatus = "Verified";
                        }
                        
                        await updateDoc(issueRef, {
                            verifiedCount: newVerifiedCount,
                            verifiedBy: arrayUnion(userId),
                            status: newStatus
                        });
                        return true;
                    }
                }
                return false;
            },
            addComment: async (issueId, commentData) => {
                const commentsRef = collection(firestoreDb, "comments");
                await addDoc(commentsRef, {
                    issueId,
                    ...commentData,
                    createdAt: new Date().toISOString()
                });
                
                // Increment commentsCount in issue doc
                const issueRef = doc(firestoreDb, "issues", issueId);
                const issueSnap = await getDoc(issueRef);
                if (issueSnap.exists()) {
                    await updateDoc(issueRef, {
                        commentsCount: (issueSnap.data().commentsCount || 0) + 1
                    });
                }
            },
            getComments: async (issueId) => {
                const querySnapshot = await getDocs(collection(firestoreDb, "comments"));
                let list = [];
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.issueId === issueId) {
                        list.push({ id: doc.id, ...data });
                    }
                });
                return list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            },
            reportDuplicate: async (id, targetId) => {
                const issueRef = doc(firestoreDb, "issues", id);
                await updateDoc(issueRef, {
                    status: "Resolved",
                    isDuplicate: true,
                    duplicateOf: targetId,
                    resolvedAt: new Date().toISOString()
                });
            },
            getLeaderboard: async () => {
                const querySnapshot = await getDocs(collection(firestoreDb, "leaderboard"));
                let list = [];
                querySnapshot.forEach(doc => {
                    list.push({ id: doc.id, ...doc.data() });
                });
                return list.sort((a, b) => b.points - a.points);
            }
        };
        console.log("Firestore database operations bound.");
        return true;
    } catch (e) {
        console.error("Firestore database init error:", e);
        return false;
    }
}

// Initialise LocalStorage mock database logic
function initMockDb() {
    // Populate seeds if database doesn't exist
    if (!localStorage.getItem('community_hero_issues')) {
        localStorage.setItem('community_hero_issues', JSON.stringify(initialMockIssues));
    }
    if (!localStorage.getItem('community_hero_comments')) {
        localStorage.setItem('community_hero_comments', JSON.stringify(initialMockComments));
    }
    if (!localStorage.getItem('community_hero_leaderboard')) {
        localStorage.setItem('community_hero_leaderboard', JSON.stringify(initialLeaderboard));
    }

    dbInstance = {
        addIssue: async (issue) => {
            const issues = JSON.parse(localStorage.getItem('community_hero_issues')) || [];
            const newIssue = {
                id: 'issue_' + Math.random().toString(36).substr(2, 9),
                upvotes: 0,
                upvotedBy: [],
                verifiedCount: 0,
                verifiedBy: [],
                commentsCount: 0,
                createdAt: new Date().toISOString(),
                resolvedAt: null,
                ...issue
            };
            issues.unshift(newIssue);
            localStorage.setItem('community_hero_issues', JSON.stringify(issues));
            return newIssue;
        },
        getIssues: async () => {
            return JSON.parse(localStorage.getItem('community_hero_issues')) || [];
        },
        updateIssueStatus: async (id, status) => {
            const issues = JSON.parse(localStorage.getItem('community_hero_issues')) || [];
            const idx = issues.findIndex(i => i.id === id);
            if (idx !== -1) {
                issues[idx].status = status;
                if (status === 'Resolved') {
                    issues[idx].resolvedAt = new Date().toISOString();
                } else {
                    issues[idx].resolvedAt = null;
                }
                localStorage.setItem('community_hero_issues', JSON.stringify(issues));
            }
        },
        upvoteIssue: async (id, userId) => {
            const issues = JSON.parse(localStorage.getItem('community_hero_issues')) || [];
            const idx = issues.findIndex(i => i.id === id);
            if (idx !== -1) {
                const issue = issues[idx];
                const upvotedBy = issue.upvotedBy || [];
                if (!upvotedBy.includes(userId)) {
                    issue.upvotes = (issue.upvotes || 0) + 1;
                    issue.upvotedBy = [...upvotedBy, userId];
                    localStorage.setItem('community_hero_issues', JSON.stringify(issues));
                    return true;
                }
            }
            return false;
        },
        verifyIssue: async (id, userId) => {
            const issues = JSON.parse(localStorage.getItem('community_hero_issues')) || [];
            const idx = issues.findIndex(i => i.id === id);
            if (idx !== -1) {
                const issue = issues[idx];
                const verifiedBy = issue.verifiedBy || [];
                if (!verifiedBy.includes(userId)) {
                    issue.verifiedBy = [...verifiedBy, userId];
                    issue.verifiedCount = issue.verifiedBy.length;
                    
                    if (issue.status === "Open" && issue.verifiedCount >= 3) {
                        issue.status = "Verified";
                    }
                    localStorage.setItem('community_hero_issues', JSON.stringify(issues));
                    return true;
                }
            }
            return false;
        },
        addComment: async (issueId, commentData) => {
            const commentsMap = JSON.parse(localStorage.getItem('community_hero_comments')) || {};
            if (!commentsMap[issueId]) {
                commentsMap[issueId] = [];
            }
            const newComment = {
                id: 'comment_' + Math.random().toString(36).substr(2, 9),
                ...commentData,
                createdAt: new Date().toISOString()
            };
            commentsMap[issueId].push(newComment);
            localStorage.setItem('community_hero_comments', JSON.stringify(commentsMap));
            
            // Update commentsCount in issues list
            const issues = JSON.parse(localStorage.getItem('community_hero_issues')) || [];
            const idx = issues.findIndex(i => i.id === issueId);
            if (idx !== -1) {
                issues[idx].commentsCount = (issues[idx].commentsCount || 0) + 1;
                localStorage.setItem('community_hero_issues', JSON.stringify(issues));
            }
        },
        getComments: async (issueId) => {
            const commentsMap = JSON.parse(localStorage.getItem('community_hero_comments')) || {};
            return commentsMap[issueId] || [];
        },
        reportDuplicate: async (id, targetId) => {
            const issues = JSON.parse(localStorage.getItem('community_hero_issues')) || [];
            const idx = issues.findIndex(i => i.id === id);
            if (idx !== -1) {
                issues[idx].status = "Resolved";
                issues[idx].isDuplicate = true;
                issues[idx].duplicateOf = targetId;
                issues[idx].resolvedAt = new Date().toISOString();
                localStorage.setItem('community_hero_issues', JSON.stringify(issues));
            }
        },
        getLeaderboard: async () => {
            const list = JSON.parse(localStorage.getItem('community_hero_leaderboard')) || [];
            return list.sort((a, b) => b.points - a.points);
        }
    };
    console.log("Mock database operations bound.");
    return true;
}

// Wrapper exports
export async function initialize(config) {
    if (config && config.apiKey && config.projectId) {
        const success = await initFirestore(config);
        if (success) return;
    }
    initMockDb();
}

export async function addIssue(issue) {
    if (!dbInstance) throw new Error("Database not initialized");
    return dbInstance.addIssue(issue);
}

export async function getIssues() {
    if (!dbInstance) throw new Error("Database not initialized");
    return dbInstance.getIssues();
}

export async function updateIssueStatus(id, status) {
    if (!dbInstance) throw new Error("Database not initialized");
    return dbInstance.updateIssueStatus(id, status);
}

export async function upvoteIssue(id, userId) {
    if (!dbInstance) throw new Error("Database not initialized");
    return dbInstance.upvoteIssue(id, userId);
}

export async function verifyIssue(id, userId) {
    if (!dbInstance) throw new Error("Database not initialized");
    return dbInstance.verifyIssue(id, userId);
}

export async function addComment(issueId, commentData) {
    if (!dbInstance) throw new Error("Database not initialized");
    return dbInstance.addComment(issueId, commentData);
}

export async function getComments(issueId) {
    if (!dbInstance) throw new Error("Database not initialized");
    return dbInstance.getComments(issueId);
}

export async function reportDuplicate(id, targetId) {
    if (!dbInstance) throw new Error("Database not initialized");
    return dbInstance.reportDuplicate(id, targetId);
}

export async function getLeaderboard() {
    if (!dbInstance) throw new Error("Database not initialized");
    return dbInstance.getLeaderboard();
}
