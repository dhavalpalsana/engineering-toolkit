/**
 * tool-shell.js — Shared chrome for Engineering Toolkit tool pages.
 *
 * Responsibilities:
 *  - Resolve tool metadata from tools-data.js / projectManagerConfig
 *  - Inject a dismissible Beta banner with one-click bug report
 *  - Ensure a standardized tool footer exists
 *  - Provide helpers to build a standardized header (opt-in)
 *  - Queue bug/suggest clicks until project-manager modals are ready
 *
 * ── New tool checklist ──────────────────────────────────────────────
 * 1. Register in js/tools-data.js (id, name, status, icon, path, physicsVersion).
 * 2. Scaffold: tools/<id>/{index.html, app.js, style.css}
 *    Optional pure engine: tools/<id>/js/*.js (+ *.test.js golden cases).
 * 3. CSS: theme.css → header.css → tool-shell.css → style.css (no Tailwind CDN).
 * 4. Script load order:
 *      firebase-app/auth/firestore CDN
 *      → ../../js/firebase.js
 *      → ../../js/auth-ui.js
 *      → ../../js/tools-data.js
 *      → ../../js/registry.js   (optional; hub icons)
 *      → ../../js/tool-shell.js
 *      → ../../js/tool-exports.js
 *      → ../../js/project-manager.js
 *      → ../../js/analytics.js  (privacy-safe counters only)
 *      → js/<physics>.js       (optional pure modules)
 *      → app.js
 * 5. window.projectManagerConfig = { toolId, getInputs, setInputs } (unless exempt).
 * 6. ToolExports.register(...) for export/import menu (unless exempt).
 * 7. Standardized header with #auth-btn and .hdr-icon.
 * 8. Golden tests for any non-trivial physics; bump physicsVersion on formula changes.
 * Footer shows build (version.json) + physicsVersion for support.
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
      <p class="tool-footer-version" data-shell-version hidden></p>
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

  /** Cached site version from /version.json (build id). */
  let cachedSiteVersion = null;

  /** Pending shell actions if PM modals are not registered yet. */
  let pendingAction = null; // { type: 'bug'|'suggest', eventLike }
  let pendingPollTimer = null;

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

  /** Context attached to bug reports (no project payload / PII beyond path). */
  function getBugContext() {
    const toolId = detectToolId() || "unknown";
    return {
      toolId,
      path: (window.location && window.location.pathname) || "",
      href: (window.location && window.location.href) || "",
      userAgent: (typeof navigator !== "undefined" && navigator.userAgent) || "",
      screen: (typeof window !== "undefined" && window.screen)
        ? `${window.screen.width}x${window.screen.height}`
        : "",
      ts: new Date().toISOString()
    };
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

  function versionJsonUrl() {
    // Tool pages live under /tools/<id>/; hub is at root.
    const path = (window.location && window.location.pathname) || "";
    if (path.includes("/tools/")) return "../../version.json";
    return "./version.json";
  }

  function formatVersionLine(siteVersion, tool) {
    const parts = [];
    if (siteVersion) parts.push(`build ${siteVersion}`);
    if (tool && tool.physicsVersion != null) {
      parts.push(`physics v${tool.physicsVersion}`);
    }
    if (tool && tool.id) parts.push(tool.id);
    return parts.length ? parts.join(" · ") : "";
  }

  function applyVersionToFooter(footer, tool) {
    if (!footer) return;
    let el = footer.querySelector("[data-shell-version]");
    if (!el) {
      el = document.createElement("p");
      el.className = "tool-footer-version";
      el.setAttribute("data-shell-version", "");
      const firstP = footer.querySelector(".tool-footer-content p");
      if (firstP && firstP.parentNode) {
        firstP.insertAdjacentElement("afterend", el);
      } else {
        footer.appendChild(el);
      }
    }
    const line = formatVersionLine(cachedSiteVersion, tool);
    if (line) {
      el.textContent = line;
      el.hidden = false;
      el.title = "Report this version when filing bugs or comparing calculation results";
    }
  }

  function loadSiteVersion(footer, tool) {
    applyVersionToFooter(footer, tool);
    if (cachedSiteVersion != null) return;
    const url = versionJsonUrl();
    // Prefer fetch; fall back silently if offline / file://
    if (typeof fetch !== "function") return;
    fetch(url, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.version != null) {
          cachedSiteVersion = String(data.version);
          window.ET_SITE_VERSION = cachedSiteVersion;
          applyVersionToFooter(footer, tool);
        }
      })
      .catch(() => { /* offline / blocked — leave physicsVersion only */ });
  }

  function ensureFooter() {
    const cfg = getConfig();
    if (cfg.showFooter === false) return;

    const toolId = detectToolId();
    const tool = getToolMeta(toolId);

    let footer = document.querySelector("footer.tool-footer");
    if (!footer) {
      footer = document.createElement("footer");
      footer.className = "tool-footer";
      footer.innerHTML = FOOTER_HTML;
      document.body.appendChild(footer);
    } else if (!footer.querySelector(".tool-footer-links")) {
      footer.innerHTML = FOOTER_HTML;
    } else if (!footer.querySelector("[data-shell-version]")) {
      // Enhance existing static footers with version line
      applyVersionToFooter(footer, tool);
    }

    loadSiteVersion(footer, tool);

    footer.querySelectorAll("[data-shell-action]").forEach((el) => {
      // Avoid double-binding on re-boot
      if (el.dataset.shellBound === "1") return;
      el.dataset.shellBound = "1";
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
      if (a.dataset.shellBound === "1") return;
      a.dataset.shellBound = "1";
      a.addEventListener("click", (e) => {
        e.preventDefault();
        openBugReport(e);
      });
    });
    footer.querySelectorAll('a[onclick*="openFeatureSuggestionModal"]').forEach((a) => {
      a.removeAttribute("onclick");
      if (a.dataset.shellBound === "1") return;
      a.dataset.shellBound = "1";
      a.addEventListener("click", (e) => {
        e.preventDefault();
        openSuggest(e);
      });
    });
  }

  function clearPendingPoll() {
    if (pendingPollTimer) {
      clearInterval(pendingPollTimer);
      pendingPollTimer = null;
    }
  }

  function flushPendingAction() {
    if (!pendingAction) return false;
    const { type } = pendingAction;
    if (type === "bug" && typeof window.openBugReportModal === "function") {
      const act = pendingAction;
      pendingAction = null;
      clearPendingPoll();
      window.openBugReportModal(act.eventLike || null);
      return true;
    }
    if (type === "suggest" && typeof window.openFeatureSuggestionModal === "function") {
      const act = pendingAction;
      pendingAction = null;
      clearPendingPoll();
      window.openFeatureSuggestionModal(act.eventLike || null);
      return true;
    }
    return false;
  }

  function queueAction(type, e) {
    pendingAction = { type, eventLike: e || null };
    if (pendingPollTimer) return;
    let tries = 0;
    pendingPollTimer = setInterval(() => {
      tries += 1;
      if (flushPendingAction() || tries > 40) {
        // ~4s at 100ms
        if (tries > 40 && pendingAction) {
          pendingAction = null;
          clearPendingPoll();
          if (window.showToast) {
            window.showToast("Page is still loading — try Report Bug again in a moment.", false);
          }
        }
      }
    }, 100);
  }

  function openBugReport(e) {
    if (e && e.preventDefault) e.preventDefault();
    try {
      if (window.ETAnalytics && typeof window.ETAnalytics.track === "function") {
        window.ETAnalytics.track("bug_report_open");
      }
    } catch (_) { /* ignore */ }

    if (typeof window.openBugReportModal === "function") {
      window.openBugReportModal(e);
      return;
    }
    // Queue until project-manager registers the modal
    queueAction("bug", e);
    if (window.showToast) {
      window.showToast("Opening bug report…", true);
    }
  }

  function openSuggest(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (typeof window.openFeatureSuggestionModal === "function") {
      window.openFeatureSuggestionModal(e);
      return;
    }
    queueAction("suggest", e);
    if (window.showToast) {
      window.showToast("Opening suggestion form…", true);
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

  /**
   * Sync tool page header logo with the hub card icon from registryIcons.
   * Hub (app.js) and tool headers must share the same SVG artwork.
   */
  function syncHeaderIcon(tool) {
    if (!tool || !tool.icon) return;
    const icons = window.registryIcons;
    if (!icons || !icons[tool.icon]) return;

    const host = document.querySelector("header .hdr-icon");
    if (!host) return;

    host.innerHTML = icons[tool.icon];

    host.querySelectorAll("svg").forEach((svg) => {
      svg.setAttribute("width", "22");
      svg.setAttribute("height", "22");
      svg.removeAttribute("class");
      if (!svg.getAttribute("fill")) svg.setAttribute("fill", "none");
      if (!svg.getAttribute("stroke")) svg.setAttribute("stroke", "currentColor");
    });
  }

  function boot() {
    const toolId = detectToolId();
    const tool = getToolMeta(toolId);
    syncHeaderIcon(tool);
    injectBetaBanner(tool);
    ensureFooter();
    flushPendingAction();

    window.ToolShell = window.ToolShell || {};
    window.ToolShell.toolId = toolId;
    window.ToolShell.toolMeta = tool;
    window.ToolShell.syncHeaderIcon = syncHeaderIcon;
    window.ToolShell.getBugContext = getBugContext;
    window.ToolShell.flushPendingAction = flushPendingAction;
  }

  window.ToolShell = {
    boot,
    renderHeader,
    detectToolId,
    getToolMeta,
    getBugContext,
    openBugReport,
    openSuggest,
    syncHeaderIcon,
    flushPendingAction
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
