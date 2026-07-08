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
  const suggestSuccessView = document.getElementById("suggest-success-view");
  const githubIssueLink = document.getElementById("github-issue-link");
  const btnSuccessDone = document.getElementById("btn-success-done");

  // Initial Theme Sync
  const initTheme = () => {
    const savedTheme = localStorage.getItem("theme") || "light";
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
    }
  };
  initTheme();

  // Theme Toggler
  themeToggleBtn.addEventListener("click", () => {
    const isDark = document.documentElement.classList.contains("dark") || 
                   document.documentElement.getAttribute("data-theme") === "dark";
    const newTheme = isDark ? "light" : "dark";
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
    }
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

      // Accessibility: make card keyboard-navigable
      const isActive = tool.status === "active";
      const badgeClass = isActive ? "active" : "upcoming";
      const badgeText = isActive ? "Active" : "Coming Soon";
      const ariaLabel = isActive
        ? `Open ${tool.name}`
        : `${tool.name} — Coming Soon. Click to suggest this tool.`;

      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", ariaLabel);
      
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

      const handleActivate = () => {
        if (isActive) {
          window.location.href = tool.path;
        } else {
          openModalWithTool(tool.name);
        }
      };

      card.addEventListener("click", handleActivate);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleActivate();
        }
      });

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
    requestForm.style.display = "block";
    suggestSuccessView.style.display = "none";
    requestModal.classList.add("active");
    document.getElementById("tool-name-input").value = "";
    document.getElementById("tool-name-input").focus();
  };

  const openModalWithTool = (toolName) => {
    requestForm.style.display = "block";
    suggestSuccessView.style.display = "none";
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
  btnSuccessDone.addEventListener("click", closeModal);
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
  requestForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = requestForm.querySelector("button[type=submit]");
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    const toolName = document.getElementById("tool-name-input").value;
    const toolDesc = document.getElementById("tool-description-input").value;
    const contactEmail = document.getElementById("contact-email").value;

    // 1. Save to Database (Firestore with Local Fallback)
    if (window.fbHelper && typeof window.fbHelper.suggestTool === "function") {
      await window.fbHelper.suggestTool(toolName, toolDesc, contactEmail);
    } else {
      // Local fallback if firebase helper is not loaded
      const existing = JSON.parse(localStorage.getItem("tool_suggestions") || "[]");
      existing.push({ toolName, toolDesc, contactEmail, date: new Date().toISOString() });
      localStorage.setItem("tool_suggestions", JSON.stringify(existing));
    }

    // 2. Build the GitHub pre-filled issue URL
    const repoUrl = "https://github.com/dhavalpalsana/engineering-toolkit/issues/new";
    const title = encodeURIComponent(`Tool Suggestion: ${toolName}`);
    const body = encodeURIComponent(
      `### Tool Request\n\n` +
      `**Name:** ${toolName}\n\n` +
      `**Description & Requirements:**\n${toolDesc}\n\n` +
      `**Contact / Context (Optional):** ${contactEmail || "N/A"}\n\n` +
      `*Submitted via Engineering Toolkit Suggestion Portal.*`
    );
    githubIssueLink.href = `${repoUrl}?title=${title}&body=${body}`;

    // 3. Reset form and show success screen
    requestForm.reset();
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
    
    requestForm.style.display = "none";
    suggestSuccessView.style.display = "block";
  });

  // Initial Run
  initStats();
  renderCards(toolsRegistry);
});
