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
    customK: 200,
    density: 2.7
  };

  let chips = [
    { id: "chip-1", power: 45, width: 25, length: 25, x: 0, y: 0, maxTemp: 125 } // positions relative to base center (mm)
  ];

  let tim = {
    thickness: 100, // micrometers (0.1mm)
    k: 5.0,          // W/mK
    preset: "custom"
  };

  let environment = {
    mode: "forced", // "forced" or "natural"
    ambientTemp: 25, // °C
    fanAirflow: 32,  // CFM (Max Flow)
    bypassSide: 2,   // mm
    bypassTop: 1,    // mm
    emissivity: 0.85,
    orientation: "upward",
    meshResolution: "medium"
  };

  // 3D Rendering variables
  let scene, camera, renderer, controls;
  let heatsinkGroup, chipsGroup, ductMesh, helpersGroup, cadAssemblyGroup;
  const canvasContainer = document.getElementById("canvas-container");
  
  let cadMode = false;
  let cadParts = [];
  let currentScale = 1.0;
  
  // Solver Grid dimensions


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
  const customDensityInput = document.getElementById("custom-density");

  const addChipBtn = document.getElementById("add-source-btn");
  const chipsListContainer = document.getElementById("sources-list-container");
  const timThicknessInput = document.getElementById("tim-thickness");
  const timKInput = document.getElementById("tim-k");
  const timPresetSelect = document.getElementById("tim-preset");

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
  const cadUploadStatus = document.getElementById("cad-upload-status");
  const cadUploadStatusText = document.getElementById("cad-upload-status-text");
  const meshResolutionSlider = document.getElementById("mesh-resolution-slider");
  const meshResolutionValue = document.getElementById("mesh-resolution-value");
  const showMeshGridInput = document.getElementById("show-mesh-grid");
  let voxelGridHelper = null;
  const resTJunction = document.getElementById("res-t-junction");
  const resTBase = document.getElementById("res-t-base");
  const resHCoeff = document.getElementById("res-h-coeff");
  const resTheta = document.getElementById("res-theta");
  const resMass = document.getElementById("res-mass");
  const resMassEff = document.getElementById("res-mass-eff");
  const resTAirRise = document.getElementById("res-t-air-rise");
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
    
    heatsink.material = materialSelect.value;
    let kVal = 200;
    let densityVal = 2.7;
    if (heatsink.material === "aluminum") { kVal = 200; densityVal = 2.7; }
    else if (heatsink.material === "copper") { kVal = 400; densityVal = 8.96; }
    else if (heatsink.material === "magnesium") { kVal = 96; densityVal = 1.77; }
    else if (heatsink.material === "graphite") { kVal = 400; densityVal = 2.2; }
    else {
      kVal = parseFloat(customKInput.value) || 200;
      densityVal = parseFloat(customDensityInput.value) || 2.7;
    }
    heatsink.customK = kVal;
    heatsink.density = densityVal;

    environment.bypassSide = parseFloat(bypassSideInput.value) || 2;
    environment.bypassTop = parseFloat(bypassTopInput.value) || 1;
    environment.mode = convectionMode.value;
    environment.orientation = assemblyOrientation.value;
    environment.ambientTemp = parseFloat(ambientTempInput.value) || 25;
    environment.fanAirflow = parseFloat(fanAirflowInput.value) || 32;
    environment.emissivity = parseFloat(surfaceEmissivityInput.value) || 0.85;
    tim.thickness = parseFloat(timThicknessInput.value) || 100;
    tim.k = parseFloat(timKInput.value) || 5.0;
    tim.preset = timPresetSelect ? timPresetSelect.value : "custom";

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
    updateCADGeometry();
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
            <label>Max Tj <span>(&deg;C)</span></label>
            <input type="number" class="form-input chip-maxtemp" data-id="${chip.id}" value="${chip.maxTemp || 125}" min="30" max="250" />
          </div>
          <div class="form-group margin-top-6">
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
        updateCADGeometry();
        document.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });

    document.querySelectorAll(".chip-maxtemp").forEach(input => {
      input.addEventListener("change", (e) => {
        const id = e.target.getAttribute("data-id");
        const match = chips.find(c => c.id === id);
        if (match) match.maxTemp = parseFloat(e.target.value) || 125;
        updateCADGeometry();
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
    chips.push({ id: newId, power: 30, width: 20, length: 20, x: 0, y: 0, maxTemp: 125 });
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

  const getMeshResolutionVal = () => {
    if (meshResolutionSlider) {
      return parseInt(meshResolutionSlider.value) || 20;
    }
    return 20;
  };

  const updateVoxelGridHelper = () => {
    if (voxelGridHelper) {
      scene.remove(voxelGridHelper);
      voxelGridHelper = null;
    }

    if (!showMeshGridInput || !showMeshGridInput.checked) return;

    scene.updateMatrixWorld(true);
    const bbox = new THREE.Box3();
    if (cadMode) {
      bbox.setFromObject(cadAssemblyGroup);
    } else {
      bbox.setFromObject(heatsinkGroup);
      bbox.union(new THREE.Box3().setFromObject(chipsGroup));
    }
    const min = bbox.min;
    const max = bbox.max;
    const size = bbox.getSize(new THREE.Vector3());

    const Vx = getMeshResolutionVal();
    const Vy = Vx;
    const Vz = Math.round(Vx / 2);

    const dx = size.x / Vx;
    const dy = size.y / Vy;
    const dz = size.z / Vz;

    const points = [];

    // X direction lines
    for (let j = 0; j <= Vy; j++) {
      const y = min.y + j * dy;
      points.push(new THREE.Vector3(min.x, y, min.z), new THREE.Vector3(max.x, y, min.z));
      points.push(new THREE.Vector3(min.x, y, max.z), new THREE.Vector3(max.x, y, max.z));
    }
    for (let k = 0; k <= Vz; k++) {
      const z = min.z + k * dz;
      points.push(new THREE.Vector3(min.x, min.y, z), new THREE.Vector3(max.x, min.y, z));
      points.push(new THREE.Vector3(min.x, max.y, z), new THREE.Vector3(max.x, max.y, z));
    }

    // Y direction lines
    for (let i = 0; i <= Vx; i++) {
      const x = min.x + i * dx;
      points.push(new THREE.Vector3(x, min.y, min.z), new THREE.Vector3(x, max.y, min.z));
      points.push(new THREE.Vector3(x, min.y, max.z), new THREE.Vector3(x, max.y, max.z));
    }
    for (let k = 0; k <= Vz; k++) {
      const z = min.z + k * dz;
      points.push(new THREE.Vector3(min.x, min.y, z), new THREE.Vector3(min.x, max.y, z));
      points.push(new THREE.Vector3(max.x, min.y, z), new THREE.Vector3(max.x, max.y, z));
    }

    // Z direction lines
    for (let i = 0; i <= Vx; i++) {
      const x = min.x + i * dx;
      points.push(new THREE.Vector3(x, min.y, min.z), new THREE.Vector3(x, min.y, max.z));
      points.push(new THREE.Vector3(x, max.y, min.z), new THREE.Vector3(x, max.y, max.z));
    }
    for (let j = 0; j <= Vy; j++) {
      const y = min.y + j * dy;
      points.push(new THREE.Vector3(min.x, y, min.z), new THREE.Vector3(min.x, y, max.z));
      points.push(new THREE.Vector3(max.x, y, min.z), new THREE.Vector3(max.x, y, max.z));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.35
    });

    voxelGridHelper = new THREE.LineSegments(geometry, material);
    scene.add(voxelGridHelper);
  };

  if (showMeshGridInput) {
    showMeshGridInput.addEventListener("change", () => {
      updateVoxelGridHelper();
    });
  }

  const updateResolutionDisplay = () => {
    const val = getMeshResolutionVal();
    const Vx = val;
    const Vy = val;
    const Vz = Math.round(val / 2);
    const nodes = Vx * Vy * Vz;
    if (meshResolutionValue) {
      meshResolutionValue.textContent = `${Vx} divs (${nodes.toLocaleString()} nodes)`;
    }
  };

  if (meshResolutionSlider) {
    meshResolutionSlider.addEventListener("input", () => {
      updateResolutionDisplay();
    });
    meshResolutionSlider.addEventListener("change", () => {
      environment.meshResolution = meshResolutionSlider.value;
      updateCADGeometry();
      document.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

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
    currentScale = scale;
    const W = heatsink.width * scale;
    const L = heatsink.length * scale;
    const t = heatsink.thickness * scale;
    const Hf = heatsink.finHeight * scale;
    const tf = heatsink.finThickness * scale;

    const segs = Math.min(60, getMeshResolutionVal());

    // 1. Build heatsink base box with grid segments for vertex coloring
    const baseGeo = new THREE.BoxBufferGeometry(W, t, L, segs, 1, segs);
    const baseMat = new THREE.MeshLambertMaterial({ color: 0xd1d5db });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.set(0, t / 2, 0);
    heatsinkGroup.add(baseMesh);

    // 2. Build Fin meshes spaced along base
    const numFins = heatsink.finCount;
    const spacing = (W - tf) / (numFins - 1 || 1);
    const startX = -W / 2 + tf / 2;

    const finMeshes = [];
    for (let i = 0; i < numFins; i++) {
      const finX = startX + i * spacing;
      
      // Fin box geometry. Segment along length so we get linear heat map gradients
      const finGeo = new THREE.BoxBufferGeometry(tf, Hf, L, 1, Math.max(2, Math.round(segs/3)), segs);
      const finMat = new THREE.MeshLambertMaterial({ color: 0xd1d5db });
      const finMesh = new THREE.Mesh(finGeo, finMat);
      finMesh.position.set(finX, t + Hf / 2, 0);
      heatsinkGroup.add(finMesh);
      finMeshes.push(finMesh);
    }

    // 3. Build Silicon Chips (Heat Sources) and TIM transparent layers
    const chipMeshes = [];
    const timMeshes = [];
    chips.forEach((chip, index) => {
      const cW = chip.width * scale;
      const cL = chip.length * scale;
      const cX = chip.x * scale;
      const cY = -chip.y * scale; // invert Y for standard Cartesian 3D map

      // Chip / Heat Source (colored red by default)
      const chipGeo = new THREE.BoxBufferGeometry(cW, 2, cL);
      const chipMat = new THREE.MeshLambertMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.95
      });
      const chipMesh = new THREE.Mesh(chipGeo, chipMat);
      chipMesh.position.set(cX, -1, cY);
      chipsGroup.add(chipMesh);
      chipMeshes.push(chipMesh);

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
      timMeshes.push(timMesh);
    });

    // Populate cadParts procedurally if not in CAD mode
    if (!cadMode) {
      cadParts = [];
      
      // Add base
      cadParts.push({
        id: "procedural-base",
        name: "Heatsink Base",
        mesh: baseMesh,
        role: "heatsink",
        material: heatsink.material,
        customK: heatsink.customK,
        customDensity: heatsink.density,
        power: 0
      });
      
      // Add fins
      finMeshes.forEach((finMesh, idx) => {
        cadParts.push({
          id: `procedural-fin-${idx}`,
          name: `Fin #${idx + 1}`,
          mesh: finMesh,
          role: "heatsink",
          material: heatsink.material,
          customK: heatsink.customK,
          customDensity: heatsink.density,
          power: 0
        });
      });
      
      // Add chips
      chipMeshes.forEach((chipMesh, idx) => {
        const chipData = chips[idx];
        cadParts.push({
          id: `procedural-source-${idx}`,
          name: `Heat Source #${idx + 1}`,
          mesh: chipMesh,
          role: "source",
          material: "custom",
          customK: 150, // silicon
          power: chipData.power,
          maxTemp: chipData.maxTemp || 125
        });
      });

      // Add tim layers
      timMeshes.forEach((timMesh, idx) => {
        cadParts.push({
          id: `procedural-tim-${idx}`,
          name: `TIM Layer #${idx + 1}`,
          mesh: timMesh,
          role: "tim",
          material: "custom",
          customK: tim.k,
          power: 0
        });
      });
    }

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
    
    updateVoxelGridHelper();
  };

  // ── Simulator Solver Engine ──────────────────────────────────
  const runSimulation = () => {
    // Show loader
    simSpinner.classList.remove("hidden");

    // Throttled in standard browser frame timeout to permit CSS loading state to render
    setTimeout(() => {
      runVoxelSimulation();
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
    customKInput, customDensityInput, timThicknessInput, timKInput,
    ambientTempInput, fanAirflowInput, surfaceEmissivityInput
  ].forEach(input => {
    input.addEventListener("input", () => {
      updateCADGeometry();
      document.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });

  const timPresets = {
    "paste-high": { k: 5.0, thickness: 50 },
    "paste-std": { k: 2.0, thickness: 100 },
    "pad-thin": { k: 1.5, thickness: 500 },
    "pad-thick": { k: 3.0, thickness: 1000 },
    "pcm": { k: 4.0, thickness: 40 },
    "liquid-metal": { k: 70.0, thickness: 10 }
  };

  if (timPresetSelect) {
    timPresetSelect.addEventListener("change", () => {
      const val = timPresetSelect.value;
      if (val !== "custom" && timPresets[val]) {
        timThicknessInput.value = timPresets[val].thickness;
        timKInput.value = timPresets[val].k;
        tim.thickness = timPresets[val].thickness;
        tim.k = timPresets[val].k;
        tim.preset = val;
        updateCADGeometry();
        document.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }

  if (timThicknessInput && timKInput && timPresetSelect) {
    [timThicknessInput, timKInput].forEach(input => {
      input.addEventListener("input", () => {
        timPresetSelect.value = "custom";
        tim.preset = "custom";
      });
    });
  }

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
          if (environment.meshResolution) {
            meshResolutionSlider.value = environment.meshResolution;
            updateResolutionDisplay();
          }

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
        customDensityInput.value = heatsink.density || 2.7;
        if (heatsink.material === "custom") {
          customKGroup.classList.remove("hidden");
        } else {
          customKGroup.classList.add("hidden");
        }

        timThicknessInput.value = tim.thickness;
        timKInput.value = tim.k;
        if (timPresetSelect) {
          timPresetSelect.value = tim.preset || "custom";
        }

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
        if (environment.meshResolution) {
          meshResolutionSlider.value = environment.meshResolution;
          updateResolutionDisplay();
        }

        renderChipsUI();
        updateCADGeometry();
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
              <option value="magnesium" ${part.material === "magnesium" ? "selected" : ""}>Magnesium</option>
              <option value="graphite" ${part.material === "graphite" ? "selected" : ""}>Graphite</option>
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
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <div class="form-group">
                <label style="font-size: 11px;">Heat Dissipation (W)</label>
                <input type="number" class="form-input part-power-input" data-id="${part.id}" value="${part.power}" min="0.1" step="0.5" style="padding: 4px; font-size: 11px;" />
              </div>
              <div class="form-group">
                <label style="font-size: 11px;">Max Tj (&deg;C)</label>
                <input type="number" class="form-input part-maxtemp-input" data-id="${part.id}" value="${part.maxTemp || 125}" min="30" max="250" style="padding: 4px; font-size: 11px;" />
              </div>
            </div>
          `;
          detailGrp.querySelector(".part-power-input").addEventListener("change", (e) => {
            part.power = parseFloat(e.target.value) || 0;
          });
          detailGrp.querySelector(".part-maxtemp-input").addEventListener("change", (e) => {
            part.maxTemp = parseFloat(e.target.value) || 125;
          });
        }
        if (part.material === "custom") {
          detailGrp.innerHTML += `
            <div class="form-row" style="margin-top: 4px; display: flex; gap: 8px;">
              <div class="form-group flex-1">
                <label style="font-size: 11px;">Conductivity (W/m·K)</label>
                <input type="number" class="form-input part-k-input" data-id="${part.id}" value="${part.customK || 200}" min="1" step="5" style="padding: 4px; font-size: 11px;" />
              </div>
              <div class="form-group flex-1">
                <label style="font-size: 11px;">Density (g/cm³)</label>
                <input type="number" class="form-input part-density-input" data-id="${part.id}" value="${part.customDensity || 2.7}" min="0.1" step="0.1" style="padding: 4px; font-size: 11px;" />
              </div>
            </div>
          `;
          detailGrp.querySelector(".part-k-input").addEventListener("change", (e) => {
            part.customK = parseFloat(e.target.value) || 200;
          });
          detailGrp.querySelector(".part-density-input").addEventListener("change", (e) => {
            part.customDensity = parseFloat(e.target.value) || 2.7;
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
        customDensity: 2.7,
        power: 30,
        maxTemp: 125
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
    currentScale = scale;
    
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
    cadUploadStatus.classList.add("hidden");
    cadFileInput.disabled = false;
    renderCADPartsList();
    
    updateVoxelGridHelper();
    if (window.showToast) window.showToast("CAD File loaded! Assign roles in Parts Manager.");
  };

  const loadCADFile = (file) => {
    const extension = file.name.split(".").pop().toLowerCase();
    if (extension !== "step" && extension !== "stp") {
      alert("Please select a valid STEP file (.step, .stp).");
      return;
    }
    
    cadUploadStatus.className = "margin-top-12";
    cadUploadStatus.style.borderColor = "var(--border-color)";
    cadUploadStatus.style.background = "var(--bg-tertiary)";
    cadUploadStatusText.textContent = "Reading file bytes... (0%)";
    cadUploadStatusText.style.color = "var(--text-secondary)";
    cadFileInput.disabled = true;

    const reader = new FileReader();
    simSpinner.classList.remove("hidden");
    
    reader.onprogress = function(evt) {
      if (evt.lengthComputable) {
        const percent = Math.round((evt.loaded / evt.total) * 100);
        cadUploadStatusText.textContent = `Reading file bytes... (${percent}%)`;
      }
    };

    reader.onload = function(evt) {
      try {
        const buffer = evt.target.result;
        cadUploadStatusText.textContent = "Decoding STEP geometry structure... (may take a few seconds)";
        
        if (typeof occtimportjs === "undefined") {
          throw new Error("STEP decoder library is not fully loaded. Check internet connection.");
        }
        occtimportjs().then(occt => {
          cadUploadStatusText.textContent = "Generating 3D meshes and computing bounds...";
          
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
          console.error(err);
          cadUploadStatus.style.borderColor = "var(--text-critical)";
          cadUploadStatus.style.background = "rgba(239, 68, 68, 0.05)";
          cadUploadStatusText.textContent = "STEP Import Error: " + err.message;
          cadUploadStatusText.style.color = "var(--text-critical)";
          cadFileInput.disabled = false;
          simSpinner.classList.add("hidden");
        });
      } catch (err) {
        console.error(err);
        cadUploadStatus.style.borderColor = "var(--text-critical)";
        cadUploadStatus.style.background = "rgba(239, 68, 68, 0.05)";
        cadUploadStatusText.textContent = "CAD Loading Error: " + err.message;
        cadUploadStatusText.style.color = "var(--text-critical)";
        cadFileInput.disabled = false;
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
      const Vx = getMeshResolutionVal();
      const Vy = Vx;
      const Vz = Math.round(Vx / 2);
      const ambient = parseFloat(ambientTempInput.value) || 25;
      
      // Force update of Three.js world transforms to get correct AABB world boxes
      scene.updateMatrixWorld(true);

      const bbox = new THREE.Box3();
      if (cadMode) {
        bbox.setFromObject(cadAssemblyGroup);
      } else {
        bbox.setFromObject(heatsinkGroup);
        bbox.union(new THREE.Box3().setFromObject(chipsGroup));
      }
      const minPt = bbox.min;
      const maxPt = bbox.max;
      const size = bbox.getSize(new THREE.Vector3());
      
      const dx_scaled = size.x / Vx;
      const dy_scaled = size.y / Vy;
      const dz_scaled = size.z / Vz;

      const physicalScale = currentScale * 1000;
      const dx = dx_scaled / physicalScale;
      const dy = dy_scaled / physicalScale;
      const dz = dz_scaled / physicalScale;

      const size_total = Vx * Vy * Vz;
      const strideY = Vy * Vz;
      const strideZ = Vz;
      
      const grid = new Float32Array(size_total).fill(ambient);
      const gridK = new Float32Array(size_total).fill(0.026); // default air thermal conductivity
      const gridQ = new Float32Array(size_total);
      const gridType = new Uint8Array(size_total); // 0: air, 1: heatsink, 2: source, 3: tim, 4: duct
      const gridDensity = new Float32Array(size_total);
      const gridIsGraphite = new Uint8Array(size_total);
      const T_air = new Float32Array(Vz).fill(ambient);
      
      cadParts.forEach(part => {
        if (part.role === "ignore") return;
        part.mesh.geometry.computeBoundingBox();
        part._worldBBox = new THREE.Box3().setFromObject(part.mesh);
        let kVal = 200;
        let densityVal = 2.7;
        if (part.material === "aluminum") { kVal = 200; densityVal = 2.7; }
        else if (part.material === "copper") { kVal = 400; densityVal = 8.96; }
        else if (part.material === "magnesium") { kVal = 96; densityVal = 1.77; }
        else if (part.material === "graphite") { kVal = 400; densityVal = 2.2; }
        else {
          kVal = parseFloat(part.customK) || 200;
          densityVal = parseFloat(part.customDensity) || 2.7;
        }
        part._k = kVal;
        part._density = densityVal;
      });

      console.log("Global Simulation AABB:", bbox);
      cadParts.forEach(p => {
        if (p.role !== "ignore") {
          console.log(`Part [${p.name}] role=[${p.role}] k=[${p._k}] bbox:`, p._worldBBox);
        }
      });
      
      const voxelBox = new THREE.Box3();
      const halfX = dx_scaled / 2;
      const halfY = dy_scaled / 2;
      const halfZ = dz_scaled / 2;

      for (let i = 0; i < Vx; i++) {
        const px = minPt.x + (i + 0.5) * dx_scaled;
        const iStride = i * strideY;
        for (let j = 0; j < Vy; j++) {
          const py = minPt.y + (j + 0.5) * dy_scaled;
          const jStride = j * strideZ;
          for (let k = 0; k < Vz; k++) {
            const pz = minPt.z + (k + 0.5) * dz_scaled;
            const idx = iStride + jStride + k;
            
            voxelBox.min.set(px - halfX, py - halfY, pz - halfZ);
            voxelBox.max.set(px + halfX, py + halfY, pz + halfZ);
            
            for (let pIdx = 0; pIdx < cadParts.length; pIdx++) {
              const part = cadParts[pIdx];
              if (part.role === "ignore") continue;
              if (part._worldBBox.intersectsBox(voxelBox)) {
                if (part.role === "tim") {
                  // Treat TIM voxels as heatsink base (type 1) with heatsink conductivity to avoid bulk resistance exaggeration
                  const hsPart = cadParts.find(p => p.role === "heatsink");
                  gridK[idx] = hsPart ? hsPart._k : part._k;
                  gridDensity[idx] = hsPart ? hsPart._density : part._density;
                  gridType[idx] = 1;
                  gridIsGraphite[idx] = (hsPart && hsPart.material === "graphite") ? 1 : 0;
                } else {
                  gridK[idx] = part._k;
                  gridDensity[idx] = part._density;
                  if (part.role === "heatsink") gridType[idx] = 1;
                  else if (part.role === "source") gridType[idx] = 2;
                  else if (part.role === "duct") gridType[idx] = 4;
                  gridIsGraphite[idx] = (part.material === "graphite") ? 1 : 0;
                }
                break;
              }
            }
          }
        }
      }

      let hsCount = 0, srcCount = 0, timCount = 0, airCount = 0;
      for (let idx = 0; idx < size_total; idx++) {
        if (gridType[idx] === 1) hsCount++;
        else if (gridType[idx] === 2) srcCount++;
        else if (gridType[idx] === 3) timCount++;
        else airCount++;
      }
      console.log("Classified voxel grid counts:", { hsCount, srcCount, timCount, airCount });
      
      cadParts.forEach(part => {
        if (part.role !== "source") return;
        let nodeCount = 0;
        for (let i = 0; i < Vx; i++) {
          const px = minPt.x + (i + 0.5) * dx_scaled;
          const iStride = i * strideY;
          for (let j = 0; j < Vy; j++) {
            const py = minPt.y + (j + 0.5) * dy_scaled;
            const jStride = j * strideZ;
            for (let k = 0; k < Vz; k++) {
              const pz = minPt.z + (k + 0.5) * dz_scaled;
              const idx = iStride + jStride + k;
              
              voxelBox.min.set(px - halfX, py - halfY, pz - halfZ);
              voxelBox.max.set(px + halfX, py + halfY, pz + halfZ);
              
              if (gridType[idx] === 2 && part._worldBBox.intersectsBox(voxelBox)) {
                nodeCount++;
              }
            }
          }
        }
        if (nodeCount > 0) {
          const qVal = part.power / nodeCount;
          for (let i = 0; i < Vx; i++) {
            const px = minPt.x + (i + 0.5) * dx_scaled;
            const iStride = i * strideY;
            for (let j = 0; j < Vy; j++) {
              const py = minPt.y + (j + 0.5) * dy_scaled;
              const jStride = j * strideZ;
              for (let k = 0; k < Vz; k++) {
                const pz = minPt.z + (k + 0.5) * dz_scaled;
                const idx = iStride + jStride + k;
                
                voxelBox.min.set(px - halfX, py - halfY, pz - halfZ);
                voxelBox.max.set(px + halfX, py + halfY, pz + halfZ);
                
                if (gridType[idx] === 2 && part._worldBBox.intersectsBox(voxelBox)) {
                  gridQ[idx] = qVal;
                }
              }
            }
          }
        }
      });
      
      let operatingFlowCFM = 0;
      let operatingPressPa = 0;
      let hVal = 8.0;
      
      if (environment.mode === "forced") {
        const W = cadMode ? size.x * 2 : heatsink.width;
        const L = cadMode ? size.z * 2 : heatsink.length;
        const Hf = cadMode ? size.y * 2 : heatsink.finHeight;
        const tf = heatsink.finThickness;
        const N = heatsink.finCount;
        const s = (W - N * tf) / (N - 1 || 1);
        const Dh = (2 * s * Hf) / (s + Hf || 1);
        const pMax = 45;
        const qMaxCFM = environment.fanAirflow;
        operatingFlowCFM = qMaxCFM;
        let flowVelocity = 1.0;
        for (let flow = 0.5; flow <= qMaxCFM; flow += 0.5) {
          const qM3S = flow * 0.000471947;
          const areaChannel = (W * Hf) / 1e6;
          const areaBypass = ((environment.bypassSide * 2 * (Hf + heatsink.thickness)) + (environment.bypassTop * W)) / 1e6;
          const bypassFactor = areaBypass > 0 ? 1 / (1 + 1.6 * (areaBypass / areaChannel)) : 1.0;
          const vChannel = (qM3S / areaChannel) * bypassFactor;
          const nuAir = 1.56e-5;
          const Re = (vChannel * (Dh / 1000)) / nuAir;
          const f = Re > 2000 ? 0.316 * Math.pow(Re, -0.25) : 64 / (Re || 1);
          const rhoAir = 1.18;
          const pressureDrop = f * (L / Dh) * (rhoAir * vChannel * vChannel) / 2;
          const fanPressure = pMax * (1 - Math.pow(flow / qMaxCFM, 2));
          if (pressureDrop >= fanPressure) {
            operatingFlowCFM = flow;
            flowVelocity = vChannel;
            operatingPressPa = pressureDrop;
            break;
          }
        }
        const reChannel = (flowVelocity * (Dh / 1000)) / 1.56e-5;
        const pr = 0.7;
        let Nu = reChannel > 2300 ? 0.023 * Math.pow(reChannel, 0.8) * Math.pow(pr, 0.4) : 3.66 + (0.0668 * (Dh / L) * reChannel * pr) / (1 + 0.04 * Math.pow((Dh / L) * reChannel * pr, 2/3));
        hVal = (Nu * 0.026) / (Dh / 1000);
      } else {
        const dT_est = 25.0;
        let C_orientation = 1.42;
        let L_char = (cadMode ? size.y * 2 : heatsink.finHeight) / 1000;
        const W = cadMode ? size.x * 2 : heatsink.width;
        const L = cadMode ? size.z * 2 : heatsink.length;
        if (environment.orientation === "upward") {
          C_orientation = 1.32;
          const AreaM2 = (W * L) / 1e6;
          const PerimM = (2 * (W + L)) / 1000;
          L_char = Math.max(0.01, AreaM2 / PerimM);
        } else if (environment.orientation === "downward") {
          C_orientation = 0.59;
          const AreaM2 = (W * L) / 1e6;
          const PerimM = (2 * (W + L)) / 1000;
          L_char = Math.max(0.01, AreaM2 / PerimM);
        }
        const h_conv = C_orientation * Math.pow(dT_est / L_char, 0.25);
        const sigma = 5.67e-8;
        const T_avg_k = environment.ambientTemp + 273.15 + dT_est / 2;
        const h_rad = environment.emissivity * sigma * 4 * Math.pow(T_avg_k, 3);
        hVal = h_conv + h_rad;
      }

      let iter = 0;
      const maxIter = Math.min(5000, Math.max(800, Math.round(50 * Vx)));
      
      const updateVisuals = () => {
        let minT = 999;
        let maxT = -999;
        for (let i = 0; i < Vx; i++) {
          const iStride = i * strideY;
          for (let j = 0; j < Vy; j++) {
            const jStride = j * strideZ;
            for (let k = 0; k < Vz; k++) {
              const idx = iStride + jStride + k;
              const type = gridType[idx];
              if (type !== 0 && type !== 4) { // solid parts
                const T = grid[idx];
                if (T < minT) minT = T;
                if (T > maxT) maxT = T;
              }
            }
          }
        }
        if (minT > maxT) { minT = ambient; maxT = ambient + 1; }
        
        const totalP = cadParts.reduce((acc, p) => p.role === "source" ? acc + p.power : acc, 0);
        resTJunction.textContent = `${maxT.toFixed(1)} °C`;
        resTBase.textContent = `${minT.toFixed(1)} °C`;
        resHCoeff.textContent = `${hVal.toFixed(1)} W/m²K`;
        const theta = totalP > 0 ? (maxT - ambient) / totalP : 0;
        resTheta.textContent = `${theta.toFixed(2)} K/W`;
        
        // Mass and Specific Performance calculation
        const voxelVolCm3 = (dx * dy * dz) * 1e6;
        let massGrams = 0;
        for (let idx = 0; idx < size_total; idx++) {
          if (gridType[idx] === 1) { // heatsink voxels
            massGrams += gridDensity[idx] * voxelVolCm3;
          }
        }
        resMass.textContent = `${massGrams.toFixed(0)} g`;
        
        const specPerf = (theta > 0 && massGrams > 0) ? (1000 / (theta * massGrams)) : 0; // mW / (K * g)
        resMassEff.textContent = `${specPerf.toFixed(1)} mW/(K·g)`;
        
        if (environment.mode === "forced" && typeof T_air !== "undefined") {
          const inletT = T_air[0];
          const outletT = T_air[Vz - 1];
          const rise = outletT - inletT;
          resTAirRise.textContent = `${rise.toFixed(1)} °C (Out: ${outletT.toFixed(1)}°C)`;
        } else {
          resTAirRise.textContent = "N/A";
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
            
            const gIdx = i * strideY + j * strideZ + k;
            const temp = grid[gIdx];
            sumT += temp;
            vCount++;
            
            const color = getTemperatureColor(temp, ambient, maxT);
            colors[idx * 3] = color.r;
            colors[idx * 3 + 1] = color.g;
            colors[idx * 3 + 2] = color.b;
          }
          
          geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
          geom.attributes.color.needsUpdate = true;
          
          if (!part.mesh.material.vertexColors) {
            part.mesh.material = new THREE.MeshLambertMaterial({
              vertexColors: true
            });
          }
          
          if (part.role === "source") {
            let maxTempLimit = part.maxTemp || 125;
            if (!cadMode) {
              const chipIndex = parseInt(part.id.replace("procedural-source-", ""));
              const chipData = chips[chipIndex];
              if (chipData && chipData.maxTemp !== undefined) {
                maxTempLimit = chipData.maxTemp;
              }
            }
            const avgTemp = vCount > 0 ? sumT / vCount : maxT;
            indTemps.push({ 
              name: part.name,
              power: part.power, 
              tJunc: avgTemp,
              maxTempLimit: maxTempLimit,
              failed: avgTemp > maxTempLimit
            });
          }
        });
        
        // Status Badge Logic based on custom limits
        const anyFailed = indTemps.some(item => item.failed);
        const nearLimit = indTemps.some(item => !item.failed && (item.maxTempLimit - item.tJunc <= 15));
        
        if (indTemps.length > 0) {
          if (anyFailed) {
            statusBadge.className = "badge critical-badge";
            statusBadge.textContent = "Critical";
          } else if (nearLimit) {
            statusBadge.className = "badge warning-badge";
            statusBadge.textContent = "Warning";
          } else {
            statusBadge.className = "badge active-badge";
            statusBadge.textContent = "Normal";
          }
        } else {
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
        }

        const sourcesTempList = document.getElementById("sources-temp-list");
        if (sourcesTempList) {
          sourcesTempList.innerHTML = "";
          indTemps.forEach((item, idx) => {
            const row = document.createElement("div");
            row.style.display = "flex";
            row.style.justifyContent = "space-between";
            row.style.alignItems = "center";
            row.style.fontSize = "12px";
            row.style.background = item.failed ? "rgba(239, 68, 68, 0.15)" : "var(--bg-tertiary)";
            row.style.borderLeft = item.failed ? "3px solid #ef4444" : "3px solid #0d9488";
            row.style.padding = "6px 12px";
            row.style.borderRadius = "var(--radius-sm)";
            row.style.marginTop = "4px";
            row.innerHTML = `
              <span style="color: var(--text-secondary); font-family: var(--font-sans);">${item.name} (${item.power}W)</span>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 10px; color: var(--text-muted); font-family: var(--font-sans);">Max: ${item.maxTempLimit}&deg;C</span>
                <strong style="font-family: var(--font-mono); color: ${item.failed ? "#ef4444" : "var(--text-primary)"};">${item.tJunc.toFixed(1)} &deg;C</strong>
                ${item.failed 
                  ? `<span style="background: #ef4444; color: white; padding: 1px 4px; font-size: 9px; font-weight: 700; border-radius: var(--radius-sm); font-family: var(--font-sans);">FAIL</span>` 
                  : `<span style="background: #0d9488; color: white; padding: 1px 4px; font-size: 9px; font-weight: 700; border-radius: var(--radius-sm); font-family: var(--font-sans);">OK</span>`
                }
              </div>
            `;
            sourcesTempList.appendChild(row);
          });
        }
        
        // Draw the fan curve matching chart
        drawFanCurve(operatingFlowCFM, operatingPressPa);
      };

      const finalizeSimulation = () => {
        updateVisuals();
        simSpinner.classList.add("hidden");
        if (window.showToast) window.showToast("Volumetric 3D Finite Difference Simulation complete!");
      };
      
      const solveStep = () => {
        if (iter >= maxIter) {
          finalizeSimulation();
          return;
        }

        // ── 1. Update Air Properties & Spatially Varying Air Temp (1D Fluid Network) ──
        T_air.fill(ambient);
        
        let sumT = 0, countT = 0;
        for (let idx = 0; idx < size_total; idx++) {
          if (gridType[idx] === 1 || gridType[idx] === 2) {
            sumT += grid[idx];
            countT++;
          }
        }
        const T_wall_avg = countT > 0 ? sumT / countT : ambient;
        const T_film = (T_wall_avg + ambient) / 2;

        const rhoAir = 353.0 / (T_film + 273.15);
        const nuAir = (1.32 + 0.009 * T_film) * 1e-5;
        const kAir = 0.0242 + 7.4e-5 * T_film;

        const W = cadMode ? size.x * 2 : heatsink.width;
        const L = cadMode ? size.z * 2 : heatsink.length;
        const Hf = cadMode ? size.y * 2 : heatsink.finHeight;
        const tf = heatsink.finThickness;
        const N = heatsink.finCount;
        const s = (W - N * tf) / (N - 1 || 1);
        const Dh = (2 * s * Hf) / (s + Hf || 1);

        if (environment.mode === "forced") {
          const pMax = 45;
          const qMaxCFM = environment.fanAirflow;
          let operatingFlowCFM = qMaxCFM;
          let flowVelocity = 1.0;
          for (let flow = 0.5; flow <= qMaxCFM; flow += 0.5) {
            const qM3S = flow * 0.000471947;
            const areaChannel = (W * Hf) / 1e6;
            const areaBypass = ((environment.bypassSide * 2 * (Hf + heatsink.thickness)) + (environment.bypassTop * W)) / 1e6;
            const bypassFactor = areaBypass > 0 ? 1 / (1 + 1.6 * (areaBypass / areaChannel)) : 1.0;
            const vChannel = (qM3S / areaChannel) * bypassFactor;
            const Re = (vChannel * (Dh / 1000)) / nuAir;
            const f = Re > 2000 ? 0.316 * Math.pow(Re, -0.25) : 64 / (Re || 1);
            const pressureDrop = f * (L / Dh) * (rhoAir * vChannel * vChannel) / 2;
            const fanPressure = pMax * (1 - Math.pow(flow / qMaxCFM, 2));
            if (pressureDrop >= fanPressure) {
              operatingFlowCFM = flow;
              flowVelocity = vChannel;
              break;
            }
          }
          const reChannel = (flowVelocity * (Dh / 1000)) / nuAir;
          const pr = 0.7;
          let Nu = reChannel > 2300 ? 0.023 * Math.pow(reChannel, 0.8) * Math.pow(pr, 0.4) : 3.66 + (0.0668 * (Dh / L) * reChannel * pr) / (1 + 0.04 * Math.pow((Dh / L) * reChannel * pr, 2/3));
          hVal = (Nu * kAir) / (Dh / 1000);

          const qM3S = operatingFlowCFM * 0.000471947;
          const areaBypass = ((environment.bypassSide * 2 * (Hf + heatsink.thickness)) + (environment.bypassTop * W)) / 1e6;
          const areaChannel = (W * Hf) / 1e6;
          const bypassFactor = areaBypass > 0 ? 1 / (1 + 1.6 * (areaBypass / areaChannel)) : 1.0;
          const mDot_channels = rhoAir * qM3S * bypassFactor;
          const Cp = 1005; // J/kg-K
          const C_dot = Math.max(1e-3, mDot_channels * Cp);

          for (let k = 0; k < Vz - 1; k++) {
            let q_slice = 0;
            for (let i = 0; i < Vx; i++) {
              const iStride = i * strideY;
              for (let j = 0; j < Vy; j++) {
                const jStride = j * strideZ;
                const idx = iStride + jStride + k;
                const type = gridType[idx];
                if (type !== 1 && type !== 2) continue;

                const neighbors = [
                  { ni: i - 1, nj: j, nk: k, area: dy * dz, nidx: idx - strideY },
                  { ni: i + 1, nj: j, nk: k, area: dy * dz, nidx: idx + strideY },
                  { ni: i, nj: j - 1, nk: k, area: dx * dz, nidx: idx - strideZ },
                  { ni: i, nj: j + 1, nk: k, area: dx * dz, nidx: idx + strideZ }
                ];

                neighbors.forEach(n => {
                  let isAirNeigh = true;
                  if (n.ni >= 0 && n.ni < Vx && n.nj >= 0 && n.nj < Vy) {
                    const typeNeigh = gridType[n.nidx];
                    if (typeNeigh === 1 || typeNeigh === 2) {
                      isAirNeigh = false;
                    }
                  } else if (n.nj < 0) {
                    isAirNeigh = false; // bottom PCB is adiabatic
                  }
                  if (isAirNeigh) {
                    q_slice += hVal * n.area * Math.max(0, grid[idx] - T_air[k]);
                  }
                });
              }
            }
            T_air[k + 1] = T_air[k] + q_slice / C_dot;
          }
        } else {
          // Natural convection
          const dT_est = Math.max(1.0, T_wall_avg - ambient);
          let C_orientation = 1.42;
          let L_char = (cadMode ? size.y * 2 : heatsink.finHeight) / 1000;
          if (environment.orientation === "upward") {
            C_orientation = 1.32;
            const AreaM2 = (W * L) / 1e6;
            const PerimM = (2 * (W + L)) / 1000;
            L_char = Math.max(0.01, AreaM2 / PerimM);
          } else if (environment.orientation === "downward") {
            C_orientation = 0.59;
            const AreaM2 = (W * L) / 1e6;
            const PerimM = (2 * (W + L)) / 1000;
            L_char = Math.max(0.01, AreaM2 / PerimM);
          }
          const h_conv = C_orientation * Math.pow(dT_est / L_char, 0.25);
          const sigma = 5.67e-8;
          const T_avg_k = T_wall_avg + 273.15;
          const h_rad = environment.emissivity * sigma * 4 * Math.pow(T_avg_k, 3);
          hVal = h_conv + h_rad;
        }

        const iterationsPerFrame = Math.max(1, Math.min(100, Math.round(80000 / size_total)));
        let maxDiff = 0;
        const omega = 1.9 - 1.5 / Vx; // Optimal SOR acceleration parameter based on grid size
        
        // Helper to query directional thermal conductivity for Graphite Anisotropy
        const getNodeK = (nodeIdx, dir) => {
          const type = gridType[nodeIdx];
          const kVal = gridK[nodeIdx];
          if (gridIsGraphite[nodeIdx] === 1) {
            if (dir === "y") return 10.0; // through-plane PGS conductivity
            return 800.0; // in-plane PGS conductivity
          }
          return kVal; // isotropic
        };

        for (let step = 0; step < iterationsPerFrame && iter < maxIter; step++, iter++) {
          maxDiff = 0;
          
          for (let i = 0; i < Vx; i++) {
            const iStride = i * strideY;
            for (let j = 0; j < Vy; j++) {
              const jStride = j * strideZ;
              for (let k = 0; k < Vz; k++) {
                const idx = iStride + jStride + k;
                const type = gridType[idx];
                
                if (type === 0 || type === 4) { // air or duct
                  grid[idx] = T_air[k];
                  continue;
                }
                
                let condSum = 0;
                let tSum = 0;
                
                const neighbors = [
                  { ni: i - 1, nj: j, nk: k, area: dy * dz, dist: dx, nidx: idx - strideY, dir: "x" },
                  { ni: i + 1, nj: j, nk: k, area: dy * dz, dist: dx, nidx: idx + strideY, dir: "x" },
                  { ni: i, nj: j - 1, nk: k, area: dx * dz, dist: dy, nidx: idx - strideZ, dir: "y" },
                  { ni: i, nj: j + 1, nk: k, area: dx * dz, dist: dy, nidx: idx + strideZ, dir: "y" },
                  { ni: i, nj: j, nk: k - 1, area: dx * dy, dist: dz, nidx: idx - 1, dir: "z" },
                  { ni: i, nj: j, nk: k + 1, area: dx * dy, dist: dz, nidx: idx + 1, dir: "z" }
                ];
                
                neighbors.forEach(n => {
                  let isSolidNeigh = false;
                  if (n.ni >= 0 && n.ni < Vx && n.nj >= 0 && n.nj < Vy && n.nk >= 0 && n.nk < Vz) {
                    const typeNeigh = gridType[n.nidx];
                    if (typeNeigh !== 0 && typeNeigh !== 4) {
                      isSolidNeigh = true;
                    }
                  }
                  
                  if (isSolidNeigh) {
                    const typeNode = gridType[idx];
                    const typeNeigh = gridType[n.nidx];
                    
                    const kNode = getNodeK(idx, n.dir);
                    const kNeigh = getNodeK(n.nidx, n.dir);
                    const kAvg = 2 * kNode * kNeigh / (kNode + kNeigh || 1);
                    
                    let R_total = n.dist / (kAvg * n.area || 1);
                    
                    if ((typeNode === 2 && typeNeigh === 1) || (typeNode === 1 && typeNeigh === 2)) {
                      const R_tim = (tim.thickness / 1e6) / (tim.k * n.area || 1);
                      R_total += R_tim;
                    }
                    
                    const cond = 1 / (R_total || 1);
                    condSum += cond;
                    tSum += cond * grid[n.nidx];
                  } else {
                    // Bottom boundary (nj < 0) is adiabatic (PCB substrate)
                    if (n.nj < 0) {
                      return; // equivalent to continue in forEach
                    }
                    const condAir = hVal * n.area;
                    condSum += condAir;
                    tSum += condAir * T_air[k];
                  }
                });
                
                const val = (tSum + gridQ[idx]) / (condSum || 1);
                const diff = val - grid[idx];
                grid[idx] += omega * diff;
                
                const absDiff = Math.abs(diff);
                if (absDiff > maxDiff) maxDiff = absDiff;
              }
            }
          }
        }
        
        simSpinner.querySelector("span").textContent = `Solving... Iteration ${iter}/${maxIter} (residual: ${maxDiff.toFixed(5)}°C)`;
        
        // Update visuals in real-time
        updateVisuals();
        
        // Exit early once the grid is mathematically converged
        if (iter >= 30 && maxDiff < 0.0001) {
          finalizeSimulation();
          return;
        }
        
        requestAnimationFrame(solveStep);
      };
      
      requestAnimationFrame(solveStep);
    
  } catch (err) {
    console.error("Voxel simulation solver error:", err);
    alert("Simulation failed: " + err.message);
    simSpinner.classList.add("hidden");
  }
};

  // Run Initializations
  init3DScene();
  renderChipsUI();
  updateCADGeometry();
  
  // Parse shared URL design if present
  const urlParams = new URLSearchParams(window.location.search);
  const designParam = urlParams.get("design");
  let loadedFromUrl = false;
  if (designParam) {
    try {
      const decoded = JSON.parse(atob(designParam));
      window.projectManagerConfig.setInputs(decoded);
      loadedFromUrl = true;
    } catch (err) {
      console.error("Failed to parse design from URL:", err);
    }
  }
  
  if (!loadedFromUrl) {
    runSimulation();
  }
});
