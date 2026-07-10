# Engineering Toolkit 🛠️

A curated, unified suite of high-performance interactive design calculators, simulation solvers, and engineering utilities — built for mechanical, electrical, aerospace, and industrial engineers.

The toolkit runs entirely client-side as a static site with optional user authentication and Firestore cloud database integration. Run it offline via local server or access it live.

🔗 **Live site:** [eng-toolkit.web.app](https://eng-toolkit.web.app)

---

## 🌟 Key Features

- **Centralized Project Manager** — Unified slide-out Projects Drawer to save, search, delete, and cross-load designs.
- **Firebase Authentication** — Multi-provider sign-in (Email/Password and Google OAuth) with Firestore database rules protecting user data.
- **Theme Sync** — Global Light ↔ Dark mode synced across all tool pages via `localStorage`.
- **Open Suggestion Portal** — Built-in workflow for requesting new engineering utilities.
- **SEO & Social-Ready** — Structured schema metadata, sitemaps, and Open Graph previews.

---

## 🧮 Tools Directory

| Tool | Domain | Key Features |
| :--- | :--- | :--- |
| [**Ishikawa Fishbone Diagram**](tools/fishbone-diagram/) | Quality & Systems | Pre-built templates (6M, 8P, 4S), auto-scaling dynamic SVG, PNG/SVG exports, and Cloud Project Manager sync. |
| [**Dynamic Cable Thermal Solver**](tools/wire-gauge/) | Electrical / Thermo | Real-time proportional SVG heat maps, multi-segment series derating, NEC/IEC limit checks, and gauge optimization. |
| [**Parametric Heatsink Simulator**](tools/heatsink-simulator/) | Thermal / CAD | 3D voxel heat diffusion CFD solver, custom materials (Magnesium/Graphite/Al/Copper), mass telemetry, and sharing links. |
| [**Engineering Unit Converter**](tools/unit-converter/) | General Utility | Bidirectional conversions across 23 categories (Mechanics, Thermo, Fluids, Electrical) with instant fuzzy search. |
| [**Busbar Capacity Calculator**](tools/busbar-sizing/) | Power Systems | DC skin effect, EM forces, deflection, short-circuit ratings, and voltage drops with live SVG busbar previews. |
| [**CAN Bus Harness Designer**](tools/can-bus-designer/) | Aerospace / Auto | Interactive drag-and-drop topology canvas, ISO 11898 compliance checker, propagation delays, and signal reflection model. |
| [**Plot Data Extractor**](tools/plot-extractor/) | Data / Analytics | Digitizer for plot images with magnifying axis calibration, linear/log grids, curve regressions, and CSV export. |
| [**Barcode & QR Code Scanner**](tools/code-scanner/) | General Utility | Client-side webcam/image decoding scanner, history logger, CSV exports, sharing links, and Project Manager sync. |
| [**Interactive Time Planner**](tools/timezone-converter/) | General Utility | Multi-timezone alignment layout with visual daylight/night/work segments, horizontal continuous gradients, and JDN/Julian conversions. |

---

## 🏗️ Project Architecture

```
engineering-toolkit/
├── index.html                # Hub / dashboard
├── css/
│   ├── style.css             # Shared global design system (tokens, components)
│   └── theme.css             # Theme variables (light/dark colors)
├── js/
│   ├── firebase.js           # Firebase app init & Firestore CRUD operations
│   ├── auth-ui.js            # Injected sign-in/up modal & styling
│   ├── project-manager.js    # Slide-out saved project list drawer
│   ├── tools-data.js         # Single source of truth for tool registry
│   └── app.js                # Dashboard search, filtering, and theme toggle
├── tools/                    # Tool subdirectories (HTML, Local CSS, JS)
│   ├── busbar-sizing/
│   ├── can-bus-designer/
│   ├── code-scanner/
│   ├── fishbone-diagram/
│   ├── heatsink-simulator/
│   ├── plot-extractor/
│   ├── timezone-converter/
│   ├── unit-converter/
│   └── wire-gauge/
├── robots.txt
└── sitemap.xml
```

### Adding a New Tool
1. **Create the directory** under `tools/<tool-id>/index.html`.
2. **Register the tool** in `js/tools-data.js`.
3. **Integrate Unified Styling**:
   - Link global styles: `../../css/theme.css` and `../../css/header.css`.
   - Implement the standardized header template (see `.agents/AGENTS.md`).
   - Wrap tool layout in `.container` with local bounds.
   - Register save/load hooks with `window.projectManagerConfig` for Firestore sync.

---

## 💻 Local Usage & Offline Mode

No build system required. Run entirely static:
```bash
# Start local server to avoid browser file:// origin CORS quirks
python -m http.server 8000

# Open http://localhost:8000 in your browser
```

---

## 📄 License

Open-source under the **GNU GPLv3 License**.
