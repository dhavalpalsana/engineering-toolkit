# Engineering Toolkit 🛠️

A curated, unified suite of high-performance design calculators, simulation solvers, and interactive utilities for mechanical, industrial, aerospace, and electrical engineers.

Designed as a static site, this entire hub runs client-side, is fully optimized for offline utilization, and is hosted live on GitHub Pages.

🔗 **Access the live toolkit:** [dhavalpalsana.github.io/engineering-toolkit/](https://dhavalpalsana.github.io/engineering-toolkit/)

---

## 🌟 Key Features

- **Interactive Visual Dashboard**: A sleek, modern design index implementing the *Sleek Minimalist Light* design system with deep slate backgrounds, custom gradients, and micro-animations.
- **Bi-Directional Theme Syncing**: Dynamic toggling between premium Light Mode and dark-slate Dark Mode. Toggling the theme on any individual solver tool automatically syncs the visual mode across all pages in real-time.
- **Search & Quick-Launch System**: Responsive filter system with global keyboard hotkeys (`Ctrl + K` or `/` to focus search) for lightning-fast tool finding.
- **Open Suggestion Portal**: Direct integration for requesting new engineering utilities.

---

## 🧮 Available Tools

### ⚡ Dynamic Cable Thermal & Loss Solver (`tools/wire-gauge/`)
A thermodynamic evaluation & electrodynamic solver designed for complex multi-segment series spliced cable harnesses. Unlike standard static tables, this solver couples electrodynamics and radial heat transfer physics.
- **Proportional SVG Splicing Heat Map**: Renders real-time proportional diagrams showing splicing points and local temperature distributions.
- **Physical Operational Envelope Checks**: Tracks and highlights peak thermal limits and voltage drop budgets.
- **Dynamic Optimization Matrix**: Runs iterative wire-sizing shifts (AWG and Metric standards) on the active configuration to suggest optimal conductor areas.
- **AI Design Assistant Integration**: Natural language interface coupled with Gemini models to translate configuration prompts directly into simulation variables.
- **State Export/Import**: Download and reload setup parameters as JSON payloads.

---

## 💻 Local Usage & Offline Mode

Because the entire toolkit is constructed using static HTML, Vanilla CSS, and modern JavaScript, there are no databases or server-side requirements. You can run it locally or completely offline:

1. **Direct Load**: Double-click `index.html` inside the root folder to launch the dashboard locally.
2. **Local Web Server**: For full feature support (including correct origin policies when reloading files), serve the repository root using any simple HTTP server:
   ```bash
   # Using Python
   python -m http.server 8000
   ```
   Then navigate to `http://localhost:8000`.

---

## 📄 License

This project is open-source and distributed under the **GNU GPLv3 License**. Feel free to fork, expand, and self-host!
