# Engineering Toolkit — Agent Design Principles & Project Rules

This document outlines the core architecture guidelines, design rules, and user experience (UX) requirements for the **Engineering Toolkit** repository. All current and future AI agents working on this project must read, understand, and strictly follow these rules to ensure consistency, high-fidelity UI, and clean code.

---

## 1. Global CSS Design Tokens & Theme System
* **Central Token Registry**: All design tokens (colors, font sizes, weights, spacing, borders, shadows, and transitions) are defined in `/css/theme.css`.
* **CSS Variable Priority**: Always use custom CSS properties (e.g., `var(--bg-primary)`, `var(--text-primary)`, `var(--border-color)`, `var(--font-sans)`) rather than hardcoding hexadecimal, RGB, or HSL values. This guarantees correct light/dark theme synchronization.
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
      
      <!-- Standard Theme Toggle -->
      <button id="theme-toggle" class="hdr-icon-btn" title="Toggle Light/Dark Theme">
        <i data-lucide="moon" class="moon-icon"></i>
        <i data-lucide="sun" class="sun-icon"></i>
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

## 4. Auth & Project Manager Integration
* Ensure the page imports Firebase scripts and the shared helpers:
  ```html
  <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js"></script>
  <script src="../../js/firebase.js"></script>
  <script src="../../js/auth-ui.js"></script>
  <script src="../../js/project-manager.js"></script>
  ```
* Register the tool with the global `window.projectManagerConfig` inside `app.js` before loading `project-manager.js` to enable online/offline project saving:
  ```javascript
  window.projectManagerConfig = {
    toolId: "your-tool-id",
    getInputs: () => ({ ... }), // returns state object
    setInputs: (data) => { ... } // sets state object
  };
  ```
