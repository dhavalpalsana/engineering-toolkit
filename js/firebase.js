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

  deleteAccount: async () => {
    if (!isConfigured) throw new Error("Firebase is not configured.");
    const user = auth.currentUser;
    if (!user) throw new Error("No authenticated user found.");
    try {
      // Firestore batches are limited to 500 operations.
      const commitInChunks = async (refs) => {
        const CHUNK = 450;
        for (let i = 0; i < refs.length; i += CHUNK) {
          const batch = db.batch();
          refs.slice(i, i + CHUNK).forEach(ref => batch.delete(ref));
          await batch.commit();
        }
      };

      const refsToDelete = [];

      // User projects
      const projectsSnap = await db.collection("projects").where("userId", "==", user.uid).get();
      projectsSnap.forEach(doc => refsToDelete.push(doc.ref));

      // Favorites subcollection
      const favsSnap = await db.collection("user_favorites").doc(user.uid).collection("tools").get();
      favsSnap.forEach(doc => refsToDelete.push(doc.ref));
      refsToDelete.push(db.collection("user_favorites").doc(user.uid));

      // Risk register documents
      const risksSnap = await db.collection("risk_registers").doc(user.uid).collection("risks").get();
      risksSnap.forEach(doc => refsToDelete.push(doc.ref));
      refsToDelete.push(db.collection("risk_registers").doc(user.uid));

      // Bug reports and feature suggestions filed by this user
      try {
        const bugsSnap = await db.collection("bug_reports").where("userId", "==", user.uid).get();
        bugsSnap.forEach(doc => refsToDelete.push(doc.ref));
      } catch (e) {
        console.warn("Could not list bug_reports for account deletion:", e);
      }
      try {
        const featsSnap = await db.collection("feature_suggestions").where("userId", "==", user.uid).get();
        featsSnap.forEach(doc => refsToDelete.push(doc.ref));
      } catch (e) {
        console.warn("Could not list feature_suggestions for account deletion:", e);
      }

      await commitInChunks(refsToDelete);
      await user.delete();
      return { error: null };
    } catch (error) {
      return { error };
    }
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

  saveProject: async (toolId, name, config, projectId = null) => {
    if (!isConfigured) {
      const local = JSON.parse(localStorage.getItem(`local_projects_${toolId}`) || "[]");
      const existingIdx = projectId ? local.findIndex(p => p.id === projectId) : local.findIndex(p => p.name === name);
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
      return { id: newProj.id, error: null };
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        const local = JSON.parse(localStorage.getItem(`local_projects_${toolId}`) || "[]");
        const existingIdx = projectId ? local.findIndex(p => p.id === projectId) : local.findIndex(p => p.name === name);
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
        return { id: newProj.id, error: null };
      }

      const projData = {
        userId: user.uid,
        toolId,
        name,
        config,
        updatedAt: new Date().toISOString()
      };

      if (projectId) {
        await db.collection("projects").doc(projectId).update({ name, config, updatedAt: projData.updatedAt });
        return { id: projectId, error: null };
      }

      const snapshot = await db.collection("projects")
        .where("userId", "==", user.uid)
        .where("toolId", "==", toolId)
        .where("name", "==", name)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const docId = snapshot.docs[0].id;
        await db.collection("projects").doc(docId).update({ name, config, updatedAt: projData.updatedAt });
        return { id: docId, error: null };
      } else {
        const docRef = await db.collection("projects").add(projData);
        return { id: docRef.id, error: null };
      }
    } catch (e) {
      return { id: null, error: e };
    }
  },

  deleteProject: async (projectId, toolId = null) => {
    if (!isConfigured) {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith("local_projects_")) {
          let local = JSON.parse(localStorage.getItem(key) || "[]");
          if (local.some(p => p.id === projectId)) {
            local = local.filter(p => p.id !== projectId);
            localStorage.setItem(key, JSON.stringify(local));
          }
        }
      }
      return { error: null };
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
          if (key.startsWith("local_projects_")) {
            let local = JSON.parse(localStorage.getItem(key) || "[]");
            if (local.some(p => p.id === projectId)) {
              local = local.filter(p => p.id !== projectId);
              localStorage.setItem(key, JSON.stringify(local));
            }
          }
        }
        return { error: null };
      }

      await db.collection("projects").doc(projectId).delete();
      return { error: null };
    } catch (e) {
      return { error: e };
    }
  },

  getProjectById: async (projectId) => {
    if (!isConfigured) {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith("local_projects_")) {
          const list = JSON.parse(localStorage.getItem(key) || "[]");
          const found = list.find(p => p.id === projectId);
          if (found) return { data: found, error: null };
        }
      }
      return { data: null, error: new Error("Project not found.") };
    }

    try {
      const doc = await db.collection("projects").doc(projectId).get();
      if (!doc.exists) {
        return { data: null, error: new Error("Project not found.") };
      }
      return { data: { id: doc.id, ...doc.data() }, error: null };
    } catch (e) {
      return { data: null, error: e };
    }
  },

  getAllProjects: async () => {
    if (!isConfigured) {
      const all = [];
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith("local_projects_")) {
          const toolId = key.replace("local_projects_", "");
          const list = JSON.parse(localStorage.getItem(key) || "[]");
          list.forEach(p => all.push({ ...p, toolId }));
        }
      }
      return { data: all, error: null };
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        const all = [];
        const keys = Object.keys(localStorage);
        for (const key of keys) {
          if (key.startsWith("local_projects_")) {
            const toolId = key.replace("local_projects_", "");
            const list = JSON.parse(localStorage.getItem(key) || "[]");
            list.forEach(p => all.push({ ...p, toolId }));
          }
        }
        return { data: all, error: null };
      }

      const snapshot = await db.collection("projects")
        .where("userId", "==", user.uid)
        .get();

      const data = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });
      data.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      return { data, error: null };
    } catch (e) {
      return { data: [], error: e };
    }
  },

  suggestFeature: async (title, desc, toolId, contactEmail) => {
    if (!isConfigured) {
      // Local fallback
      const existing = JSON.parse(localStorage.getItem("feature_suggestions") || "[]");
      existing.push({ title, desc, toolId, contactEmail, date: new Date().toISOString() });
      localStorage.setItem("feature_suggestions", JSON.stringify(existing));
      return { success: true, local: true };
    }

    try {
      const user = auth.currentUser;
      const docData = {
        title,
        desc,
        toolId,
        contactEmail: contactEmail || (user ? user.email : null),
        userId: user ? user.uid : null,
        createdAt: new Date().toISOString(),
        status: "pending"
      };

      await db.collection("feature_suggestions").add(docData);
      return { success: true, local: false };
    } catch (e) {
      console.error("Failed to save feature suggestion to Firestore:", e);
      // Fallback
      const existing = JSON.parse(localStorage.getItem("feature_suggestions") || "[]");
      existing.push({ title, desc, toolId, contactEmail, date: new Date().toISOString(), error: e.message });
      localStorage.setItem("feature_suggestions", JSON.stringify(existing));
      return { success: true, local: true, error: e };
    }
  }
};
