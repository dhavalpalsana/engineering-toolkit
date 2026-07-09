document.addEventListener("DOMContentLoaded", () => {
  // Predefined materials database
  const materials = {
    aluminum: { name: "Aluminum 6061-T6", k: 167 },
    copper: { name: "Pure Copper", k: 400 },
    custom: { name: "Custom", k: 200 }
  };

  // Local State
  let heatsink = {
    width: 80,       // mm (W)
    length: 80,      // mm (L)
    thickness: 6,    // mm (t)
    finHeight: 25,   // mm
    finThickness: 1.5, // mm
    finCount: 16,
    material: "aluminum",
    customK: 200
  };

  let chips = [
    { id: "chip-1", power: 45, width: 25, length: 25, x: 0, y: 0 } // positions relative to base center (mm)
  ];

  let tim = {
    thickness: 50, // micrometers
    k: 3.5         // W/mK
  };

  let environment = {
    mode: "forced", // "forced" or "natural"
    ambientTemp: 25, // °C
    fanAirflow: 32,  // CFM (Max Flow)
    bypassSide: 2,   // mm
    bypassTop: 1,    // mm
    emissivity: 0.85
  };

  // 3D Rendering variables
  let scene, camera, renderer, controls;
  let heatsinkGroup, chipsGroup, ductMesh;
  const canvasContainer = document.getElementById("canvas-container");
  
  // Solver Grid dimensions
  const Nx = 15;
  const Ny = 15;
  let gridT = Array(Nx).fill(0).map(() => Array(Ny).fill(25)); // base temperatures

  // HTML DOM Selections
  const baseWidthInput = document.getElementById("base-width");
  const baseLengthInput = document.getElementById("base-length");
  const baseHeightInput = document.getElementById("base-height");
  const finHeightInput = document.getElementById("fin-height");
  const finThicknessInput = document.getElementById("fin-thickness");
  const finCountInput = document.getElementById("fin-count");
  const materialSelect = document.getElementById("material-select");
  const customKGroup = document.getElementById("custom-k-group");
  const customKInput = document.getElementById("custom-k");

  const addChipBtn = document.getElementById("add-chip-btn");
  const chipsListContainer = document.getElementById("chips-list-container");
  const timThicknessInput = document.getElementById("tim-thickness");
  const timKInput = document.getElementById("tim-k");

  const convectionMode = document.getElementById("convection-mode");
  const ambientTempInput = document.getElementById("ambient-temp");
  const forcedCoolingControls = document.getElementById("forced-cooling-controls");
  const fanAirflowInput = document.getElementById("fan-airflow");
  const bypassSideInput = document.getElementById("duct-bypass-side");
  const bypassTopInput = document.getElementById("duct-bypass-top");
  const naturalCoolingControls = document.getElementById("natural-cooling-controls");
  const surfaceEmissivityInput = document.getElementById("surface-emissivity");

  const simSpinner = document.getElementById("sim-spinner");
  const statusBadge = document.getElementById("status-badge");
  const resTJunction = document.getElementById("res-t-junction");
  const resTBase = document.getElementById("res-t-base");
  const resHCoeff = document.getElementById("res-h-coeff");
  const resTheta = document.getElementById("res-theta");
  const fanCurveChart = document.getElementById("fan-curve-chart");

  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  // Initialize Lucide Icons
  if (typeof lucide !== "undefined") lucide.createIcons();

  // ── Tabs Management ──────────────────────────────────────────
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      const target = btn.getAttribute("data-tab");
      tabContents.forEach(content => {
        if (content.id === target) {
          content.classList.remove("hidden");
        } else {
          content.classList.add("hidden");
        }
      });
    });
  });

  // ── Material Custom Selector toggle ─────────────────────────
  materialSelect.addEventListener("change", () => {
    if (materialSelect.value === "custom") {
      customKGroup.classList.remove("hidden");
    } else {
      customKGroup.classList.add("hidden");
    }
    heatsink.material = materialSelect.value;
    runSimulation();
  });

  // ── Chip Elements Dynamic Management ────────────────────────
  const renderChipsUI = () => {
    chipsListContainer.innerHTML = "";
    chips.forEach((chip, index) => {
      const row = document.createElement("div");
      row.className = "chip-item-row";
      row.innerHTML = `
        <div class="chip-header">
          <span class="chip-title">Chip #${index + 1}</span>
          ${chips.length > 1 ? `
            <button class="delete-chip-btn" data-id="${chip.id}" title="Remove Chip">
              <i data-lucide="trash-2"></i>
            </button>
          ` : ""}
        </div>
        <div class="chip-inputs">
          <div class="form-group">
            <label>Power (W)</label>
            <input type="number" class="form-input chip-power" data-id="${chip.id}" value="${chip.power}" min="1" max="500" />
          </div>
          <div class="form-group">
            <label>Size (W x L - mm)</label>
            <input type="number" class="form-input chip-size" data-id="${chip.id}" value="${chip.width}" min="5" max="100" />
          </div>
          <div class="form-group margin-top-6">
            <label>Offset X (mm)</label>
            <input type="number" class="form-input chip-x" data-id="${chip.id}" value="${chip.x}" min="-100" max="100" />
          </div>
          <div class="form-group margin-top-6">
            <label>Offset Y (mm)</label>
            <input type="number" class="form-input chip-y" data-id="${chip.id}" value="${chip.y}" min="-100" max="100" />
          </div>
        </div>
      `;

      // Remove Chip Event
      const delBtn = row.querySelector(".delete-chip-btn");
      if (delBtn) {
        delBtn.addEventListener("click", () => {
          chips = chips.filter(c => c.id !== chip.id);
          renderChipsUI();
          runSimulation();
          document.dispatchEvent(new Event("change", { bubbles: true }));
        });
      }

      chipsListContainer.appendChild(row);
    });

    // Wire up inputs triggers
    document.querySelectorAll(".chip-power").forEach(input => {
      input.addEventListener("change", (e) => {
        const id = e.target.getAttribute("data-id");
        const match = chips.find(c => c.id === id);
        if (match) match.power = parseFloat(e.target.value) || 0;
        runSimulation();
        document.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });

    document.querySelectorAll(".chip-size").forEach(input => {
      input.addEventListener("change", (e) => {
        const id = e.target.getAttribute("data-id");
        const match = chips.find(c => c.id === id);
        if (match) {
          const val = parseFloat(e.target.value) || 10;
          match.width = val;
          match.length = val; // square chip for simplicity
        }
        runSimulation();
        document.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });

    document.querySelectorAll(".chip-x").forEach(input => {
      input.addEventListener("change", (e) => {
        const id = e.target.getAttribute("data-id");
        const match = chips.find(c => c.id === id);
        if (match) match.x = parseFloat(e.target.value) || 0;
        runSimulation();
        document.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });

    document.querySelectorAll(".chip-y").forEach(input => {
      input.addEventListener("change", (e) => {
        const id = e.target.getAttribute("data-id");
        const match = chips.find(c => c.id === id);
        if (match) match.y = parseFloat(e.target.value) || 0;
        runSimulation();
        document.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });

    if (typeof lucide !== "undefined") lucide.createIcons();
  };

  addChipBtn.addEventListener("click", () => {
    const newId = `chip-${Date.now()}`;
    chips.push({ id: newId, power: 30, width: 20, length: 20, x: 0, y: 0 });
    renderChipsUI();
    runSimulation();
    document.dispatchEvent(new Event("change", { bubbles: true }));
  });

  // Toggle Convection cooling input fields
  convectionMode.addEventListener("change", () => {
    if (convectionMode.value === "natural") {
      naturalCoolingControls.classList.remove("hidden");
      forcedCoolingControls.classList.add("hidden");
    } else {
      naturalCoolingControls.classList.add("hidden");
      forcedCoolingControls.classList.remove("hidden");
    }
    environment.mode = convectionMode.value;
    runSimulation();
  });

  // ── Three.js Viewport Setup ───────────────────────────────────
  const init3DScene = () => {
    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16);

    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(100, 100, 150);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    canvasContainer.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2; // don't go under floor

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(80, 120, 50);
    scene.add(dirLight);

    heatsinkGroup = new THREE.Group();
    scene.add(heatsinkGroup);

    chipsGroup = new THREE.Group();
    scene.add(chipsGroup);

    window.addEventListener("resize", onWindowResize);
    animate();
  };

  const onWindowResize = () => {
    if (!canvasContainer) return;
    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };

  const animate = () => {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  };

  // Convert temp value to RGB color for shader mapping (Blue -> Cyan -> Green -> Yellow -> Red)
  const getTemperatureColor = (temp, minTemp, maxTemp) => {
    let t = (temp - minTemp) / (maxTemp - minTemp || 1);
    t = Math.max(0, Math.min(1, t)); // clamp 0-1
    
    // Smooth color scale mapping
    let r = 0, g = 0, b = 0;
    if (t < 0.25) {
      // Blue to Cyan
      r = 0; g = t * 4; b = 1;
    } else if (t < 0.5) {
      // Cyan to Green
      r = 0; g = 1; b = 1 - (t - 0.25) * 4;
    } else if (t < 0.75) {
      // Green to Yellow
      r = (t - 0.5) * 4; g = 1; b = 0;
    } else {
      // Yellow to Red
      r = 1; g = 1 - (t - 0.75) * 4; b = 0;
    }
    return new THREE.Color(r, g, b);
  };

  // Build / update 3D Meshes in Scene
  const update3DModel = (minT, maxT) => {
    // Clear groups
    while (heatsinkGroup.children.length > 0) {
      heatsinkGroup.remove(heatsinkGroup.children[0]);
    }
    while (chipsGroup.children.length > 0) {
      chipsGroup.remove(chipsGroup.children[0]);
    }
    if (ductMesh) {
      scene.remove(ductMesh);
      ductMesh = null;
    }

    const scale = 0.5; // Scale down base dimensions so it fits viewport scene nicely
    const W = heatsink.width * scale;
    const L = heatsink.length * scale;
    const t = heatsink.thickness * scale;
    const Hf = heatsink.finHeight * scale;
    const tf = heatsink.finThickness * scale;

    // 1. Build heatsink base box with grid segments for vertex coloring
    const baseGeo = new THREE.BoxGeometry(W, t, L, Nx - 1, 1, Ny - 1);
    
    // Apply vertex colors based on local FDM temperature arrays
    const colors = [];
    const positions = baseGeo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      // Map X/Z vertex positions to Nx/Ny indices
      const xVal = positions.getX(i);
      const zVal = positions.getZ(i);
      
      const gridX = Math.round(((xVal + W / 2) / W) * (Nx - 1));
      const gridY = Math.round(((zVal + L / 2) / L) * (Ny - 1));
      
      const idxX = Math.max(0, Math.min(Nx - 1, gridX));
      const idxY = Math.max(0, Math.min(Ny - 1, gridY));
      
      const temp = gridT[idxX][idxY];
      const color = getTemperatureColor(temp, minT, maxT);
      colors.push(color.r, color.g, color.b);
    }
    baseGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const baseMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.set(0, t / 2, 0);
    heatsinkGroup.add(baseMesh);

    // 2. Build Fin meshes spaced along base
    const numFins = heatsink.finCount;
    const spacing = (W - tf) / (numFins - 1 || 1);
    const startX = -W / 2 + tf / 2;

    for (let i = 0; i < numFins; i++) {
      const finX = startX + i * spacing;
      
      // Fin box geometry. Segment along length so we get linear heat map gradients
      const finGeo = new THREE.BoxGeometry(tf, Hf, L, 1, 4, Ny - 1);
      
      const finColors = [];
      const finPos = finGeo.attributes.position;
      for (let k = 0; k < finPos.count; k++) {
        const zVal = finPos.getZ(k);
        const yVal = finPos.getY(k); // height coordinate
        
        const gridY = Math.round(((zVal + L / 2) / L) * (Ny - 1));
        const idxY = Math.max(0, Math.min(Ny - 1, gridY));
        
        // Linear temperature drop from base of fin (bottom) to tip of fin (top)
        const mappedX = Math.max(0, Math.min(Nx - 1, Math.round(((finX + W / 2) / W) * (Nx - 1))));
        const baseTemp = gridT[mappedX][idxY];
        
        const yFraction = (yVal + Hf/2) / Hf; // 0 (bottom) to 1 (top)
        // Approximate temperature along fin height using standard hyperbolic cosine fin decay
        const mVal = 0.2; // fin thermal decay parameter
        const finTemp = environment.ambientTemp + (baseTemp - environment.ambientTemp) * (Math.cosh(mVal * (1 - yFraction)) / Math.cosh(mVal));
        
        const color = getTemperatureColor(finTemp, minT, maxT);
        finColors.push(color.r, color.g, color.b);
      }
      finGeo.setAttribute('color', new THREE.Float32BufferAttribute(finColors, 3));

      const finMat = new THREE.MeshLambertMaterial({ vertexColors: true });
      const finMesh = new THREE.Mesh(finGeo, finMat);
      finMesh.position.set(finX, t + Hf / 2, 0);
      heatsinkGroup.add(finMesh);
    }

    // 3. Build Silicon Chips and TIM transparent layers
    chips.forEach(chip => {
      const cW = chip.width * scale;
      const cL = chip.length * scale;
      const cX = chip.x * scale;
      const cY = -chip.y * scale; // invert Y for standard Cartesian 3D map

      // Chip (silicon colored, translucent red glow)
      const chipGeo = new THREE.BoxGeometry(cW, 2, cL);
      const chipMat = new THREE.MeshLambertMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.8
      });
      const chipMesh = new THREE.Mesh(chipGeo, chipMat);
      // Place directly under base
      chipMesh.position.set(cX, -1, cY);
      chipsGroup.add(chipMesh);

      // TIM (grey interface material)
      const timGeo = new THREE.BoxGeometry(cW, 0.4, cL);
      const timMat = new THREE.MeshLambertMaterial({
        color: 0x94a3b8,
        transparent: true,
        opacity: 0.6
      });
      const timMesh = new THREE.Mesh(timGeo, timMat);
      timMesh.position.set(cX, -0.2, cY);
      chipsGroup.add(timMesh);
    });

    // 4. Build Translucent Airflow Duct (if forced cooling)
    if (environment.mode === "forced") {
      const dW = W + (environment.bypassSide * 2) * scale;
      const dH = t + Hf + environment.bypassTop * scale;
      const dL = L + 40 * scale; // extend beyond heatsink to show tunnel

      const ductGeo = new THREE.BoxGeometry(dW, dH, dL);
      const ductMat = new THREE.MeshLambertMaterial({
        color: 0x3b82f6,
        wireframe: true,
        transparent: true,
        opacity: 0.15
      });
      ductMesh = new THREE.Mesh(ductGeo, ductMat);
      ductMesh.position.set(0, dH / 2 - (environment.bypassTop * scale)/2, 0);
      scene.add(ductMesh);
    }
  };

  // ── Simulator Solver Engine ──────────────────────────────────
  const runSimulation = () => {
    // Show loader
    simSpinner.classList.remove("hidden");

    // Throttled in standard browser frame timeout to permit CSS loading state to render
    setTimeout(() => {
      // 1. Fetch input values
      heatsink.width = parseFloat(baseWidthInput.value) || 80;
      heatsink.length = parseFloat(baseLengthInput.value) || 80;
      heatsink.thickness = parseFloat(baseHeightInput.value) || 6;
      heatsink.finHeight = parseFloat(finHeightInput.value) || 25;
      heatsink.finThickness = parseFloat(finThicknessInput.value) || 1.5;
      heatsink.finCount = parseInt(finCountInput.value) || 16;
      heatsink.customK = parseFloat(customKInput.value) || 200;

      tim.thickness = parseFloat(timThicknessInput.value) || 50;
      tim.k = parseFloat(timKInput.value) || 3.5;

      environment.ambientTemp = parseFloat(ambientTempInput.value) || 25;
      environment.fanAirflow = parseFloat(fanAirflowInput.value) || 32;
      environment.bypassSide = parseFloat(bypassSideInput.value) || 2;
      environment.bypassTop = parseFloat(bypassTopInput.value) || 1;
      environment.emissivity = parseFloat(surfaceEmissivityInput.value) || 0.85;

      const kBase = heatsink.material === "custom" ? heatsink.customK : materials[heatsink.material].k;

      // 2. Perform convection calculations
      let h = 8.0; // default convection coeff
      let sysFlow = 0; // CFM
      let sysPress = 0; // Pa

      if (environment.mode === "forced") {
        // Geometric channel parameters
        const s = (heatsink.width - heatsink.finCount * heatsink.finThickness) / (heatsink.finCount - 1 || 1);
        const Dh = (2 * s * heatsink.finHeight) / (s + heatsink.finHeight || 1);

        // Solve operating airflow matching flow impedance to fan curves
        // Fan Curve: P_fan = P_max * (1 - (Q / Q_max)^2)
        // Low static pressure axial fan curve approximation: Max Pressure = 45 Pa
        const pMax = 45;
        const qMaxCFM = environment.fanAirflow;
        const qMaxM3S = qMaxCFM * 0.000471947; // CFM to m³/s

        // Numerical solver for operating flow intersection
        let operatingFlowCFM = qMaxCFM;
        let flowVelocity = 1.0;

        for (let flow = 0.5; flow <= qMaxCFM; flow += 0.5) {
          const qM3S = flow * 0.000471947;
          
          // Calculate channel velocity considering duct bypass clearances
          const areaChannel = (heatsink.width * heatsink.finHeight) / 1e6; // m²
          const areaBypass = ((environment.bypassSide * 2 * (heatsink.finHeight + heatsink.thickness)) + (environment.bypassTop * heatsink.width)) / 1e6;
          
          // Bypass ratio
          const bypassFactor = areaBypass > 0 ? 1 / (1 + 1.6 * (areaBypass / areaChannel)) : 1.0;
          const vChannel = (qM3S / areaChannel) * bypassFactor;
          
          // Channel Reynolds
          const nuAir = 1.56e-5; // m²/s
          const Re = (vChannel * (Dh / 1000)) / nuAir;

          // Friction factor
          const f = Re > 2000 ? 0.316 * Math.pow(Re, -0.25) : 64 / (Re || 1);
          
          // Pressure drop
          const rhoAir = 1.18; // kg/m³
          const pressureDrop = f * (heatsink.length / Dh) * (rhoAir * vChannel * vChannel) / 2;

          // Fan Curve pressure matching
          const fanPressure = pMax * (1 - Math.pow(flow / qMaxCFM, 2));

          if (pressureDrop >= fanPressure) {
            operatingFlowCFM = flow;
            flowVelocity = vChannel;
            sysPress = pressureDrop;
            break;
          }
        }

        sysFlow = operatingFlowCFM;
        
        // Calculate Forced Convection Nusselt / Heat Coefficient (h)
        const reChannel = (flowVelocity * (Dh / 1000)) / 1.56e-5;
        const pr = 0.7; // air Prandtl
        let Nu = 3.66; // laminar default
        
        if (reChannel > 2300) {
          Nu = 0.023 * Math.pow(reChannel, 0.8) * Math.pow(pr, 0.4);
        } else {
          Nu = 3.66 + (0.0668 * (Dh / heatsink.length) * reChannel * pr) / (1 + 0.04 * Math.pow((Dh / heatsink.length) * reChannel * pr, 2/3));
        }

        h = (Nu * 0.026) / (Dh / 1000);
      } else {
        // Natural Convection (Vertical channels free convection)
        // Convective coefficient + Radiative coefficient based on emissivity
        const dT_est = 25.0; // estimated delta temperature
        const h_conv = 1.42 * Math.pow(dT_est / (heatsink.finHeight / 1000), 0.25);
        
        const sigma = 5.67e-8; // Stefan-Boltzmann
        const T_avg_k = environment.ambientTemp + 273.15 + dT_est / 2;
        const h_rad = environment.emissivity * sigma * 4 * Math.pow(T_avg_k, 3);
        
        h = h_conv + h_rad;
      }

      // Match fin surface area enhancements
      // Fin efficiency (eta_f)
      const P_fin = 2 * heatsink.length / 1000; // perimeter
      const Ac_fin = (heatsink.finThickness * heatsink.length) / 1e6; // cross section
      const m = Math.sqrt((h * P_fin) / (kBase * Ac_fin || 1));
      const eta_f = Math.tanh(m * (heatsink.finHeight / 1000)) / (m * (heatsink.finHeight / 1000) || 1);

      // Fin area multiplier
      const areaFins = heatsink.finCount * 2 * heatsink.length * heatsink.finHeight / 1e6; // m²
      const areaBase = (heatsink.width * heatsink.length) / 1e6;
      const hEff = h * (1 + eta_f * (areaFins / areaBase));

      // 3. Finite Difference Solver Relaxation iteration
      const dx = (heatsink.width / 1000) / Nx;
      const dy = (heatsink.length / 1000) / Ny;
      const t_m = heatsink.thickness / 1000;

      // Reset base temps
      for (let i = 0; i < Nx; i++) {
        for (let j = 0; j < Ny; j++) {
          gridT[i][j] = environment.ambientTemp;
        }
      }

      // Heat source Node mapping
      const heatNodes = Array(Nx).fill(0).map(() => Array(Ny).fill(0));
      let totalPower = 0;

      chips.forEach(chip => {
        // Chip coordinates converted to grid nodes indexes
        const leftX = ((chip.x - chip.width/2 + heatsink.width/2) / heatsink.width) * Nx;
        const rightX = ((chip.x + chip.width/2 + heatsink.width/2) / heatsink.width) * Nx;
        const topY = ((chip.y - chip.length/2 + heatsink.length/2) / heatsink.length) * Ny;
        const bottomY = ((chip.y + chip.length/2 + heatsink.length/2) / heatsink.length) * Ny;

        let numMatchedNodes = 0;
        for (let i = 0; i < Nx; i++) {
          for (let j = 0; j < Ny; j++) {
            if (i >= leftX && i <= rightX && j >= topY && j <= bottomY) {
              numMatchedNodes++;
            }
          }
        }

        if (numMatchedNodes > 0) {
          const powerPerNode = chip.power / numMatchedNodes;
          for (let i = 0; i < Nx; i++) {
            for (let j = 0; j < Ny; j++) {
              if (i >= leftX && i <= rightX && j >= topY && j <= bottomY) {
                heatNodes[i][j] += powerPerNode;
              }
            }
          }
        }
        totalPower += chip.power;
      });

      // Relaxation solver iterations (steady state diffusion solution)
      const conductX = (kBase * t_m * dy) / dx;
      const conductY = (kBase * t_m * dx) / dy;
      const conductConv = hEff * dx * dy;

      for (let iter = 0; iter < 120; iter++) {
        const nextT = Array(Nx).fill(0).map(() => Array(Ny).fill(25));
        
        for (let i = 0; i < Nx; i++) {
          for (let j = 0; j < Ny; j++) {
            let sumNeighborTerms = 0;
            let sumConductance = 0;

            // X-conductance neighbors
            if (i > 0) {
              sumNeighborTerms += conductX * gridT[i-1][j];
              sumConductance += conductX;
            }
            if (i < Nx-1) {
              sumNeighborTerms += conductX * gridT[i+1][j];
              sumConductance += conductX;
            }

            // Y-conductance neighbors
            if (j > 0) {
              sumNeighborTerms += conductY * gridT[i][j-1];
              sumConductance += conductY;
            }
            if (j < Ny-1) {
              sumNeighborTerms += conductY * gridT[i][j+1];
              sumConductance += conductY;
            }

            // Convection loss
            sumNeighborTerms += conductConv * environment.ambientTemp;
            sumConductance += conductConv;

            // Heat input source
            const nodePower = heatNodes[i][j];

            // Node temperature solution
            nextT[i][j] = (sumNeighborTerms + nodePower) / sumConductance;
          }
        }
        gridT = nextT;
      }

      // Compute statistics results
      let maxBaseTemp = environment.ambientTemp;
      for (let i = 0; i < Nx; i++) {
        for (let j = 0; j < Ny; j++) {
          if (gridT[i][j] > maxBaseTemp) maxBaseTemp = gridT[i][j];
        }
      }

      // Silicon Junction Temp matching chip contact and TIM thermal resistance
      // R_tim = thickness / (k_tim * Area)
      // T_junction = T_base + Q * R_tim
      let maxJunctionTemp = maxBaseTemp;
      chips.forEach(chip => {
        // Average base temperature under this chip
        const leftX = Math.floor(((chip.x - chip.width/2 + heatsink.width/2) / heatsink.width) * Nx);
        const rightX = Math.ceil(((chip.x + chip.width/2 + heatsink.width/2) / heatsink.width) * Nx);
        const topY = Math.floor(((chip.y - chip.length/2 + heatsink.length/2) / heatsink.length) * Ny);
        const bottomY = Math.ceil(((chip.y + chip.length/2 + heatsink.length/2) / heatsink.length) * Ny);

        let sumBaseT = 0;
        let cCount = 0;
        for (let i = 0; i < Nx; i++) {
          for (let j = 0; j < Ny; j++) {
            if (i >= leftX && i <= rightX && j >= topY && j <= bottomY) {
              sumBaseT += gridT[i][j];
              cCount++;
            }
          }
        }
        const avgBaseT = cCount > 0 ? sumBaseT / cCount : maxBaseTemp;
        
        // TIM contact resistance
        const chipAreaM2 = (chip.width * chip.length) / 1e6;
        const R_tim = (tim.thickness / 1e6) / (tim.k * chipAreaM2);
        
        // Chip spreading/conduction
        const tJunc = avgBaseT + chip.power * R_tim;
        if (tJunc > maxJunctionTemp) maxJunctionTemp = tJunc;
      });

      const maxTheta = totalPower > 0 ? (maxJunctionTemp - environment.ambientTemp) / totalPower : 0;

      // 4. Update UI labels and badge states
      resTJunction.textContent = `${maxJunctionTemp.toFixed(1)} °C`;
      resTBase.textContent = `${maxBaseTemp.toFixed(1)} °C`;
      resHCoeff.textContent = `${h.toFixed(1)} W/m²K`;
      resTheta.textContent = `${maxTheta.toFixed(3)} K/W`;

      // Status colors
      if (maxJunctionTemp > 105) {
        statusBadge.className = "badge critical-badge";
        statusBadge.textContent = "Critical";
      } else if (maxJunctionTemp > 85) {
        statusBadge.className = "badge warning-badge";
        statusBadge.textContent = "Warning";
      } else {
        statusBadge.className = "badge active-badge";
        statusBadge.textContent = "Normal";
      }

      // Update 3D colors legends
      document.getElementById("legend-min").textContent = `${Math.round(environment.ambientTemp)}°C`;
      document.getElementById("legend-max").textContent = `${Math.round(maxBaseTemp)}°C`;

      // Redraw 3D scene and Fan curve chart
      update3DModel(environment.ambientTemp, maxBaseTemp);
      drawFanCurve(sysFlow, sysPress);

      // Hide Loader
      simSpinner.classList.add("hidden");
    }, 150);
  };

  // ── HTML5 Canvas Fan Curve Plotter ────────────────────────────
  const drawFanCurve = (operatingFlow, operatingPress) => {
    const ctx = fanCurveChart.getContext("2d");
    const width = fanCurveChart.width;
    const height = fanCurveChart.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Style properties
    const margin = { top: 15, right: 20, bottom: 25, left: 35 };
    const chartW = width - margin.left - margin.right;
    const chartH = height - margin.top - margin.bottom;

    // Draw axes lines
    ctx.strokeStyle = "var(--border-color)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top + chartH);
    ctx.lineTo(margin.left + chartW, margin.top + chartH);
    ctx.stroke();

    // Max limits
    const maxCFM = environment.fanAirflow * 1.2;
    const maxPa = 55;

    // Draw Fan Curve line
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let flow = 0; flow <= environment.fanAirflow; flow += 1) {
      const p = 45 * (1 - Math.pow(flow / environment.fanAirflow, 2));
      const x = margin.left + (flow / maxCFM) * chartW;
      const y = margin.top + chartH - (p / maxPa) * chartH;
      if (flow === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw Heatsink Impedance line
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let flow = 0; flow <= maxCFM; flow += 1) {
      // Approximate quadratic system curve
      const ratio = operatingFlow > 0 ? flow / operatingFlow : 0;
      const p = operatingPress * ratio * ratio;
      const x = margin.left + (flow / maxCFM) * chartW;
      const y = margin.top + chartH - (p / maxPa) * chartH;
      if (flow === 0) ctx.moveTo(x, y);
      else if (p <= maxPa) ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw Intersection Operating Point Dot
    const dotX = margin.left + (operatingFlow / maxCFM) * chartW;
    const dotY = margin.top + chartH - (operatingPress / maxPa) * chartH;

    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw axes text markers
    ctx.fillStyle = "var(--text-muted)";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${maxPa} Pa`, margin.left - 5, margin.top + 5);
    ctx.fillText("0 Pa", margin.left - 5, margin.top + chartH);

    ctx.textAlign = "center";
    ctx.fillText("0 CFM", margin.left, margin.top + chartH + 15);
    ctx.fillText(`${Math.round(maxCFM)} CFM`, margin.left + chartW, margin.top + chartH + 15);
    
    // Labels
    ctx.fillStyle = "var(--text-secondary)";
    ctx.font = "10px sans-serif";
    ctx.fillText(`Operating Pt: ${operatingFlow.toFixed(1)} CFM @ ${operatingPress.toFixed(1)} Pa`, width / 2 + 10, margin.top);
  };

  // ── Input change listener hooks ────────────────────────────────
  [
    baseWidthInput, baseLengthInput, baseHeightInput,
    finHeightInput, finThicknessInput, finCountInput,
    customKInput, timThicknessInput, timKInput,
    ambientTempInput, fanAirflowInput, bypassSideInput, bypassTopInput,
    surfaceEmissivityInput
  ].forEach(input => {
    input.addEventListener("input", () => {
      runSimulation();
      document.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });

  // ── Import / Export Logic ────────────────────────────────────
  window.exportJSON = function() {
    const data = {
      heatsink: heatsink,
      chips: chips,
      tim: tim,
      environment: environment
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `heatsink-design-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  window.importJSON = function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const data = JSON.parse(evt.target.result);
        if (data && data.heatsink && Array.isArray(data.chips)) {
          heatsink = data.heatsink;
          chips = data.chips;
          if (data.tim) tim = data.tim;
          if (data.environment) environment = data.environment;

          // Sync inputs fields in DOM
          baseWidthInput.value = heatsink.width;
          baseLengthInput.value = heatsink.length;
          baseHeightInput.value = heatsink.thickness;
          finHeightInput.value = heatsink.finHeight;
          finThicknessInput.value = heatsink.finThickness;
          finCountInput.value = heatsink.finCount;
          materialSelect.value = heatsink.material;
          customKInput.value = heatsink.customK;
          if (heatsink.material === "custom") {
            customKGroup.classList.remove("hidden");
          } else {
            customKGroup.classList.add("hidden");
          }

          timThicknessInput.value = tim.thickness;
          timKInput.value = tim.k;

          convectionMode.value = environment.mode;
          if (environment.mode === "natural") {
            naturalCoolingControls.classList.remove("hidden");
            forcedCoolingControls.classList.add("hidden");
          } else {
            naturalCoolingControls.classList.add("hidden");
            forcedCoolingControls.classList.remove("hidden");
          }
          ambientTempInput.value = environment.ambientTemp;
          fanAirflowInput.value = environment.fanAirflow;
          bypassSideInput.value = environment.bypassSide;
          bypassTopInput.value = environment.bypassTop;
          surfaceEmissivityInput.value = environment.emissivity;

          renderChipsUI();
          runSimulation();
          document.dispatchEvent(new Event("change", { bubbles: true }));
          if (window.showToast) window.showToast("Heatsink design imported successfully!");
        } else {
          alert("Invalid project format.");
        }
      } catch (err) {
        alert("Failed to parse JSON file: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  window.shareLink = function() {
    try {
      const state = {
        heatsink: heatsink,
        chips: chips,
        tim: tim,
        environment: environment
      };
      const serialized = btoa(JSON.stringify(state));
      const url = new URL(window.location.href);
      url.searchParams.set("design", serialized);
      
      navigator.clipboard.writeText(url.toString()).then(() => {
        if (window.showToast) window.showToast("Sharing link copied to clipboard!");
      });
    } catch (err) {
      console.error(err);
      if (window.showToast) window.showToast("Failed to create sharing link.", false);
    }
  };

  // ── Project Manager Integration ──────────────────────────────
  window.projectManagerConfig = {
    toolId: "heatsink-simulator",
    getInputs: () => {
      return {
        heatsink: heatsink,
        chips: chips,
        tim: tim,
        environment: environment
      };
    },
    setInputs: (data) => {
      if (data && data.heatsink && Array.isArray(data.chips)) {
        heatsink = data.heatsink;
        chips = data.chips;
        if (data.tim) tim = data.tim;
        if (data.environment) environment = data.environment;

        // Sync inputs fields in DOM
        baseWidthInput.value = heatsink.width;
        baseLengthInput.value = heatsink.length;
        baseHeightInput.value = heatsink.thickness;
        finHeightInput.value = heatsink.finHeight;
        finThicknessInput.value = heatsink.finThickness;
        finCountInput.value = heatsink.finCount;
        materialSelect.value = heatsink.material;
        customKInput.value = heatsink.customK;
        if (heatsink.material === "custom") {
          customKGroup.classList.remove("hidden");
        } else {
          customKGroup.classList.add("hidden");
        }

        timThicknessInput.value = tim.thickness;
        timKInput.value = tim.k;

        convectionMode.value = environment.mode;
        if (environment.mode === "natural") {
          naturalCoolingControls.classList.remove("hidden");
          forcedCoolingControls.classList.add("hidden");
        } else {
          naturalCoolingControls.classList.add("hidden");
          forcedCoolingControls.classList.remove("hidden");
        }
        ambientTempInput.value = environment.ambientTemp;
        fanAirflowInput.value = environment.fanAirflow;
        bypassSideInput.value = environment.bypassSide;
        bypassTopInput.value = environment.bypassTop;
        surfaceEmissivityInput.value = environment.emissivity;

        renderChipsUI();
        runSimulation();
      }
    }
  };

  // Run Initializations
  init3DScene();
  renderChipsUI();
  runSimulation();
});
