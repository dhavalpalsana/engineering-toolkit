# Engineering Toolkit 🛠️

A curated, unified suite of high-performance interactive design calculators, simulation solvers, and engineering utilities — built for mechanical, electrical, aerospace, and industrial engineers.

The toolkit runs entirely client-side as a static site with optional user authentication and Firestore cloud database integration. Double-click `index.html` to run offline, or access it live on Firebase Hosting.

🔗 **Live site:** [eng-toolkit.web.app](https://eng-toolkit.web.app)

---

## 🌟 Key Features

- **Centralized Project Manager** — Unified slide-out Projects Drawer on both the homepage and within individual tools. Authenticated users can save, search, delete, and cross-load their designs.
- **Firebase Authentication** — Multi-provider sign-in (Email/Password and Google OAuth) with security rules protecting user-owned data in Cloud Firestore.
- **Premium Interactive Dashboard** — Sleek, dark-capable design with micro-animations, global search (`Ctrl + K` or `/`), and instant tool filtering by tag.
- **Bi-Directional Theme Sync** — Light ↔ Dark mode synced across all tool pages via `localStorage`. Toggle anywhere; every page follows.
- **Open Suggestion Portal** — Built-in workflow for requesting new engineering utilities.
- **SEO & Social-Ready** — Open Graph and Twitter Card meta tags on all pages, with `robots.txt` and `sitemap.xml`.
- **Keyboard Accessible** — All tool cards support `Tab` → `Enter`/`Space` navigation.

---

## 🧮 Active Tools

### 🌊 Ishikawa Fishbone Diagram Creator (`tools/fishbone-diagram/`)

An interactive, high-fidelity cause-and-effect diagram builder for professional root-cause analysis sessions.

- **Pre-built Templates** — Manufacturing (6M), Service (8P), Software (4S), and custom frameworks
- **Dynamic Layout Engine** — Auto-scales branches and spine based on cause density
- **Export** — SVG vector and PNG raster download at any resolution
- **Dark/Light Themes** — Full theme support with custom color palettes
- **State Persistence** — Auto-saves to `localStorage` (offline) and Firestore (cloud) under user accounts
- **Project Manager Integration** — Load, save, rename, and delete designs directly via the slide-out drawer

---

### ⚡ Dynamic Cable Thermal & Loss Solver (`tools/wire-gauge/`)

A thermodynamic + electrodynamic solver for multi-segment series-spliced cable harnesses. Goes far beyond standard lookup tables.

- **Proportional SVG Heat Map** — Real-time diagram of splicing points and local temperature rise per segment
- **Physical Envelope Checks** — Tracks peak thermal limits and voltage drop budgets against NEC/IEC derating
- **Dynamic Optimization Matrix** — Iterative AWG/metric wire-size shifts to suggest the optimal conductor cross-section
- **State Persistence** — Auto-saves to `localStorage` (offline) and Firestore (cloud) under user accounts
- **Project Manager Integration** — Load, save, rename, and delete designs directly via the slide-out drawer

---

### 📐 Engineering Unit Converter (`tools/unit-converter/`)

Instant bidirectional conversion across **23 engineering categories** with live search and a full reference table.

| Group | Categories |
|---|---|
| **Mechanics** | Acceleration, Area, Density, Force, Frequency, Length, Mass Flow, Pressure, Stress, Time, Torque, Velocity, Volume, Volume Flow |
| **Thermodynamics** | Energy, Heat Flux, Heat Transfer Coefficient, Power, Specific Heat, Temperature, Thermal Conductivity |
| **Fluids** | Dynamic Viscosity, Kinematic Viscosity |
| **Electrical** | Current, Voltage |

- **Live Search** — Filter categories and unit names as you type (press `/` to focus)
- **Bidirectional** — Type in either field; both update instantly
- **Swap Button** — Reverse from/to units in one click
- **Copy to Clipboard** — Hover result to reveal copy button; toast confirmation
- **Reference Table** — All units in the active category with base-unit equivalents

---

### 🏗️ Busbar Capacity Calculator (`tools/busbar-sizing/`)

Full physics-based busbar design implementing the **CDA "Copper for Busbars"** methodology across 7 calculation modules.

- **Module 1 — DC Resistance:** Temperature-corrected resistivity, cross-section, weight per metre
- **Module 2 — AC Skin Effect:** Classical slab formula (k_s = Rac/Rdc), skin depth δ at operating temperature
- **Module 3 — Thermal Current Capacity:** Heat balance (I²R = Q_conv + Q_rad); emissivity and orientation corrections
- **Module 4 — Multi-Bar Derating:** CDA factors for 1–4 bars per phase (k₁=1.0 … k₄=3.2)
- **Module 5 — Short-Circuit Thermal Rating:** IEC 60865-1 adiabatic withstand; peak electromagnetic force between phases
- **Module 6 — Mechanical Deflection:** Simply-supported beam under fault EM load; bending stress vs. yield strength
- **Module 7 — Voltage Drop:** mV/m, total ΔV, % of system voltage
- **Materials:** Copper HC (ETP) and Aluminium 1350-H19 with correct physical constants
- **Live SVG Preview:** Scaled cross-section with skin depth shading; multi-bar arrangement
- **State Persistence** — Auto-saves to `localStorage` (offline) and Firestore (cloud) under user accounts
- **Project Manager Integration** — Load, save, rename, and delete designs directly via the slide-out drawer

---

### 🔌 CAN Bus Harness Designer & Analyzer (`tools/can-bus-designer/`)

An interactive physical-layer designer and compliance checker for CAN/CAN FD electrical harnesses.

- **Interactive SVG Topology Canvas** — Drag nodes and edit spacing or stub lengths on a live coordinate-snapping grid
- **Compliance Checking** — Automated validation against ISO 11898 standard requirements (maximum stub/trunk lengths, termination, bit-rate limits)
- **Signal Integrity Simulation** — Qualitative reflection engine estimates signal degradation and ringing based on impedance mismatches
- **Timing & Budget Analysis** — Verifies round-trip propagation times and Loop Delays against sample point constraints (supports dual rates in CAN FD phase)
- **State Persistence** — Auto-saves to `localStorage` (offline) and Firestore (cloud) under user accounts
- **Project Manager Integration** — Load, save, rename, and delete designs directly via the slide-out drawer

---

### 📊 Plot Data Extractor (`tools/plot-extractor/`)

**Plot Data Extractor** — Upload or paste a plot/graph image and digitize data points with pixel-accurate calibration. Supports linear/log axes, multi-series extraction, undo/redo, curve fitting (linear, polynomial, power, exponential), and CSV export.

- **Pixel-Accurate Calibration** — Set axis origin and scale with sub-pixel magnifier zoom for precise coordinate mapping
- **Linear & Log Axes** — Independently configure X/Y axes as linear or logarithmic
- **Multi-Series Extraction** — Label and color-code multiple data series on a single image
- **Undo / Redo** — Full history stack for non-destructive point editing
- **Curve Fitting** — Automatic regression: linear, polynomial (2nd–5th order), power-law, and exponential models with R² display
- **CSV Export** — Download extracted coordinates in standard comma-separated format

---

## 🔜 Coming Soon

| Tool | Domain |
|---|---|
| Bolt Torque & Tension Calculator | Mechanical |
| Pipe Pressure Drop & Flow Calculator | Fluids |

---

## 🏗️ Architecture

The project is a **pure static site** — no build system, no Node.js, no package.json required.

```
engineering-toolkit/
├── index.html                # Hub / dashboard
├── css/
│   ├── style.css             # Global shared design system (tokens, layout, components)
│   └── theme.css             # Global dark/light theme variables and UI inputs
├── js/
│   ├── firebase.js           # Firebase app init & Firestore CRUD operations
│   ├── auth-ui.js            # Injected sign-in/up/forgot modal interface & styling
│   ├── project-manager.js    # Slide-out saved project list drawer & active load sync
│   ├── tools-data.js         # ← SINGLE SOURCE OF TRUTH for tool registry
│   ├── registry.js           # Thin shim: const toolsRegistry = TOOLS_DATA
│   └── app.js                # Dashboard rendering, search, filtering, theme
├── assets/
│   └── og-image.png          # Social preview (1200×630)
├── tools/
│   ├── fishbone-diagram/
│   │   ├── index.html        # Ishikawa creator HTML
│   │   └── app.js            # Fishbone canvas engine and project hook mapping
│   ├── wire-gauge/
│   │   ├── index.html        # Conductor synthesis HTML
│   │   └── app.js            # Cable thermodynamics & project hook mapping
│   ├── unit-converter/
│   │   └── index.html        # Self-contained unit converter
│   ├── busbar-sizing/
│   │   └── index.html        # Busbar calculations & project hook mapping
│   └── can-bus-designer/
│       ├── index.html        # CAN visual designer HTML
│       ├── style.css         # Local stylesheets
│       └── app.js            # Design & simulation engine
│   └── plot-extractor/
│       ├── index.html        # Plot digitizer HTML
│       └── style.css         # Local stylesheets
├── robots.txt
└── sitemap.xml
```

### Adding a New Tool

1. **Create the tool page** in `tools/<tool-id>/index.html`
2. **Register it** by adding a new entry to `js/tools-data.js`:
   ```js
   {
     id: "my-new-tool",
     name: "My New Tool",
     description: "Short description shown on the hub card.",
     tags: ["mechanical", "thermal"],
     icon: "wrench",          // any key from registryIcons in registry.js
     path: "./tools/my-new-tool/index.html",
     status: "active"         // "active" | "coming-soon"
   }
   ```
3. **Integrate Unified Styling**:
   - Link the global stylesheet: `<link rel="stylesheet" href="../../css/theme.css">`
   - Bind layout container widths to `max-width: var(--max-width);` (sets a standard `1600px` max-width).
   - Set interactive inputs/selects backgrounds to `var(--bg-interactive)` (and `var(--bg-interactive-disabled)` when locked).
   - Align fonts to global typography variables (e.g., `var(--font-size-sm)` for inputs/labels, `var(--font-size-base)` for minor titles).
   - Include early theme syncing scripts in `<head>` to prevent flash of un-themed mode (FOUC).
4. That's it — the hub auto-renders the card, badge, and stats.

---

## 💻 Local Usage & Offline Mode

No server required for most features.

```bash
# Option 1: Direct open (works for most tools)
# Double-click index.html

# Option 2: Local server (recommended — avoids any file:// origin quirks)
python -m http.server 8000
# Then open http://localhost:8000
```

---

## 📄 License

Open-source under the **GNU GPLv3 License**. Fork, expand, and self-host freely.
