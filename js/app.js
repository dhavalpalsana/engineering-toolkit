document.addEventListener("DOMContentLoaded", () => {
  // DOM Selection
  const searchInput = document.getElementById("search-input");
  const toolsGrid = document.getElementById("tools-grid");
  const themeToggleBtn = document.getElementById("theme-toggle");
  const activeCountEl = document.getElementById("active-count");
  const totalCountEl = document.getElementById("total-count");

  // Local suggest-btn on homepage header
  const suggestBtn = document.getElementById("suggest-btn");

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
      document.getElementById("suggest-from-empty").addEventListener("click", (e) => window.openFeatureSuggestionModal(e, searchInput.value));
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
        <div class="tool-card-footer">
          ${isActive 
            ? `<span class="launch-btn">Open Tool ${registryIcons.arrowRight}</span>` 
            : `<span class="coming-soon-text">Under Development</span>`
          }
        </div>
      `;

      const handleActivate = (e) => {
        if (isActive) {
          window.location.href = tool.path;
        } else {
          window.openFeatureSuggestionModal(e, `Propose: ${tool.name}`);
        }
      };

      card.addEventListener("click", (e) => handleActivate(e));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleActivate(e);
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

  // Bind header Suggest Feature button
  if (suggestBtn) {
    suggestBtn.addEventListener("click", (e) => window.openFeatureSuggestionModal(e));
  }

  // Initial Run
  initStats();
  renderCards(toolsRegistry);
});
