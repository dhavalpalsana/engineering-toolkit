/**
 * tool-shell.js — Shared chrome for Engineering Toolkit tool pages.
 *
 * Responsibilities:
 *  - Resolve tool metadata from tools-data.js / projectManagerConfig
 *  - Inject a dismissible Beta banner with one-click bug report
 *  - Ensure a standardized tool footer exists
 *  - Provide helpers to build a standardized header (opt-in)
 *
 * Load order (typical tool page):
 *   firebase → auth-ui → tools-data.js → tool-shell.js → project-manager.js → app.js
 *
 * Optional config (set before this script runs, or anytime before DOMContentLoaded):
 *   window.toolShellConfig = {
 *     toolId: "beam-calculator",     // defaults to URL / projectManagerConfig
 *     showBetaBanner: true,          // default true when status === "beta"
 *     showFooter: true,              // default true
 *     hubPath: "../../index.html"
 *   };
 */
(function () {
  "use strict";

  const FOOTER_HTML = `
    <div class="tool-footer-content">
      <p>&copy; ${new Date().getFullYear()} Engineering Toolkit. Open-source GPLv3.</p>
      <div class="tool-footer-links">
        <a href="https://buymeacoffee.com/dhavalpalsana" target="_blank" rel="noopener" class="coffee-link">☕ Buy me a coffee</a>
        <span class="divider">|</span>
        <a href="#" data-shell-action="suggest">💡 Suggest Feature</a>
        <span class="divider">|</span>
        <a href="#" data-shell-action="bug">🐛 Report a Bug</a>
        <span class="divider">|</span>
        <a href="https://github.com/dhavalpalsana/engineering-toolkit" target="_blank" rel="noopener">GitHub</a>
      </div>
    </div>
  `;

  function getConfig() {
    return window.toolShellConfig || {};
  }

  function detectToolId() {
    const cfg = getConfig();
    if (cfg.toolId) return cfg.toolId;
    if (window.projectManagerConfig && window.projectManagerConfig.toolId) {
      return window.projectManagerConfig.toolId;
    }
    const path = window.location.pathname || "";
    const match = path.match(/\/tools\/([^/]+)/);
    return match ? match[1] : null;
  }

  function getRegistry() {
    if (Array.isArray(window.TOOLS_DATA)) return window.TOOLS_DATA;
    if (Array.isArray(window.toolsRegistry)) return window.toolsRegistry;
    return [];
  }

  function getToolMeta(toolId) {
    if (!toolId) return null;
    return getRegistry().find((t) => t.id === toolId) || null;
  }

  function hubPath() {
    return getConfig().hubPath || "../../index.html";
  }

  function betaDismissKey(toolId) {
    return `tool_beta_banner_dismissed_${toolId}`;
  }

  function injectBetaBanner(tool) {
    const cfg = getConfig();
    if (cfg.showBetaBanner === false) return;
    if (!tool || tool.status !== "beta") return;
    if (document.getElementById("tool-beta-banner")) return;
    if (sessionStorage.getItem(betaDismissKey(tool.id)) === "1") return;

    const banner = document.createElement("div");
    banner.id = "tool-beta-banner";
    banner.className = "tool-beta-banner";
    banner.setAttribute("role", "status");
    banner.innerHTML = `
      <span class="tool-beta-banner-badge">Beta</span>
      <span class="tool-beta-banner-text">
        You're using <strong>${escapeHtml(tool.name || tool.id)}</strong> in beta —
        results are usable, but expect refinements. Feedback is welcome.
      </span>
      <span class="tool-beta-banner-actions">
        <button type="button" class="tool-beta-banner-btn primary" data-shell-action="bug">
          Report a Bug
        </button>
        <button type="button" class="tool-beta-banner-dismiss" title="Dismiss for this session" aria-label="Dismiss beta banner">&times;</button>
      </span>
    `;

    const header = document.querySelector("header");
    if (header && header.parentNode) {
      header.insertAdjacentElement("afterend", banner);
    } else {
      document.body.insertBefore(banner, document.body.firstChild);
    }

    banner.querySelector(".tool-beta-banner-dismiss")?.addEventListener("click", () => {
      sessionStorage.setItem(betaDismissKey(tool.id), "1");
      banner.remove();
    });

    banner.querySelector('[data-shell-action="bug"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      openBugReport(e);
    });
  }

  function ensureFooter() {
    const cfg = getConfig();
    if (cfg.showFooter === false) return;

    let footer = document.querySelector("footer.tool-footer");
    if (!footer) {
      footer = document.createElement("footer");
      footer.className = "tool-footer";
      footer.innerHTML = FOOTER_HTML;
      document.body.appendChild(footer);
    } else if (!footer.querySelector(".tool-footer-links")) {
      footer.innerHTML = FOOTER_HTML;
    }

    footer.querySelectorAll("[data-shell-action]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const action = el.getAttribute("data-shell-action");
        if (action === "bug") openBugReport(e);
        if (action === "suggest") openSuggest(e);
      });
    });

    // Normalize legacy inline onclick footers to the same handlers
    footer.querySelectorAll('a[onclick*="openBugReportModal"]').forEach((a) => {
      a.removeAttribute("onclick");
      a.addEventListener("click", (e) => {
        e.preventDefault();
        openBugReport(e);
      });
    });
    footer.querySelectorAll('a[onclick*="openFeatureSuggestionModal"]').forEach((a) => {
      a.removeAttribute("onclick");
      a.addEventListener("click", (e) => {
        e.preventDefault();
        openSuggest(e);
      });
    });
  }

  function openBugReport(e) {
    if (typeof window.openBugReportModal === "function") {
      window.openBugReportModal(e);
    } else if (window.showToast) {
      window.showToast("Sign in to report bugs (bug form loads with project manager).", false);
    } else {
      alert("Bug report is available after the page fully loads. Please try again in a moment.");
    }
  }

  function openSuggest(e) {
    if (typeof window.openFeatureSuggestionModal === "function") {
      window.openFeatureSuggestionModal(e);
    } else if (window.showToast) {
      window.showToast("Feature suggestions load with the page chrome.", false);
    }
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * Optional: build a standardized header into a container.
   * Usage:
   *   window.ToolShell.renderHeader(document.getElementById('header-host'), {
   *     title, subtitle, iconHtml, showShare, showExport, showImport
   *   });
   */
  function renderHeader(container, options = {}) {
    if (!container) return;
    const title = options.title || "Engineering Tool";
    const subtitle = options.subtitle || "";
    const iconHtml = options.iconHtml || '<i data-lucide="wrench"></i>';
    const showShare = options.showShare !== false;
    const showExport = options.showExport !== false;
    const showImport = options.showImport !== false;
    const extraRightHtml = options.extraRightHtml || "";

    const actions = [];
    if (showShare) {
      actions.push(`<button type="button" onclick="typeof shareLink==='function'&&shareLink()" class="hdr-btn hdr-btn-accent" title="Copy sharing link to clipboard"><i data-lucide="share-2"></i> Share Link</button>`);
    }
    if (showExport) {
      actions.push(`<button type="button" onclick="typeof exportJSON==='function'&&exportJSON()" class="hdr-btn" title="Export to JSON file"><i data-lucide="download"></i> Export JSON</button>`);
    }
    if (showImport) {
      actions.push(`<button type="button" onclick="document.getElementById('import-file-input')&&document.getElementById('import-file-input').click()" class="hdr-btn" title="Import from JSON file"><i data-lucide="upload"></i> Import JSON</button>`);
      actions.push(`<input id="import-file-input" type="file" accept=".json" class="hidden" onchange="typeof importJSON==='function'&&importJSON(event)" style="display:none" />`);
    }

    container.innerHTML = `
      <div class="hdr">
        <div class="hdr-left">
          <a href="${hubPath()}" class="hdr-back-btn" title="Back to Engineering Toolkit">
            <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </a>
          <div class="hdr-icon">${iconHtml}</div>
          <div class="hdr-titles">
            <h1>${escapeHtml(title)}</h1>
            ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
          </div>
        </div>
        <div class="hdr-right">
          ${actions.join("\n")}
          ${extraRightHtml}
          <div class="hdr-divider"></div>
          <button id="auth-btn" title="Sign In">
            <i data-lucide="user"></i> <span id="auth-btn-text">Sign In</span>
          </button>
        </div>
      </div>
    `;

    if (typeof lucide !== "undefined" && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  function boot() {
    const toolId = detectToolId();
    const tool = getToolMeta(toolId);
    injectBetaBanner(tool);
    ensureFooter();

    // Expose resolved meta for tools/analytics
    window.ToolShell = window.ToolShell || {};
    window.ToolShell.toolId = toolId;
    window.ToolShell.toolMeta = tool;
  }

  window.ToolShell = {
    boot,
    renderHeader,
    detectToolId,
    getToolMeta,
    openBugReport,
    openSuggest
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
