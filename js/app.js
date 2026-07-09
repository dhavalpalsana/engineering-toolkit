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

    // Show a clean notice if no actual tools matched a search query
    const query = searchInput.value.toLowerCase().trim();
    if (filteredTools.length === 0 && query) {
      const notice = document.createElement("div");
      notice.className = "search-no-results";
      notice.style.gridColumn = "1 / -1";
      notice.style.textAlign = "center";
      notice.style.padding = "24px 12px 12px 12px";
      notice.style.color = "var(--text-muted)";
      notice.style.fontSize = "var(--font-size-sm)";
      notice.innerHTML = `<p>No tools matched "<strong>${escapeHtml(query)}</strong>". You can submit a proposal below:</p>`;
      toolsGrid.appendChild(notice);
    }

    // Render regular tools
    filteredTools.forEach(tool => {
      const card = document.createElement("div");
      card.className = "tool-card";

      const isActive = tool.status === "active";
      const isBeta = tool.status === "beta";
      const isAvailable = isActive || isBeta;

      const badgeClass = isActive ? "active" : (isBeta ? "beta" : "upcoming");
      const badgeText = isActive ? "Active" : (isBeta ? "Beta" : "Coming Soon");
      const ariaLabel = isAvailable
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
          ${isAvailable 
            ? `<span class="launch-btn">Open Tool ${registryIcons.arrowRight}</span>` 
            : `<span class="coming-soon-text">Under Development</span>`
          }
        </div>
      `;

      const handleActivate = (e) => {
        if (isAvailable) {
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

    // Unconditionally append 'Suggest a Tool' card at the end
    const suggestCard = document.createElement("div");
    suggestCard.className = "tool-card suggest-tool-card";
    suggestCard.setAttribute("role", "button");
    suggestCard.setAttribute("tabindex", "0");
    suggestCard.setAttribute("aria-label", "Suggest a new tool");
    
    suggestCard.innerHTML = `
      <div class="tool-card-header">
        <div class="tool-icon-box" style="background: var(--accent-primary-glow); color: var(--accent-primary);">
          ${getIconSvg("lightbulb")}
        </div>
        <span class="tool-badge active" style="background: var(--accent-primary-glow); color: var(--accent-primary);">New Request</span>
      </div>
      <h3 class="tool-card-title">Suggest a Tool</h3>
      <p class="tool-card-desc">Can't find the specific engineering tool or calculator you need? Submit a proposal to our development team.</p>
      <div class="tool-card-footer">
        <span class="launch-btn" style="color: var(--accent-primary);">Submit Proposal ${registryIcons.arrowRight}</span>
      </div>
    `;

    const handleSuggest = (e) => {
      if (window.openFeatureSuggestionModal) {
        window.openFeatureSuggestionModal(e, searchInput.value ? `Search: ${searchInput.value}` : "New Tool Suggestion");
      }
    };

    suggestCard.addEventListener("click", handleSuggest);
    suggestCard.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleSuggest(e);
      }
    });

    toolsGrid.appendChild(suggestCard);
  };

  const escapeHtml = (str) => {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
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
