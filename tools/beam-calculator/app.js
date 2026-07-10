// ==========================================================================
// Structural Beam Solver & Designer - Core Logic
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  // --- State Initialization ---
  let L = 6.0; // beam length in m
  let materialPreset = "steel";
  let E = 200.0; // Elastic modulus in GPa
  let yieldStrength = 250.0; // Yield limit in MPa
  let density = 7850.0; // Density in kg/m³
  let selfWeightEnabled = true;
  let sectionShape = "rect-solid";

  // Sketched custom shape state
  let sketchedIz = 33750.0; // cm⁴ (defaults to 150x300 rect)
  let sketchedD = 300.0; // mm
  let sketchedA = 450.0; // cm²
  let sketchedSz = 2250.0; // cm³
  let sketchedVertices = []; // Saved coordinates array in mm

  // Live Sketcher Canvas drawing state
  let sketchVertices = []; // Active editor points
  let isSketchClosed = false;
  let gridSnap = 10; // Snap resolution in mm
  let selectedVertexIndex = -1;
  let mousePos = { x: 0, y: 0 };
  let hoveredSegmentIndex = -1; // Index of segment currently hovered in list

  // Interactive CAD modes variables
  let editorMode = "draw"; // "draw", "dimension", "measure"
  let customDimensions = []; // [{ v1: index1, v2: index2 }]
  let selectedVertexA = -1; // Vertex A for custom dimension selection
  let selectedVertexB = -1; // Vertex B for custom dimension selection
  let measureStartPos = null; // Ruler start coordinate
  let measureEndPos = null; // Ruler end coordinate
  let isMeasuring = false;

  // Section shape parameters
  let sectionParams = {
    rectSolid: { b: 150, d: 300 },
    rectHollow: { b: 150, d: 300, t: 10 },
    circSolid: { d: 150 },
    circHollow: { d: 168, t: 8 },
    ibeam: { d: 300, b: 150, tf: 12, tw: 8 },
    custom: { I: 8500, d: 300 }
  };

  // Default supports list (Pinned at 0.0, Roller at L)
  let supports = [
    { type: "pinned", x: 0.0 },
    { type: "roller", x: 6.0 }
  ];

  // Default loads list (Point load of -10 kN at L/2)
  let loads = [
    { type: "point", val: -15.0, x1: 3.0, x2: 0.0 }
  ];

  // --- DOM Elements ---
  const beamLengthInput = document.getElementById("beam-length");
  const materialPresetSelect = document.getElementById("material-preset");
  const materialEInput = document.getElementById("material-e");
  const materialYieldInput = document.getElementById("material-yield");
  const materialDensityInput = document.getElementById("material-density");
  const toggleSelfWeightInput = document.getElementById("toggle-self-weight");
  
  const sectionShapeSelect = document.getElementById("section-shape");
  
  const supportPresetsSelect = document.getElementById("support-presets");
  const supportXInput = document.getElementById("add-support-x");
  const supportTypeSelect = document.getElementById("add-support-type");
  
  const loadTypeSelect = document.getElementById("add-load-type");
  const loadValInput = document.getElementById("add-load-value");
  const loadX1Input = document.getElementById("add-load-x1");
  const loadX2Input = document.getElementById("add-load-x2");

  // Material property presets mapping
  const MATERIAL_PRESETS = {
    steel: { E: 200, yield: 250, density: 7850 },
    aluminum: { E: 70, yield: 270, density: 2700 },
    timber: { E: 12, yield: 30, density: 600 },
    concrete: { E: 30, yield: 25, density: 2400 }
  };

  // --- Initial Bindings & Listeners ---
  beamLengthInput.addEventListener("input", (e) => {
    L = Math.max(0.5, parseFloat(e.target.value) || 6.0);
    // Auto clamp supports and loads within boundary
    clampPositionsToLength();
    updateUIElementsRange();
    recalculate();
  });

  materialPresetSelect.addEventListener("change", (e) => {
    const preset = e.target.value;
    materialPreset = preset;
    if (preset !== "custom" && MATERIAL_PRESETS[preset]) {
      E = MATERIAL_PRESETS[preset].E;
      yieldStrength = MATERIAL_PRESETS[preset].yield;
      density = MATERIAL_PRESETS[preset].density;
      
      materialEInput.value = E;
      materialYieldInput.value = yieldStrength;
      materialDensityInput.value = density;
      
      materialEInput.disabled = true;
      materialYieldInput.disabled = true;
      materialDensityInput.disabled = true;
    } else {
      materialEInput.disabled = false;
      materialYieldInput.disabled = false;
      materialDensityInput.disabled = false;
    }
    recalculate();
  });

  const onMaterialValChange = () => {
    E = Math.max(1, parseFloat(materialEInput.value) || 200.0);
    yieldStrength = Math.max(1, parseFloat(materialYieldInput.value) || 250.0);
    density = Math.max(0, parseFloat(materialDensityInput.value) || 7850.0);
    recalculate();
  };
  materialEInput.addEventListener("input", onMaterialValChange);
  materialYieldInput.addEventListener("input", onMaterialValChange);
  materialDensityInput.addEventListener("input", onMaterialValChange);

  toggleSelfWeightInput.addEventListener("change", (e) => {
    selfWeightEnabled = e.target.checked;
    recalculate();
  });

  sectionShapeSelect.addEventListener("change", (e) => {
    sectionShape = e.target.value;
    // Toggle input field displays
    document.querySelectorAll(".shape-input-group").forEach(el => el.classList.add("hidden"));
    document.getElementById("open-sketcher-btn").classList.add("hidden");
    
    if (sectionShape === "rect-solid") document.querySelector(".rect-solid-fields").classList.remove("hidden");
    else if (sectionShape === "rect-hollow") document.querySelector(".rect-hollow-fields").classList.remove("hidden");
    else if (sectionShape === "circ-solid") document.querySelector(".circ-solid-fields").classList.remove("hidden");
    else if (sectionShape === "circ-hollow") document.querySelector(".circ-hollow-fields").classList.remove("hidden");
    else if (sectionShape === "i-beam") document.querySelector(".ibeam-fields").classList.remove("hidden");
    else if (sectionShape === "custom") document.querySelector(".custom-fields").classList.remove("hidden");
    else if (sectionShape === "sketch") {
      document.getElementById("open-sketcher-btn").classList.remove("hidden");
    }
    
    recalculate();
  });

  // Bind all shape parameter input updates
  const shapeInputs = [
    "rect-b", "rect-d", "box-b", "box-d", "box-t", "circ-d", "pipe-d", "pipe-t",
    "ib-d", "ib-b", "ib-tf", "ib-tw", "cust-i", "cust-d"
  ];
  shapeInputs.forEach(id => {
    document.getElementById(id).addEventListener("input", () => {
      readShapeParameters();
      recalculate();
    });
  });

  supportPresetsSelect.addEventListener("change", (e) => {
    const val = e.target.value;
    if (!val) return;
    
    if (val === "simply-supported") {
      supports = [
        { type: "pinned", x: 0.0 },
        { type: "roller", x: L }
      ];
    } else if (val === "cantilever") {
      supports = [
        { type: "fixed", x: 0.0 }
      ];
    } else if (val === "fixed-fixed") {
      supports = [
        { type: "fixed", x: 0.0 },
        { type: "fixed", x: L }
      ];
    } else if (val === "fixed-pinned") {
      supports = [
        { type: "fixed", x: 0.0 },
        { type: "pinned", x: L }
      ];
    } else if (val === "double-overhang") {
      const offset = parseFloat((L * 0.15).toFixed(2));
      supports = [
        { type: "pinned", x: offset },
        { type: "roller", x: parseFloat((L - offset).toFixed(2)) }
      ];
    }
    
    supportPresetsSelect.value = "";
    recalculate();
  });

  // --- Helper Math / Utility Functions ---

  function clampPositionsToLength() {
    supports.forEach(s => { s.x = Math.min(L, Math.max(0, s.x)); });
    loads.forEach(l => {
      l.x1 = Math.min(L, Math.max(0, l.x1));
      l.x2 = Math.min(L, Math.max(0, l.x2));
    });
  }

  function updateUIElementsRange() {
    supportXInput.max = L;
    loadX1Input.max = L;
    loadX2Input.max = L;
  }

  function readShapeParameters() {
    sectionParams.rectSolid.b = parseFloat(document.getElementById("rect-b").value) || 150;
    sectionParams.rectSolid.d = parseFloat(document.getElementById("rect-d").value) || 300;
    
    sectionParams.rectHollow.b = parseFloat(document.getElementById("box-b").value) || 150;
    sectionParams.rectHollow.d = parseFloat(document.getElementById("box-d").value) || 300;
    sectionParams.rectHollow.t = parseFloat(document.getElementById("box-t").value) || 10;
    
    sectionParams.circSolid.d = parseFloat(document.getElementById("circ-d").value) || 150;
    
    sectionParams.circHollow.d = parseFloat(document.getElementById("pipe-d").value) || 168;
    sectionParams.circHollow.t = parseFloat(document.getElementById("pipe-t").value) || 8;
    
    sectionParams.ibeam.d = parseFloat(document.getElementById("ib-d").value) || 300;
    sectionParams.ibeam.b = parseFloat(document.getElementById("ib-b").value) || 150;
    sectionParams.ibeam.tf = parseFloat(document.getElementById("ib-tf").value) || 12;
    sectionParams.ibeam.tw = parseFloat(document.getElementById("ib-tw").value) || 8;
    
    sectionParams.custom.I = parseFloat(document.getElementById("cust-i").value) || 8500;
    sectionParams.custom.d = parseFloat(document.getElementById("cust-d").value) || 300;
  }

  // Calculate Section Properties: Area (m²), Iz (m⁴), Sz (m³), d (m)
  function getSectionProperties() {
    let A = 0.0;
    let Iz = 0.0;
    let Sz = 0.0;
    let d = 0.0; // height
    
    if (sectionShape === "rect-solid") {
      const b = sectionParams.rectSolid.b / 1000.0; // convert to m
      d = sectionParams.rectSolid.d / 1000.0;
      A = b * d;
      Iz = (b * Math.pow(d, 3)) / 12.0;
      Sz = Iz / (d / 2.0);
    } 
    else if (sectionShape === "rect-hollow") {
      const b = sectionParams.rectHollow.b / 1000.0;
      d = sectionParams.rectHollow.d / 1000.0;
      const t = sectionParams.rectHollow.t / 1000.0;
      const bi = b - 2.0 * t;
      const di = d - 2.0 * t;
      
      A = (b * d) - (bi * di);
      Iz = ((b * Math.pow(d, 3)) - (bi * Math.pow(di, 3))) / 12.0;
      Sz = Iz / (d / 2.0);
    } 
    else if (sectionShape === "circ-solid") {
      d = sectionParams.circSolid.d / 1000.0;
      A = (Math.PI * Math.pow(d, 2)) / 4.0;
      Iz = (Math.PI * Math.pow(d, 4)) / 64.0;
      Sz = Iz / (d / 2.0);
    } 
    else if (sectionShape === "circ-hollow") {
      d = sectionParams.circHollow.d / 1000.0;
      const t = sectionParams.circHollow.t / 1000.0;
      const di = d - 2.0 * t;
      
      A = (Math.PI * (Math.pow(d, 2) - Math.pow(di, 2))) / 4.0;
      Iz = (Math.PI * (Math.pow(d, 4) - Math.pow(di, 4))) / 64.0;
      Sz = Iz / (d / 2.0);
    } 
    else if (sectionShape === "i-beam") {
      d = sectionParams.ibeam.d / 1000.0;
      const b = sectionParams.ibeam.b / 1000.0;
      const tf = sectionParams.ibeam.tf / 1000.0;
      const tw = sectionParams.ibeam.tw / 1000.0;
      const dw = d - 2.0 * tf;
      
      A = (2.0 * b * tf) + (dw * tw);
      Iz = ((b * Math.pow(d, 3)) - ((b - tw) * Math.pow(dw, 3))) / 12.0;
      Sz = Iz / (d / 2.0);
    } 
    else if (sectionShape === "custom") {
      Iz = sectionParams.custom.I * 1e-8; // cm^4 to m^4
      d = sectionParams.custom.d / 1000.0;
      A = 0.001; // dummy area if not needed
      Sz = Iz / (d / 2.0);
    }
    else if (sectionShape === "sketch") {
      A = sketchedA * 1e-4; // cm² to m²
      Iz = sketchedIz * 1e-8; // cm⁴ to m⁴
      Sz = sketchedSz * 1e-6; // cm³ to m³
      d = sketchedD / 1000.0; // mm to m
    }
    
    return { A, Iz, Sz, d };
  }

  // --- Dynamic Table Actions ---

  window.addNewSupport = () => {
    const x = Math.min(L, Math.max(0, parseFloat(supportXInput.value) || 0.0));
    const type = supportTypeSelect.value;
    
    // Avoid exact duplicate coordinates
    if (supports.some(s => Math.abs(s.x - x) < 0.01)) {
      alert("A support already exists at this coordinate location.");
      return;
    }
    
    supports.push({ type, x });
    supports.sort((a, b) => a.x - b.x);
    recalculate();
  };

  window.deleteSupport = (index) => {
    supports.splice(index, 1);
    recalculate();
  };

  window.toggleLoadInputFields = () => {
    const type = loadTypeSelect.value;
    if (type === "udl") {
      loadX2Input.classList.remove("hidden");
      loadValInput.placeholder = "UDL Load w [kN/m]";
      if (parseFloat(loadValInput.value) === -15) loadValInput.value = -5;
    } else {
      loadX2Input.classList.add("hidden");
      if (type === "moment") {
        loadValInput.placeholder = "Moment M [kN·m]";
        loadValInput.value = 10;
      } else {
        loadValInput.placeholder = "Point Force P [kN]";
        loadValInput.value = -15;
      }
    }
  };

  window.addNewLoad = () => {
    const type = loadTypeSelect.value;
    const val = parseFloat(loadValInput.value) || -10.0;
    const x1 = Math.min(L, Math.max(0, parseFloat(loadX1Input.value) || 0.0));
    let x2 = 0.0;
    
    if (type === "udl") {
      x2 = Math.min(L, Math.max(0, parseFloat(loadX2Input.value) || 0.0));
      if (x2 < x1) {
        alert("UDL end coordinate (x2) must be greater than or equal to start coordinate (x1).");
        return;
      }
    }
    
    loads.push({ type, val, x1, x2 });
    recalculate();
  };

  window.deleteLoad = (index) => {
    loads.splice(index, 1);
    recalculate();
  };

  // Render HTML Tables
  function renderSupportTable() {
    const tbody = document.getElementById("supports-body");
    tbody.innerHTML = "";
    
    supports.forEach((sup, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${sup.type.toUpperCase()}</strong></td>
        <td>${sup.x.toFixed(2)} m</td>
        <td>
          <button class="delete-row-btn" onclick="deleteSupport(${idx})" title="Delete Support">
            <i data-lucide="trash-2"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    lucide.createIcons();
  }

  function renderLoadTable() {
    const tbody = document.getElementById("loads-body");
    tbody.innerHTML = "";
    
    loads.forEach((ld, idx) => {
      const tr = document.createElement("tr");
      const unit = ld.type === "udl" ? "kN/m" : (ld.type === "moment" ? "kN·m" : "kN");
      const span = ld.type === "udl" ? `${ld.x2.toFixed(2)} m` : "--";
      tr.innerHTML = `
        <td>${ld.type.toUpperCase()}</td>
        <td><span class="tel-val">${ld.val.toFixed(1)} ${unit}</span></td>
        <td>${ld.x1.toFixed(2)} m</td>
        <td>${span}</td>
        <td>
          <button class="delete-row-btn" onclick="deleteLoad(${idx})" title="Delete Load">
            <i data-lucide="trash-2"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    lucide.createIcons();
  }

  // --- Core FEA Solver ---

  function runAnalyticalSolver() {
    const sec = getSectionProperties();
    const EI = (E * 1e6) * sec.Iz; // GPa to kN/m² * m⁴ = kN·m²
    
    const Ne = 100; // 100 finite elements
    const h = L / Ne;
    const Nd = Ne + 1; // 101 nodes
    const TotalDoF = Nd * 2; // 2 DoF per node (v, theta)
    
    // Initialize matrices
    const K = Array.from({ length: TotalDoF }, () => new Array(TotalDoF).fill(0.0));
    const F = new Array(TotalDoF).fill(0.0);
    
    // 1. Assemble Stiffness Matrix
    for (let e = 0; e < Ne; e++) {
      const n1 = e;
      const n2 = e + 1;
      
      const d1 = 2 * n1;
      const d2 = 2 * n1 + 1;
      const d3 = 2 * n2;
      const d4 = 2 * n2 + 1;
      
      const dofs = [d1, d2, d3, d4];
      
      // Local element stiffness matrix
      const k_e = [
        [ 12.0,       6.0 * h,       -12.0,      6.0 * h ],
        [ 6.0 * h,    4.0 * h * h,   -6.0 * h,   2.0 * h * h ],
        [-12.0,      -6.0 * h,        12.0,     -6.0 * h ],
        [ 6.0 * h,    2.0 * h * h,   -6.0 * h,   4.0 * h * h ]
      ];
      
      const multiplier = EI / Math.pow(h, 3);
      
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          K[dofs[r]][dofs[c]] += k_e[r][c] * multiplier;
        }
      }
    }
    
    // Save original K and F for reaction computations
    const K_orig = K.map(row => [...row]);
    const F_orig = [...F];
    
    // 2. Assemble Load Vector (User loads + Self Weight)
    // Gather all distributed loads
    const activeUDLs = [];
    if (selfWeightEnabled && sec.A > 0) {
      // self weight UDL: w = rho * A * g
      const w_sw = -1.0 * (density * sec.A * 9.81 * 1e-3); // kg/m³ * m² * m/s² = N/m, converted to kN/m
      activeUDLs.push({ val: w_sw, x1: 0.0, x2: L });
    }
    
    loads.forEach(ld => {
      if (ld.type === "point") {
        const idx = Math.min(Ne, Math.max(0, Math.round(ld.x1 / h)));
        F[2 * idx] += ld.val; // Point Force
        F_orig[2 * idx] += ld.val;
      } 
      else if (ld.type === "moment") {
        const idx = Math.min(Ne, Math.max(0, Math.round(ld.x1 / h)));
        F[2 * idx + 1] += ld.val; // Point Moment
        F_orig[2 * idx + 1] += ld.val;
      } 
      else if (ld.type === "udl") {
        activeUDLs.push({ val: ld.val, x1: ld.x1, x2: ld.x2 });
      }
    });
    
    // Process UDLs on each element
    activeUDLs.forEach(udl => {
      for (let e = 0; e < Ne; e++) {
        const x_e1 = e * h;
        const x_e2 = (e + 1) * h;
        
        // Find overlap
        const x_a = Math.max(x_e1, udl.x1);
        const x_b = Math.min(x_e2, udl.x2);
        
        if (x_b > x_a) {
          const overlap_ratio = (x_b - x_a) / h;
          const w_equiv = udl.val * overlap_ratio;
          
          const f_equiv = [
            w_equiv * h / 2.0,
            w_equiv * h * h / 12.0,
            w_equiv * h / 2.0,
            -w_equiv * h * h / 12.0
          ];
          
          const dofs = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
          for (let r = 0; r < 4; r++) {
            F[dofs[r]] += f_equiv[r];
            F_orig[dofs[r]] += f_equiv[r];
          }
        }
      }
    });
    
    // 3. Apply Restraints / Boundary Conditions (Fixed support, pin support, roller support)
    const restrainedDoFs = new Array(TotalDoF).fill(false);
    supports.forEach(sup => {
      const idx = Math.min(Ne, Math.max(0, Math.round(sup.x / h)));
      if (sup.type === "pinned" || sup.type === "roller") {
        restrainedDoFs[2 * idx] = true; // vertical deflection locked
      } 
      else if (sup.type === "fixed") {
        restrainedDoFs[2 * idx] = true; // vertical deflection locked
        restrainedDoFs[2 * idx + 1] = true; // rotation locked
      }
    });
    
    // Penalty/Dirichlet elimination in global K
    for (let d = 0; d < TotalDoF; d++) {
      if (restrainedDoFs[d]) {
        for (let j = 0; j < TotalDoF; j++) {
          K[d][j] = 0.0;
        }
        K[d][d] = 1.0;
        F[d] = 0.0; // force equation boundary
      }
    }
    
    // 4. Solve system of equations (Gaussian Elimination)
    const solution = solveLU(K, F);
    if (!solution) {
      return { unstable: true };
    }
    
    // 5. Post-process reactions
    // Reactions R = K_orig * solution - F_orig
    const R = new Array(TotalDoF).fill(0.0);
    for (let r = 0; r < TotalDoF; r++) {
      let sum = 0.0;
      for (let c = 0; c < TotalDoF; c++) {
        sum += K_orig[r][c] * solution[c];
      }
      R[r] = sum - F_orig[r];
    }
    
    // Compile reaction results per support
    const supportReactions = supports.map(sup => {
      const idx = Math.min(Ne, Math.max(0, Math.round(sup.x / h)));
      const vReact = R[2 * idx];
      const mReact = sup.type === "fixed" ? R[2 * idx + 1] : 0.0;
      return {
        x: sup.x,
        type: sup.type,
        Fy: vReact,
        M: mReact
      };
    });
    
    // 6. Calculate Shear Force (V), Bending Moment (M), and Stress (σ) at nodes
    const nodeX = [];
    const deflection = [];
    const internalShear = []; // element-wise
    const internalMoment = []; // averaged at nodes
    
    for (let i = 0; i < Nd; i++) {
      nodeX.push(i * h);
      deflection.push(solution[2 * i] * 1000.0); // convert to mm
    }
    
    // Element Shear and End moments calculations
    const elemShear = [];
    const elemM1 = [];
    const elemM2 = [];
    
    for (let e = 0; e < Ne; e++) {
      const v1 = solution[2 * e];
      const t1 = solution[2 * e + 1];
      const v2 = solution[2 * e + 2];
      const t2 = solution[2 * e + 3];
      
      const vVal = (EI / Math.pow(h, 3)) * (-12.0 * v1 - 6.0 * h * t1 + 12.0 * v2 - 6.0 * h * t2);
      const m1Val = (EI / Math.pow(h, 2)) * (-6.0 * v1 - 4.0 * h * t1 + 6.0 * v2 - 2.0 * h * t2);
      const m2Val = (EI / Math.pow(h, 2)) * (6.0 * v1 + 2.0 * h * t1 - 6.0 * v2 + 4.0 * h * t2);
      
      elemShear.push(vVal);
      elemM1.push(m1Val);
      elemM2.push(m2Val);
    }
    
    // Node-wise moment average
    for (let i = 0; i < Nd; i++) {
      if (i === 0) {
        internalMoment.push(elemM1[0]);
      } else if (i === Nd - 1) {
        internalMoment.push(elemM2[Ne - 1]);
      } else {
        internalMoment.push((elemM2[i - 1] + elemM1[i]) / 2.0);
      }
    }
    
    // Element-wise shear projection for node points (with boundary steps)
    for (let i = 0; i < Nd; i++) {
      if (i === 0) internalShear.push(elemShear[0]);
      else if (i === Nd - 1) internalShear.push(elemShear[Ne - 1]);
      else internalShear.push((elemShear[i - 1] + elemShear[i]) / 2.0);
    }
    
    // Calculate stress: σ = M / Sz (Sz is in m³)
    const stress = internalMoment.map(M => {
      if (sec.Sz === 0) return 0.0;
      // M is in kN·m, Sz in m³ -> Stress in kN/m² = kPa, divided by 1000 = MPa
      return Math.abs(M) / sec.Sz / 1000.0;
    });
    
    // 7. Extract Peak Metrics
    let maxDeflection = 0.0;
    let maxDeflectionLoc = 0.0;
    for (let i = 0; i < Nd; i++) {
      if (Math.abs(deflection[i]) > Math.abs(maxDeflection)) {
        maxDeflection = deflection[i];
        maxDeflectionLoc = nodeX[i];
      }
    }
    
    let maxMoment = 0.0;
    let maxMomentLoc = 0.0;
    for (let i = 0; i < Nd; i++) {
      if (Math.abs(internalMoment[i]) > Math.abs(maxMoment)) {
        maxMoment = internalMoment[i];
        maxMomentLoc = nodeX[i];
      }
    }
    
    let maxShear = 0.0;
    for (let e = 0; e < Ne; e++) {
      if (Math.abs(elemShear[e]) > Math.abs(maxShear)) {
        maxShear = elemShear[e];
      }
    }
    
    let maxStress = 0.0;
    for (let i = 0; i < Nd; i++) {
      if (stress[i] > maxStress) {
        maxStress = stress[i];
      }
    }
    
    return {
      unstable: false,
      supportReactions,
      nodeX,
      deflection,
      shear: internalShear, // averaged display
      elemShear, // raw elements
      moment: internalMoment,
      stress,
      maxDeflection,
      maxDeflectionLoc,
      maxMoment,
      maxMomentLoc,
      maxShear,
      maxStress
    };
  }

  // Banded matrix solver
  function solveLU(K, F) {
    const n = F.length;
    
    // Gaussian elimination with simple pivoting
    for (let i = 0; i < n; i++) {
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(K[k][i]) > Math.abs(K[maxRow][i])) {
          maxRow = k;
        }
      }
      
      const tempRow = K[i]; K[i] = K[maxRow]; K[maxRow] = tempRow;
      const tempF = F[i]; F[i] = F[maxRow]; F[maxRow] = tempF;
      
      const pivot = K[i][i];
      if (Math.abs(pivot) < 1e-11) {
        return null; // System is unstable
      }
      
      for (let k = i + 1; k < n; k++) {
        const factor = K[k][i] / pivot;
        K[k][i] = 0.0;
        for (let j = i + 1; j < n; j++) {
          K[k][j] -= factor * K[i][j];
        }
        F[k] -= factor * F[i];
      }
    }
    
    // Back substitution
    const x = new Array(n).fill(0.0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = 0.0;
      for (let j = i + 1; j < n; j++) {
        sum += K[i][j] * x[j];
      }
      x[i] = (F[i] - sum) / K[i][i];
    }
    
    return x;
  }

  // --- Recalculation & Rendering Engine ---

  function recalculate() {
    clampPositionsToLength();
    renderSupportTable();
    renderLoadTable();
    
    // Render calculated section properties telemetry
    const sec = getSectionProperties();
    document.getElementById("area-calc").textContent = `${(sec.A * 1e4).toFixed(1)} cm²`;
    document.getElementById("inertia-calc").textContent = `${(sec.Iz * 1e8).toLocaleString(undefined, {maximumFractionDigits: 1})} cm⁴`;
    document.getElementById("modulus-calc").textContent = `${(sec.Sz * 1e6).toLocaleString(undefined, {maximumFractionDigits: 1})} cm³`;
    
    const res = runAnalyticalSolver();
    const complianceBadge = document.getElementById("compliance-badge");
    const fosText = document.getElementById("safety-factor-text");
    
    if (res.unstable) {
      complianceBadge.textContent = "UNSTABLE";
      complianceBadge.className = "tile-large-val status-pending";
      fosText.textContent = "Insufficient supports applied";
      
      // Zero out displays
      document.getElementById("max-deflection-val").textContent = "--";
      document.getElementById("max-moment-val").textContent = "--";
      document.getElementById("max-stress-val").textContent = "--";
      
      // Clear SVGs
      drawEmptyGraphs();
      return;
    }
    
    // 1. Update text telemetry cards
    document.getElementById("max-deflection-val").textContent = `${Math.abs(res.maxDeflection).toFixed(2)} mm`;
    const spanRatio = res.maxDeflection === 0 ? "L/∞" : `L/${Math.round((L * 1000) / Math.abs(res.maxDeflection))}`;
    document.getElementById("span-ratio-text").textContent = `Ratio: ${spanRatio}`;
    
    document.getElementById("max-moment-val").textContent = `${res.maxMoment.toFixed(2)} kN·m`;
    document.getElementById("max-moment-loc").textContent = `At x = ${res.maxMomentLoc.toFixed(2)}m`;
    
    document.getElementById("max-stress-val").textContent = `${res.maxStress.toFixed(1)} MPa`;
    const stressPercent = ((res.maxStress / yieldStrength) * 100).toFixed(0);
    document.getElementById("stress-ratio-text").textContent = `${stressPercent}% of Yield Limit`;
    
    // Safety Status Badge
    const fos = yieldStrength / res.maxStress;
    if (res.maxStress === 0) {
      complianceBadge.textContent = "NO LOAD";
      complianceBadge.className = "tile-large-val status-pending";
      fosText.textContent = "Factor of Safety: N/A";
    } 
    else if (fos >= 1.0) {
      complianceBadge.textContent = "PASSING";
      complianceBadge.className = "tile-large-val status-pass";
      fosText.textContent = `Factor of Safety: ${fos.toFixed(2)}`;
    } 
    else {
      complianceBadge.textContent = "FAILING";
      complianceBadge.className = "tile-large-val status-fail";
      fosText.textContent = `Factor of Safety: ${fos.toFixed(2)}`;
    }
    
    // 2. Render Support reactions drawer list
    const reactionsList = document.getElementById("reactions-output-list");
    reactionsList.innerHTML = "";
    res.supportReactions.forEach((sup, idx) => {
      const card = document.createElement("div");
      card.className = "reaction-card";
      let momentLine = "";
      if (sup.type === "fixed") {
        momentLine = `
          <div class="react-force-item">
            <span>Moment Mz:</span>
            <span class="react-force-val">${sup.M.toFixed(2)} kN·m</span>
          </div>
        `;
      }
      card.innerHTML = `
        <span class="react-title">Reaction #${idx + 1} (${sup.type.toUpperCase()} @ ${sup.x.toFixed(2)}m)</span>
        <div class="react-forces">
          <div class="react-force-item">
            <span>Vertical Fy:</span>
            <span class="react-force-val">${sup.Fy.toFixed(2)} kN</span>
          </div>
          ${momentLine}
        </div>
      `;
      reactionsList.appendChild(card);
    });
    
    // 3. Update Diagram Header Max values labels
    document.getElementById("max-shear-lbl").textContent = `Vmax = ${res.maxShear.toFixed(2)} kN`;
    document.getElementById("max-moment-lbl").textContent = `Mmax = ${res.maxMoment.toFixed(2)} kN·m`;
    document.getElementById("max-deflection-lbl").textContent = `ymax = ${res.maxDeflection.toFixed(2)} mm`;
    
    // 4. Draw interactive visual diagram SVGs
    drawBeamSchematic();
    drawPlotDiagram("sfd-svg", res.nodeX, res.shear, "Shear Force (V) [kN]", "#0284c7");
    drawPlotDiagram("bmd-svg", res.nodeX, res.moment, "Bending Moment (M) [kN·m]", "#ea580c");
    drawPlotDiagram("deflection-svg", res.nodeX, res.deflection, "Deflection (y) [mm]", "#10b981", true);
  }

  // --- SVG Plot Drawing Functions ---

  function drawBeamSchematic() {
    const svg = document.getElementById("beam-schematic-svg");
    svg.innerHTML = "";
    
    const W = 1000;
    const H = 240;
    const paddingX = 80;
    const beamY = 120;
    const beamW = W - 2.0 * paddingX;
    
    const scaleX = (x) => paddingX + (x / L) * beamW;
    
    // Draw Beam member (Solid cylinder block)
    const beamRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    beamRect.setAttribute("x", paddingX);
    beamRect.setAttribute("y", beamY - 8);
    beamRect.setAttribute("width", beamW);
    beamRect.setAttribute("height", 16);
    beamRect.setAttribute("rx", 4);
    beamRect.setAttribute("fill", "url(#beam-gradient)");
    beamRect.setAttribute("stroke", "var(--border-color)");
    beamRect.setAttribute("stroke-width", "1");
    svg.appendChild(beamRect);
    
    // Linear gradient definition
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `
      <linearGradient id="beam-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="var(--accent-primary)" />
        <stop offset="100%" stop-color="var(--accent-primary-glow)" />
      </linearGradient>
    `;
    svg.appendChild(defs);
    
    // Draw supports icons
    supports.forEach(sup => {
      const sx = scaleX(sup.x);
      
      if (sup.type === "pinned") {
        // Triangle shape
        const tri = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        tri.setAttribute("points", `${sx},${beamY + 8} ${sx - 12},${beamY + 28} ${sx + 12},${beamY + 28}`);
        tri.setAttribute("class", "svg-support-pinned");
        svg.appendChild(tri);
        // Base ground line
        const gLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        gLine.setAttribute("x1", sx - 16);
        gLine.setAttribute("y1", beamY + 28);
        gLine.setAttribute("x2", sx + 16);
        gLine.setAttribute("y2", beamY + 28);
        gLine.setAttribute("stroke", "var(--text-secondary)");
        gLine.setAttribute("stroke-width", "2");
        svg.appendChild(gLine);
      } 
      else if (sup.type === "roller") {
        // Circle base with roller spacing
        const tri = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        tri.setAttribute("points", `${sx},${beamY + 8} ${sx - 10},${beamY + 23} ${sx + 10},${beamY + 23}`);
        tri.setAttribute("class", "svg-support-roller");
        svg.appendChild(tri);
        
        const circ = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circ.setAttribute("cx", sx);
        circ.setAttribute("cy", beamY + 26);
        circ.setAttribute("r", 3.5);
        circ.setAttribute("fill", "var(--text-secondary)");
        svg.appendChild(circ);
        
        // Base ground line
        const gLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        gLine.setAttribute("x1", sx - 16);
        gLine.setAttribute("y1", beamY + 31);
        gLine.setAttribute("x2", sx + 16);
        gLine.setAttribute("y2", beamY + 31);
        gLine.setAttribute("stroke", "var(--text-secondary)");
        gLine.setAttribute("stroke-width", "2");
        svg.appendChild(gLine);
      } 
      else if (sup.type === "fixed") {
        // Vertical hatch block on left/right boundary
        const block = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        block.setAttribute("x", sx - 6);
        block.setAttribute("y", beamY - 32);
        block.setAttribute("width", 12);
        block.setAttribute("height", 64);
        block.setAttribute("fill", "var(--bg-tertiary)");
        block.setAttribute("stroke", "var(--text-secondary)");
        block.setAttribute("stroke-width", "1.5");
        svg.appendChild(block);
      }
      
      // Coord text label
      const lbl = document.createElementNS("http://www.w3.org/2000/svg", "text");
      lbl.setAttribute("x", sx);
      lbl.setAttribute("y", beamY + 46);
      lbl.setAttribute("class", "svg-axis-lbl");
      lbl.setAttribute("text-anchor", "middle");
      lbl.textContent = `x=${sup.x.toFixed(1)}m`;
      svg.appendChild(lbl);
    });
    
    // Draw applied forces/moments
    loads.forEach(ld => {
      const sx1 = scaleX(ld.x1);
      
      if (ld.type === "point") {
        const isUpward = ld.val > 0;
        const arrowY1 = isUpward ? beamY + 80 : beamY - 80;
        const arrowY2 = isUpward ? beamY + 12 : beamY - 12;
        
        // Red Arrow representing point force
        const arrow = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const dy = isUpward ? -8 : 8;
        arrow.setAttribute("d", `M${sx1},${arrowY1} L${sx1},${arrowY2} M${sx1 - 6},${arrowY2 - dy} L${sx1},${arrowY2} L${sx1 + 6},${arrowY2 - dy}`);
        arrow.setAttribute("stroke", isUpward ? "#22c55e" : "#ef4444");
        arrow.setAttribute("class", "svg-load-arrow");
        svg.appendChild(arrow);
        
        // Label text
        const lbl = document.createElementNS("http://www.w3.org/2000/svg", "text");
        lbl.setAttribute("x", sx1);
        lbl.setAttribute("y", isUpward ? beamY + 94 : beamY - 86);
        lbl.setAttribute("class", "svg-plot-lbl");
        lbl.setAttribute("text-anchor", "middle");
        lbl.setAttribute("fill", isUpward ? "#22c55e" : "#ef4444");
        lbl.textContent = `${ld.val.toFixed(1)} kN`;
        svg.appendChild(lbl);
      } 
      else if (ld.type === "moment") {
        const isClockwise = ld.val < 0;
        // Draw circular spiral arc arrow
        const arc = document.createElementNS("http://www.w3.org/2000/svg", "path");
        // simple representation of curved moment arrow around beam point
        const sweep = isClockwise ? "1" : "0";
        arc.setAttribute("d", `M${sx1 - 20},${beamY} A20,20 0 1,${sweep} ${sx1 + 20},${beamY}`);
        arc.setAttribute("fill", "none");
        arc.setAttribute("stroke", "#eab308");
        arc.setAttribute("stroke-width", "2.5");
        svg.appendChild(arc);
        
        // Arrow tip
        const tip = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        if (isClockwise) {
          tip.setAttribute("points", `${sx1 + 20},${beamY} ${sx1 + 14},${beamY - 6} ${sx1 + 26},${beamY - 6}`);
        } else {
          tip.setAttribute("points", `${sx1 + 20},${beamY} ${sx1 + 14},${beamY + 6} ${sx1 + 26},${beamY + 6}`);
        }
        tip.setAttribute("fill", "#eab308");
        svg.appendChild(tip);
        
        // Label text
        const lbl = document.createElementNS("http://www.w3.org/2000/svg", "text");
        lbl.setAttribute("x", sx1);
        lbl.setAttribute("y", beamY - 32);
        lbl.setAttribute("class", "svg-plot-lbl");
        lbl.setAttribute("text-anchor", "middle");
        lbl.setAttribute("fill", "#eab308");
        lbl.textContent = `${ld.val.toFixed(1)} kN·m`;
        svg.appendChild(lbl);
      } 
      else if (ld.type === "udl") {
        const sx2 = scaleX(ld.x2);
        const wVal = ld.val;
        const isUpward = wVal > 0;
        
        // Draw UDL boundary envelope line
        const envelopeY = isUpward ? beamY + 40 : beamY - 40;
        
        const mainLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        mainLine.setAttribute("x1", sx1);
        mainLine.setAttribute("y1", envelopeY);
        mainLine.setAttribute("x2", sx2);
        mainLine.setAttribute("y2", envelopeY);
        mainLine.setAttribute("stroke", isUpward ? "#22c55e" : "#ef4444");
        mainLine.setAttribute("stroke-width", "1.5");
        svg.appendChild(mainLine);
        
        // Render 5 evenly spaced arrow segments under UDL
        const segmentsCount = 6;
        for (let i = 0; i <= segmentsCount; i++) {
          const arrowX = sx1 + (i / segmentsCount) * (sx2 - sx1);
          const arrowYStart = envelopeY;
          const arrowYEnd = isUpward ? beamY + 12 : beamY - 12;
          
          const arr = document.createElementNS("http://www.w3.org/2000/svg", "path");
          const dy = isUpward ? -5 : 5;
          arr.setAttribute("d", `M${arrowX},${arrowYStart} L${arrowX},${arrowYEnd} M${arrowX - 4},${arrowYEnd - dy} L${arrowX},${arrowYEnd} L${arrowX + 4},${arrowYEnd - dy}`);
          arr.setAttribute("stroke", isUpward ? "#22c55e" : "#ef4444");
          arr.setAttribute("stroke-width", "1.5");
          arr.setAttribute("fill", "none");
          svg.appendChild(arr);
        }
        
        // Label text
        const lbl = document.createElementNS("http://www.w3.org/2000/svg", "text");
        lbl.setAttribute("x", (sx1 + sx2) / 2.0);
        lbl.setAttribute("y", isUpward ? beamY + 54 : beamY - 48);
        lbl.setAttribute("class", "svg-plot-lbl");
        lbl.setAttribute("text-anchor", "middle");
        lbl.setAttribute("fill", isUpward ? "#22c55e" : "#ef4444");
        lbl.textContent = `${wVal.toFixed(1)} kN/m`;
        svg.appendChild(lbl);
      }
    });
    
    // Draw total length dimension at bottom
    const dimY = H - 24;
    const dLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
    dLine.setAttribute("d", `M${paddingX},${dimY} L${W - paddingX},${dimY} M${paddingX},${dimY - 6} L${paddingX},${dimY + 6} M${W - paddingX},${dimY - 6} L${W - paddingX},${dimY + 6}`);
    dLine.setAttribute("stroke", "var(--text-secondary)");
    dLine.setAttribute("stroke-width", "1.5");
    svg.appendChild(dLine);
    
    const dText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    dText.setAttribute("x", W / 2.0);
    dText.setAttribute("y", dimY - 6);
    dText.setAttribute("class", "svg-plot-lbl");
    dText.setAttribute("fill", "var(--text-primary)");
    dText.setAttribute("text-anchor", "middle");
    dText.textContent = `Total Span = ${L.toFixed(2)}m`;
    svg.appendChild(dText);
  }

  function drawPlotDiagram(svgId, listX, listY, title, color, invertDeflection = false) {
    const svg = document.getElementById(svgId);
    svg.innerHTML = "";
    
    const W = 1000;
    const H = 220;
    const paddingX = 80;
    const paddingY = 40;
    
    const drawW = W - 2.0 * paddingX;
    const drawH = H - 2.0 * paddingY;
    
    // Find min/max values
    let maxVal = Math.max(...listY);
    let minVal = Math.min(...listY);
    
    // Avoid flat bounds divide by zero
    if (maxVal === minVal) {
      maxVal = 1.0;
      minVal = -1.0;
    }
    
    // Add extra padding range
    const range = maxVal - minVal;
    const displayMax = maxVal + 0.1 * range;
    const displayMin = minVal - 0.1 * range;
    
    // Coordinate mapping functions
    const scaleX = (x) => paddingX + (x / L) * drawW;
    const scaleY = (y) => {
      // Invert deflection plotting so down is physically downward displacement!
      const valRatio = (y - displayMin) / (displayMax - displayMin);
      const outputY = paddingY + (1.0 - valRatio) * drawH;
      return invertDeflection ? H - outputY : outputY;
    };
    
    // Draw Grid Lines (Vertical ticks every 1.0m)
    for (let x = 1; x < L; x += 1.0) {
      const gx = scaleX(x);
      const gLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
      gLine.setAttribute("x1", gx);
      gLine.setAttribute("y1", paddingY);
      gLine.setAttribute("x2", gx);
      gLine.setAttribute("y2", H - paddingY);
      gLine.setAttribute("stroke", "var(--border-color)");
      gLine.setAttribute("stroke-width", "0.5");
      gLine.setAttribute("stroke-dasharray", "4,4");
      svg.appendChild(gLine);
    }
    
    // Draw Axis Line (y=0)
    const zeroY = scaleY(0.0);
    const axisLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    axisLine.setAttribute("x1", paddingX);
    axisLine.setAttribute("y1", zeroY);
    axisLine.setAttribute("x2", W - paddingX);
    axisLine.setAttribute("y2", zeroY);
    axisLine.setAttribute("class", "svg-axis");
    svg.appendChild(axisLine);
    
    // Build polygon points for diagram envelope fill
    let pathD = `M${scaleX(listX[0])},${zeroY} `;
    listX.forEach((x, idx) => {
      pathD += `L${scaleX(x)},${scaleY(listY[idx])} `;
    });
    pathD += `L${scaleX(listX[listX.length - 1])},${zeroY} Z`;
    
    // Draw filled graphic polygon path
    const fillPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    fillPath.setAttribute("d", pathD);
    fillPath.setAttribute("fill", color);
    fillPath.setAttribute("opacity", "0.15");
    svg.appendChild(fillPath);
    
    // Draw outline stroke path
    let strokeD = `M${scaleX(listX[0])},${scaleY(listY[0])} `;
    listX.forEach((x, idx) => {
      strokeD += `L${scaleX(x)},${scaleY(listY[idx])} `;
    });
    const strokeLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
    strokeLine.setAttribute("d", strokeD);
    strokeLine.setAttribute("fill", "none");
    strokeLine.setAttribute("stroke", color);
    strokeLine.setAttribute("stroke-width", "2");
    svg.appendChild(strokeLine);
    
    // Draw value annotations on maximums / minimums
    let peakIdx = 0;
    let peakVal = 0.0;
    listY.forEach((val, idx) => {
      if (Math.abs(val) > Math.abs(peakVal)) {
        peakVal = val;
        peakIdx = idx;
      }
    });
    
    const peakX = listX[peakIdx];
    const peakY = listY[peakIdx];
    const unit = svgId === "deflection-svg" ? "mm" : (svgId === "bmd-svg" ? "kN·m" : "kN");
    
    const peakDot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    peakDot.setAttribute("cx", scaleX(peakX));
    peakDot.setAttribute("cy", scaleY(peakY));
    peakDot.setAttribute("r", "4");
    peakDot.setAttribute("fill", color);
    svg.appendChild(peakDot);
    
    const peakText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    peakText.setAttribute("x", scaleX(peakX));
    // Offset height depending on direction
    const offsetDirection = (peakY >= 0 && !invertDeflection) || (peakY < 0 && invertDeflection) ? -10 : 16;
    peakText.setAttribute("y", scaleY(peakY) + offsetDirection);
    peakText.setAttribute("class", "svg-plot-lbl");
    peakText.setAttribute("fill", color);
    peakText.setAttribute("text-anchor", "middle");
    peakText.textContent = `${peakVal.toFixed(2)} ${unit}`;
    svg.appendChild(peakText);
    
    // Draw basic labels (0.0 and L)
    const startXLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    startXLabel.setAttribute("x", paddingX - 10);
    startXLabel.setAttribute("y", zeroY + 4);
    startXLabel.setAttribute("class", "svg-axis-lbl");
    startXLabel.setAttribute("text-anchor", "end");
    startXLabel.textContent = "0.0m";
    svg.appendChild(startXLabel);
    
    const endXLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    endXLabel.setAttribute("x", W - paddingX + 10);
    endXLabel.setAttribute("y", zeroY + 4);
    endXLabel.setAttribute("class", "svg-axis-lbl");
    endXLabel.setAttribute("text-anchor", "start");
    endXLabel.textContent = `${L.toFixed(1)}m`;
    svg.appendChild(endXLabel);
  }

  function drawEmptyGraphs() {
    ["sfd-svg", "bmd-svg", "deflection-svg"].forEach(id => {
      const svg = document.getElementById(id);
      svg.innerHTML = `
        <line x1="80" y1="110" x2="920" y2="110" class="svg-axis" />
        <text x="500" y="115" class="svg-axis-lbl" text-anchor="middle">Awaiting calculations...</text>
      `;
    });
  }

  // --- Share, Export, Import Configurations ---

  window.captureCurrentState = () => {
    return {
      L,
      materialPreset,
      E,
      yieldStrength,
      density,
      selfWeightEnabled,
      sectionShape,
      sectionParams,
      supports,
      loads,
      sketchedIz,
      sketchedD,
      sketchedA,
      sketchedSz,
      sketchedVertices,
      customDimensions
    };
  };

  window.loadStateObject = (state) => {
    if (!state) return;
    
    L = state.L || 6.0;
    materialPreset = state.materialPreset || "steel";
    E = state.E || 200.0;
    yieldStrength = state.yieldStrength || 250.0;
    density = state.density || 7850.0;
    selfWeightEnabled = state.selfWeightEnabled !== undefined ? state.selfWeightEnabled : true;
    sectionShape = state.sectionShape || "rect-solid";
    
    if (state.sectionParams) sectionParams = state.sectionParams;
    if (state.supports) supports = state.supports;
    if (state.loads) loads = state.loads;
    
    sketchedIz = state.sketchedIz || 33750.0;
    sketchedD = state.sketchedD || 300.0;
    sketchedA = state.sketchedA || 450.0;
    sketchedSz = state.sketchedSz || 2250.0;
    sketchedVertices = state.sketchedVertices || [];
    customDimensions = state.customDimensions || [];
    
    // Sync forms
    beamLengthInput.value = L;
    materialPresetSelect.value = materialPreset;
    materialEInput.value = E;
    materialYieldInput.value = yieldStrength;
    materialDensityInput.value = density;
    toggleSelfWeightInput.checked = selfWeightEnabled;
    sectionShapeSelect.value = sectionShape;
    
    // Trigger presets disables
    if (materialPreset !== "custom" && MATERIAL_PRESETS[materialPreset]) {
      materialEInput.disabled = true;
      materialYieldInput.disabled = true;
      materialDensityInput.disabled = true;
    } else {
      materialEInput.disabled = false;
      materialYieldInput.disabled = false;
      materialDensityInput.disabled = false;
    }
    
    // Sync Section inputs
    document.getElementById("rect-b").value = sectionParams.rectSolid.b;
    document.getElementById("rect-d").value = sectionParams.rectSolid.d;
    document.getElementById("box-b").value = sectionParams.rectHollow.b;
    document.getElementById("box-d").value = sectionParams.rectHollow.d;
    document.getElementById("box-t").value = sectionParams.rectHollow.t;
    document.getElementById("circ-d").value = sectionParams.circSolid.d;
    document.getElementById("pipe-d").value = sectionParams.circHollow.d;
    document.getElementById("pipe-t").value = sectionParams.circHollow.t;
    document.getElementById("ib-d").value = sectionParams.ibeam.d;
    document.getElementById("ib-b").value = sectionParams.ibeam.b;
    document.getElementById("ib-tf").value = sectionParams.ibeam.tf;
    document.getElementById("ib-tw").value = sectionParams.ibeam.tw;
    document.getElementById("cust-i").value = sectionParams.custom.I;
    document.getElementById("cust-d").value = sectionParams.custom.d;
    
    // Trigger layout display updates
    sectionShapeSelect.dispatchEvent(new Event("change"));
    
    clampPositionsToLength();
    updateUIElementsRange();
    recalculate();
  };

  // Link Sharing
  window.shareLink = () => {
    const state = captureCurrentState();
    const stringified = JSON.stringify(state);
    const encoded = btoa(stringified);
    const shareUrl = `${window.location.origin}${window.location.pathname}?design=${encoded}`;
    
    const tempTextArea = document.createElement("textarea");
    tempTextArea.value = shareUrl;
    document.body.appendChild(tempTextArea);
    tempTextArea.select();
    
    try {
      document.execCommand("copy");
      if (window.showToast) {
        window.showToast("Sharing link copied to your clipboard!");
      } else {
        alert("Link copied! Share this design configuration:\n" + shareUrl);
      }
    } catch (e) {
      alert("Copy failed. You can copy this link manually:\n" + shareUrl);
    }
    document.body.removeChild(tempTextArea);
  };

  // Local JSON File export
  window.exportJSON = () => {
    const state = captureCurrentState();
    const stringified = JSON.stringify(state, null, 2);
    const blob = new Blob([stringified], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `beam-solver-design-${L.toFixed(1)}m.json`;
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Local JSON File Import
  window.importJSON = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const state = JSON.parse(e.target.result);
        loadStateObject(state);
        document.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (err) {
        alert("Invalid file format. Please upload a correct JSON file exported from this solver.");
      }
    };
    reader.readAsText(file);
  };

  // --- Project Manager Hook Registration ---
  window.projectManagerConfig = {
    toolId: "beam-calculator",
    getInputs: () => captureCurrentState(),
    setInputs: (data) => loadStateObject(data)
  };

  // --- Final Boot / Startup Execution ---
  
  // Read forms initially
  readShapeParameters();
  updateUIElementsRange();
  
  // Parse shared URL parameter if present
  const urlParams = new URLSearchParams(window.location.search);
  const designParam = urlParams.get("design");
  let loadedFromUrl = false;
  
  if (designParam) {
    try {
      const decoded = JSON.parse(atob(designParam));
      loadStateObject(decoded);
      loadedFromUrl = true;
    } catch (err) {
      console.error("Failed to parse design from shared link URL:", err);
    }
  }
  
  if (!loadedFromUrl) {
    recalculate(); // Default boot run
  }

  // ==========================================================================
  // --- 2D Section Sketcher Code ---
  // ==========================================================================

  window.openSketcher = () => {
    // Load existing sketched vertices if any, or default to a simple rectangle template
    if (sketchedVertices && sketchedVertices.length >= 3) {
      sketchVertices = [...sketchedVertices];
      isSketchClosed = true;
    } else {
      loadSketchTemplate("rect");
    }
    
    // Set default editor mode to "draw" on startup
    setEditorMode("draw");
    
    document.getElementById("sketcher-modal").classList.remove("hidden");
    initSketcherEvents();
    drawSketchCanvas();
    updateLiveProperties();
  };

  window.closeSketcher = () => {
    document.getElementById("sketcher-modal").classList.add("hidden");
  };

  window.clearSketchCanvas = () => {
    sketchVertices = [];
    isSketchClosed = false;
    customDimensions = []; // Clear custom dimensions
    drawSketchCanvas();
    updateLiveProperties();
  };

  window.undoSketchPoint = () => {
    if (isSketchClosed) {
      isSketchClosed = false;
    } else {
      sketchVertices.pop();
    }
    // Prune custom dimensions that reference removed vertices
    customDimensions = customDimensions.filter(d => d.v1 < sketchVertices.length && d.v2 < sketchVertices.length);
    drawSketchCanvas();
    updateLiveProperties();
  };

  window.changeGridSnap = () => {
    gridSnap = parseInt(document.getElementById("grid-snap-select").value) || 10;
    drawSketchCanvas();
  };

  window.closeSketchShape = () => {
    if (sketchVertices.length >= 3) {
      isSketchClosed = true;
      drawSketchCanvas();
      updateLiveProperties();
    } else {
      alert("Please place at least 3 points before closing the shape.");
    }
  };

  window.loadSketchTemplate = (type) => {
    isSketchClosed = true;
    customDimensions = []; // Clear custom dimensions since shape structure changes
    if (type === "rect") {
      // 200x200 rectangle centered on 200,200
      sketchVertices = [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
        { x: 300, y: 300 },
        { x: 100, y: 300 }
      ];
    } else if (type === "ibeam") {
      // I-beam shape
      sketchVertices = [
        { x: 100, y: 300 },
        { x: 300, y: 300 },
        { x: 300, y: 260 },
        { x: 220, y: 260 },
        { x: 220, y: 140 },
        { x: 300, y: 140 },
        { x: 300, y: 100 },
        { x: 100, y: 100 },
        { x: 100, y: 140 },
        { x: 180, y: 140 },
        { x: 180, y: 260 },
        { x: 100, y: 260 }
      ];
    } else if (type === "tbeam") {
      // T-beam shape
      sketchVertices = [
        { x: 100, y: 300 },
        { x: 300, y: 300 },
        { x: 300, y: 260 },
        { x: 220, y: 260 },
        { x: 220, y: 100 },
        { x: 180, y: 100 },
        { x: 180, y: 260 },
        { x: 100, y: 260 }
      ];
    } else if (type === "angle") {
      // L-angle shape
      sketchVertices = [
        { x: 100, y: 300 },
        { x: 140, y: 300 },
        { x: 140, y: 140 },
        { x: 300, y: 140 },
        { x: 300, y: 100 },
        { x: 100, y: 100 }
      ];
    } else if (type === "channel") {
      // C-channel shape
      sketchVertices = [
        { x: 260, y: 300 },
        { x: 260, y: 260 },
        { x: 140, y: 260 },
        { x: 140, y: 140 },
        { x: 260, y: 140 },
        { x: 260, y: 100 },
        { x: 100, y: 100 },
        { x: 100, y: 300 }
      ];
    }
    drawSketchCanvas();
    updateLiveProperties();
  };

  window.applySketchedSection = () => {
    const props = calculatePolygonProperties(sketchVertices);
    if (!props || props.A <= 0) return;
    
    sketchedA = props.A; // cm²
    sketchedIz = props.Iz; // cm⁴
    sketchedSz = props.Sz; // cm³
    sketchedD = props.height; // mm
    sketchedVertices = [...sketchVertices];
    
    closeSketcher();
    recalculate();
  };

  function getMousePos(svg, evt) {
    const rect = svg.getBoundingClientRect();
    const x = ((evt.clientX - rect.left) / rect.width) * 400;
    const y = ((evt.clientY - rect.top) / rect.height) * 400;
    return { x, y };
  }

  function snapToGrid(x, y, snap) {
    return {
      x: Math.round(x / snap) * snap,
      y: Math.round(y / snap) * snap
    };
  }

  function calculatePolygonProperties(vertices) {
    const n = vertices.length;
    if (n < 3) return { A: 0, xc: 0, yc: 0, Iz: 0, Sz: 0, height: 0 };
    
    let A = 0;
    let cx = 0;
    let cy = 0;
    let Ixx_origin = 0;
    
    let ymin = Infinity;
    let ymax = -Infinity;
    
    for (let i = 0; i < n; i++) {
      const p = vertices[i];
      if (p.y < ymin) ymin = p.y;
      if (p.y > ymax) ymax = p.y;
    }
    
    for (let i = 0; i < n; i++) {
      const p1 = vertices[i];
      const p2 = vertices[(i + 1) % n];
      
      const factor = (p1.x * p2.y - p2.x * p1.y);
      A += factor;
      cx += (p1.x + p2.x) * factor;
      cy += (p1.y + p2.y) * factor;
      
      Ixx_origin += (p1.y * p1.y + p1.y * p2.y + p2.y * p2.y) * factor;
    }
    
    A = A / 2.0;
    if (Math.abs(A) < 1e-5) return { A: 0, xc: 0, yc: 0, Iz: 0, Sz: 0, height: 0 };
    
    cx = cx / (6.0 * A);
    cy = cy / (6.0 * A);
    Ixx_origin = Ixx_origin / 12.0;
    
    const areaSign = Math.sign(A);
    const A_abs = Math.abs(A);
    
    // Inertia around centroidal x-axis
    const Iz_centroid = (Ixx_origin * areaSign) - A_abs * cy * cy;
    
    const height = ymax - ymin;
    const y_max_fiber = Math.max(ymax - cy, cy - ymin);
    const Sz = y_max_fiber === 0 ? 0 : Iz_centroid / y_max_fiber;
    
    return {
      A: A_abs / 100.0, // convert mm² to cm²
      xc: cx,
      yc: cy,
      Iz: Math.max(0.1, Iz_centroid / 10000.0), // mm⁴ to cm⁴
      Sz: Math.max(0.1, Sz / 1000.0), // mm³ to cm³
      height: height // mm
    };
  }

  function updateLiveProperties() {
    const props = calculatePolygonProperties(sketchVertices);
    const applyBtn = document.getElementById("apply-sketch-btn");
    
    if (isSketchClosed && props.A > 0) {
      document.getElementById("sk-area").textContent = `${props.A.toFixed(1)} cm²`;
      document.getElementById("sk-inertia").textContent = `${props.Iz.toFixed(1)} cm⁴`;
      document.getElementById("sk-centroid").textContent = `${props.yc.toFixed(1)} mm`;
      document.getElementById("sk-height").textContent = `${props.height.toFixed(1)} mm`;
      applyBtn.disabled = false;
    } else {
      document.getElementById("sk-area").textContent = "0.0 cm²";
      document.getElementById("sk-inertia").textContent = "0.0 cm⁴";
      document.getElementById("sk-centroid").textContent = "0.0 mm";
      document.getElementById("sk-height").textContent = "0.0 mm";
      applyBtn.disabled = true;
    }
    
  }

  function drawSketchCanvas(drawCursorLine = false) {
    const svg = document.getElementById("sketch-canvas-svg");
    if (!svg) return;
    svg.innerHTML = `
      <defs>
        <marker id="arrow-start" viewBox="0 0 10 10" refX="0" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 10 0 L 0 5 L 10 10 z" fill="var(--accent-primary)" />
        </marker>
        <marker id="arrow-end" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent-primary)" />
        </marker>
      </defs>
    `;
    
    // Draw grid lines
    const gSize = gridSnap;
    for (let i = 0; i <= 400; i += gSize) {
      // Horizontal grid
      const hLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
      hLine.setAttribute("x1", 0);
      hLine.setAttribute("y1", i);
      hLine.setAttribute("x2", 400);
      hLine.setAttribute("y2", i);
      hLine.setAttribute("class", "sk-grid-line");
      svg.appendChild(hLine);
      
      // Vertical grid
      const vLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
      vLine.setAttribute("x1", i);
      vLine.setAttribute("y1", 0);
      vLine.setAttribute("x2", i);
      vLine.setAttribute("y2", 400);
      vLine.setAttribute("class", "sk-grid-line");
      svg.appendChild(vLine);
    }
    
    // Highlight origin center lines (x=200, y=200)
    const centerX = document.createElementNS("http://www.w3.org/2000/svg", "line");
    centerX.setAttribute("x1", 200);
    centerX.setAttribute("y1", 0);
    centerX.setAttribute("x2", 200);
    centerX.setAttribute("y2", 400);
    centerX.setAttribute("class", "sk-axis-line");
    svg.appendChild(centerX);
    
    const centerY = document.createElementNS("http://www.w3.org/2000/svg", "line");
    centerY.setAttribute("x1", 0);
    centerY.setAttribute("y1", 200);
    centerY.setAttribute("x2", 400);
    centerY.setAttribute("y2", 200);
    centerY.setAttribute("class", "sk-axis-line");
    svg.appendChild(centerY);
    
    // Draw polygon / shapes
    if (sketchVertices.length > 0) {
      if (isSketchClosed) {
        // Closed filled polygon
        let pointsStr = sketchVertices.map(p => `${p.x},${p.y}`).join(" ");
        const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        poly.setAttribute("points", pointsStr);
        poly.setAttribute("class", "sk-poly-fill");
        svg.appendChild(poly);
        
        // Draw Centroid Crosshair
        const props = calculatePolygonProperties(sketchVertices);
        if (props.A > 0) {
          const cx = props.xc;
          const cy = props.yc;
          
          const chX = document.createElementNS("http://www.w3.org/2000/svg", "line");
          chX.setAttribute("x1", cx - 12);
          chX.setAttribute("y1", cy);
          chX.setAttribute("x2", cx + 12);
          chX.setAttribute("y2", cy);
          chX.setAttribute("class", "sk-centroid-cross");
          svg.appendChild(chX);
          
          const chY = document.createElementNS("http://www.w3.org/2000/svg", "line");
          chY.setAttribute("x1", cx);
          chY.setAttribute("y1", cy - 12);
          chY.setAttribute("x2", cx);
          chY.setAttribute("y2", cy + 12);
          chY.setAttribute("class", "sk-centroid-cross");
          svg.appendChild(chY);
          
          const chLbl = document.createElementNS("http://www.w3.org/2000/svg", "text");
          chLbl.setAttribute("x", cx + 6);
          chLbl.setAttribute("y", cy - 6);
          chLbl.setAttribute("fill", "#ef4444");
          chLbl.setAttribute("font-size", "10px");
          chLbl.setAttribute("font-family", "var(--font-mono)");
          chLbl.textContent = "N.A. (ȳ)";
          svg.appendChild(chLbl);
        }
      } else {
        // Open outline polyline
        let pointsStr = sketchVertices.map(p => `${p.x},${p.y}`).join(" ");
        const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        poly.setAttribute("points", pointsStr);
        poly.setAttribute("class", "sk-line-active");
        svg.appendChild(poly);
        
        // Dash cursor line to show next segment preview
        if (drawCursorLine && mousePos) {
          const last = sketchVertices[sketchVertices.length - 1];
          const previewLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
          previewLine.setAttribute("x1", last.x);
          previewLine.setAttribute("y1", last.y);
          previewLine.setAttribute("x2", mousePos.x);
          previewLine.setAttribute("y2", mousePos.y);
          previewLine.setAttribute("stroke", "var(--accent-primary)");
          previewLine.setAttribute("stroke-width", "1.5");
          previewLine.setAttribute("stroke-dasharray", "4,4");
          svg.appendChild(previewLine);
        }
      }
      
      // Draw hovered segment CAD dimensions
      if (hoveredSegmentIndex !== -1 && sketchVertices.length >= 2) {
        const idx1 = hoveredSegmentIndex;
        const idx2 = (hoveredSegmentIndex + 1) % sketchVertices.length;
        
        const p1 = sketchVertices[idx1];
        const p2 = sketchVertices[idx2];
        
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        
        if (len > 0.1) {
          const mx = (p1.x + p2.x) / 2;
          const my = (p1.y + p2.y) / 2;
          
          // Calculate normal perpendicular angle pointing outwards
          const theta = Math.atan2(dy, dx);
          const normalAngle = theta - Math.PI / 2;
          const offsetDist = 25; // Offset 25 pixels
          
          const o1x = p1.x + offsetDist * Math.cos(normalAngle);
          const o1y = p1.y + offsetDist * Math.sin(normalAngle);
          const o2x = p2.x + offsetDist * Math.cos(normalAngle);
          const o2y = p2.y + offsetDist * Math.sin(normalAngle);
          const midx = mx + offsetDist * Math.cos(normalAngle);
          const midy = my + offsetDist * Math.sin(normalAngle);
          
          // Extension lines
          const ext1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
          ext1.setAttribute("x1", p1.x);
          ext1.setAttribute("y1", p1.y);
          ext1.setAttribute("x2", o1x);
          ext1.setAttribute("y2", o1y);
          ext1.setAttribute("class", "sk-dim-ext");
          svg.appendChild(ext1);
          
          const ext2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
          ext2.setAttribute("x1", p2.x);
          ext2.setAttribute("y1", p2.y);
          ext2.setAttribute("x2", o2x);
          ext2.setAttribute("y2", o2y);
          ext2.setAttribute("class", "sk-dim-ext");
          svg.appendChild(ext2);
          
          // Dimension line
          const dimLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
          dimLine.setAttribute("x1", o1x);
          dimLine.setAttribute("y1", o1y);
          dimLine.setAttribute("x2", o2x);
          dimLine.setAttribute("y2", o2y);
          dimLine.setAttribute("class", "sk-dim-line");
          svg.appendChild(dimLine);
          
          // Solid background pill behind text so dimension line doesn't strike through it
          const txtBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          txtBg.setAttribute("x", midx - 22);
          txtBg.setAttribute("y", midy - 8);
          txtBg.setAttribute("width", 44);
          txtBg.setAttribute("height", 16);
          txtBg.setAttribute("rx", 3);
          txtBg.setAttribute("fill", "var(--bg-secondary)");
          txtBg.setAttribute("stroke", "var(--border-color)");
          txtBg.setAttribute("stroke-width", "0.5");
          svg.appendChild(txtBg);
          
          // Dimension text
          const dimTxt = document.createElementNS("http://www.w3.org/2000/svg", "text");
          dimTxt.setAttribute("x", midx);
          dimTxt.setAttribute("y", midy + 4);
          dimTxt.setAttribute("class", "sk-dim-lbl");
          dimTxt.textContent = `${Math.round(len)}mm`;
          svg.appendChild(dimTxt);
          
          // Highlight segment line in red
          const highlightSeg = document.createElementNS("http://www.w3.org/2000/svg", "line");
          highlightSeg.setAttribute("x1", p1.x);
          highlightSeg.setAttribute("y1", p1.y);
          highlightSeg.setAttribute("x2", p2.x);
          highlightSeg.setAttribute("y2", p2.y);
          highlightSeg.setAttribute("stroke", "#ef4444");
          highlightSeg.setAttribute("stroke-width", "3.5");
          svg.appendChild(highlightSeg);
        }
      }
      
      // Draw selected vertex A highlight in dimension mode
      if (editorMode === "dimension" && selectedVertexA !== -1) {
        const pt = sketchVertices[selectedVertexA];
        if (pt) {
          const highlight = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          highlight.setAttribute("cx", pt.x);
          highlight.setAttribute("cy", pt.y);
          highlight.setAttribute("r", "8");
          highlight.setAttribute("class", "sk-handle-selected");
          svg.appendChild(highlight);
        }
      }
      
      // Draw all custom dimensions
      customDimensions.forEach((dim, dimIdx) => {
        const p1 = sketchVertices[dim.v1];
        const p2 = sketchVertices[dim.v2];
        if (!p1 || !p2) return;
        
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        
        if (len > 0.1) {
          const mx = (p1.x + p2.x) / 2;
          const my = (p1.y + p2.y) / 2;
          
          const theta = Math.atan2(dy, dx);
          const normalAngle = theta - Math.PI / 2;
          
          // Nest dimension offsets to avoid overlaps
          const offsetDist = 32 + (dimIdx * 18); 
          
          const o1x = p1.x + offsetDist * Math.cos(normalAngle);
          const o1y = p1.y + offsetDist * Math.sin(normalAngle);
          const o2x = p2.x + offsetDist * Math.cos(normalAngle);
          const o2y = p2.y + offsetDist * Math.sin(normalAngle);
          const midx = mx + offsetDist * Math.cos(normalAngle);
          const midy = my + offsetDist * Math.sin(normalAngle);
          
          // Extension lines
          const ext1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
          ext1.setAttribute("x1", p1.x);
          ext1.setAttribute("y1", p1.y);
          ext1.setAttribute("x2", o1x);
          ext1.setAttribute("y2", o1y);
          ext1.setAttribute("class", "sk-dim-ext");
          svg.appendChild(ext1);
          
          const ext2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
          ext2.setAttribute("x1", p2.x);
          ext2.setAttribute("y1", p2.y);
          ext2.setAttribute("x2", o2x);
          ext2.setAttribute("y2", o2y);
          ext2.setAttribute("class", "sk-dim-ext");
          svg.appendChild(ext2);
          
          // Dimension line
          const dimLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
          dimLine.setAttribute("x1", o1x);
          dimLine.setAttribute("y1", o1y);
          dimLine.setAttribute("x2", o2x);
          dimLine.setAttribute("y2", o2y);
          dimLine.setAttribute("class", "sk-dim-line");
          svg.appendChild(dimLine);
          
          // Solid background pill behind text
          const txtBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          txtBg.setAttribute("x", midx - 22);
          txtBg.setAttribute("y", midy - 8);
          txtBg.setAttribute("width", 44);
          txtBg.setAttribute("height", 16);
          txtBg.setAttribute("rx", 3);
          txtBg.setAttribute("fill", "var(--bg-secondary)");
          txtBg.setAttribute("stroke", "var(--border-color)");
          txtBg.setAttribute("stroke-width", "0.5");
          svg.appendChild(txtBg);
          
          // Dimension text
          const dimTxt = document.createElementNS("http://www.w3.org/2000/svg", "text");
          dimTxt.setAttribute("x", midx);
          dimTxt.setAttribute("y", midy + 4);
          dimTxt.setAttribute("class", "sk-dim-lbl");
          dimTxt.textContent = `${Math.round(len)}mm`;
          svg.appendChild(dimTxt);
        }
      });

      // Draw measure tool ruler lines
      if (editorMode === "measure" && measureStartPos) {
        const dotStart = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dotStart.setAttribute("cx", measureStartPos.x);
        dotStart.setAttribute("cy", measureStartPos.y);
        dotStart.setAttribute("r", "4");
        dotStart.setAttribute("fill", "#22c55e");
        svg.appendChild(dotStart);
        
        let targetPos = null;
        if (isMeasuring && mousePos) {
          targetPos = mousePos;
        } else if (!isMeasuring && measureEndPos) {
          targetPos = measureEndPos;
          
          const dotEnd = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          dotEnd.setAttribute("cx", measureEndPos.x);
          dotEnd.setAttribute("cy", measureEndPos.y);
          dotEnd.setAttribute("r", "4");
          dotEnd.setAttribute("fill", "#22c55e");
          svg.appendChild(dotEnd);
        }
        
        if (targetPos) {
          const dx = targetPos.x - measureStartPos.x;
          const dy = targetPos.y - measureStartPos.y;
          const dist = Math.hypot(dx, dy);
          
          const mLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
          mLine.setAttribute("x1", measureStartPos.x);
          mLine.setAttribute("y1", measureStartPos.y);
          mLine.setAttribute("x2", targetPos.x);
          mLine.setAttribute("y2", targetPos.y);
          mLine.setAttribute("class", "sk-measure-line");
          svg.appendChild(mLine);
          
          const midX = (measureStartPos.x + targetPos.x) / 2;
          const midY = (measureStartPos.y + targetPos.y) / 2;
          
          const txtBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          txtBg.setAttribute("x", midX - 30);
          txtBg.setAttribute("y", midY - 9);
          txtBg.setAttribute("width", 60);
          txtBg.setAttribute("height", 18);
          txtBg.setAttribute("rx", 3);
          txtBg.setAttribute("fill", "var(--bg-secondary)");
          txtBg.setAttribute("stroke", "#22c55e");
          txtBg.setAttribute("stroke-width", "0.8");
          svg.appendChild(txtBg);
          
          const mTxt = document.createElementNS("http://www.w3.org/2000/svg", "text");
          mTxt.setAttribute("x", midX);
          mTxt.setAttribute("y", midY + 4);
          mTxt.setAttribute("class", "sk-measure-lbl");
          mTxt.textContent = `${Math.round(dist)} mm`;
          svg.appendChild(mTxt);
        }
      }
      
      // Draw handles for vertex dragging
      sketchVertices.forEach((pt, idx) => {
        const handle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        handle.setAttribute("cx", pt.x);
        handle.setAttribute("cy", pt.y);
        handle.setAttribute("r", "5");
        handle.setAttribute("class", "sk-handle");
        handle.setAttribute("data-index", idx);
        svg.appendChild(handle);
      });
    }
  }

  let eventsBound = false;
  function initSketcherEvents() {
    if (eventsBound) return;
    
    const svg = document.getElementById("sketch-canvas-svg");
    if (!svg) return;
    
    svg.addEventListener("mousedown", (e) => {
      if (editorMode === "draw") {
        if (e.target.classList.contains("sk-handle")) {
          selectedVertexIndex = parseInt(e.target.getAttribute("data-index"));
          return;
        }
        
        if (isSketchClosed) return;
        
        const pos = getMousePos(svg, e);
        const snapped = snapToGrid(pos.x, pos.y, gridSnap);
        
        // If clicking near first point, close loop
        if (sketchVertices.length >= 3) {
          const start = sketchVertices[0];
          const dist = Math.hypot(snapped.x - start.x, snapped.y - start.y);
          if (dist < 15) {
            isSketchClosed = true;
            drawSketchCanvas();
            updateLiveProperties();
            return;
          }
        }
        
        sketchVertices.push(snapped);
        drawSketchCanvas();
        updateLiveProperties();
      } 
      else if (editorMode === "dimension") {
        const pos = getMousePos(svg, e);
        // Find if clicked near an existing vertex
        let clickedIdx = -1;
        for (let i = 0; i < sketchVertices.length; i++) {
          const v = sketchVertices[i];
          if (Math.hypot(pos.x - v.x, pos.y - v.y) < 15) {
            clickedIdx = i;
            break;
          }
        }
        
        if (clickedIdx !== -1) {
          if (selectedVertexA === -1) {
            selectedVertexA = clickedIdx;
            document.getElementById("sketcher-instruction").textContent = "Click the second vertex.";
          } else {
            selectedVertexB = clickedIdx;
            if (selectedVertexA !== selectedVertexB) {
              const exists = customDimensions.some(d => 
                (d.v1 === selectedVertexA && d.v2 === selectedVertexB) ||
                (d.v1 === selectedVertexB && d.v2 === selectedVertexA)
              );
              if (!exists) {
                customDimensions.push({ v1: selectedVertexA, v2: selectedVertexB });
              }
            }
            selectedVertexA = -1;
            selectedVertexB = -1;
            document.getElementById("sketcher-instruction").textContent = "Add Dimension Mode: Click the first vertex.";
          }
          drawSketchCanvas();
        }
      } 
      else if (editorMode === "measure") {
        const pos = getMousePos(svg, e);
        const snapped = snapToGrid(pos.x, pos.y, gridSnap);
        
        if (!isMeasuring) {
          measureStartPos = snapped;
          measureEndPos = null;
          isMeasuring = true;
          document.getElementById("sketcher-instruction").textContent = "Move mouse and click to end measurement.";
        } else {
          measureEndPos = snapped;
          isMeasuring = false;
          const dist = Math.round(Math.hypot(measureEndPos.x - measureStartPos.x, measureEndPos.y - measureStartPos.y));
          document.getElementById("sketcher-instruction").textContent = `Measured Distance: ${dist} mm. Click grid to measure again.`;
        }
        drawSketchCanvas();
      }
    });
    
    svg.addEventListener("mousemove", (e) => {
      const pos = getMousePos(svg, e);
      const snapped = snapToGrid(pos.x, pos.y, gridSnap);
      
      if (editorMode === "draw") {
        if (selectedVertexIndex !== -1) {
          sketchVertices[selectedVertexIndex] = snapped;
          drawSketchCanvas();
          updateLiveProperties();
        } else {
          mousePos = snapped;
          if (!isSketchClosed && sketchVertices.length > 0) {
            drawSketchCanvas(true);
          }
        }
      } 
      else if (editorMode === "measure") {
        mousePos = snapped;
        if (isMeasuring) {
          drawSketchCanvas();
        }
      }
    });
    
    // Support mobile touch dragging
    svg.addEventListener("touchstart", (e) => {
      if (editorMode === "draw" && e.target.classList.contains("sk-handle")) {
        selectedVertexIndex = parseInt(e.target.getAttribute("data-index"));
        e.preventDefault();
      }
    }, { passive: false });
    
    svg.addEventListener("touchmove", (e) => {
      if (editorMode === "draw" && selectedVertexIndex !== -1 && e.touches.length > 0) {
        const pos = getMousePos(svg, e.touches[0]);
        const snapped = snapToGrid(pos.x, pos.y, gridSnap);
        sketchVertices[selectedVertexIndex] = snapped;
        drawSketchCanvas();
        updateLiveProperties();
        e.preventDefault();
      }
    }, { passive: false });
    
    const onRelease = () => {
      selectedVertexIndex = -1;
    };
    window.addEventListener("mouseup", onRelease);
    window.addEventListener("touchend", onRelease);
    
    // Double click to close the shape outline in draw mode or edit custom dimensions
    svg.addEventListener("dblclick", (e) => {
      const pos = getMousePos(svg, e);
      
      // Check if double-clicked close to any custom dimension text label center
      let clickedDimIdx = -1;
      customDimensions.forEach((dim, idx) => {
        const p1 = sketchVertices[dim.v1];
        const p2 = sketchVertices[dim.v2];
        if (!p1 || !p2) return;
        
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if (len < 0.1) return;
        
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        
        const theta = Math.atan2(dy, dx);
        const normalAngle = theta - Math.PI / 2;
        
        // Calculate where the text pill is drawn (offsetDist = 32 + idx * 18)
        const offsetDist = 32 + (idx * 18);
        const midx = mx + offsetDist * Math.cos(normalAngle);
        const midy = my + offsetDist * Math.sin(normalAngle);
        
        const distToLabel = Math.hypot(pos.x - midx, pos.y - midy);
        if (distToLabel < 22) {
          clickedDimIdx = idx;
        }
      });
      
      if (clickedDimIdx !== -1) {
        // Edit dimension length directly
        editCustomDimensionLength(clickedDimIdx);
        return;
      }
      
      if (editorMode === "draw" && !isSketchClosed && sketchVertices.length >= 3) {
        isSketchClosed = true;
        drawSketchCanvas();
        updateLiveProperties();
      }
    });
    
    // Right click to stop drawing or close outline
    svg.addEventListener("contextmenu", (e) => {
      e.preventDefault(); // Prevent standard browser menu
      if (editorMode === "draw" && !isSketchClosed) {
        if (sketchVertices.length >= 3) {
          isSketchClosed = true;
        } else {
          sketchVertices = []; // Cancel current points
        }
        drawSketchCanvas();
        updateLiveProperties();
      }
    });
    
    // ESC key to cancel active tools or close shape outline
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        const modal = document.getElementById("sketcher-modal");
        if (!modal || modal.classList.contains("hidden")) return;
        
        if (editorMode === "draw" && !isSketchClosed) {
          if (sketchVertices.length >= 3) {
            isSketchClosed = true;
          } else {
            sketchVertices = []; // Reset outline
          }
        } else {
          // Reset dimension or measure modes back to default draw mode
          setEditorMode("draw");
        }
        drawSketchCanvas();
        updateLiveProperties();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    
    eventsBound = true;
  }

  window.setEditorMode = (mode) => {
    editorMode = mode;
    
    // Toggle active state classes on toolbar buttons
    document.querySelectorAll(".tool-btn").forEach(btn => btn.classList.remove("active"));
    if (mode === "draw") document.getElementById("tool-draw-btn").classList.add("active");
    else if (mode === "dimension") document.getElementById("tool-dimension-btn").classList.add("active");
    else if (mode === "measure") document.getElementById("tool-measure-btn").classList.add("active");
    
    // Reset selections and measurements
    selectedVertexA = -1;
    selectedVertexB = -1;
    measureStartPos = null;
    measureEndPos = null;
    isMeasuring = false;
    
    // Update active instructions banner text
    const instr = document.getElementById("sketcher-instruction");
    if (mode === "draw") {
      instr.textContent = "Click on the grid to place vertices. Click the starting node (or 'Close Shape') to close the loop.";
    } else if (mode === "dimension") {
      instr.textContent = "Add Dimension Mode: Click the first vertex of the distance you wish to dimension.";
    } else if (mode === "measure") {
      instr.textContent = "Measure Mode: Click any point on the grid to start measuring.";
    }
    
    drawSketchCanvas();
  };

  window.editCustomDimensionLength = (idx) => {
    const dim = customDimensions[idx];
    if (!dim) return;
    
    const p1 = sketchVertices[dim.v1];
    const p2 = sketchVertices[dim.v2];
    if (!p1 || !p2) return;
    
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.1) return;
    
    const promptVal = prompt(`Enter new length for this dimension in mm (current: ${Math.round(len)} mm):`, Math.round(len));
    if (promptVal === null) return;
    
    const newLen = parseFloat(promptVal);
    if (isNaN(newLen) || newLen <= 0) {
      alert("Please enter a valid positive length.");
      return;
    }
    
    const ratio = newLen / len;
    
    // Push/pull translation: move p2 and shift subsequent nodes downstream to scale dimension
    const targetX = p1.x + dx * ratio;
    const targetY = p1.y + dy * ratio;
    const shiftX = targetX - p2.x;
    const shiftY = targetY - p2.y;
    
    const startIdx = dim.v2;
    for (let j = startIdx; j < sketchVertices.length; j++) {
      sketchVertices[j].x = Math.round(sketchVertices[j].x + shiftX);
      sketchVertices[j].y = Math.round(sketchVertices[j].y + shiftY);
    }
    
    drawSketchCanvas();
    updateLiveProperties();
  };
});
