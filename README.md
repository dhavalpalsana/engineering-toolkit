# Engineering Toolkit 🛠️

A curated, unified suite of high-performance interactive design calculators, simulation solvers, and engineering utilities — built for mechanical, electrical, aerospace, and industrial engineers.

The toolkit runs entirely client-side as a static site: no backend, no build step, no dependencies. Double-click `index.html` to run offline, or access it live on GitHub Pages.

🔗 **Live site:** [dhavalpalsana.github.io/engineering-toolkit/](https://dhavalpalsana.github.io/engineering-toolkit/)

---

## 🌟 Key Features

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
- **AI Brainstorm Mode** — Gemini-powered cause generation from a problem description
- **Export** — SVG vector and PNG raster download at any resolution
- **Dark/Light Themes** — Full theme support with custom color palettes
- **State Persistence** — Diagrams auto-save to `localStorage`

---

### ⚡ Dynamic Cable Thermal & Loss Solver (`tools/wire-gauge/`)

A thermodynamic + electrodynamic solver for multi-segment series-spliced cable harnesses. Goes far beyond standard lookup tables.

- **Proportional SVG Heat Map** — Real-time diagram of splicing points and local temperature rise per segment
- **Physical Envelope Checks** — Tracks peak thermal limits and voltage drop budgets against NEC/IEC derating
- **Dynamic Optimization Matrix** — Iterative AWG/metric wire-size shifts to suggest the optimal conductor cross-section
- **AI Design Assistant** — Natural language interface (Gemini) translates system descriptions into simulation parameters
- **State Export / Import** — Full configuration snapshots as JSON payloads

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

---

## 🔜 Coming Soon

| Tool | Domain |
|---|---|
| Busbar Capacity Calculator | Electrical |
| Bolt Torque & Tension Calculator | Mechanical |
| Pipe Pressure Drop & Flow Calculator | Fluids |

---

## 🏗️ Architecture

The project is a **pure static site** — no build system, no Node.js, no package.json required.

```
engineering-toolkit/
├── index.html                # Hub / dashboard
├── css/style.css             # Global shared design system (tokens, layout, components)
├── js/
│   ├── tools-data.js         # ← SINGLE SOURCE OF TRUTH for tool registry
│   ├── registry.js           # Thin shim: const toolsRegistry = TOOLS_DATA
│   └── app.js                # Dashboard rendering, search, filtering, theme
├── assets/
│   └── og-image.png          # Social preview (1200×630)
├── tools/
│   ├── fishbone-diagram/
│   │   ├── index.html        # HTML + Tailwind CDN
│   │   └── app.js            # All diagram logic (~1100 lines)
│   ├── wire-gauge/
│   │   ├── index.html        # HTML + Tailwind CDN
│   │   └── app.js            # All solver logic (~1100 lines)
│   └── unit-converter/
│       └── index.html        # Self-contained (no Tailwind, uses design tokens)
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
3. That's it — the hub auto-renders the card, badge, and stats.

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
