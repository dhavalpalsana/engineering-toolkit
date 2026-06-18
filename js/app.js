document.addEventListener("DOMContentLoaded", () => {
  // DOM Selection
  const searchInput = document.getElementById("search-input");
  const toolsGrid = document.getElementById("tools-grid");
  const themeToggleBtn = document.getElementById("theme-toggle");
  const activeCountEl = document.getElementById("active-count");
  const totalCountEl = document.getElementById("total-count");

  // Modal Selection
  const requestModal = document.getElementById("request-modal");
  const requestForm = document.getElementById("request-form");
  const suggestBtn = document.getElementById("suggest-btn");
  const modalCloseBtn = document.getElementById("modal-close");

  // Initial Theme Sync
  const initTheme = () => {
    const savedTheme = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
  };
  initTheme();

  // Theme Toggler
  themeToggleBtn.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
  });

  // Load Icons dynamically
  const getIconSvg = (name) => {
    return registryIcons[name] || registryIcons["lightbulb"];
  };

  // Render Tool Cards
  const renderCards = (filteredTools) => {
    toolsGrid.innerHTML = "";

    if (filteredTools.length === 0) {
      // Empty State Layout
      const emptyState = document.createElement("div");
      emptyState.className = "empty-state";
      emptyState.innerHTML = `
        ${getIconSvg("search")}
        <h3 class="empty-state-title">No tools found</h3>
        <p class="empty-state-desc">We couldn't find any tools matching your search query. Try another term or suggest a new tool!</p>
        <button class="suggest-btn" id="suggest-from-empty">Suggest a Tool</button>
      `;
      toolsGrid.appendChild(emptyState);

      // Bind suggest button inside empty state
      document.getElementById("suggest-from-empty").addEventListener("click", openModal);
      return;
    }

    filteredTools.forEach(tool => {
      const card = document.createElement("div");
      card.className = "tool-card";
      
      const isActive = tool.status === "active";
      const badgeClass = isActive ? "active" : "upcoming";
      const badgeText = isActive ? "Active" : "Coming Soon";
      
      card.innerHTML = `
        <div class="tool-card-header">
          <div class="tool-icon-box">
            ${getIconSvg(tool.icon)}
          </div>
          <span class="tool-badge ${badgeClass}">${badgeText}</span>
        </div>
        <h3 class="tool-card-title">${tool.name}</h3>
        <p class="tool-card-desc">${tool.description}</p>
        <div class="tool-card-tags">
          ${tool.tags.map(tag => `<span class="tool-tag">#${tag}</span>`).join("")}
        </div>
        <div class="tool-card-footer">
          ${isActive 
            ? `<span class="launch-btn">Launch Calculator ${registryIcons.arrowRight}</span>` 
            : `<span class="coming-soon-text">Under Development</span>`
          }
        </div>
      `;

      if (isActive) {
        card.addEventListener("click", () => {
          window.location.href = tool.path;
        });
      } else {
        card.addEventListener("click", () => {
          openModalWithTool(tool.name);
        });
      }

      toolsGrid.appendChild(card);
    });
  };

  // Search Logic
  const handleSearch = () => {
    const query = searchInput.value.toLowerCase().trim();
    if (!query) {
      renderCards(toolsRegistry);
      return;
    }

    const filtered = toolsRegistry.filter(tool => {
      const matchName = tool.name.toLowerCase().includes(query);
      const matchDesc = tool.description.toLowerCase().includes(query);
      const matchTags = tool.tags.some(tag => tag.toLowerCase().includes(query));
      return matchName || matchDesc || matchTags;
    });

    renderCards(filtered);
  };

  searchInput.addEventListener("input", handleSearch);

  // Stats Init
  const initStats = () => {
    const activeCount = toolsRegistry.filter(t => t.status === "active").length;
    activeCountEl.textContent = activeCount;
    totalCountEl.textContent = toolsRegistry.length;
  };

  // Keyboard Shortcuts (Ctrl+K or Cmd+K or / key to focus search)
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      searchInput.focus();
    } else if (e.key === "/" && document.activeElement !== searchInput) {
      // If pressing forward slash when not typing in form inputs
      if (document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        e.preventDefault();
        searchInput.focus();
      }
    }
  });

  // Modal Functionality
  const openModal = () => {
    requestModal.classList.add("active");
    document.getElementById("tool-name-input").value = "";
    document.getElementById("tool-name-input").focus();
  };

  const openModalWithTool = (toolName) => {
    requestModal.classList.add("active");
    document.getElementById("tool-name-input").value = toolName;
    document.getElementById("tool-description-input").focus();
  };

  const closeModal = () => {
    requestModal.classList.remove("active");
  };

  // Bind main suggestion buttons
  suggestBtn.addEventListener("click", openModal);
  modalCloseBtn.addEventListener("click", closeModal);
  requestModal.addEventListener("click", (e) => {
    if (e.target === requestModal) {
      closeModal();
    }
  });

  // Escape key closes modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && requestModal.classList.contains("active")) {
      closeModal();
    }
  });

  // Handle Request Submission
  requestForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const toolName = document.getElementById("tool-name-input").value;
    const toolDesc = document.getElementById("tool-description-input").value;
    const contactEmail = document.getElementById("contact-email").value;

    // Simulate saving suggestions (perfect for a static github.io site)
    console.log("Tool Suggestion Received:", { toolName, toolDesc, contactEmail });
    
    // Store in local storage to keep it active for the local session demo
    const existing = JSON.parse(localStorage.getItem("tool_suggestions") || "[]");
    existing.push({ toolName, toolDesc, contactEmail, date: new Date().toISOString() });
    localStorage.setItem("tool_suggestions", JSON.stringify(existing));

    // Success feedback
    alert(`Thank you! Your suggestion for "${toolName}" has been submitted.`);
    
    // Reset and close
    requestForm.reset();
    closeModal();
  });

  // Initial Run
  initStats();
  renderCards(toolsRegistry);
});
