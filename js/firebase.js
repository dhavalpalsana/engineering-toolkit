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

  /**
   * Save project. Optional 5th arg meta: { tags, folderId, lastOpenedAt, notes }
   * Additive fields only — older clients ignore them.
   */
  saveProject: async (toolId, name, config, projectId = null, meta = null) => {
    const now = new Date().toISOString();
    const tags = meta && Array.isArray(meta.tags)
      ? meta.tags.map(t => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 12)
      : undefined;
    const folderId = meta && Object.prototype.hasOwnProperty.call(meta, "folderId")
      ? (meta.folderId || null)
      : undefined;
    const lastOpenedAt = meta && meta.lastOpenedAt ? meta.lastOpenedAt : undefined;
    const notes = meta && Object.prototype.hasOwnProperty.call(meta, "notes")
      ? String(meta.notes || "").slice(0, 2000)
      : undefined;

    const applyMeta = (proj) => {
      if (tags !== undefined) proj.tags = tags;
      if (folderId !== undefined) proj.folderId = folderId;
      if (lastOpenedAt !== undefined) proj.lastOpenedAt = lastOpenedAt;
      if (notes !== undefined) proj.notes = notes;
      return proj;
    };

    if (!isConfigured) {
      const local = JSON.parse(localStorage.getItem(`local_projects_${toolId}`) || "[]");
      const existingIdx = projectId ? local.findIndex(p => p.id === projectId) : local.findIndex(p => p.name === name);
      let newProj = {
        id: existingIdx >= 0 ? local[existingIdx].id : Math.random().toString(36).substr(2, 9),
        name,
        config,
        toolId,
        updatedAt: now,
        tags: existingIdx >= 0 ? (local[existingIdx].tags || []) : [],
        folderId: existingIdx >= 0 ? (local[existingIdx].folderId || null) : null,
        lastOpenedAt: existingIdx >= 0 ? (local[existingIdx].lastOpenedAt || null) : null,
        notes: existingIdx >= 0 ? (local[existingIdx].notes || "") : ""
      };
      if (existingIdx >= 0) {
        newProj = { ...local[existingIdx], ...newProj, config, name, updatedAt: now };
      }
      applyMeta(newProj);
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
        let newProj = {
          id: existingIdx >= 0 ? local[existingIdx].id : Math.random().toString(36).substr(2, 9),
          name,
          config,
          toolId,
          updatedAt: now,
          tags: existingIdx >= 0 ? (local[existingIdx].tags || []) : [],
          folderId: existingIdx >= 0 ? (local[existingIdx].folderId || null) : null,
          lastOpenedAt: existingIdx >= 0 ? (local[existingIdx].lastOpenedAt || null) : null,
          notes: existingIdx >= 0 ? (local[existingIdx].notes || "") : ""
        };
        if (existingIdx >= 0) {
          newProj = { ...local[existingIdx], ...newProj, config, name, updatedAt: now };
        }
        applyMeta(newProj);
        if (existingIdx >= 0) {
          local[existingIdx] = newProj;
        } else {
          local.push(newProj);
        }
        localStorage.setItem(`local_projects_${toolId}`, JSON.stringify(local));
        return { id: newProj.id, error: null };
      }

      const projData = applyMeta({
        userId: user.uid,
        toolId,
        name,
        config,
        updatedAt: now
      });

      if (projectId) {
        const patch = { name, config, updatedAt: now };
        if (tags !== undefined) patch.tags = tags;
        if (folderId !== undefined) patch.folderId = folderId;
        if (lastOpenedAt !== undefined) patch.lastOpenedAt = lastOpenedAt;
        if (notes !== undefined) patch.notes = notes;
        await db.collection("projects").doc(projectId).update(patch);
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
        const patch = { name, config, updatedAt: now };
        if (tags !== undefined) patch.tags = tags;
        if (folderId !== undefined) patch.folderId = folderId;
        if (lastOpenedAt !== undefined) patch.lastOpenedAt = lastOpenedAt;
        if (notes !== undefined) patch.notes = notes;
        await db.collection("projects").doc(docId).update(patch);
        return { id: docId, error: null };
      } else {
        if (!projData.tags) projData.tags = [];
        if (projData.folderId === undefined) projData.folderId = null;
        if (projData.notes === undefined) projData.notes = "";
        const docRef = await db.collection("projects").add(projData);
        return { id: docRef.id, error: null };
      }
    } catch (e) {
      return { id: null, error: e };
    }
  },

  /** Touch lastOpenedAt without rewriting config. */
  touchProjectOpened: async (projectId, toolId = null) => {
    const now = new Date().toISOString();
    if (!projectId) return { error: null };
    if (!isConfigured || !auth.currentUser) {
      if (!toolId) return { error: null };
      const local = JSON.parse(localStorage.getItem(`local_projects_${toolId}`) || "[]");
      const idx = local.findIndex(p => p.id === projectId);
      if (idx >= 0) {
        local[idx].lastOpenedAt = now;
        localStorage.setItem(`local_projects_${toolId}`, JSON.stringify(local));
      }
      return { error: null };
    }
    try {
      await db.collection("projects").doc(projectId).update({ lastOpenedAt: now });
      return { error: null };
    } catch (e) {
      return { error: e };
    }
  },

  /** Duplicate project as a new doc with " (copy)" name. */
  duplicateProject: async (project) => {
    if (!project) return { id: null, error: new Error("No project") };
    const baseName = (project.name || "Project").replace(/\s*\(copy\)\s*$/i, "").trim();
    const name = `${baseName} (copy)`;
    return window.fbHelper.saveProject(
      project.toolId,
      name,
      project.config,
      null,
      { tags: project.tags || [], folderId: project.folderId || null, notes: project.notes || "" }
    );
  },

  getUserFolders: async () => {
    const key = "et_user_folders";
    if (!isConfigured || !auth.currentUser) {
      return { data: JSON.parse(localStorage.getItem(key) || "[]"), error: null };
    }
    try {
      const snap = await db.collection("user_folders").doc(auth.currentUser.uid).collection("folders").get();
      const data = [];
      snap.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (a.order || 0) - (b.order || 0) || (a.name || "").localeCompare(b.name || ""));
      return { data, error: null };
    } catch (e) {
      return { data: [], error: e };
    }
  },

  saveUserFolder: async (name, folderId = null) => {
    const key = "et_user_folders";
    const clean = String(name || "").trim().slice(0, 48);
    if (!clean) return { id: null, error: new Error("Name required") };
    if (!isConfigured || !auth.currentUser) {
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      if (folderId) {
        const i = list.findIndex(f => f.id === folderId);
        if (i >= 0) list[i].name = clean;
      } else {
        list.push({ id: "f_" + Math.random().toString(36).slice(2, 9), name: clean, order: list.length });
      }
      localStorage.setItem(key, JSON.stringify(list));
      return { id: folderId || list[list.length - 1].id, error: null };
    }
    try {
      const col = db.collection("user_folders").doc(auth.currentUser.uid).collection("folders");
      if (folderId) {
        await col.doc(folderId).update({ name: clean });
        return { id: folderId, error: null };
      }
      const docRef = await col.add({ name: clean, order: Date.now(), createdAt: new Date().toISOString() });
      return { id: docRef.id, error: null };
    } catch (e) {
      return { id: null, error: e };
    }
  },

  deleteUserFolder: async (folderId) => {
    const key = "et_user_folders";
    if (!folderId) return { error: null };
    if (!isConfigured || !auth.currentUser) {
      let list = JSON.parse(localStorage.getItem(key) || "[]");
      list = list.filter(f => f.id !== folderId);
      localStorage.setItem(key, JSON.stringify(list));
      return { error: null };
    }
    try {
      await db.collection("user_folders").doc(auth.currentUser.uid).collection("folders").doc(folderId).delete();
      return { error: null };
    } catch (e) {
      return { error: e };
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
