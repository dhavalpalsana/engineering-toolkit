/**
 * Global Project Manager for Engineering Toolkit
 * Handles unified Project Drawer on both homepage and tool subpages.
 */
document.addEventListener("DOMContentLoaded", () => {
  const config = window.projectManagerConfig;
  const isHomepage = !config;
  const fb = window.fbHelper;

  // Auto-increment global tool popularity statistics
  if (config && config.toolId) {
    const toolId = config.toolId;
    // Check if Firebase is fully initialized
    if (window.firebase && firebase.apps.length > 0) {
      firebase.firestore().collection("tool_stats").doc(toolId).set({
        uses: firebase.firestore.FieldValue.increment(1),
        lastUsed: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).catch(err => console.warn("Analytics write failed:", err));
    }
  }

  // Inject Styles for Drawer, Toolbar, Modal and Toast
  const style = document.createElement("style");
  style.textContent = `
    /* Project Actions Toolbar (Subpages) */
    .project-actions-group {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-right: 8px;
    }
    .project-btn {
      height: 36px;
      padding: 0 14px;
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    .project-btn:hover {
      background: var(--bg-secondary);
      color: var(--text-primary);
      border-color: var(--text-muted);
    }
    .project-btn.primary {
      background: var(--accent-primary-glow);
      border-color: var(--accent-primary);
      color: var(--accent-primary);
    }
    .project-btn.primary:hover {
      background: var(--accent-primary);
      color: #fff;
    }
    .active-project-indicator {
      font-size: 12px;
      font-weight: 700;
      color: var(--accent-primary);
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-right: 4px;
      padding: 4px 8px;
      background: var(--accent-primary-glow);
      border-radius: var(--radius-sm);
      display: none;
    }

    /* Drawer Styles */
    .pm-drawer-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(4px);
      z-index: 9999;
      display: none;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .pm-drawer-overlay.show {
      display: block;
      opacity: 1;
    }
    .pm-drawer {
      position: fixed;
      top: 0;
      right: 0;
      width: 100%;
      max-width: 420px;
      height: 100%;
      background: var(--bg-secondary);
      border-left: 1px solid var(--border-color);
      box-shadow: var(--shadow-lg);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .pm-drawer.show {
      transform: translateX(0);
    }
    .pm-drawer-header {
      padding: 24px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .pm-drawer-title {
      font-size: 16px;
      font-weight: 800;
      color: var(--text-primary);
    }
    .pm-drawer-close {
      background: none;
      border: none;
      font-size: 24px;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--radius-sm);
      transition: all var(--transition-fast);
    }
    .pm-drawer-close:hover {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }
    .pm-drawer-body {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .pm-drawer-search {
      width: 100%;
      border: 1px solid var(--border-color);
      background-color: var(--bg-interactive);
      border-radius: var(--radius-md);
      padding: 10px 14px;
      font-family: var(--font-sans);
      font-size: 13px;
      color: var(--text-primary);
      outline: none;
      transition: border-color var(--transition-fast);
    }
    .pm-drawer-search:focus {
      border-color: var(--accent-primary);
    }
    
    /* Category Groups */
    .pm-category-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .pm-category-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-muted);
      margin-bottom: 4px;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 6px;
    }
    .pm-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      transition: all var(--transition-fast);
    }
    .pm-item:hover {
      border-color: var(--accent-primary);
      background: var(--bg-secondary);
    }
    .pm-item-info {
      flex: 1;
      min-width: 0;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .pm-item-name {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pm-item-date {
      font-size: 10px;
      color: var(--text-muted);
    }
    .pm-item-actions {
      display: flex;
      gap: 4px;
    }
    .pm-item-btn {
      background: none;
      border: none;
      padding: 6px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all var(--transition-fast);
    }
    .pm-item-btn:hover {
      color: var(--color-error);
      background: var(--color-error-bg);
    }

    /* Save Modal (Subpages) */
    .pm-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(4px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: pmFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .pm-modal-content {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      width: 100%;
      max-width: 400px;
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      padding: 24px;
      position: relative;
      animation: pmSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .pm-modal-close {
      position: absolute;
      top: 16px;
      right: 16px;
      background: none;
      border: none;
      font-size: 20px;
      color: var(--text-muted);
      cursor: pointer;
    }
    .pm-modal-header {
      margin-bottom: 16px;
    }
    .pm-modal-header h3 {
      font-size: 16px;
      font-weight: 800;
      color: var(--text-primary);
    }
    .pm-modal-header p {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 2px;
    }
    .pm-form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 16px;
    }
    .pm-form-group label {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .pm-form-input {
      width: 100%;
      border: 1px solid var(--border-color);
      background-color: var(--bg-interactive);
      border-radius: var(--radius-md);
      padding: 10px 14px;
      font-family: var(--font-sans);
      font-size: 14px;
      color: var(--text-primary);
      outline: none;
      box-sizing: border-box;
    }

    /* Toasts */
    .pm-toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-left: 4px solid var(--accent-primary);
      padding: 12px 20px;
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      display: flex;
      align-items: center;
      gap: 10px;
      z-index: 20000;
      transform: translateY(100px);
      opacity: 0;
      transition: all var(--transition-normal);
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
    }
    .pm-toast.show {
      transform: translateY(0);
      opacity: 1;
    }

    @keyframes pmFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes pmSlideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    /* Skeleton loading cards */
    @keyframes pmSkeleton {
      0% { background-position: -200px 0; }
      100% { background-position: calc(200px + 100%) 0; }
    }
    .pm-skeleton {
      background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-secondary) 50%, var(--bg-tertiary) 75%);
      background-size: 400px 100%;
      animation: pmSkeleton 1.4s ease-in-out infinite;
      border-radius: var(--radius-sm);
    }
    .pm-skeleton-card {
      height: 54px;
      border-radius: var(--radius-md);
      margin-bottom: 8px;
    }

    /* Unsaved dot on Save button */
    .project-btn.unsaved {
      position: relative;
    }
    .project-btn.unsaved::after {
      content: '';
      position: absolute;
      top: 6px;
      right: 6px;
      width: 7px;
      height: 7px;
      background: var(--color-warning, #f59e0b);
      border-radius: 50%;
      border: 2px solid var(--bg-primary);
    }

    /* Delete confirm modal */
    .pm-confirm-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      backdrop-filter: blur(4px);
      z-index: 20001;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: pmFadeIn 0.15s ease;
    }
    .pm-confirm-box {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      padding: 24px;
      width: 100%;
      max-width: 360px;
      box-shadow: var(--shadow-lg);
      animation: pmSlideUp 0.2s cubic-bezier(0.16,1,0.3,1);
    }
    .pm-confirm-box h4 {
      font-size: 15px;
      font-weight: 800;
      color: var(--text-primary);
      margin-bottom: 8px;
    }
    .pm-confirm-box p {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 20px;
      line-height: 1.5;
    }
    .pm-confirm-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .pm-confirm-cancel {
      height: 36px;
      padding: 0 16px;
      font-size: 13px;
      font-weight: 600;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    .pm-confirm-cancel:hover {
      background: var(--bg-secondary);
      color: var(--text-primary);
    }
    .pm-confirm-delete {
      height: 36px;
      padding: 0 16px;
      font-size: 13px;
      font-weight: 600;
      background: var(--color-error-bg, #fee2e2);
      border: 1px solid var(--color-error, #ef4444);
      border-radius: var(--radius-md);
      color: var(--color-error, #ef4444);
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    .pm-confirm-delete:hover {
      background: var(--color-error, #ef4444);
      color: #fff;
    }
  `;
  document.head.appendChild(style);

  // Global Toast notifier
  const toastDiv = document.createElement("div");
  toastDiv.className = "pm-toast";
  document.body.appendChild(toastDiv);

  const showToast = (message, isSuccess = true) => {
    toastDiv.textContent = message;
    toastDiv.style.borderLeftColor = isSuccess ? "var(--color-success)" : "var(--color-error)";
    toastDiv.classList.add("show");
    setTimeout(() => {
      toastDiv.classList.remove("show");
    }, 3000);
  };
  window.showToast = showToast;

  // Find header auth-btn to anchor control injections
  const authBtn = document.getElementById("auth-btn");
  if (!authBtn) return;
  const headerRight = authBtn.parentElement;

  let activeProject = null;
  let allProjects = [];

  // Inject Drawer Markup globally on all pages
  const overlay = document.createElement("div");
  overlay.className = "pm-drawer-overlay";
  overlay.id = "pm-drawer-overlay";
  overlay.innerHTML = `
    <div class="pm-drawer" id="pm-drawer">
      <div class="pm-drawer-header">
        <span class="pm-drawer-title">My Saved Projects</span>
        <button class="pm-drawer-close" id="pm-drawer-close-btn">&times;</button>
      </div>
      <div class="pm-drawer-body">
        <input type="text" class="pm-drawer-search" id="pm-drawer-search-input" placeholder="Search saved projects by name...">
        <div id="pm-drawer-list" class="flex flex-col gap-6">
          <div class="pm-empty-state">Loading saved projects...</div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const drawer = document.getElementById("pm-drawer");
  const drawerList = document.getElementById("pm-drawer-list");
  const searchInput = document.getElementById("pm-drawer-search-input");
  const closeBtn = document.getElementById("pm-drawer-close-btn");

  const openDrawer = () => {
    overlay.classList.add("show");
    setTimeout(() => drawer.classList.add("show"), 50);
    loadProjects();
  };

  const closeDrawer = () => {
    drawer.classList.remove("show");
    setTimeout(() => overlay.classList.remove("show"), 300);
  };

  const loadProjects = async () => {
    // Show skeleton cards while loading
    drawerList.innerHTML = `
      <div class="pm-skeleton pm-skeleton-card"></div>
      <div class="pm-skeleton pm-skeleton-card" style="opacity:0.7"></div>
      <div class="pm-skeleton pm-skeleton-card" style="opacity:0.4"></div>
    `;
    try {
      const { data, error } = await fb.getAllProjects();
      if (error) {
        drawerList.innerHTML = `<div class="pm-empty-state" style="color:var(--color-error);">Error: ${error.message}</div>`;
        return;
      }
      allProjects = data;
      renderProjectsList();
    } catch (err) {
      drawerList.innerHTML = `<div class="pm-empty-state" style="color:var(--color-error);">Error loading projects.</div>`;
    }
  };

  const getToolName = (toolId) => {
    switch (toolId) {
      case "busbar-sizing": return "Busbar Capacity Calculator";
      case "wire-gauge": return "Cable Solver (Wire Gauge)";
      case "can-bus-designer": return "CAN Bus Harness Designer";
      case "fishbone-diagram": return "Ishikawa Fishbone Creator";
      default: return toolId;
    }
  };

  const getToolPath = (toolId) => {
    if (isHomepage) {
      switch (toolId) {
        case "busbar-sizing": return "tools/busbar-sizing/index.html";
        case "wire-gauge": return "tools/wire-gauge/index.html";
        case "can-bus-designer": return "tools/can-bus-designer/index.html";
        case "fishbone-diagram": return "tools/fishbone-diagram/index.html";
        default: return `tools/${toolId}/index.html`;
      }
    } else {
      switch (toolId) {
        case "busbar-sizing": return "../busbar-sizing/index.html";
        case "wire-gauge": return "../wire-gauge/index.html";
        case "can-bus-designer": return "../can-bus-designer/index.html";
        case "fishbone-diagram": return "../fishbone-diagram/index.html";
        default: return `../${toolId}/index.html`;
      }
    }
  };

  const relativeTime = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const renderProjectsList = (filter = "") => {
    const filtered = allProjects.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
    if (filtered.length === 0) {
      drawerList.innerHTML = `<div class="pm-empty-state">No saved projects found${filter ? " matching search" : ""}.</div>`;
      return;
    }

    // Group projects by toolId
    const grouped = {};
    filtered.forEach(p => {
      if (!grouped[p.toolId]) grouped[p.toolId] = [];
      grouped[p.toolId].push(p);
    });

    drawerList.innerHTML = Object.keys(grouped).map(toolId => {
      const groupItems = grouped[toolId].map(p => {
        const dateStr = new Date(p.updatedAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });
        return `
          <div class="pm-item">
            <div class="pm-item-info" data-id="${p.id}" data-tool="${p.toolId}">
              <span class="pm-item-name">${escapeHtml(p.name)}</span>
              <span class="pm-item-date">${relativeTime(p.updatedAt)}</span>
            </div>
            <div class="pm-item-actions">
              <button class="pm-item-btn pm-item-delete" data-id="${p.id}" data-name="${escapeHtml(p.name)}" title="Delete project">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </div>
        `;
      }).join("");

      return `
        <div class="pm-category-group">
          <span class="pm-category-title">${getToolName(toolId)}</span>
          ${groupItems}
        </div>
      `;
    }).join("");

    // Bind Load Click handlers
    drawerList.querySelectorAll(".pm-item-info").forEach(el => {
      el.addEventListener("click", () => {
        const id = el.dataset.id;
        const toolId = el.dataset.tool;

        // If we are currently inside the target tool subpage, load locally!
        if (config && config.toolId === toolId) {
          const match = allProjects.find(p => p.id === id);
          if (match) {
            config.setInputs(match.config);
            activeProject = { id: match.id, name: match.name };
            localStorage.setItem(`pm_active_id_${config.toolId}`, match.id);
            updateActiveIndicator();
            showToast(`Loaded "${match.name}"`);
            closeDrawer();
          }
        } else {
          // Redirect to target page with query parameter
          window.location.href = `${getToolPath(toolId)}?project=${id}`;
        }
      });
    });

    // Bind Delete click handlers
    drawerList.querySelectorAll(".pm-item-delete").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const name = btn.dataset.name;

        // Styled confirm modal instead of browser confirm()
        const confirmOverlay = document.createElement("div");
        confirmOverlay.className = "pm-confirm-overlay";
        confirmOverlay.innerHTML = `
          <div class="pm-confirm-box">
            <h4>Delete project?</h4>
            <p>"${escapeHtml(name)}" will be permanently deleted and cannot be recovered.</p>
            <div class="pm-confirm-actions">
              <button class="pm-confirm-cancel" id="pm-confirm-no">Cancel</button>
              <button class="pm-confirm-delete" id="pm-confirm-yes">Delete</button>
            </div>
          </div>
        `;
        document.body.appendChild(confirmOverlay);

        const closeConfirm = () => confirmOverlay.remove();
        confirmOverlay.querySelector("#pm-confirm-no").addEventListener("click", closeConfirm);
        confirmOverlay.addEventListener("click", e => { if (e.target === confirmOverlay) closeConfirm(); });

        confirmOverlay.querySelector("#pm-confirm-yes").addEventListener("click", async () => {
          closeConfirm();
          btn.disabled = true;
          const { error } = await fb.deleteProject(id);
          if (error) {
            showToast("Delete failed: " + error.message, false);
            btn.disabled = false;
          } else {
            allProjects = allProjects.filter(p => p.id !== id);
            if (config && activeProject && activeProject.id === id) {
              activeProject = null;
              localStorage.removeItem(`pm_active_id_${config.toolId}`);
              updateActiveIndicator();
            }
            showToast(`Deleted "${name}"`);
            renderProjectsList(searchInput.value);
          }
        });
      });
    });
  };

  // Bind Shared Drawer Close Events
  closeBtn.addEventListener("click", closeDrawer);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeDrawer();
  });
  searchInput.addEventListener("input", (e) => {
    renderProjectsList(e.target.value);
  });
  // Escape key closes drawer
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("show")) closeDrawer();
  });

  // ----------------------------------------------------
  // CASE A: HOMEPAGE PROJECT DRAWER INTEGRATION
  // ----------------------------------------------------
  if (isHomepage) {
    // Inject "My Projects" folder button next to auth-btn
    const myProjectsBtn = document.createElement("button");
    myProjectsBtn.id = "pm-projects-btn";
    myProjectsBtn.className = "theme-toggle"; // Uses dashboard layout button styles
    myProjectsBtn.style.cssText = "display:none;align-items:center;gap:6px;width:auto;padding:0 12px;border-radius:var(--radius-md);height:40px;font-size:13px;font-weight:600;background:var(--bg-tertiary);border:1px solid var(--border-color);color:var(--text-secondary);cursor:pointer;transition:all var(--transition-fast);margin-right:8px;";
    myProjectsBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
      <span>My Projects</span>
    `;
    headerRight.insertBefore(myProjectsBtn, authBtn);

    myProjectsBtn.addEventListener("click", openDrawer);

    // Check login state changes
    const syncBtnVisibility = (user) => {
      if (user && fb.isConfigured()) {
        myProjectsBtn.style.display = "flex";
      } else {
        myProjectsBtn.style.display = "none";
        closeDrawer();
      }
    };

    document.addEventListener("auth-state-changed", (e) => {
      syncBtnVisibility(e.detail.user);
    });
    fb.getUser().then(syncBtnVisibility);

    // Auto-open drawer if requested in query parameters (e.g. from subpage Open redirect)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("drawer") === "open") {
      openDrawer();
      // Clean query parameter to keep fresh page loads clean
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  // ----------------------------------------------------
  // CASE B: SUBPAGE CALCULATOR INTEGRATION
  // ----------------------------------------------------
  else {
    // Inject toolbar containing "Open" (opens local drawer!) and "Save"
    const toolbar = document.createElement("div");
    toolbar.className = "project-actions-group";
    toolbar.style.display = "none"; // Hidden until logged in
    toolbar.innerHTML = `
      <span class="active-project-indicator" id="pm-active-name"></span>
      <button class="project-btn" id="pm-open-btn" title="Open My Saved Projects">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
        <span>Open</span>
      </button>
      <button class="project-btn primary" id="pm-save-btn" title="Save current design">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
        <span>Save</span>
      </button>
    `;
    headerRight.insertBefore(toolbar, authBtn);

    const openBtn = document.getElementById("pm-open-btn");
    const saveBtn = document.getElementById("pm-save-btn");
    const activeNameEl = document.getElementById("pm-active-name");

    const updateToolbarVisibility = (user) => {
      if (user && fb.isConfigured()) {
        toolbar.style.display = "flex";
      } else {
        toolbar.style.display = "none";
        activeProject = null;
        updateActiveIndicator();
      }
    };

    let isDirty = false;

    const markDirty = () => {
      if (activeProject && !isDirty) {
        isDirty = true;
        saveBtn.classList.add("unsaved");
      }
    };

    const markClean = () => {
      isDirty = false;
      saveBtn.classList.remove("unsaved");
    };

    // Warn user if they navigate away with unsaved changes
    window.addEventListener("beforeunload", (e) => {
      if (isDirty && activeProject) {
        e.preventDefault();
        e.returnValue = "";
      }
    });

    const updateActiveIndicator = () => {
      if (activeProject) {
        activeNameEl.textContent = activeProject.name;
        activeNameEl.style.display = "block";
        saveBtn.title = `Save updates to ${activeProject.name}`;
      } else {
        activeNameEl.textContent = "";
        activeNameEl.style.display = "none";
        saveBtn.title = "Save current design";
        markClean();
      }
    };

    // Open button click opens drawer directly on this page!
    openBtn.addEventListener("click", openDrawer);

    // Mark project as saved (clean) when first loaded
    const openSaveModal = (prefill = "") => {
      const overlayModal = document.createElement("div");
      overlayModal.className = "pm-modal-overlay";
      overlayModal.id = "pm-save-modal";
      overlayModal.innerHTML = `
        <div class="pm-modal-content">
          <button class="pm-modal-close" id="pm-close-save-modal">&times;</button>
          <div class="pm-modal-header">
            <h3>Save Configuration</h3>
            <p>Give your current inputs a name to save online</p>
          </div>
          <form id="pm-save-form">
            <div class="pm-form-group">
              <label for="pm-name">Design Name</label>
              <input type="text" class="pm-form-input" id="pm-name" required placeholder="e.g. Feeder Busbar 200A" value="${prefill}">
            </div>
            <button type="submit" class="project-btn primary" style="width:100%;justify-content:center;height:42px;">Save Design</button>
          </form>
        </div>
      `;
      document.body.appendChild(overlayModal);

      const closeSaveBtn = document.getElementById("pm-close-save-modal");
      const form = document.getElementById("pm-save-form");
      const nameInput = document.getElementById("pm-name");

      const closeModal = () => {
        overlayModal.classList.add("pm-fade-out");
        setTimeout(() => overlayModal.remove(), 200);
      };

      closeSaveBtn.addEventListener("click", closeModal);
      overlayModal.addEventListener("click", (e) => {
        if (e.target === overlayModal) closeModal();
      });

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        if (!name) return;

        const submitBtn = form.querySelector("button[type=submit]");
        submitBtn.disabled = true;
        submitBtn.textContent = "Saving...";

        try {
          const data = config.getInputs();
          const { id, error } = await fb.saveProject(config.toolId, name, data);
          if (error) {
            showToast("Save failed: " + error.message, false);
          } else {
            activeProject = { id, name };
            localStorage.setItem(`pm_active_id_${config.toolId}`, id);
            updateActiveIndicator();
            markClean();
            showToast(`Saved "${name}"`);
            closeModal();
          }
        } catch (err) {
          showToast("Save failed: " + (err.message || "Unknown error"), false);
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = "Save Design";
        }
      });

      nameInput.focus();
    };

    // Save click dispatcher (autosave vs prompts)
    saveBtn.addEventListener("click", async () => {
      if (activeProject) {
        saveBtn.disabled = true;
        const originalHtml = saveBtn.innerHTML;
        saveBtn.innerHTML = "Saving...";

        try {
          const data = config.getInputs();
          const { error } = await fb.saveProject(config.toolId, activeProject.name, data, activeProject.id);
          
          if (error) {
            showToast("Auto-save failed: " + error.message, false);
          } else {
            markClean();
            showToast(`Saved "${activeProject.name}"`);
          }
        } catch (err) {
          showToast("Auto-save failed: " + (err.message || "Unknown error"), false);
        } finally {
          saveBtn.disabled = false;
          saveBtn.innerHTML = originalHtml;
          // Restore unsaved dot if still dirty
          if (isDirty) saveBtn.classList.add("unsaved");
        }
      } else {
        openSaveModal();
      }
    });

    // Listen for input changes to mark dirty
    document.addEventListener("input", markDirty);
    document.addEventListener("change", markDirty);

    // 60-second periodic background auto-save for active projects
    setInterval(async () => {
      if (activeProject && isDirty && fb.isConfigured()) {
        try {
          const data = config.getInputs();
          const { error } = await fb.saveProject(config.toolId, activeProject.name, data, activeProject.id);
          if (!error) {
            markClean();
            showToast(`Auto-saved "${activeProject.name}"`);
          }
        } catch (_) { /* silent fail — user can still manually save */ }
      }
    }, 60000);

    // Check login state changes
    document.addEventListener("auth-state-changed", (e) => {
      updateToolbarVisibility(e.detail.user);
    });
    fb.getUser().then(updateToolbarVisibility);

    // Preload project parameter from URL if present
    const urlParams = new URLSearchParams(window.location.search);
    const projectIdParam = urlParams.get("project");
    if (projectIdParam) {
      fb.getProjectById(projectIdParam).then(result => {
        if (result.data) {
          config.setInputs(result.data.config);
          activeProject = { id: result.data.id, name: result.data.name };
          localStorage.setItem(`pm_active_id_${config.toolId}`, result.data.id);
          updateActiveIndicator();
          showToast(`Loaded "${result.data.name}"`);
          // Clean URL parameter to keep fresh page loads clean
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          showToast("Failed to load project: " + (result.error ? result.error.message : "Not found"), false);
        }
      });
    } else {
      // Sync active state from local storage last active indicator
      const lastActiveId = localStorage.getItem(`pm_active_id_${config.toolId}`);
      if (lastActiveId) {
        fb.getProjects(config.toolId).then(result => {
          const projects = result.data || [];
          const match = projects.find(p => p.id === lastActiveId);
          if (match) {
            activeProject = { id: match.id, name: match.name };
            updateActiveIndicator();
          } else {
            localStorage.removeItem(`pm_active_id_${config.toolId}`);
          }
        }).catch(err => console.error("Error loading initial active project", err));
      }
    }
  }

  // Escaping helper
  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
  }

  // ── Global Bug Report Modal ──────────────────────────────────────
  window.openBugReportModal = function(e) {
    if (e) e.preventDefault();

    // Verify user is signed in before allowing bug reports
    const user = (fb && fb.isConfigured() && firebase.auth().currentUser) || null;
    if (!user) {
      if (window.showToast) window.showToast("Please sign in to report bugs.", false);
      const loginBtn = document.getElementById("auth-btn");
      if (loginBtn) loginBtn.click();
      return;
    }

    // Check if modal already exists
    let overlay = document.getElementById("bug-report-modal");
    if (overlay) {
      overlay.style.display = "flex";
      document.getElementById("bug-report-form").style.display = "block";
      document.getElementById("bug-success-state").style.display = "none";
      return;
    }

    overlay = document.createElement("div");
    overlay.id = "bug-report-modal";
    overlay.className = "pm-modal-overlay"; // Reuses project-manager drawer overlay animations
    overlay.style.cssText = "position:fixed; inset:0; background:rgba(9, 13, 22, 0.7); display:flex; align-items:center; justify-content:center; z-index:9999; backdrop-filter:blur(4px);";
    
    // Grab active user email
    const prefillEmail = user.email || "";

    overlay.innerHTML = `
      <div class="pm-modal-content" style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:16px; width:100%; max-width:440px; padding:28px; position:relative; box-shadow:var(--shadow-lg); font-family:var(--font-sans);">
        <button class="pm-modal-close" id="close-bug-modal" style="position:absolute; top:12px; right:16px; background:none; border:none; color:var(--text-secondary); font-size:24px; cursor:pointer;">&times;</button>
        <div style="text-align:center; margin-bottom:20px;">
          <div style="width:44px; height:44px; background:rgba(239, 68, 68, 0.1); color:var(--color-error); border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 12px auto;">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          </div>
          <h3 style="font-weight:700; font-size:18px; color:var(--text-primary); margin:0 0 6px 0;">Report a Bug</h3>
          <p style="font-size:13px; color:var(--text-secondary); margin:0; line-height:1.4;">Help us improve this utility by describing the issue.</p>
        </div>
        <form id="bug-report-form">
          <div style="margin-bottom:16px; text-align:left;">
            <label style="display:block; font-size:12px; font-weight:600; color:var(--text-secondary); margin-bottom:6px;">Issue / Problem Description</label>
            <textarea id="bug-desc" required placeholder="Describe what went wrong, inputs used, steps to reproduce..." style="width:100%; height:110px; padding:10px 12px; border:1px solid var(--border-color); border-radius:8px; background:var(--bg-interactive); color:var(--text-primary); font-family:var(--font-sans); font-size:14px; resize:none; outline:none; box-sizing:border-box; line-height:1.4;"></textarea>
          </div>
          <div style="margin-bottom:20px; text-align:left;">
            <label style="display:block; font-size:12px; font-weight:600; color:var(--text-secondary); margin-bottom:6px;">Contact Email (Optional)</label>
            <input type="email" id="bug-email" placeholder="engineering@example.com" value="${prefillEmail}" style="width:100%; padding:10px 12px; border:1px solid var(--border-color); border-radius:8px; background:var(--bg-interactive); color:var(--text-primary); font-family:var(--font-sans); font-size:14px; outline:none; box-sizing:border-box;" />
          </div>
          <button type="submit" style="width:100%; display:flex; align-items:center; justify-content:center; height:42px; background:var(--accent-primary); border:none; border-radius:8px; color:#fff; font-weight:600; cursor:pointer; font-size:14px; transition:opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">Submit Bug Report</button>
        </form>
        
        <!-- Success State -->
        <div id="bug-success-state" style="display:none; text-align:center; padding:10px 0;">
          <div style="width:44px; height:44px; background:rgba(16, 185, 129, 0.1); color:var(--color-success); border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 12px auto;">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <h4 style="font-weight:700; font-size:16px; margin:0 0 6px 0; color:var(--text-primary);">Bug Report Logged!</h4>
          <p style="font-size:13px; color:var(--text-secondary); margin:0 0 24px 0; line-height:1.4;">Your report has been logged in our database.</p>
          <div style="display:flex; flex-direction:column; gap:10px;">
            <a href="#" id="bug-github-link" target="_blank" rel="noopener" style="display:flex; align-items:center; justify-content:center; text-decoration:none; height:42px; background:var(--accent-primary); color:#fff; font-weight:600; border-radius:8px; font-size:14px; transition:opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">Open GitHub Issue (Optional)</a>
            <button type="button" id="bug-done-btn" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color); background:transparent; cursor:pointer; color:var(--text-primary); font-weight:600; font-family:var(--font-sans); font-size:14px;">Done</button>
          </div>
        </div>
      </div>
    </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = document.getElementById("close-bug-modal");
    const bugForm = document.getElementById("bug-report-form");
    const successState = document.getElementById("bug-success-state");
    const doneBtn = document.getElementById("bug-done-btn");
    const githubLink = document.getElementById("bug-github-link");

    const close = () => {
      overlay.style.display = "none";
      bugForm.style.display = "block";
      successState.style.display = "none";
      bugForm.reset();
    };

    closeBtn.addEventListener("click", close);
    doneBtn.addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    bugForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitBtn = bugForm.querySelector("button[type=submit]");
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = "Logging...";

      const desc = document.getElementById("bug-desc").value;
      const email = document.getElementById("bug-email").value;
      const toolId = config ? config.toolId : "homepage";

      // 1. Submit to Firestore if configured
      if (fb && fb.isConfigured()) {
        try {
          const userObj = firebase.auth().currentUser;
          await firebase.firestore().collection("bug_reports").add({
            desc,
            email: email || (userObj ? userObj.email : null),
            userId: userObj ? userObj.uid : null,
            toolId,
            createdAt: new Date().toISOString(),
            status: "open"
          });
        } catch (e) {
          console.error("Failed to log bug report to Firestore:", e);
        }
      } else {
        // Local fallback
        const existing = JSON.parse(localStorage.getItem("bug_reports") || "[]");
        existing.push({ desc, email, toolId, date: new Date().toISOString() });
        localStorage.setItem("bug_reports", JSON.stringify(existing));
      }

      // 2. Build the GitHub pre-filled issue URL
      const repoUrl = "https://github.com/dhavalpalsana/engineering-toolkit/issues/new";
      const title = encodeURIComponent(`Bug: [${toolId}] issue`);
      const body = encodeURIComponent(
        `### Bug Report\n\n` +
        `**Tool:** ${toolId}\n\n` +
        `**Description:**\n${desc}\n\n` +
        `**Contact (Optional):** ${email || "N/A"}\n\n` +
        `*Submitted via Engineering Toolkit Bug Reporting Portal.*`
      );
      githubLink.href = `${repoUrl}?title=${title}&body=${body}`;

      // 3. Show success state
      bugForm.style.display = "none";
      successState.style.display = "block";
      
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    });
  };

  // ── Global Feature Suggestion Modal ────────────────────────────────
  window.openFeatureSuggestionModal = function(e, prefillTitle = "") {
    if (e) e.preventDefault();

    // Verify user is signed in before allowing suggestions
    const user = (fb && fb.isConfigured() && firebase.auth().currentUser) || null;
    if (!user) {
      if (window.showToast) window.showToast("Please sign in to suggest features.", false);
      const loginBtn = document.getElementById("auth-btn");
      if (loginBtn) loginBtn.click();
      return;
    }

    // Check if modal already exists
    let overlay = document.getElementById("feature-suggest-modal");
    if (overlay) {
      overlay.style.display = "flex";
      document.getElementById("feature-suggest-form").style.display = "block";
      document.getElementById("feature-success-state").style.display = "none";
      if (prefillTitle) {
        document.getElementById("feature-title").value = prefillTitle;
      }
      return;
    }

    overlay = document.createElement("div");
    overlay.id = "feature-suggest-modal";
    overlay.className = "pm-modal-overlay";
    overlay.style.cssText = "position:fixed; inset:0; background:rgba(9, 13, 22, 0.7); display:flex; align-items:center; justify-content:center; z-index:9999; backdrop-filter:blur(4px);";

    overlay.innerHTML = `
      <div class="pm-modal-content" style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:16px; width:100%; max-width:440px; padding:28px; position:relative; box-shadow:var(--shadow-lg); font-family:var(--font-sans);">
        <button class="pm-modal-close" id="close-feature-modal" style="position:absolute; top:12px; right:16px; background:none; border:none; color:var(--text-secondary); font-size:24px; cursor:pointer;">&times;</button>
        <div style="text-align:center; margin-bottom:20px;">
          <div style="width:44px; height:44px; background:rgba(13, 148, 136, 0.1); color:var(--accent-primary); border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 12px auto;">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
          </div>
          <h3 style="font-weight:700; font-size:18px; color:var(--text-primary); margin:0 0 6px 0;">Suggest a Feature</h3>
          <p style="font-size:13px; color:var(--text-secondary); margin:0; line-height:1.4;">Submit your ideas and improvements directly to the developer.</p>
        </div>
        <form id="feature-suggest-form">
          <div style="margin-bottom:16px; text-align:left;">
            <label style="display:block; font-size:12px; font-weight:600; color:var(--text-secondary); margin-bottom:6px;">Feature Title</label>
            <input type="text" id="feature-title" required placeholder="e.g. Add PDF exporter / new solver module" value="${prefillTitle}" style="width:100%; padding:10px 12px; border:1px solid var(--border-color); border-radius:8px; background:var(--bg-interactive); color:var(--text-primary); font-family:var(--font-sans); font-size:14px; outline:none; box-sizing:border-box;" />
          </div>
          <div style="margin-bottom:20px; text-align:left;">
            <label style="display:block; font-size:12px; font-weight:600; color:var(--text-secondary); margin-bottom:6px;">Description & Context</label>
            <textarea id="feature-desc" required placeholder="Describe how this feature should behave and why it's useful..." style="width:100%; height:110px; padding:10px 12px; border:1px solid var(--border-color); border-radius:8px; background:var(--bg-interactive); color:var(--text-primary); font-family:var(--font-sans); font-size:14px; resize:none; outline:none; box-sizing:border-box; line-height:1.4;"></textarea>
          </div>
          <button type="submit" style="width:100%; display:flex; align-items:center; justify-content:center; height:42px; background:var(--accent-primary); border:none; border-radius:8px; color:#fff; font-weight:600; cursor:pointer; font-size:14px; transition:opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">Submit Suggestion</button>
        </form>
        
        <!-- Success State -->
        <div id="feature-success-state" style="display:none; text-align:center; padding:10px 0;">
          <div style="width:44px; height:44px; background:rgba(16, 185, 129, 0.1); color:var(--color-success); border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 12px auto;">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <h4 style="font-weight:700; font-size:16px; margin:0 0 6px 0; color:var(--text-primary);">Suggestion Received!</h4>
          <p style="font-size:13px; color:var(--text-secondary); margin:0 0 24px 0; line-height:1.4;">Thank you! Your idea has been saved to the roadmap backlog.</p>
          <div style="display:flex; flex-direction:column; gap:10px;">
            <a href="#" id="feature-github-link" target="_blank" rel="noopener" style="display:flex; align-items:center; justify-content:center; text-decoration:none; height:42px; background:var(--accent-primary); color:#fff; font-weight:600; border-radius:8px; font-size:14px; transition:opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">Open GitHub Issue (Optional)</a>
            <button type="button" id="feature-done-btn" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-color); background:transparent; cursor:pointer; color:var(--text-primary); font-weight:600; font-family:var(--font-sans); font-size:14px;">Done</button>
          </div>
        </div>
      </div>
    </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = document.getElementById("close-feature-modal");
    const featureForm = document.getElementById("feature-suggest-form");
    const successState = document.getElementById("feature-success-state");
    const doneBtn = document.getElementById("feature-done-btn");
    const githubLink = document.getElementById("feature-github-link");

    const close = () => {
      overlay.style.display = "none";
      featureForm.style.display = "block";
      successState.style.display = "none";
      featureForm.reset();
    };

    closeBtn.addEventListener("click", close);
    doneBtn.addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    featureForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitBtn = featureForm.querySelector("button[type=submit]");
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = "Logging...";

      const titleVal = document.getElementById("feature-title").value;
      const descVal = document.getElementById("feature-desc").value;
      const toolId = config ? config.toolId : "homepage";

      // 1. Submit to Firestore
      if (window.fbHelper && window.fbHelper.isConfigured()) {
        try {
          const userObj = firebase.auth().currentUser;
          await window.fbHelper.suggestFeature(titleVal, descVal, toolId, userObj ? userObj.email : null);
        } catch (e) {
          console.error("Failed to log feature suggestion to Firestore:", e);
        }
      } else {
        // Local fallback
        const existing = JSON.parse(localStorage.getItem("feature_suggestions") || "[]");
        existing.push({ title: titleVal, desc: descVal, toolId, date: new Date().toISOString() });
        localStorage.setItem("feature_suggestions", JSON.stringify(existing));
      }

      // 2. Build the GitHub pre-filled issue URL
      const repoUrl = "https://github.com/dhavalpalsana/engineering-toolkit/issues/new";
      const gitTitle = encodeURIComponent(`Feature Request: [${toolId}] ${titleVal}`);
      const gitBody = encodeURIComponent(
        `### Feature Request / Suggestion\n\n` +
        `**Tool / Context:** ${toolId}\n\n` +
        `**Title:** ${titleVal}\n\n` +
        `**Description:**\n${descVal}\n\n` +
        `*Submitted via Engineering Toolkit Feature Suggestion Portal.*`
      );
      githubLink.href = `${repoUrl}?title=${gitTitle}&body=${gitBody}`;

      // 3. Show success state
      featureForm.style.display = "none";
      successState.style.display = "block";
      
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    });
  };

  // ── Safe Update / Redeploy Progress Safeguard ──────────────────────────
  window.promptUpdate = function(actionOrTime) {
    const user = (fb && fb.isConfigured() && firebase.auth().currentUser) || null;
    
    const triggerReload = () => {
      if (typeof actionOrTime === "function") {
        actionOrTime();
      } else if (actionOrTime) {
        // Hard refresh via query parameter cache-busting
        window.location.href = window.location.pathname + "?v=" + actionOrTime + window.location.hash;
      } else {
        window.location.reload();
      }
    };

    if (user) {
      if (window.showToast) window.showToast("Updating website and reloading...");
      setTimeout(triggerReload, 1000);
      return;
    }
    
    let overlay = document.getElementById("update-warning-modal");
    if (overlay) {
      overlay.style.display = "flex";
      return;
    }
    
    overlay = document.createElement("div");
    overlay.id = "update-warning-modal";
    overlay.className = "pm-modal-overlay";
    overlay.style.cssText = "position:fixed; inset:0; background:rgba(9, 13, 22, 0.7); display:flex; align-items:center; justify-content:center; z-index:9999; backdrop-filter:blur(4px);";
    
    overlay.innerHTML = `
      <div class="pm-modal-card" style="background:var(--bg-primary); border:1px solid var(--border-color); border-radius:12px; width:90%; max-width:440px; padding:24px; box-shadow:var(--shadow-lg); font-family:var(--font-sans); color:var(--text-primary); text-align:left; animation:pm-modal-fade 0.2s ease-out;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
          <div style="background:rgba(239, 68, 68, 0.1); color:#ef4444; width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          </div>
          <h3 style="margin:0; font-size:18px; font-weight:700;">Unsaved Progress Warning</h3>
        </div>
        
        <p style="margin:0 0 20px 0; font-size:14px; line-height:1.5; color:var(--text-secondary);">
          A website update is available. Because you are <strong>not signed in</strong>, updating now will reload the page and clear your current work session.
        </p>
        
        <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px;">
          <button id="update-warning-signin" style="width:100%; padding:11px; border-radius:8px; background:var(--accent-teal); color:var(--bg-primary); border:none; font-weight:600; cursor:pointer; font-size:13px; transition:opacity 0.2s;">
            🔑 Sign In (Autosaves your progress)
          </button>
          <button id="update-warning-export" style="width:100%; padding:11px; border-radius:8px; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); font-weight:600; cursor:pointer; font-size:13px; transition:opacity 0.2s;">
            📥 Export Work (Download JSON file)
          </button>
        </div>
        
        <div style="display:flex; justify-content:flex-end; gap:16px; border-top:1px solid var(--border-color); padding-top:16px; align-items:center;">
          <button id="update-warning-cancel" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; font-size:13px; font-weight:600;">Cancel</button>
          <button id="update-warning-reload" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:13px; font-weight:600;">Update Anyway</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    document.getElementById("update-warning-cancel").onclick = () => {
      overlay.style.display = "none";
    };
    
    document.getElementById("update-warning-reload").onclick = () => {
      overlay.style.display = "none";
      triggerReload();
    };
    
    document.getElementById("update-warning-signin").onclick = () => {
      overlay.style.display = "none";
      const loginBtn = document.getElementById("auth-btn");
      if (loginBtn) loginBtn.click();
    };
    
    document.getElementById("update-warning-export").onclick = () => {
      const exportBtn = document.querySelector(".hdr-right button[onclick*='exportJSON']");
      if (exportBtn) {
        exportBtn.click();
      } else if (typeof window.exportJSON === "function") {
        window.exportJSON();
      } else {
        if (window.showToast) window.showToast("Export JSON function not found on this page.", false);
      }
    };
  };

  // ── Daily Update Checker ───────────────────────────────────────────────
  const APP_LOAD_TIME = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  function checkDeployment() {
    const now = Date.now();
    const lastCheck = parseInt(localStorage.getItem("last_deploy_check") || "0");
    
    if (now - lastCheck < ONE_DAY_MS) {
      return;
    }
    
    localStorage.setItem("last_deploy_check", now.toString());

    fetch("/version.json?cb=" + now)
      .then(res => res.json())
      .then(data => {
        const deployTime = parseInt(data.version);
        if (deployTime > APP_LOAD_TIME) {
          window.promptUpdate(deployTime);
        }
      })
      .catch(err => console.warn("Could not check for updates:", err));
  }

  // Initial check throttled to once a day on load
  checkDeployment();
  // Check once a day for open tabs
  setInterval(checkDeployment, ONE_DAY_MS);
});
