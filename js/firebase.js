// Firebase Configuration
// Replace these placeholders with your actual Firebase Project Configuration.
// You can get these from your Firebase Console -> Project Settings.
const firebaseConfig = {
  apiKey: "AIzaSyBVjs74ADt_EEc9GrUyczERkRUrY4o4qPk",
  authDomain: "eng-toolkit.firebaseapp.com",
  projectId: "eng-toolkit",
  storageBucket: "eng-toolkit.firebasestorage.app",
  messagingSenderId: "737176030968",
  appId: "1:737176030968:web:a33e3017da3e05c025350d",
  measurementId: "G-PV58X5FP1W"
};

let app = null;
let auth = null;
let db = null;
let isConfigured = false;

if (
  typeof window.firebase !== "undefined" &&
  firebaseConfig.apiKey !== "your-api-key"
) {
  try {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    isConfigured = true;
    console.log("Firebase initialized successfully.");
  } catch (e) {
    console.error("Failed to initialize Firebase:", e);
  }
} else {
  console.warn("Firebase is not configured. Falling back to local storage mode.");
}

window.fbHelper = {
  isConfigured: () => isConfigured,

  // Auth operations
  signUp: async (email, password) => {
    if (!isConfigured) throw new Error("Firebase is not configured.");
    return await auth.createUserWithEmailAndPassword(email, password)
      .then(userCredential => ({ user: userCredential.user, error: null }))
      .catch(error => ({ user: null, error }));
  },

  signIn: async (email, password) => {
    if (!isConfigured) throw new Error("Firebase is not configured.");
    return await auth.signInWithEmailAndPassword(email, password)
      .then(userCredential => ({ user: userCredential.user, error: null }))
      .catch(error => ({ user: null, error }));
  },

  signInWithGoogle: async () => {
    if (!isConfigured) throw new Error("Firebase is not configured.");
    const provider = new firebase.auth.GoogleAuthProvider();
    return await auth.signInWithPopup(provider)
      .then(userCredential => ({ user: userCredential.user, error: null }))
      .catch(error => ({ user: null, error }));
  },

  sendPasswordResetEmail: async (email) => {
    if (!isConfigured) throw new Error("Firebase is not configured.");
    return await auth.sendPasswordResetEmail(email)
      .then(() => ({ error: null }))
      .catch(error => ({ error }));
  },

  signOut: async () => {
    if (!isConfigured) return { error: null };
    return await auth.signOut()
      .then(() => ({ error: null }))
      .catch(error => ({ error }));
  },

  getUser: async () => {
    if (!isConfigured) return null;
    return new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        resolve(user);
      });
    });
  },

  onAuthStateChange: (callback) => {
    if (!isConfigured) return () => {};
    return auth.onAuthStateChanged(callback);
  },

  // Database DB Operations
  getProjects: async (toolId) => {
    if (!isConfigured) {
      const local = JSON.parse(localStorage.getItem(`local_projects_${toolId}`) || "[]");
      return { data: local, error: null };
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        const local = JSON.parse(localStorage.getItem(`local_projects_${toolId}`) || "[]");
        return { data: local, error: null };
      }

      // Default fetch
      const snapshot = await db.collection("projects")
        .where("userId", "==", user.uid)
        .where("toolId", "==", toolId)
        .get();

      const data = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });
      // Sort client side to avoid needing composite indexes pre-configured on Firestore
      data.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      return { data, error: null };
    } catch (e) {
      return { data: [], error: e };
    }
  },

  saveProject: async (toolId, name, config) => {
    if (!isConfigured) {
      const local = JSON.parse(localStorage.getItem(`local_projects_${toolId}`) || "[]");
      const existingIdx = local.findIndex(p => p.name === name);
      const newProj = {
        id: existingIdx >= 0 ? local[existingIdx].id : Math.random().toString(36).substr(2, 9),
        name,
        config,
        updatedAt: new Date().toISOString()
      };
      if (existingIdx >= 0) {
        local[existingIdx] = newProj;
      } else {
        local.push(newProj);
      }
      localStorage.setItem(`local_projects_${toolId}`, JSON.stringify(local));
      return { data: newProj, error: null };
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        const local = JSON.parse(localStorage.getItem(`local_projects_${toolId}`) || "[]");
        const existingIdx = local.findIndex(p => p.name === name);
        const newProj = {
          id: existingIdx >= 0 ? local[existingIdx].id : Math.random().toString(36).substr(2, 9),
          name,
          config,
          updatedAt: new Date().toISOString()
        };
        if (existingIdx >= 0) {
          local[existingIdx] = newProj;
        } else {
          local.push(newProj);
        }
        localStorage.setItem(`local_projects_${toolId}`, JSON.stringify(local));
        return { data: newProj, error: null };
      }

      // Check if project with same name already exists for this user/tool
      const snapshot = await db.collection("projects")
        .where("userId", "==", user.uid)
        .where("toolId", "==", toolId)
        .where("name", "==", name)
        .limit(1)
        .get();

      let docRef;
      const projData = {
        userId: user.uid,
        toolId,
        name,
        config,
        updatedAt: new Date().toISOString()
      };

      if (!snapshot.empty) {
        const docId = snapshot.docs[0].id;
        docRef = db.collection("projects").doc(docId);
        await docRef.update({ config, updatedAt: projData.updatedAt });
        return { data: { id: docId, ...projData }, error: null };
      } else {
        docRef = await db.collection("projects").add(projData);
        return { data: { id: docRef.id, ...projData }, error: null };
      }
    } catch (e) {
      return { data: null, error: e };
    }
  },

  deleteProject: async (toolId, projectId) => {
    if (!isConfigured) {
      let local = JSON.parse(localStorage.getItem(`local_projects_${toolId}`) || "[]");
      local = local.filter(p => p.id !== projectId);
      localStorage.setItem(`local_projects_${toolId}`, JSON.stringify(local));
      return { error: null };
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        let local = JSON.parse(localStorage.getItem(`local_projects_${toolId}`) || "[]");
        local = local.filter(p => p.id !== projectId);
        localStorage.setItem(`local_projects_${toolId}`, JSON.stringify(local));
        return { error: null };
      }

      await db.collection("projects").doc(projectId).delete();
      return { error: null };
    } catch (e) {
      return { error: e };
    }
  }
};
