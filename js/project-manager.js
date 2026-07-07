/**
 * Global Project Manager for Engineering Toolkit
 * Handles modular Saving and Loading of configurations across tools.
 */
document.addEventListener("DOMContentLoaded", () => {
  const config = window.projectManagerConfig;
  if (!config) return;

  // Inject Styles for Toolbar, Modal and Toast
  const style = document.createElement("style");
  style.textContent = `
    /* Project Actions Toolbar */
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

    /* Modal Styles */
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
      max-width: 440px;
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
    .pm-search-input {
      width: 100%;
      border: 1px solid var(--border-color);
      background-color: var(--bg-interactive);
      border-radius: var(--radius-md);
      padding: 8px 12px;
      font-family: var(--font-sans);
      font-size: 13px;
      color: var(--text-primary);
      outline: none;
      margin-bottom: 12px;
    }
    .pm-project-list {
      max-height: 240px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .pm-project-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      transition: all var(--transition-fast);
    }
    .pm-project-item:hover {
      border-color: var(--accent-primary);
      background: var(--bg-secondary);
    }
    .pm-project-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      cursor: pointer;
      flex: 1;
      min-width: 0;
    }
    .pm-project-name {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pm-project-date {
      font-size: 10px;
      color: var(--text-muted);
    }
    .pm-project-actions {
      display: flex;
      gap: 4px;
    }
    .pm-icon-btn {
      background: none;
      border: none;
      padding: 6px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pm-icon-btn:hover {
      color: var(--color-error);
      background: var(--color-error-bg);
    }
    .pm-empty-state {
      padding: 24px;
      text-align: center;
      color: var(--text-muted);
      font-size: 13px;
    }

    /* Save Modal Form */
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
      z-index: 2000;
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

  // Injected Elements State
  let activeProject = null; // { id, name }
  let cachedProjects = [];

  // Create Toast Element
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

  // Find Header elements to insert project controls
  const authBtn = document.getElementById("auth-btn");
  if (!authBtn) return;

  const headerRight = authBtn.parentElement;
  
  // Create Toolbar container
  const toolbar = document.createElement("div");
  toolbar.className = "project-actions-group";
  toolbar.style.display = "none"; // Hidden until logged in
  toolbar.innerHTML = `
    <span class="active-project-indicator" id="pm-active-name"></span>
    <button class="project-btn" id="pm-open-btn" title="Open saved designs">
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

  // Authentication state listeners
  const updateToolbarVisibility = (user) => {
    if (user && fb.isConfigured()) {
      toolbar.style.display = "flex";
      loadAndSyncIndicator();
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

  const loadAndSyncIndicator = async () => {
    // If there is a last active project ID stored locally for this tool, retrieve it
    const lastActiveId = localStorage.getItem(`pm_active_id_${config.toolId}`);
    if (lastActiveId) {
      try {
        const projects = await fb.getProjects(config.toolId);
        const match = projects.find(p => p.id === lastActiveId);
        if (match) {
          activeProject = { id: match.id, name: match.name };
          updateActiveIndicator();
        } else {
          localStorage.removeItem(`pm_active_id_${config.toolId}`);
        }
      } catch (e) {
        console.error("Error syncing project indicator:", e);
      }
    }
  };

  // Open Designs List Modal
  const openListModal = () => {
    const overlay = document.createElement("div");
    overlay.className = "pm-modal-overlay";
    overlay.id = "pm-open-modal";
    overlay.innerHTML = `
      <div class="pm-modal-content">
        <button class="pm-modal-close" id="pm-close-open-modal">&times;</button>
        <div class="pm-modal-header">
          <h3>Saved Configurations</h3>
          <p>Choose a previously saved design to load</p>
        </div>
        <input type="text" class="pm-search-input" id="pm-search" placeholder="Search designs by name...">
        <div class="pm-project-list" id="pm-list-container">
          <div class="pm-empty-state">Loading designs...</div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const closeBtn = document.getElementById("pm-close-open-modal");
    const searchInput = document.getElementById("pm-search");
    const container = document.getElementById("pm-list-container");

    const renderList = (filter = "") => {
      const filtered = cachedProjects.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
      if (filtered.length === 0) {
        container.innerHTML = `<div class="pm-empty-state">No saved designs found${filter ? " matching search" : ""}.</div>`;
        return;
      }

      container.innerHTML = filtered.map(p => {
        const dateStr = new Date(p.updatedAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });
        return `
          <div class="pm-project-item">
            <div class="pm-project-info" data-id="${p.id}">
              <span class="pm-project-name">${escapeHtml(p.name)}</span>
              <span class="pm-project-date">Last updated: ${dateStr}</span>
            </div>
            <div class="pm-project-actions">
              <button class="pm-icon-btn pm-delete-btn" data-id="${p.id}" data-name="${escapeHtml(p.name)}" title="Delete project">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </div>
        `;
      }).join("");

      // Bind loader actions
      container.querySelectorAll(".pm-project-info").forEach(el => {
        el.addEventListener("click", () => {
          const id = el.dataset.id;
          const match = cachedProjects.find(p => p.id === id);
          if (match) {
            config.setInputs(match.data);
            activeProject = { id: match.id, name: match.name };
            localStorage.setItem(`pm_active_id_${config.toolId}`, match.id);
            updateActiveIndicator();
            showToast(`Loaded "${match.name}"`);
            closeModal();
          }
        });
      });

      // Bind delete actions
      container.querySelectorAll(".pm-delete-btn").forEach(btn => {
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
              cachedProjects = cachedProjects.filter(p => p.id !== id);
              if (activeProject && activeProject.id === id) {
                activeProject = null;
                localStorage.removeItem(`pm_active_id_${config.toolId}`);
                updateActiveIndicator();
              }
              showToast(`Deleted "${name}"`);
              renderList(searchInput.value);
            }
          }
        });
      });
    };

    const closeModal = () => {
      overlay.classList.add("pm-fade-out"); // Visual hook
      setTimeout(() => overlay.remove(), 200);
    };

    closeBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
    searchInput.addEventListener("input", (e) => {
      renderList(e.target.value);
    });

    // Load actual projects from DB
    fb.getProjects(config.toolId).then(projects => {
      cachedProjects = projects;
      renderList();
    }).catch(err => {
      container.innerHTML = `<div class="pm-empty-state" style="color:var(--color-error);">Error: ${err.message}</div>`;
    });
  };

  // Save current design Modal
  const openSaveModal = (prefill = "") => {
    const overlay = document.createElement("div");
    overlay.className = "pm-modal-overlay";
    overlay.id = "pm-save-modal";
    overlay.innerHTML = `
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
    document.body.appendChild(overlay);

    const closeBtn = document.getElementById("pm-close-save-modal");
    const form = document.getElementById("pm-save-form");
    const nameInput = document.getElementById("pm-name");

    const closeModal = () => {
      setTimeout(() => overlay.remove(), 200);
    };

    closeBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = nameInput.value.trim();
      if (!name) return;

      const submitBtn = form.querySelector("button[type=submit]");
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving...";

      const data = config.getInputs();

      const { id, error } = await fb.saveProject(config.toolId, name, data);
      if (error) {
        showToast("Save failed: " + error.message, false);
        submitBtn.disabled = false;
        submitBtn.textContent = "Save Design";
      } else {
        activeProject = { id, name };
        localStorage.setItem(`pm_active_id_${config.toolId}`, id);
        updateActiveIndicator();
        showToast(`Saved "${name}"`);
        closeModal();
      }
    });

    nameInput.focus();
  };

  // Save click dispatcher (autosave vs prompts)
  saveBtn.addEventListener("click", async () => {
    if (activeProject) {
      // Autosave update to current project
      saveBtn.disabled = true;
      const originalHtml = saveBtn.innerHTML;
      saveBtn.innerHTML = "Saving...";

      const data = config.getInputs();
      const { error } = await fb.saveProject(config.toolId, activeProject.name, data, activeProject.id);
      
      if (error) {
        showToast("Auto-save failed: " + error.message, false);
      } else {
        showToast(`Auto-saved "${activeProject.name}"`);
      }
      
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalHtml;
    } else {
      openSaveModal();
    }
  });

  openBtn.addEventListener("click", openListModal);

  // Listen to Auth State Events
  document.addEventListener("auth-state-changed", (e) => {
    updateToolbarVisibility(e.detail.user);
  });

  // Check initial state
  fb.getUser().then(user => {
    updateToolbarVisibility(user);
  });

  // Helper function to escape HTML entities
  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
  }
});
