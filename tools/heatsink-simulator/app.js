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
    thickness: 100, // micrometers (0.1mm)
    k: 5.0          // W/mK
  };

  let environment = {
    mode: "forced", // "forced" or "natural"
    ambientTemp: 25, // °C
    fanAirflow: 32,  // CFM (Max Flow)
    bypassSide: 2,   // mm
    bypassTop: 1,    // mm
    emissivity: 0.85,
    orientation: "upward"
  };

  // 3D Rendering variables
  let scene, camera, renderer, controls;
  let heatsinkGroup, chipsGroup, ductMesh, helpersGroup, cadAssemblyGroup;
  const canvasContainer = document.getElementById("canvas-container");
  
  let cadMode = false;
  let cadParts = [];
  
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
  const finSpacingInput = document.getElementById("fin-spacing");
  const materialSelect = document.getElementById("material-select");
  const customKGroup = document.getElementById("custom-k-group");
  const customKInput = document.getElementById("custom-k");

  const addChipBtn = document.getElementById("add-source-btn");
  const chipsListContainer = document.getElementById("sources-list-container");
  const timThicknessInput = document.getElementById("tim-thickness");
  const timKInput = document.getElementById("tim-k");

  const convectionMode = document.getElementById("convection-mode");
  const ambientTempInput = document.getElementById("ambient-temp");
  const forcedCoolingControls = document.getElementById("forced-cooling-controls");
  const fanAirflowInput = document.getElementById("fan-airflow");
  const bypassSideInput = document.getElementById("duct-bypass-side");
  const bypassTopInput = document.getElementById("duct-bypass-top");
  const naturalCoolingControls = document.getElementById("natural-cooling-controls");
  const assemblyOrientation = document.getElementById("assembly-orientation");
  const surfaceEmissivityInput = document.getElementById("surface-emissivity");

  const simSpinner = document.getElementById("sim-spinner");
  const statusBadge = document.getElementById("status-badge");

  const cadFileInput = document.getElementById("cad-file-input");
  const cadPartsList = document.getElementById("cad-parts-list");
  const cadActiveControls = document.getElementById("cad-active-controls");
  const cadClearBtn = document.getElementById("cad-clear-btn");
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

  const syncFinLimits = () => {
    const W = parseFloat(baseWidthInput.value) || 80;
    const tf = parseFloat(finThicknessInput.value) || 1.5;
    
    // Max fins calculation allowing min 0.5mm clear space
    const Nmax = Math.max(2, Math.floor((W - tf) / (tf + 0.5)) + 1);
    finCountInput.max = Nmax;

    let N = parseInt(finCountInput.value) || 16;
    if (N > Nmax) {
      N = Nmax;
      finCountInput.value = Nmax;
    }
    
    // Resulting clear spacing
    const s_f = (W - N * tf) / (N - 1 || 1);
    finSpacingInput.value = s_f.toFixed(2);
  };

  const updateCADGeometry = () => {
    if (cadMode) return;
    syncFinLimits();
    heatsink.width = parseFloat(baseWidthInput.value) || 80;
    heatsink.length = parseFloat(baseLengthInput.value) || 80;
    heatsink.thickness = parseFloat(baseHeightInput.value) || 6;
    heatsink.finHeight = parseFloat(finHeightInput.value) || 25;
    heatsink.finThickness = parseFloat(finThicknessInput.value) || 1.5;
    heatsink.finCount = parseInt(finCountInput.value) || 16;
    heatsink.customK = parseFloat(customKInput.value) || 200;

    environment.bypassSide = parseFloat(bypassSideInput.value) || 2;
    environment.bypassTop = parseFloat(bypassTopInput.value) || 1;
    environment.mode = convectionMode.value;
    environment.orientation = assemblyOrientation.value;

    // Set grid temperatures to ambient for standard CAD representation
    for (let i = 0; i < Nx; i++) {
      for (let j = 0; j < Ny; j++) {
        gridT[i][j] = environment.ambientTemp;
      }
    }

    // Update 3D model meshes
    update3DModel(environment.ambientTemp, environment.ambientTemp);
  };

  // ── Material Custom Selector toggle ─────────────────────────
  materialSelect.addEventListener("change", () => {
    if (materialSelect.value === "custom") {
      customKGroup.classList.remove("hidden");
    } else {
      customKGroup.classList.add("hidden");
    }
    heatsink.material = materialSelect.value;
    document.dispatchEvent(new Event("change", { bubbles: true }));
  });

  // ── Heat Source Elements Dynamic Management ──────────────────
  const renderChipsUI = () => {
    chipsListContainer.innerHTML = "";
    chips.forEach((chip, index) => {
      const row = document.createElement("div");
      row.className = "chip-item-row";
      row.innerHTML = `
        <div class="chip-header">
          <span class="chip-title">Heat Source #${index + 1}</span>
          ${chips.length > 1 ? `
            <button class="delete-chip-btn" data-id="${chip.id}" title="Remove Heat Source">
              <i data-lucide="trash-2"></i>
            </button>
          ` : ""}
        </div>
        <div class="chip-inputs">
          <div class="form-group">
            <label>Power <span>(W)</span></label>
            <input type="number" class="form-input chip-power" data-id="${chip.id}" value="${chip.power}" min="1" max="500" />
          </div>
          <div class="form-group">
            <label>Size <span>(W x L - mm)</span></label>
            <input type="number" class="form-input chip-size" data-id="${chip.id}" value="${chip.width}" min="5" max="100" />
          </div>
          <div class="form-group margin-top-6">
            <label>Offset X <span>(mm)</span></label>
            <input type="number" class="form-input chip-x" data-id="${chip.id}" value="${chip.x}" min="-100" max="100" />
          </div>
          <div class="form-group margin-top-6">
            <label>Offset Y <span>(mm)</span></label>
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
          updateCADGeometry();
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
        updateCADGeometry();
        document.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });

    document.querySelectorAll(".chip-x").forEach(input => {
      input.addEventListener("change", (e) => {
        const id = e.target.getAttribute("data-id");
        const match = chips.find(c => c.id === id);
        if (match) match.x = parseFloat(e.target.value) || 0;
        updateCADGeometry();
        document.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });

    document.querySelectorAll(".chip-y").forEach(input => {
      input.addEventListener("change", (e) => {
        const id = e.target.getAttribute("data-id");
        const match = chips.find(c => c.id === id);
        if (match) match.y = parseFloat(e.target.value) || 0;
        updateCADGeometry();
        document.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });

    if (typeof lucide !== "undefined") lucide.createIcons();
  };

  addChipBtn.addEventListener("click", () => {
    const newId = `chip-${Date.now()}`;
    chips.push({ id: newId, power: 30, width: 20, length: 20, x: 0, y: 0 });
    renderChipsUI();
    updateCADGeometry();
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
    updateCADGeometry();
  });

  assemblyOrientation.addEventListener("change", () => {
    environment.orientation = assemblyOrientation.value;
    updateCADGeometry();
  });

  // ── Three.js Viewport Setup ───────────────────────────────────
  const init3DScene = () => {
    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(100, 100, 150);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    canvasContainer.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

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

    helpersGroup = new THREE.Group();
    scene.add(helpersGroup);

    cadAssemblyGroup = new THREE.Group();
    scene.add(cadAssemblyGroup);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    canvasContainer.addEventListener("click", (e) => {
      if (!cadMode || cadParts.length === 0) return;
      
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(cadAssemblyGroup.children, true);
      
      if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        const hitPart = cadParts.find(p => p.mesh === hitMesh);
        if (hitPart) {
          highlightCADPart(hitPart.id);
        }
      }
    });

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
  const update3DModel = (minT, maxT, individualTemps) => {
    // Clear groups & reset rotation orientations
    heatsinkGroup.rotation.set(0, 0, 0);
    chipsGroup.rotation.set(0, 0, 0);

    while (heatsinkGroup.children.length > 0) {
      heatsinkGroup.remove(heatsinkGroup.children[0]);
    }
    while (chipsGroup.children.length > 0) {
      chipsGroup.remove(chipsGroup.children[0]);
    }
    while (helpersGroup.children.length > 0) {
      helpersGroup.remove(helpersGroup.children[0]);
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
    const baseGeo = new THREE.BoxBufferGeometry(W, t, L, Nx - 1, 1, Ny - 1);
    
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
      const finGeo = new THREE.BoxBufferGeometry(tf, Hf, L, 1, 4, Ny - 1);
      
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

    // 3. Build Silicon Chips (Heat Sources) and TIM transparent layers
    chips.forEach(chip => {
      const cW = chip.width * scale;
      const cL = chip.length * scale;
      const cX = chip.x * scale;
      const cY = -chip.y * scale; // invert Y for standard Cartesian 3D map

      // Calculate junction temperature of this heat source
      const leftX = Math.max(0, Math.min(Nx - 1, Math.floor(((chip.x - chip.width/2 + heatsink.width/2) / heatsink.width) * Nx)));
      const rightX = Math.max(0, Math.min(Nx - 1, Math.ceil(((chip.x + chip.width/2 + heatsink.width/2) / heatsink.width) * Nx)));
      const topY = Math.max(0, Math.min(Ny - 1, Math.floor(((chip.y - chip.length/2 + heatsink.length/2) / heatsink.length) * Ny)));
      const bottomY = Math.max(0, Math.min(Ny - 1, Math.ceil(((chip.y + chip.length/2 + heatsink.length/2) / heatsink.length) * Ny)));

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
      const avgBaseT = cCount > 0 ? sumBaseT / cCount : minT;
      const chipAreaM2 = (chip.width * chip.length) / 1e6;
      const R_tim = (tim.thickness / 1e6) / (tim.k * chipAreaM2);
      const tJunc = avgBaseT + chip.power * R_tim;

      // Color dynamically if simulated (minT !== maxT), else show CAD location reference red
      const sourceColor = (minT === maxT) ? new THREE.Color(0xef4444) : getTemperatureColor(tJunc, minT, maxT);

      // Chip / Heat Source (colored dynamically)
      const chipGeo = new THREE.BoxBufferGeometry(cW, 2, cL);
      const chipMat = new THREE.MeshLambertMaterial({
        color: sourceColor,
        transparent: true,
        opacity: 0.95
      });
      const chipMesh = new THREE.Mesh(chipGeo, chipMat);
      // Place directly under base
      chipMesh.position.set(cX, -1, cY);
      chipsGroup.add(chipMesh);

      // TIM (grey interface material)
      const timGeo = new THREE.BoxBufferGeometry(cW, 0.4, cL);
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

      const ductGeo = new THREE.BoxBufferGeometry(dW, dH, dL);
      const ductMat = new THREE.MeshLambertMaterial({
        color: 0x3b82f6,
        transparent: true,
        opacity: 0.12
      });
      const duct = new THREE.Mesh(ductGeo, ductMat);

      // Sharp outer outline wireframe edge helper
      const edges = new THREE.EdgesGeometry(ductGeo);
      const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x60a5fa, linewidth: 2 }));

      ductMesh = new THREE.Group();
      ductMesh.add(duct);
      ductMesh.add(line);
      ductMesh.position.set(0, dH / 2 - (environment.bypassTop * scale)/2, 0);
      scene.add(ductMesh);
    }

    // Apply global assembly rotations to heatsink and heat sources groups
    if (environment.orientation === "downward") {
      heatsinkGroup.rotation.z = Math.PI;
      chipsGroup.rotation.z = Math.PI;
    } else if (environment.orientation === "vertical") {
      heatsinkGroup.rotation.x = Math.PI / 2;
      chipsGroup.rotation.x = Math.PI / 2;
    }

    // 5. Add Airflow & Gravity indicators to helpersGroup (placed in constant world space)
    const gravDir = new THREE.Vector3(0, -1, 0);
    const gravOrigin = new THREE.Vector3(-W/2 - 15 * scale, 0, 0);
    const gravArrow = new THREE.ArrowHelper(gravDir, gravOrigin, 10 * scale, 0xec4899, 2.5 * scale, 1.5 * scale);
    helpersGroup.add(gravArrow);

    if (environment.mode === "forced") {
      // Airflow entrance/exit plane helpers
      const dW = W + (environment.bypassSide * 2) * scale;
      const dH = t + Hf + environment.bypassTop * scale;
      const dL = L + 40 * scale;

      const intakeGeo = new THREE.PlaneGeometry(dW, dH);
      const intakeMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, wireframe: true, transparent: true, opacity: 0.15 });
      const intakeMesh = new THREE.Mesh(intakeGeo, intakeMat);
      intakeMesh.position.set(0, dH / 2 - (environment.bypassTop * scale)/2, -L/2 - 20 * scale);
      helpersGroup.add(intakeMesh);

      const outletGeo = new THREE.PlaneGeometry(dW, dH);
      const outletMat = new THREE.MeshBasicMaterial({ color: 0xf97316, wireframe: true, transparent: true, opacity: 0.15 });
      const outletMesh = new THREE.Mesh(outletGeo, outletMat);
      outletMesh.position.set(0, dH / 2 - (environment.bypassTop * scale)/2, L/2 + 20 * scale);
      helpersGroup.add(outletMesh);

      // Flow direction arrows (Cyan inlet, Orange outlet)
      const arrowDir = new THREE.Vector3(0, 0, 1);
      const arrowLength = 12 * scale;
      const arrowHeadLength = 3 * scale;
      const arrowHeadWidth = 2.0 * scale;

      [-W/3, 0, W/3].forEach(x => {
        // Cold intake arrows
        const inOrigin = new THREE.Vector3(x, t + Hf/2, -L/2 - 20 * scale);
        const inArrow = new THREE.ArrowHelper(arrowDir, inOrigin, arrowLength, 0x06b6d4, arrowHeadLength, arrowHeadWidth);
        helpersGroup.add(inArrow);

        // Hot exhaust arrows
        const outOrigin = new THREE.Vector3(x, t + Hf/2, L/2 + 8 * scale);
        const outArrow = new THREE.ArrowHelper(arrowDir, outOrigin, arrowLength, 0xf97316, arrowHeadLength, arrowHeadWidth);
        helpersGroup.add(outArrow);
      });
    } else {
      // Natural convection - upward draft thermal arrows (Warm orange-red pointing up +Y)
      const arrowDir = new THREE.Vector3(0, 1, 0);
      const arrowLength = 10 * scale;
      const arrowHeadLength = 2.5 * scale;
      const arrowHeadWidth = 1.5 * scale;

      [-W/3, 0, W/3].forEach(x => {
        // Rising air arrows above the base/fins
        const origin1 = new THREE.Vector3(x, t + Hf + 4 * scale, -L/4);
        const arrow1 = new THREE.ArrowHelper(arrowDir, origin1, arrowLength, 0xef4444, arrowHeadLength, arrowHeadWidth);
        helpersGroup.add(arrow1);

        const origin2 = new THREE.Vector3(x, t + Hf + 4 * scale, L/4);
        const arrow2 = new THREE.ArrowHelper(arrowDir, origin2, arrowLength, 0xef4444, arrowHeadLength, arrowHeadWidth);
        helpersGroup.add(arrow2);
      });
    }
  };

  // ── Simulator Solver Engine ──────────────────────────────────
  const runSimulation = () => {
    // Show loader
    simSpinner.classList.remove("hidden");

    // Throttled in standard browser frame timeout to permit CSS loading state to render
    setTimeout(() => {
      try {
        if (cadMode) {
          runVoxelSimulation();
          return;
        }
        syncFinLimits();
        // 1. Fetch input values
        heatsink.width = parseFloat(baseWidthInput.value) || 80;
        heatsink.length = parseFloat(baseLengthInput.value) || 80;
        heatsink.thickness = parseFloat(baseHeightInput.value) || 6;
        heatsink.finHeight = parseFloat(finHeightInput.value) || 25;
        heatsink.finThickness = parseFloat(finThicknessInput.value) || 1.5;
        heatsink.finCount = parseInt(finCountInput.value) || 16;
        heatsink.customK = parseFloat(customKInput.value) || 200;

        tim.thickness = parseFloat(timThicknessInput.value) || 100;
        tim.k = parseFloat(timKInput.value) || 5.0;

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
          // Natural Convection (Free convection based on orientation)
          const dT_est = 25.0; // estimated delta temperature
          
          let C_orientation = 1.42; // default vertical chimney
          let L_char = heatsink.finHeight / 1000;

          if (environment.orientation === "upward") {
            C_orientation = 1.32;
            const AreaM2 = (heatsink.width * heatsink.length) / 1e6;
            const PerimM = (2 * (heatsink.width + heatsink.length)) / 1000;
            L_char = Math.max(0.01, AreaM2 / PerimM);
          } else if (environment.orientation === "downward") {
            C_orientation = 0.59;
            const AreaM2 = (heatsink.width * heatsink.length) / 1e6;
            const PerimM = (2 * (heatsink.width + heatsink.length)) / 1000;
            L_char = Math.max(0.01, AreaM2 / PerimM);
          }

          const h_conv = C_orientation * Math.pow(dT_est / L_char, 0.25);
          
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

      // Junction Temp matching chip contact and TIM thermal resistance
      // R_tim = thickness / (k_tim * Area)
      // T_junction = T_base + Q * R_tim
      let maxJunctionTemp = maxBaseTemp;
      const individualTemps = [];

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

        individualTemps.push({ power: chip.power, tJunc });
      });

      // Update individual heat source temps in DOM
      const sourcesTempList = document.getElementById("sources-temp-list");
      if (sourcesTempList) {
        sourcesTempList.innerHTML = "";
        individualTemps.forEach((item, idx) => {
          const row = document.createElement("div");
          row.style.display = "flex";
          row.style.justify = "space-between";
          row.style.fontSize = "13px";
          row.style.fontFamily = "var(--font-mono)";
          row.style.color = "var(--text-primary)";
          row.style.background = "var(--bg-tertiary)";
          row.style.padding = "6px 12px";
          row.style.borderRadius = "var(--radius-sm)";
          row.style.marginTop = "4px";
          row.innerHTML = `
            <span>Heat Source #${idx + 1} (${item.power}W)</span>
            <strong>${item.tJunc.toFixed(1)} °C</strong>
          `;
          sourcesTempList.appendChild(row);
        });
      }

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
        document.getElementById("legend-max").textContent = `${Math.round(maxJunctionTemp)}°C`;

        // Redraw 3D scene and Fan curve chart
        update3DModel(environment.ambientTemp, maxJunctionTemp, individualTemps);
        drawFanCurve(sysFlow, sysPress);
      } catch (err) {
        console.error("Solver execution error:", err);
      } finally {
        // Hide Loader
        simSpinner.classList.add("hidden");
      }
    }, 150);
  };

  // ── HTML5 Canvas Fan Curve Plotter ────────────────────────────
  const drawFanCurve = (operatingFlow, operatingPress) => {
    const rect = fanCurveChart.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Set actual canvas resolution multiplied by device pixel ratio
    fanCurveChart.width = rect.width * dpr;
    fanCurveChart.height = rect.height * dpr;

    const ctx = fanCurveChart.getContext("2d");
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

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
    bypassSideInput, bypassTopInput
  ].forEach(input => {
    input.addEventListener("input", () => {
      updateCADGeometry();
      document.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });

  [
    customKInput, timThicknessInput, timKInput,
    ambientTempInput, fanAirflowInput, surfaceEmissivityInput
  ].forEach(input => {
    input.addEventListener("input", () => {
      document.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });

  const runSimBtn = document.getElementById("run-sim-btn");
  if (runSimBtn) {
    runSimBtn.addEventListener("click", () => {
      runSimulation();
    });
  }

  const resetViewBtn = document.getElementById("reset-view-btn");
  if (resetViewBtn) {
    resetViewBtn.addEventListener("click", () => {
      camera.position.set(100, 100, 150);
      controls.target.set(0, 0, 0);
      controls.update();
    });
  }

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
          assemblyOrientation.value = environment.orientation || "upward";
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
        assemblyOrientation.value = environment.orientation || "upward";
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

  // ── CAD File Import & Interaction Logic ──────────────────────
  const getRoleColor = (role) => {
    switch (role) {
      case "heatsink": return "#0d9488";
      case "source": return "#ef4444";
      case "tim": return "#f59e0b";
      case "duct": return "#3b82f6";
      default: return "#64748b";
    }
  };

  const highlightCADPart = (partId) => {
    document.querySelectorAll(".chip-item-row").forEach(row => {
      row.style.background = "var(--bg-secondary)";
    });
    const activeRow = document.getElementById(`part-row-${partId}`);
    if (activeRow) {
      activeRow.style.background = "var(--accent-primary-glow)";
      activeRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    
    cadParts.forEach(part => {
      if (part.id === partId) {
        part.mesh.material = new THREE.MeshLambertMaterial({
          color: 0xeab308,
          transparent: true,
          opacity: 1.0
        });
      } else {
        part.mesh.material = new THREE.MeshLambertMaterial({
          color: part.role === "ignore" ? 0x64748b : 0x94a3b8,
          transparent: true,
          opacity: part.role === "ignore" ? 0.3 : 0.7
        });
      }
    });
  };

  const renderCADPartsList = () => {
    cadPartsList.innerHTML = "";
    if (cadParts.length === 0) {
      cadPartsList.innerHTML = `<p class="text-muted" style="font-size: 12px; text-align: center; padding: 12px;">No CAD parts loaded. Upload a file above to begin.</p>`;
      return;
    }
    
    cadParts.forEach(part => {
      const row = document.createElement("div");
      row.className = "chip-item-row";
      row.id = `part-row-${part.id}`;
      row.style.borderLeft = `4px solid ${getRoleColor(part.role)}`;
      row.style.background = "var(--bg-secondary)";
      row.style.padding = "10px";
      row.style.borderRadius = "var(--radius-md)";
      row.style.marginBottom = "8px";
      row.style.cursor = "pointer";
      
      row.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700; font-size: 13px; color: var(--text-primary);">${part.name}</span>
          <button class="action-btn delete-part-btn" data-id="${part.id}" title="Delete Part" style="background: none; border: none; padding: 4px; display: inline-flex; align-items: center; color: var(--text-critical); cursor: pointer;">
            <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
          </button>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px;">
          <div class="form-group">
            <label style="font-size: 11px;">Role</label>
            <select class="form-select part-role-select" data-id="${part.id}" style="padding: 4px; font-size: 11px;">
              <option value="heatsink" ${part.role === "heatsink" ? "selected" : ""}>Heatsink</option>
              <option value="source" ${part.role === "source" ? "selected" : ""}>Heat Source</option>
              <option value="tim" ${part.role === "tim" ? "selected" : ""}>TIM Layer</option>
              <option value="duct" ${part.role === "duct" ? "selected" : ""}>Duct Boundary</option>
              <option value="ignore" ${part.role === "ignore" ? "selected" : ""}>Ignore</option>
            </select>
          </div>
          
          <div class="form-group">
            <label style="font-size: 11px;">Material</label>
            <select class="form-select part-mat-select" data-id="${part.id}" style="padding: 4px; font-size: 11px;">
              <option value="aluminum" ${part.material === "aluminum" ? "selected" : ""}>Aluminum</option>
              <option value="copper" ${part.material === "copper" ? "selected" : ""}>Copper</option>
              <option value="custom" ${part.material === "custom" ? "selected" : ""}>Custom</option>
            </select>
          </div>
        </div>
        <div class="part-detail-group-${part.id}" style="margin-top: 8px;"></div>
      `;
      
      cadPartsList.appendChild(row);
      
      const detailGrp = row.querySelector(`.part-detail-group-${part.id}`);
      const updateDetails = () => {
        detailGrp.innerHTML = "";
        if (part.role === "source") {
          detailGrp.innerHTML = `
            <div class="form-group">
              <label style="font-size: 11px;">Heat Dissipation (W)</label>
              <input type="number" class="form-input part-power-input" data-id="${part.id}" value="${part.power}" min="0.1" step="0.5" style="padding: 4px; font-size: 11px;" />
            </div>
          `;
          detailGrp.querySelector(".part-power-input").addEventListener("change", (e) => {
            part.power = parseFloat(e.target.value) || 0;
          });
        }
        if (part.material === "custom") {
          detailGrp.innerHTML += `
            <div class="form-group" style="margin-top: 4px;">
              <label style="font-size: 11px;">Conductivity (W/m·K)</label>
              <input type="number" class="form-input part-k-input" data-id="${part.id}" value="${part.customK}" min="1" step="5" style="padding: 4px; font-size: 11px;" />
            </div>
          `;
          detailGrp.querySelector(".part-k-input").addEventListener("change", (e) => {
            part.customK = parseFloat(e.target.value) || 200;
          });
        }
      };
      
      updateDetails();
      
      row.querySelector(".part-role-select").addEventListener("change", (e) => {
        part.role = e.target.value;
        row.style.borderLeft = `4px solid ${getRoleColor(part.role)}`;
        updateDetails();
        highlightCADPart(part.id);
      });
      
      row.querySelector(".part-mat-select").addEventListener("change", (e) => {
        part.material = e.target.value;
        updateDetails();
      });

      row.addEventListener("click", (e) => {
        if (e.target.tagName === "SELECT" || e.target.tagName === "INPUT" || e.target.tagName === "OPTION" || e.target.closest(".delete-part-btn")) {
          return;
        }
        highlightCADPart(part.id);
      });

      row.querySelector(".delete-part-btn").addEventListener("click", (evt) => {
        evt.stopPropagation();
        cadAssemblyGroup.remove(part.mesh);
        cadParts = cadParts.filter(p => p.id !== part.id);
        renderCADPartsList();
        if (window.showToast) window.showToast(`Deleted part: ${part.name}`);
      });
    });
    if (typeof lucide !== "undefined") lucide.createIcons();
  };

  const setupCADAssembly = (partsList) => {
    cadMode = true;
    cadParts = partsList.map((part, idx) => {
      return {
        id: `cad-part-${idx}`,
        name: part.name || `Part #${idx + 1}`,
        mesh: part.mesh,
        role: idx === 0 ? "heatsink" : "ignore",
        material: "aluminum",
        customK: 200,
        power: 30
      };
    });
    
    while (heatsinkGroup.children.length > 0) heatsinkGroup.remove(heatsinkGroup.children[0]);
    while (chipsGroup.children.length > 0) chipsGroup.remove(chipsGroup.children[0]);
    while (helpersGroup.children.length > 0) helpersGroup.remove(helpersGroup.children[0]);
    if (ductMesh) scene.remove(ductMesh);
    
    while (cadAssemblyGroup.children.length > 0) cadAssemblyGroup.remove(cadAssemblyGroup.children[0]);
    
    const globalBox = new THREE.Box3();
    cadParts.forEach(part => {
      part.mesh.geometry.computeBoundingBox();
      const box = part.mesh.geometry.boundingBox.clone();
      globalBox.union(box);
    });
    
    const center = new THREE.Vector3();
    globalBox.getCenter(center);
    const size = new THREE.Vector3();
    globalBox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1.0;
    const scale = 50.0 / maxDim;
    
    cadParts.forEach(part => {
      part.mesh.position.sub(center);
      part.mesh.scale.set(scale, scale, scale);
      part.mesh.position.multiplyScalar(scale);
      
      part.mesh.material = new THREE.MeshLambertMaterial({
        color: 0x94a3b8,
        transparent: true,
        opacity: 0.8
      });
      cadAssemblyGroup.add(part.mesh);
    });
    
    cadActiveControls.classList.remove("hidden");
    simSpinner.classList.add("hidden");
    renderCADPartsList();
    
    if (window.showToast) window.showToast("CAD File loaded! Assign roles in Parts Manager.");
  };

  const loadCADFile = (file) => {
    const extension = file.name.split(".").pop().toLowerCase();
    if (extension !== "step" && extension !== "stp") {
      alert("Please select a valid STEP file (.step, .stp).");
      return;
    }
    
    const reader = new FileReader();
    simSpinner.classList.remove("hidden");
    
    reader.onload = function(evt) {
      try {
        const buffer = evt.target.result;
        if (typeof occtimportjs === "undefined") {
          throw new Error("STEP decoder library is not fully loaded. Check internet connection.");
        }
        occtimportjs().then(occt => {
          const fileContent = new Uint8Array(buffer);
          const result = occt.ReadStepFile(fileContent);
          if (!result || !result.success) {
            throw new Error("Unable to parse STEP B-Rep geometry.");
          }
          const partsList = [];
          result.meshes.forEach((m, idx) => {
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(m.attributes.position.array);
            geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
            if (m.attributes.normal) {
              const normals = new Float32Array(m.attributes.normal.array);
              geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
            } else {
              geometry.computeVertexNormals();
            }
            if (m.index) {
              const indices = new Uint32Array(m.index.array);
              geometry.setIndex(new THREE.BufferAttribute(indices, 1));
            }
            const material = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });
            const mesh = new THREE.Mesh(geometry, material);
            partsList.push({ name: m.name || `Part ${idx + 1}`, mesh: mesh });
          });
          setupCADAssembly(partsList);
        }).catch(err => {
          alert("STEP Import Error: " + err.message);
          simSpinner.classList.add("hidden");
        });
      } catch (err) {
        alert("CAD Loading Error: " + err.message);
        simSpinner.classList.add("hidden");
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

  cadFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    loadCADFile(file);
  });

  cadClearBtn.addEventListener("click", () => {
    cadMode = false;
    cadParts = [];
    cadActiveControls.classList.add("hidden");
    cadFileInput.value = "";
    
    while (cadAssemblyGroup.children.length > 0) cadAssemblyGroup.remove(cadAssemblyGroup.children[0]);
    
    updateCADGeometry();
    cadPartsList.innerHTML = `<p class="text-muted" style="font-size: 12px; text-align: center; padding: 12px;">No CAD parts loaded. Upload a file above to begin.</p>`;
  });

  const runVoxelSimulation = () => {
    try {
      const Vx = 20;
      const Vy = 20;
      const Vz = 10;
      const ambient = parseFloat(ambientTempInput.value) || 25;
      
      const bbox = new THREE.Box3().setFromObject(cadAssemblyGroup);
      const minPt = bbox.min;
      const maxPt = bbox.max;
      const size = bbox.getSize(new THREE.Vector3());
      
      const dx = size.x / Vx;
      const dy = size.y / Vy;
      const dz = size.z / Vz;
      
      const grid = Array(Vx).fill(0).map(() => Array(Vy).fill(0).map(() => Array(Vz).fill(ambient)));
      const gridK = Array(Vx).fill(0).map(() => Array(Vy).fill(0).map(() => Array(Vz).fill(0.026)));
      const gridQ = Array(Vx).fill(0).map(() => Array(Vy).fill(0).map(() => Array(Vz).fill(0)));
      const gridType = Array(Vx).fill(0).map(() => Array(Vy).fill(0).map(() => Array(Vz).fill("air")));
      
      cadParts.forEach(part => {
        if (part.role === "ignore") return;
        part.mesh.geometry.computeBoundingBox();
        part._worldBBox = new THREE.Box3().setFromObject(part.mesh);
        let kVal = 200;
        if (part.material === "aluminum") kVal = 200;
        else if (part.material === "copper") kVal = 400;
        else kVal = parseFloat(part.customK) || 200;
        part._k = kVal;
      });
      
      for (let i = 0; i < Vx; i++) {
        const px = minPt.x + (i + 0.5) * dx;
        for (let j = 0; j < Vy; j++) {
          const py = minPt.y + (j + 0.5) * dy;
          for (let k = 0; k < Vz; k++) {
            const pz = minPt.z + (k + 0.5) * dz;
            const pt = new THREE.Vector3(px, py, pz);
            
            for (let pIdx = 0; pIdx < cadParts.length; pIdx++) {
              const part = cadParts[pIdx];
              if (part.role === "ignore") continue;
              if (part._worldBBox.containsPoint(pt)) {
                gridK[i][j][k] = part._k;
                gridType[i][j][k] = part.role;
                break;
              }
            }
          }
        }
      }
      
      cadParts.forEach(part => {
        if (part.role !== "source") return;
        let nodeCount = 0;
        for (let i = 0; i < Vx; i++) {
          const px = minPt.x + (i + 0.5) * dx;
          for (let j = 0; j < Vy; j++) {
            const py = minPt.y + (j + 0.5) * dy;
            for (let k = 0; k < Vz; k++) {
              const pz = minPt.z + (k + 0.5) * dz;
              if (gridType[i][j][k] === "source" && part._worldBBox.containsPoint(new THREE.Vector3(px, py, pz))) {
                nodeCount++;
              }
            }
          }
        }
        if (nodeCount > 0) {
          const qVal = part.power / nodeCount;
          for (let i = 0; i < Vx; i++) {
            const px = minPt.x + (i + 0.5) * dx;
            for (let j = 0; j < Vy; j++) {
              const py = minPt.y + (j + 0.5) * dy;
              for (let k = 0; k < Vz; k++) {
                const pz = minPt.z + (k + 0.5) * dz;
                if (gridType[i][j][k] === "source" && part._worldBBox.containsPoint(new THREE.Vector3(px, py, pz))) {
                  gridQ[i][j][k] = qVal;
                }
              }
            }
          }
        }
      });
      
      const hVal = environment.mode === "forced" ? 30.0 : 8.0;
      const maxIter = 100;
      
      for (let iter = 0; iter < maxIter; iter++) {
        const nextGrid = Array(Vx).fill(0).map(() => Array(Vy).fill(0).map(() => Array(Vz).fill(ambient)));
        
        for (let i = 0; i < Vx; i++) {
          for (let j = 0; j < Vy; j++) {
            for (let k = 0; k < Vz; k++) {
              const type = gridType[i][j][k];
              if (type === "air" || type === "duct") {
                nextGrid[i][j][k] = ambient;
                continue;
              }
              
              let condSum = 0;
              let tSum = 0;
              
              const neighbors = [
                { ni: i - 1, nj: j, nk: k, area: dy * dz, dist: dx },
                { ni: i + 1, nj: j, nk: k, area: dy * dz, dist: dx },
                { ni: i, nj: j - 1, nk: k, area: dx * dz, dist: dy },
                { ni: i, nj: j + 1, nk: k, area: dx * dz, dist: dy },
                { ni: i, nj: j, nk: k - 1, area: dx * dy, dist: dz },
                { ni: i, nj: j, nk: k + 1, area: dx * dy, dist: dz }
              ];
              
              neighbors.forEach(n => {
                if (n.ni >= 0 && n.ni < Vx && n.nj >= 0 && n.nj < Vy && n.nk >= 0 && n.nk < Vz) {
                  const kNode = gridK[i][j][k];
                  const kNeigh = gridK[n.ni][n.nj][n.nk];
                  const kAvg = 2 * kNode * kNeigh / (kNode + kNeigh || 1);
                  const cond = (kAvg * n.area) / n.dist;
                  condSum += cond;
                  tSum += cond * grid[n.ni][n.nj][n.nk];
                } else {
                  const condAir = hVal * n.area;
                  condSum += condAir;
                  tSum += condAir * ambient;
                }
              });
              
              nextGrid[i][j][k] = (tSum + gridQ[i][j][k]) / (condSum || 1);
            }
          }
        }
        
        for (let i = 0; i < Vx; i++) {
          for (let j = 0; j < Vy; j++) {
            for (let k = 0; k < Vz; k++) {
              grid[i][j][k] = nextGrid[i][j][k];
            }
          }
        }
      }
      
      let minT = 999;
      let maxT = -999;
      for (let i = 0; i < Vx; i++) {
        for (let j = 0; j < Vy; j++) {
          for (let k = 0; k < Vz; k++) {
            if (gridType[i][j][k] !== "air" && gridType[i][j][k] !== "ignore") {
              const T = grid[i][j][k];
              if (T < minT) minT = T;
              if (T > maxT) maxT = T;
            }
          }
        }
      }
      if (minT > maxT) { minT = ambient; maxT = ambient + 1; }
      
      const totalP = cadParts.reduce((acc, p) => p.role === "source" ? acc + p.power : acc, 0);
      document.getElementById("res-t-max").textContent = `${maxT.toFixed(1)} °C`;
      document.getElementById("res-t-base").textContent = `${minT.toFixed(1)} °C`;
      document.getElementById("res-h-coeff").textContent = `${hVal.toFixed(1)} W/m²K`;
      document.getElementById("res-theta").textContent = `${totalP > 0 ? ((maxT - ambient) / totalP).toFixed(2) : 0} K/W`;
      
      if (maxT > 105) {
        statusBadge.className = "badge critical-badge";
        statusBadge.textContent = "Critical";
      } else if (maxT > 85) {
        statusBadge.className = "badge warning-badge";
        statusBadge.textContent = "Warning";
      } else {
        statusBadge.className = "badge active-badge";
        statusBadge.textContent = "Normal";
      }
      
      document.getElementById("legend-min").textContent = `${Math.round(ambient)}°C`;
      document.getElementById("legend-max").textContent = `${Math.round(maxT)}°C`;
      
      const indTemps = [];
      cadParts.forEach(part => {
        if (part.role === "ignore") return;
        const geom = part.mesh.geometry;
        const count = geom.attributes.position.count;
        const colors = new Float32Array(count * 3);
        const pos = geom.attributes.position;
        const meshMatrix = part.mesh.matrixWorld;
        
        let sumT = 0;
        let vCount = 0;
        
        for (let idx = 0; idx < count; idx++) {
          const localPt = new THREE.Vector3(pos.getX(idx), pos.getY(idx), pos.getZ(idx));
          const worldPt = localPt.clone().applyMatrix4(meshMatrix);
          
          const i = Math.max(0, Math.min(Vx - 1, Math.floor(((worldPt.x - minPt.x) / size.x) * Vx)));
          const j = Math.max(0, Math.min(Vy - 1, Math.floor(((worldPt.y - minPt.y) / size.y) * Vy)));
          const k = Math.max(0, Math.min(Vz - 1, Math.floor(((worldPt.z - minPt.z) / size.z) * Vz)));
          
          const temp = grid[i][j][k];
          sumT += temp;
          vCount++;
          
          const color = getTemperatureColor(temp, ambient, maxT);
          colors[idx * 3] = color.r;
          colors[idx * 3 + 1] = color.g;
          colors[idx * 3 + 2] = color.b;
        }
        
        geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        part.mesh.material = new THREE.MeshLambertMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.95
        });
        geom.attributes.color.needsUpdate = true;
        
        if (part.role === "source") {
          indTemps.push({ power: part.power, tJunc: vCount > 0 ? sumT / vCount : maxT });
        }
      });
      
      const sourcesTempList = document.getElementById("sources-temp-list");
      if (sourcesTempList) {
        sourcesTempList.innerHTML = "";
        indTemps.forEach((item, idx) => {
          const row = document.createElement("div");
          row.style.display = "flex";
          row.style.justify = "space-between";
          row.style.fontSize = "13px";
          row.style.fontFamily = "var(--font-mono)";
          row.style.color = "var(--text-primary)";
          row.style.background = "var(--bg-tertiary)";
          row.style.padding = "6px 12px";
          row.style.borderRadius = "var(--radius-sm)";
          row.style.marginTop = "4px";
          row.innerHTML = `
            <span>Heat Source #${idx + 1} (${item.power}W)</span>
            <strong>${item.tJunc.toFixed(1)} °C</strong>
          `;
          sourcesTempList.appendChild(row);
        });
      }
      
      if (window.showToast) window.showToast("Volumetric 3D Finite Difference Simulation complete!");
    } catch (err) {
      console.error("Voxel simulation solver error:", err);
      alert("Simulation failed: " + err.message);
    } finally {
      simSpinner.classList.add("hidden");
    }
  };

  // Run Initializations
  init3DScene();
  renderChipsUI();
  runSimulation();
});
