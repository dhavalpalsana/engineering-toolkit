# Engineering Toolkit 🛠️

A curated, unified suite of high-performance interactive design calculators, simulation solvers, and engineering utilities — built for mechanical, electrical, aerospace, and industrial engineers.

The toolkit runs entirely client-side as a static site with optional user authentication and Firestore cloud database integration. Run it offline via local server or access it live.

🔗 **Live site:** [eng-toolkit.web.app](https://eng-toolkit.web.app)

---

## 🌟 Key Features

- **Centralized Project Manager** — Unified slide-out Projects Drawer to save, search, delete, and cross-load designs.
- **Firebase Authentication** — Multi-provider sign-in (Email/Password and Google OAuth) with Firestore database rules protecting user data.
- **Open Suggestion Portal** — Built-in workflow for requesting new engineering utilities.
- **SEO & Social-Ready** — Structured schema metadata, sitemaps, and Open Graph previews.

---

## 🧮 Tools Directory

| Tool | Domain | Key Features |
| :--- | :--- | :--- |
| [**2D Engineering Drafting Board**](tools/drafting-board/) | Mechanical / Civil | Draw parametric vector parts with snaps (endpoints, intersections, tangents, perpendiculars), Levenberg-Marquardt geometric constraint solver, and ASCII DXF import/export pipeline. |
| [**Structural Beam Solver**](tools/beam-calculator/) | Mechanical / Civil | 1D Finite Element Analysis (FEA) solver, custom materials & shapes (I-Beam, Box, pipe), support presets, and live interactive SFD/BMD/Deflection diagrams. |
| [**Ishikawa Fishbone Diagram**](tools/fishbone-diagram/) | Quality & Systems | Pre-built templates (6M, 8P, 4S), auto-scaling dynamic SVG, PNG/SVG exports, and Cloud Project Manager sync. |
| [**Dynamic Cable Thermal Solver**](tools/wire-gauge/) | Electrical / Thermo | Real-time proportional SVG heat maps, multi-segment series derating, NEC/IEC limit checks, and gauge optimization. |
| [**Parametric Heatsink Simulator**](tools/heatsink-simulator/) | Thermal / CAD | 3D voxel heat diffusion solver, custom materials (Aluminum/Copper/Magnesium/Anisotropic Graphite), 1D airflow advection network, micro-scale TIM interface resistance, and sharing links. |
| [**Engineering Unit Converter**](tools/unit-converter/) | General Utility | Bidirectional conversions across 23 categories (Mechanics, Thermo, Fluids, Electrical) with instant fuzzy search. |
| [**Busbar Capacity Calculator**](tools/busbar-sizing/) | Power Systems | DC skin effect, EM forces, deflection, short-circuit ratings, and voltage drops with live SVG busbar previews. |
| [**CAN Bus Harness Designer**](tools/can-bus-designer/) | Aerospace / Auto | Interactive drag-and-drop topology canvas, ISO 11898 compliance checker, propagation delays, and signal reflection model. |
| [**Plot Data Extractor**](tools/plot-extractor/) | Data / Analytics | Full digitizer: multi chart kinds, time/ln/1/x scales, image prep, mask + autotrace, measurements, CSV. |
| [**Barcode & QR Code Scanner**](tools/code-scanner/) | General Utility | Client-side webcam/image decoding scanner, history logger, CSV exports, sharing links, and Project Manager sync. |
| [**Interactive Time Planner**](tools/timezone-converter/) | General Utility | Multi-timezone alignment layout with visual daylight/night/work segments, horizontal continuous gradients, and JDN/Julian conversions. |
| [**MCC Feeder & Starter Designer**](tools/mcc-feeder-designer/) | Electrical / Control | Design Motor Control Center Single Line Diagrams. Drag & drop DOL starters, VFDs, soft starters, and cables with real-time sizing calculations. |
| [**MOSFET Power Loss Calculator**](tools/mosfet-power-loss/) | Electrical / Thermo | Physics-based semiconductor power loss modeler. Calculate and compare conduction, switching, gate charge, dead-time, and Coss losses side-by-side for multiple devices. |
| [**Risk Management Dashboard**](tools/risk-management/) | Management / Quality | Capture, score, and visualise project risks with heat-map, category filters, top-5 view, and weekly trend charts. Cloud sync for signed-in users. |
| [**True Rent vs Buy Calculator**](tools/rent-vs-buy/) | Personal Finance (US) | Apples-to-apples wealth model: %/$ inputs, liquid asset buckets, keep-vs-sell mode, opportunity cost, PMI, tax shield, break-even, sensitivity (**beta**). |

---

## 🏗️ Project Architecture

```
engineering-toolkit/
├── index.html                # Hub / dashboard
├── version.json              # Site build id (shown in tool footers)
├── css/
│   ├── theme.css             # Shared design tokens
│   ├── header.css            # Standard tool header
│   ├── tool-shell.css        # Beta banner + shared footer
│   └── style.css             # Hub styles
├── js/
│   ├── firebase.js           # Firebase app init & Firestore CRUD
│   ├── auth-ui.js            # Sign-in modal
│   ├── tools-data.js         # Tool registry (id, status, physicsVersion)
│   ├── tool-shell.js         # Shared chrome + version line
│   ├── tool-exports.js       # Export / import / share menu
│   ├── project-manager.js    # Projects drawer + cloud sync
│   ├── analytics.js          # Privacy-safe usage counters
│   └── app.js                # Hub search and filtering
├── tools/<tool-id>/          # Standard package per tool:
│   ├── index.html            # Markup + script/CSS includes
│   ├── app.js                # UI + orchestration
│   ├── style.css             # Tool-local styles (tokens only)
│   └── js/                   # Optional pure engines + *.test.js goldens
├── scripts/                  # check-site, smoke tests
├── robots.txt
└── sitemap.xml
```

### Adding a New Tool
1. **Scaffold** `tools/<tool-id>/{index.html, app.js, style.css}`.
2. **Register** in `js/tools-data.js` with a `physicsVersion` (integer; bump when formulas change).
3. **Shared CSS**: `theme.css` → `header.css` → `tool-shell.css` → `style.css`.
4. **Shared scripts** (order): Firebase → `firebase.js` → `auth-ui.js` → `tools-data.js` → `tool-shell.js` → `tool-exports.js` → `project-manager.js` → `analytics.js` → optional `js/physics.js` → `app.js`.
5. **Wire** `window.projectManagerConfig` and `ToolExports.register` (see `.agents/AGENTS.md`).
6. **Golden tests**: put pure calculation code under `tools/<id>/js/` and add `*.test.js` cases with known answers.

```bash
npm run check   # registry, packaging, script order, syntax
npm test        # unit + golden physics tests
npm run smoke   # Playwright hub + every live tool
npm run verify  # all of the above
```

---

## 🔬 Golden physics tests

CI does more than “page loads.” Pure engines under `tools/*/js/` are covered by fixed cases (hand calcs / standard tables):

| Tool | Module | Examples |
|------|--------|----------|
| Beam FEA | `beam-calculator/js/fea.js` | Simply-supported mid-load vs \(PL/4\), \(PL^3/48EI\) |
| Busbar | `busbar-sizing/js/physics.js` | DC \(R\), IEC short-circuit \(k/\sqrt{t}\), multi-bar \(K_N\) |
| CAN | `can-bus-designer/js/physics.js` | Termination, stubs, timing budget |
| Wire thermal | `wire-gauge/js/physics.js` | \(\rho(T)\), thermal iteration, DC drop |
| MOSFET | `mosfet-power-loss/js/physics.js` | Conduction / switching / Coss losses |
| Heatsink helpers | `heatsink-simulator/js/physics.js` | \(D_h\), Darcy \(\Delta p\), film \(\rho\) |
| Risk | `risk-management/js/scoring.js` | 5×5 matrix thresholds, residual score |
| Units | `unit-converter/js/convert.js` | Temperature + NIST-style factors |
| Drafting | `solver.js` / `dxf.js` | Constraints + DXF round-trip |

When you change a formula, **update the golden test** and **increment `physicsVersion`** in `tools-data.js` for that tool so share links and support reports stay coherent.

---

## 📊 Analytics privacy

`js/analytics.js` writes **aggregate counters only** (no third-party cookies).

**Never sent:** emails, project names, drawing / risk / CAN / beam payloads, share URLs, free-text form fields.

**Allowed:** `toolId`, event name (`hub_view`, `tool_open`, `tool_engaged`, `tool_exit_*`, `bug_report_open`, `pm_open`, `share_copy`), anonymous session id (local only), coarse duration buckets.

Data lands on Firestore `tool_stats/{toolId}` as incrementing fields. See the header comment in `js/analytics.js` for the full event list.

---

## 🏷️ Versioning

- **`version.json`** — site build id (deploy / support).
- **`physicsVersion`** per tool in `tools-data.js` — calculation engine revision.

Tool footers (via `tool-shell.js`) show both, e.g. `build 1783458900 · physics v1 · can-bus-designer`. Quote that line when reporting a bug or comparing numeric results.

---

## 💻 Local Usage & Offline Mode

No build system required. Run entirely static:
```bash
# Start local server to avoid browser file:// origin CORS quirks
python -m http.server 8000
# or: npx serve .

# Open http://localhost:8000 in your browser
```

---

## 📄 License

Open-source under the **GNU GPLv3 License**.
