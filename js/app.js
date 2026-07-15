document.addEventListener("DOMContentLoaded", () => {
  // DOM Selection
  const searchInput = document.getElementById("search-input");
  const toolsGrid = document.getElementById("tools-grid");

  const activeCountEl = document.getElementById("active-count");
  const totalCountEl = document.getElementById("total-count");
  const suggestBtn = document.getElementById("suggest-btn");
  
  // Sorting and Favorites Selection
  const sortSelect = document.getElementById("sort-select");
  const filterFavBtn = document.getElementById("filter-fav-btn");

  // State Management
  let userFavorites = [];
  let localFavorites = JSON.parse(localStorage.getItem("local_favorites") || "[]");
  let popularityStats = {};
  let showOnlyFavorites = false;





  // Load Icons dynamically
  const getIconSvg = (name) => {
    return registryIcons[name] || registryIcons["lightbulb"];
  };

  const createSectionDivider = (title, subtitle, variant) => {
    const divider = document.createElement("div");
    divider.className = `tools-section-divider tools-section-divider--${variant}`;
    divider.setAttribute("role", "separator");
    divider.setAttribute("aria-label", title);
    divider.innerHTML = `
      <div class="tools-section-divider-inner">
        <span class="tools-section-divider-label">${escapeHtml(title)}</span>
        ${subtitle ? `<span class="tools-section-divider-sub">${escapeHtml(subtitle)}</span>` : ""}
      </div>
    `;
    return divider;
  };

  const createToolCard = (tool) => {
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

    const isFav = isFavorited(tool.id);

    card.innerHTML = `
      <div class="tool-card-header">
        <div class="tool-icon-box">
          ${getIconSvg(tool.icon)}
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${isAvailable ? `
          <button class="tool-fav-star-btn ${isFav ? 'favorited' : ''}" data-id="${tool.id}" title="${isFav ? 'Remove from Favorites' : 'Add to Favorites'}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </button>` : ''}
          <span class="tool-badge ${badgeClass}">${badgeText}</span>
        </div>
      </div>
      <h3 class="tool-card-title">${escapeHtml(tool.name)}</h3>
      <p class="tool-card-desc">${escapeHtml(tool.description)}</p>
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

    const favBtn = card.querySelector(".tool-fav-star-btn");
    if (favBtn) {
      favBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFavorite(tool.id, favBtn);
      });
    }

    return card;
  };

  // Render Tool Cards grouped: Active → Beta → Coming Soon
  const renderCards = (filteredTools) => {
    toolsGrid.innerHTML = "";

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

    const activeTools = filteredTools.filter(t => t.status === "active");
    const betaTools = filteredTools.filter(t => t.status === "beta");
    const upcomingTools = filteredTools.filter(t => t.status !== "active" && t.status !== "beta");

    const appendGroup = (tools, title, subtitle, variant) => {
      if (tools.length === 0) return;
      toolsGrid.appendChild(createSectionDivider(title, subtitle, variant));
      tools.forEach(tool => toolsGrid.appendChild(createToolCard(tool)));
    };

    // Only show the Active header when other maturity sections are also visible
    // (avoids a redundant banner when the grid is Active-only after filtering).
    const multiSection =
      [activeTools, betaTools, upcomingTools].filter(g => g.length > 0).length > 1;

    if (activeTools.length > 0) {
      if (multiSection) {
        toolsGrid.appendChild(createSectionDivider(
          "Released",
          "Stable tools ready for day-to-day engineering work",
          "active"
        ));
      }
      activeTools.forEach(tool => toolsGrid.appendChild(createToolCard(tool)));
    }

    appendGroup(
      betaTools,
      "Beta",
      "Feature-complete enough to try — expect refinements and edge-case polish",
      "beta"
    );

    appendGroup(
      upcomingTools,
      "Coming Soon",
      "On the roadmap — click a card to vote or shape the design",
      "upcoming"
    );

    // Suggest card always last
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

  // Live filtering and sorting orchestrator
  const applyFiltersAndSort = () => {
    const query = searchInput.value.toLowerCase().trim();
    
    // 1. Filter by search input & favorites
    let result = toolsRegistry.filter(tool => {
      const matchSearch = tool.name.toLowerCase().includes(query) ||
                          tool.description.toLowerCase().includes(query) ||
                          tool.tags.some(t => t.toLowerCase().includes(query));
      
      if (showOnlyFavorites) {
        return matchSearch && isFavorited(tool.id);
      }
      return matchSearch;
    });
    
    // 2. Sort by dropdown value (within status sections; renderCards groups by maturity)
    const sortBy = sortSelect ? sortSelect.value : "default";
    if (sortBy === "alphabetical") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "popularity") {
      result.sort((a, b) => {
        const usesA = popularityStats[a.id] || 0;
        const usesB = popularityStats[b.id] || 0;
        return usesB - usesA;
      });
    } else if (sortBy === "newest") {
      result.sort((a, b) => {
        const dateA = new Date(a.releaseDate || 0);
        const dateB = new Date(b.releaseDate || 0);
        return dateB - dateA;
      });
    } else {
      // Default: keep registry order, but prefer active → beta → upcoming overall
      // (renderCards already sections them; this only stabilizes within-group order)
    }

    renderCards(result);
  };

  // Favorites Helpers
  function isFavorited(toolId) {
    if (window.firebase && firebase.auth().currentUser) {
      return userFavorites.includes(toolId);
    }
    return localFavorites.includes(toolId);
  }

  async function fetchFavorites(user) {
    if (user && window.firebase && firebase.apps.length > 0) {
      try {
        const snap = await firebase.firestore().collection("user_favorites").doc(user.uid).collection("tools").get();
        const favs = [];
        snap.forEach(doc => favs.push(doc.id));
        userFavorites = favs;
      } catch (e) {
        console.warn("Failed to load user favorites from Firestore:", e);
        userFavorites = [];
      }
    } else {
      userFavorites = [];
    }
  }

  async function toggleFavorite(toolId, starBtn) {
    const user = (window.firebase && firebase.auth().currentUser);
    
    if (!user) {
      // Trigger Sign In modal
      const authBtn = document.getElementById("auth-btn");
      if (authBtn) {
        authBtn.click();
        alert("Please sign in or create an account to save your favorite tools securely to the cloud.");
      } else {
        // Fallback local toggle
        const idx = localFavorites.indexOf(toolId);
        if (idx >= 0) {
          localFavorites.splice(idx, 1);
          starBtn.classList.remove("favorited");
        } else {
          localFavorites.push(toolId);
          starBtn.classList.add("favorited");
        }
        localStorage.setItem("local_favorites", JSON.stringify(localFavorites));
        applyFiltersAndSort();
      }
      return;
    }
    
    const ref = firebase.firestore().collection("user_favorites").doc(user.uid).collection("tools").doc(toolId);
    const exists = userFavorites.includes(toolId);
    
    try {
      if (exists) {
        await ref.delete();
        userFavorites = userFavorites.filter(id => id !== toolId);
        starBtn.classList.remove("favorited");
      } else {
        await ref.set({ favoritedAt: firebase.firestore.FieldValue.serverTimestamp() });
        userFavorites.push(toolId);
        starBtn.classList.add("favorited");
      }
      applyFiltersAndSort();
    } catch (e) {
      console.error("Failed to update Firestore favorites:", e);
    }
  }

  async function loadPopularityStats() {
    if (window.firebase && firebase.apps.length > 0) {
      try {
        const snap = await firebase.firestore().collection("tool_stats").get();
        const stats = {};
        snap.forEach(doc => {
          stats[doc.id] = doc.data().uses || 0;
        });
        return stats;
      } catch (e) {
        console.warn("Failed to fetch popularity stats:", e);
      }
    }
    return {};
  }

  // Bind UI control listeners
  searchInput.addEventListener("input", applyFiltersAndSort);

  if (sortSelect) {
    sortSelect.addEventListener("change", applyFiltersAndSort);
  }

  if (filterFavBtn) {
    filterFavBtn.addEventListener("click", () => {
      showOnlyFavorites = !showOnlyFavorites;
      filterFavBtn.classList.toggle("active", showOnlyFavorites);
      applyFiltersAndSort();
    });
  }

  // Firebase auth sync triggers
  if (window.fbHelper && window.fbHelper.isConfigured()) {
    window.fbHelper.onAuthStateChange(async (user) => {
      await fetchFavorites(user);
      applyFiltersAndSort();
    });
  }

  // Keyboard Shortcuts (Ctrl+K or Cmd+K or / key to focus search)
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      searchInput.focus();
    } else if (e.key === "/" && document.activeElement !== searchInput) {
      if (document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        e.preventDefault();
        searchInput.focus();
      }
    }
  });

  // Stats Init — count openable tools (active + beta), not GA-only
  const initStats = () => {
    const availableCount = toolsRegistry.filter(
      t => t.status === "active" || t.status === "beta"
    ).length;
    activeCountEl.textContent = availableCount;
    totalCountEl.textContent = toolsRegistry.length;
  };

  // Bind header Suggest Feature button
  if (suggestBtn) {
    suggestBtn.addEventListener("click", (e) => window.openFeatureSuggestionModal(e));
  }

  // Boot startup
  initStats();
  loadPopularityStats().then(stats => {
    popularityStats = stats;
    applyFiltersAndSort();
  });
});
