/**
 * Global Project Manager for Engineering Toolkit
 * Handles unified Project Drawer on both homepage and tool subpages.
 */
document.addEventListener("DOMContentLoaded", () => {
  const config = window.projectManagerConfig;
  const isHomepage = !config;
  const fb = window.fbHelper;

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
    drawerList.innerHTML = `<div class="pm-empty-state">Loading saved projects...</div>`;
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
              <span class="pm-item-date">Updated: ${dateStr}</span>
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
        if (confirm(`Are you sure you want to delete "${name}"?`)) {
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
        }
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

    const updateActiveIndicator = () => {
      if (activeProject) {
        activeNameEl.textContent = activeProject.name;
        activeNameEl.style.display = "block";
        saveBtn.title = `Save updates to ${activeProject.name}`;
      } else {
        activeNameEl.textContent = "";
        activeNameEl.style.display = "none";
        saveBtn.title = "Save current design";
      }
    };

    // Open button click opens drawer directly on this page!
    openBtn.addEventListener("click", openDrawer);

    // Save current design Modal
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
            showToast(`Auto-saved "${activeProject.name}"`);
          }
        } catch (err) {
          showToast("Auto-save failed: " + (err.message || "Unknown error"), false);
        } finally {
          saveBtn.disabled = false;
          saveBtn.innerHTML = originalHtml;
        }
      } else {
        openSaveModal();
      }
    });

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
});
