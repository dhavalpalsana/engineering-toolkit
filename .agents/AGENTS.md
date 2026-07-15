# Engineering Toolkit — Agent Design Principles & Project Rules

This document outlines the core architecture guidelines, design rules, and user experience (UX) requirements for the **Engineering Toolkit** repository. All current and future AI agents working on this project must read, understand, and strictly follow these rules to ensure consistency, high-fidelity UI, and clean code.

---

## 1. Global CSS Design Tokens & Theme System
* **Central Token Registry**: All design tokens (colors, font sizes, weights, spacing, borders, shadows, and transitions) are defined in `/css/theme.css`.
* **CSS Variable Priority**: Always use custom CSS properties (e.g., `var(--bg-primary)`, `var(--text-primary)`, `var(--border-color)`, `var(--font-sans)`) rather than hardcoding hexadecimal, RGB, or HSL values. This preserves a consistent shared design system.
* **Tailwind Compilation**:
  * **Do NOT use the Tailwind CDN script** (`<script src="https://cdn.tailwindcss.com">`) on any page. It bloats page load times and causes flickering.
  * Instead, define classes in the tool HTML/JS and compile them to a static, minified file via the Tailwind CLI:
    ```bash
    npx tailwindcss@3 -c tailwind.config.js -i css/tailwind-input.css -o css/tailwind.css --minify
    ```
  * Always link `css/tailwind.css` in the `<head>` of Tailwind-based tools.

---

## 2. Standardized Tool Headers
Every calculator or design tool page MUST implement the standardized header layout to preserve brand identity and cohesion.

### CSS Links
All tool pages must link `css/theme.css` and `css/header.css` in the `<head>` block:
```html
<link rel="stylesheet" href="../../css/theme.css">
<link rel="stylesheet" href="../../css/header.css">
```

### HTML Template
The header markup must match this structure exactly:
```html
<header>
  <div class="hdr">
    <div class="hdr-left">
      <!-- Standardized Back Button -->
      <a href="../../index.html" class="hdr-back-btn" title="Back to Engineering Toolkit">
        <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </a>
      
      <!-- Tool-Specific Icon -->
      <div class="hdr-icon">
        <i data-lucide="network"></i> <!-- Or raw SVG matching tool category -->
      </div>
      
      <!-- Titles -->
      <div class="hdr-titles">
        <h1>Tool Name (Keep h1 tag)</h1>
        <p>Short subtitle / description (Keep p tag)</p>
      </div>
    </div>
    
    <div class="hdr-right">
      <!-- Standardized Share & File Action Buttons -->
      <button onclick="shareLink()" class="hdr-btn hdr-btn-accent" title="Copy sharing link to clipboard">
        <i data-lucide="share-2"></i> Share Link
      </button>
      <button onclick="exportJSON()" class="hdr-btn" title="Export diagram to JSON file">
        <i data-lucide="download"></i> Export JSON
      </button>
      <button onclick="document.getElementById('import-file-input').click()" class="hdr-btn" title="Import diagram from JSON file">
        <i data-lucide="upload"></i> Import JSON
      </button>
      <input id="import-file-input" type="file" accept=".json" class="hidden" onchange="importJSON(event)" />
      
      <!-- Standard divider -->
      <div class="hdr-divider"></div>
      
      <!-- Global Auth Button (Managed by auth-ui.js) -->
      <button id="auth-btn" title="Sign In">
        <i data-lucide="user"></i> <span id="auth-btn-text">Sign In</span>
      </button>
      
    </div>
  </div>
</header>
```

---

## 3. Tool-Specific Action Button Naming
For tools supporting import/export, buttons in the `.hdr-right` toolbar must use these standardized labels and classes:
1. **Share Link**: Class `hdr-btn hdr-btn-accent` with a `share-2` icon. Copies the state URL to clipboard.
2. **Export JSON**: Class `hdr-btn` with a `download` icon. Triggers JSON file download.
3. **Import JSON**: Class `hdr-btn` with an `upload` icon. Triggers local file selector click.

---

## 4. Shared Tool Shell (Header / Footer / Beta Banner)
Every tool page should load the shared chrome stack after Firebase helpers:

```html
<link rel="stylesheet" href="../../css/theme.css">
<link rel="stylesheet" href="../../css/header.css">
<link rel="stylesheet" href="../../css/tool-shell.css">
...
<script src="../../js/firebase.js"></script>
<script src="../../js/auth-ui.js"></script>
<script src="../../js/tools-data.js"></script>
<script src="../../js/tool-shell.js"></script>
<script src="../../js/project-manager.js"></script>
```

* **`tool-shell.js`** auto-detects `toolId` from the URL (or `projectManagerConfig` / `toolShellConfig`) and:
  * Injects a **Beta** banner when `status === "beta"` in `tools-data.js` (one-click Report a Bug; dismissible for the session).
  * Ensures a standardized **footer** (coffee / suggest / bug / GitHub).
* Optional: `window.ToolShell.renderHeader(container, { title, subtitle, iconHtml, showShare, showExport, showImport })` for greenfield tools.
* Prefer keeping existing static `<header>` markup (AGENTS §2) and letting the shell enhance chrome, rather than regenerating headers on every page.

## 5. Auth & Project Manager Integration
* Ensure the page imports Firebase scripts and the shared helpers (see §4 for full order).
* Register the tool with the global `window.projectManagerConfig` **at top level of `app.js`** (or before `DOMContentLoaded` completes). `project-manager.js` defers boot so late registration still works, but top-level is safest:
  ```javascript
  window.projectManagerConfig = {
    toolId: "your-tool-id",
    getInputs: () => ({ ... }), // returns state object
    setInputs: (data) => { ... } // sets state object
  };
  ```

---

## 6. Page Layout Containment & Typography
To maintain styling parity with the rest of the project and ensure pages do not stretch to the full width of wide monitors:

### CSS Base & Typography
In the tool's local stylesheet (e.g. `style.css`), always style the `body` tag using project-wide design tokens for typography and background consistency:
```css
body {
  margin: 0;
  padding: 0;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-sans);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  line-height: 1.6;
  overflow-x: hidden;
  transition: background-color var(--transition-normal), color var(--transition-normal);
  position: relative;
}

/* Premium background decorative glow */
body::before {
  content: '';
  position: fixed;
  top: -150px;
  right: -100px;
  width: 500px;
  height: 500px;
  border-radius: var(--radius-full);
  filter: blur(140px);
  z-index: -1;
  pointer-events: none;
  background: radial-gradient(circle, var(--accent-primary-glow), transparent 70%);
  opacity: 0.8;
}
```

### Layout Container Widths
Always wrap the page content (e.g., `<main class="container page-content">`) in a `.container` class selector. Define `.container` explicitly in the tool's local style.css to constrain width and center the content:
```css
.container {
  width: 100%;
  max-width: var(--max-width, 1600px);
  margin: 0 auto;
  padding: 0 24px;
  box-sizing: border-box;
}
```
