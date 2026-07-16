/**
 * tool-exports.js — Standard Export dropdown + deliverables helpers.
 *
 * Tools register capabilities:
 *   window.ToolExports.register({
 *     json: () => exportJSON(),
 *     share: () => shareLink(),       // optional if Share stays outside
 *     import: () => …,               // optional
 *     csv: () => …,
 *     image: () => …,
 *     report: () => …,
 *     markdown: () => string | Promise<string>,
 *     extra: [{ id, label, run }]
 *   });
 *
 * Mount once (auto on DOMContentLoaded if .hdr-right exists):
 *   ToolExports.mount();
 *
 * Share envelope helpers:
 *   encodeToolShare(toolId, payload) / decodeToolShare(str, expectedToolId)
 */
(function () {
  "use strict";

  const registry = {
    json: null,
    share: null,
    import: null,
    csv: null,
    image: null,
    svg: null,
    dxf: null,
    ics: null,
    report: null,
    markdown: null,
    extra: []
  };

  let mounted = false;
  let menuEl = null;
  let triggerBtn = null;

  function toast(msg, ok) {
    if (window.showToast) window.showToast(msg, ok !== false);
  }

  function getPhysicsVersion(toolId) {
    const list = window.TOOLS_DATA || window.toolsRegistry || [];
    const t = list.find((x) => x.id === toolId);
    return t && t.physicsVersion != null ? Number(t.physicsVersion) : 1;
  }

  /** Encode share payload with platform envelope. */
  function encodeToolShare(toolId, payload) {
    const envelope = {
      v: 1,
      toolId: toolId || "unknown",
      physicsVersion: getPhysicsVersion(toolId),
      payload
    };
    if (window.encodeShareState) return window.encodeShareState(envelope);
    // Fallback UTF-8-safe base64
    const json = JSON.stringify(envelope);
    const bytes = new TextEncoder().encode(json);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  /**
   * Decode share string. Returns { ok, payload, warning, error }.
   * Accepts legacy plain tool state (no envelope).
   */
  function decodeToolShare(str, expectedToolId) {
    let raw;
    try {
      if (window.decodeShareState) raw = window.decodeShareState(str);
      else {
        const binary = atob(str);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        raw = JSON.parse(new TextDecoder().decode(bytes));
      }
    } catch (e) {
      return { ok: false, payload: null, warning: null, error: e.message || "Invalid share data" };
    }

    // Legacy: plain object without envelope
    if (!raw || typeof raw !== "object" || raw.v == null || raw.payload == null) {
      return { ok: true, payload: raw, warning: null, error: null, legacy: true };
    }

    if (expectedToolId && raw.toolId && raw.toolId !== expectedToolId) {
      return {
        ok: false,
        payload: null,
        warning: null,
        error: `This link is for "${raw.toolId}", not "${expectedToolId}".`
      };
    }

    const current = getPhysicsVersion(expectedToolId || raw.toolId);
    const shared = Number(raw.physicsVersion) || 1;
    let warning = null;
    if (shared < current) {
      warning = `This link was created with an older calculation model (v${shared}; current v${current}). Results may differ — review inputs before relying on numbers.`;
    } else if (shared > current) {
      warning = `This link was created with a newer calculation model (v${shared}; this page is v${current}). Refresh the page or update your bookmark.`;
    }

    return { ok: true, payload: raw.payload, warning, error: null, physicsVersion: shared };
  }

  function showPhysicsWarning(message) {
    if (!message) return;
    let banner = document.getElementById("et-physics-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "et-physics-banner";
      banner.className = "et-physics-banner";
      banner.setAttribute("role", "status");
      const header = document.querySelector("header");
      if (header && header.parentNode) header.insertAdjacentElement("afterend", banner);
      else document.body.insertBefore(banner, document.body.firstChild);
    }
    banner.innerHTML = `
      <span>${escapeHtml(message)}</span>
      <button type="button" class="et-guest-banner-dismiss" aria-label="Dismiss">&times;</button>
    `;
    banner.querySelector("button")?.addEventListener("click", () => banner.remove());
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function copyText(text) {
    const t = String(text ?? "");
    try {
      await navigator.clipboard.writeText(t);
      toast("Copied to clipboard");
      return true;
    } catch (_) {
      try {
        const ta = document.createElement("textarea");
        ta.value = t;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        toast("Copied to clipboard");
        return true;
      } catch (e2) {
        toast("Copy failed", false);
        return false;
      }
    }
  }

  async function copyMarkdown(mdOrFn) {
    let md = typeof mdOrFn === "function" ? await mdOrFn() : mdOrFn;
    if (!md) {
      toast("Nothing to copy", false);
      return false;
    }
    return copyText(md);
  }

  /**
   * Open a print-friendly report window.
   * @param {{ title: string, metaLines?: string[], sections?: Array<{heading?: string, html?: string, text?: string, imageDataUrl?: string}> }} opts
   */
  function openPrintReport(opts) {
    const title = (opts && opts.title) || "Engineering Report";
    const metaLines = (opts && opts.metaLines) || [];
    const sections = (opts && opts.sections) || [];
    const w = window.open("", "_blank");
    if (!w) {
      toast("Pop-up blocked — allow pop-ups for print/PDF reports", false);
      return;
    }
    const metaHtml = metaLines.map((l) => escapeHtml(l)).join(" · ");
    const body = sections
      .map((s) => {
        let inner = "";
        if (s.imageDataUrl) {
          inner += `<img src="${s.imageDataUrl}" alt="${escapeHtml(s.heading || "")}" />`;
        }
        if (s.html) inner += s.html;
        if (s.text) inner += `<pre class="report-pre">${escapeHtml(s.text)}</pre>`;
        return `${s.heading ? `<h2>${escapeHtml(s.heading)}</h2>` : ""}${inner}`;
      })
      .join("\n");

    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; margin: 24px; color: #0f172a; line-height: 1.45; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        h2 { font-size: 14px; margin: 18px 0 8px; color: #334155; }
        .meta { color: #64748b; font-size: 12px; margin-bottom: 20px; }
        img { width: 100%; max-width: 960px; border: 1px solid #e2e8f0; border-radius: 8px; }
        table { border-collapse: collapse; width: 100%; max-width: 960px; font-size: 13px; }
        th, td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; }
        th { background: #f8fafc; }
        .report-pre { white-space: pre-wrap; font-family: ui-monospace, monospace; font-size: 12px; background: #f8fafc; padding: 12px; border-radius: 8px; }
        @media print { body { margin: 12px; } .noprint { display: none !important; } }
      </style></head><body>
      <button class="noprint" onclick="window.print()" style="padding:8px 14px;margin-bottom:16px;cursor:pointer;font-weight:600;">Print / Save as PDF</button>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">${metaHtml}${metaHtml ? " · " : ""}Generated ${escapeHtml(new Date().toLocaleString())}</div>
      ${body}
      </body></html>`);
    w.document.close();
    toast("Print/PDF view opened");
  }

  /** Optional selectors of body/header UI to hide once the dropdown owns those actions. */
  let hideSelectors = [];

  function register(partial) {
    if (!partial || typeof partial !== "object") return;
    Object.keys(partial).forEach((k) => {
      if (k === "extra" && Array.isArray(partial.extra)) {
        // Replace extras on each register (tools pass the full tool-specific list)
        registry.extra = partial.extra.slice();
      } else if (k === "hide" && Array.isArray(partial.hide)) {
        hideSelectors = hideSelectors.concat(partial.hide);
      } else if (partial[k] != null) {
        registry[k] = partial[k];
      }
    });
    // Defaults from window globals if not provided
    if (!registry.json && typeof window.exportJSON === "function") {
      registry.json = () => window.exportJSON();
    }
    if (!registry.json && typeof window.exportStateJSON === "function") {
      registry.json = () => window.exportStateJSON();
    }
    if (!registry.share && typeof window.shareLink === "function") registry.share = () => window.shareLink();
    if (!registry.import) {
      if (typeof window.importJSON === "function") {
        registry.import = () => {
          const input =
            document.getElementById("import-file-input") ||
            document.getElementById("file-import");
          if (input) input.click();
          else window.importJSON();
        };
      } else if (typeof window.importStateJSON === "function") {
        registry.import = () => {
          const input = document.getElementById("import-file-input");
          if (input) input.click();
        };
      }
    }
    if (mounted) {
      hideRedundantExportUi(document.querySelector("header .hdr-right"));
      rebuildMenuItems();
    }
  }

  function isExportOrImportButton(btn) {
    if (!btn || btn.id === "auth-btn") return false;
    if (btn.closest(".project-actions-group") || btn.closest(".et-export-dropdown")) return false;
    // Keep Share Link outside the menu
    if (btn.classList.contains("hdr-btn-accent") || btn.id === "btn-share") {
      const t = (btn.textContent || "").toLowerCase();
      if (t.includes("share")) return false;
    }
    const label = (btn.textContent || "").toLowerCase().replace(/\s+/g, " ");
    const onclick = (btn.getAttribute("onclick") || "").toLowerCase();
    const title = (btn.getAttribute("title") || "").toLowerCase();
    const id = (btn.id || "").toLowerCase();
    const exportHints = [
      "export json",
      "import json",
      "export design",
      "export diagram",
      "export setup",
      "export scan",
      "export risk",
      "export schematic",
      "export drawing",
      "export harness",
      "export state",
      "save configuration to a json"
    ];
    if (
      exportHints.some((h) => label.includes(h) || title.includes(h)) ||
      onclick.includes("exportjson") ||
      onclick.includes("exportstatejson") ||
      onclick.includes("importjson") ||
      onclick.includes("importstatejson") ||
      id === "btn-export" ||
      id === "btn-import" ||
      (label.includes("export") && label.includes("json")) ||
      (label.includes("import") && label.includes("json"))
    ) {
      return true;
    }
    return false;
  }

  function hideLegacyHeaderButtons(headerRight) {
    if (!headerRight) return;
    headerRight.querySelectorAll("button").forEach((btn) => {
      if (isExportOrImportButton(btn)) {
        btn.style.display = "none";
        btn.setAttribute("data-et-export-hidden", "1");
      }
    });
    headerRight.querySelectorAll("#import-file-input, #file-import").forEach((el) => {
      el.style.display = "none";
    });
  }

  /** Hide body/toolbar export controls that moved into the header dropdown. */
  function hideRedundantExportUi(headerRight) {
    hideLegacyHeaderButtons(headerRight);
    document.querySelectorAll("[data-et-export-ui]").forEach((el) => {
      el.style.display = "none";
      el.setAttribute("data-et-export-hidden", "1");
      el.setAttribute("aria-hidden", "true");
    });
    hideSelectors.forEach((sel) => {
      try {
        document.querySelectorAll(sel).forEach((el) => {
          el.style.display = "none";
          el.setAttribute("data-et-export-hidden", "1");
          el.setAttribute("aria-hidden", "true");
        });
      } catch (_) { /* invalid selector */ }
    });
  }

  function buildItems() {
    const items = [];
    // Standard slots first
    if (registry.json) items.push({ id: "json", label: "Export JSON", run: registry.json });
    if (registry.csv) items.push({ id: "csv", label: "Export CSV", run: registry.csv });
    if (registry.image) items.push({ id: "image", label: "Export Image / PNG", run: registry.image });
    if (registry.svg) items.push({ id: "svg", label: "Export SVG", run: registry.svg });
    if (registry.dxf) items.push({ id: "dxf", label: "Export DXF", run: registry.dxf });
    if (registry.ics) items.push({ id: "ics", label: "Export ICS calendar", run: registry.ics });
    if (registry.report) items.push({ id: "report", label: "Report / Print PDF", run: registry.report });
    if (registry.markdown) {
      items.push({
        id: "markdown",
        label: "Copy results (Markdown)",
        run: () => copyMarkdown(registry.markdown)
      });
    }
    // Tool-specific extras (unique ids)
    const seen = new Set(items.map((i) => i.id));
    (registry.extra || []).forEach((x, i) => {
      if (!x || !x.label || typeof x.run !== "function") return;
      const id = x.id || "extra-" + i;
      if (seen.has(id)) return;
      seen.add(id);
      items.push({ id, label: x.label, run: x.run });
    });
    // Import last
    if (registry.import) items.push({ id: "import", label: "Import JSON…", run: registry.import });
    return items;
  }

  function rebuildMenuItems() {
    if (!menuEl) return;
    const items = buildItems();
    menuEl.innerHTML = items
      .map(
        (it) =>
          `<button type="button" class="et-export-item" role="menuitem" data-id="${escapeHtml(it.id)}">${escapeHtml(it.label)}</button>`
      )
      .join("");
    menuEl.querySelectorAll(".et-export-item").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const item = items.find((x) => x.id === id);
        closeMenu();
        if (!item) return;
        try {
          await item.run();
          if (id === "json" && window.pmMaybeGuestUpgradeCta) window.pmMaybeGuestUpgradeCta();
        } catch (err) {
          console.error(err);
          toast(err.message || "Export failed", false);
        }
      });
    });
    if (triggerBtn) triggerBtn.style.display = items.length ? "inline-flex" : "none";
  }

  function closeMenu() {
    if (menuEl) menuEl.classList.remove("open");
    if (triggerBtn) triggerBtn.setAttribute("aria-expanded", "false");
  }

  function openMenu() {
    if (menuEl) menuEl.classList.add("open");
    if (triggerBtn) triggerBtn.setAttribute("aria-expanded", "true");
  }

  /**
   * insertBefore that works when the reference node was re-parented
   * (e.g. #auth-btn wrapped in .auth-btn-wrapper by auth-ui.js).
   */
  function safeInsertBefore(parent, newNode, referenceNode) {
    if (!parent || !newNode) return;
    if (!referenceNode) {
      parent.appendChild(newNode);
      return;
    }
    if (referenceNode.parentNode === parent) {
      parent.insertBefore(newNode, referenceNode);
      return;
    }
    // Walk up until we find a direct child of parent that contains the ref
    let node = referenceNode;
    while (node && node.parentNode && node.parentNode !== parent) {
      node = node.parentNode;
    }
    if (node && node.parentNode === parent) {
      parent.insertBefore(newNode, node);
    } else {
      parent.appendChild(newNode);
    }
  }

  function mount(headerRight) {
    const host = headerRight || document.querySelector("header .hdr-right");
    if (!host) return;
    if (host.querySelector(".et-export-dropdown")) {
      mounted = true;
      rebuildMenuItems();
      return;
    }

    // Defaults from globals
    if (!registry.json && typeof window.exportJSON === "function") registry.json = () => window.exportJSON();
    if (!registry.json && typeof window.exportStateJSON === "function") {
      registry.json = () => window.exportStateJSON();
    }
    if (!registry.import && typeof window.importJSON === "function") {
      registry.import = () =>
        (document.getElementById("import-file-input") || document.getElementById("file-import"))?.click();
    }

    // Skip empty Export chrome on tools with no export capabilities (e.g. unit-converter)
    const provisionalItems = buildItems();
    if (provisionalItems.length === 0) {
      mounted = true;
      return;
    }

    hideRedundantExportUi(host);

    const wrap = document.createElement("div");
    wrap.className = "et-export-dropdown";
    wrap.innerHTML = `
      <button type="button" class="hdr-btn et-export-trigger" aria-haspopup="menu" aria-expanded="false" title="Export, import, and reports">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span>Export</span>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="et-export-menu" role="menu"></div>
    `;

    // Insert before project actions / divider / auth (auth may be wrapped)
    const divider = host.querySelector(".hdr-divider");
    const auth = host.querySelector("#auth-btn");
    const authWrap = host.querySelector(".auth-btn-wrapper");
    const pm = host.querySelector(".project-actions-group");
    const before = pm || divider || authWrap || auth;
    safeInsertBefore(host, wrap, before);

    triggerBtn = wrap.querySelector(".et-export-trigger");
    menuEl = wrap.querySelector(".et-export-menu");
    mounted = true;
    rebuildMenuItems();
    // Second pass after tools finish wiring DOM
    setTimeout(() => hideRedundantExportUi(host), 100);

    triggerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (menuEl.classList.contains("open")) closeMenu();
      else openMenu();
    });

    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) closeMenu();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });

    // Guest upgrade CTA on share clicks (Share stays outside menu)
    host.querySelectorAll("button.hdr-btn-accent, #btn-share").forEach((btn) => {
      if (btn.dataset.etShareHooked === "1") return;
      btn.dataset.etShareHooked = "1";
      btn.addEventListener("click", () => {
        setTimeout(() => {
          if (window.pmMaybeGuestUpgradeCta) window.pmMaybeGuestUpgradeCta();
        }, 400);
      });
    });
  }

  // Auto-mount after tools register (defer so app.js can register first)
  function autoMount() {
    setTimeout(() => {
      if (document.querySelector("header .hdr-right")) mount();
    }, 50);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMount);
  } else {
    autoMount();
  }

  window.ToolExports = {
    register,
    mount,
    hideRedundantExportUi,
    openPrintReport,
    copyText,
    copyMarkdown,
    encodeToolShare,
    decodeToolShare,
    showPhysicsWarning,
    getPhysicsVersion
  };

  // Convenient globals used by tools
  window.encodeToolShare = encodeToolShare;
  window.decodeToolShare = decodeToolShare;
})();
