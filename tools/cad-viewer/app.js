/**
 * app.js — 3D CAD Viewer & Converter
 * 
 * Orchestrates WebGL viewport, Three.js scene, file loaders (STEP, IGES, STL, OBJ, GLTF, PLY, 3MF),
 * metrology measurements, dynamic clipping planes, and client-side format conversion.
 */

// Register with global Project Manager at top level
window.projectManagerConfig = {
  toolId: "cad-viewer",
  getInputs: () => ({
    material: document.getElementById('material-select') ? document.getElementById('material-select').value : 'aluminum-6061',
    customDensity: document.getElementById('custom-density-input') ? parseFloat(document.getElementById('custom-density-input').value) || 1.0 : 1.0,
    unit: currentUnit,
    exportFormat: document.getElementById('export-format-select') ? document.getElementById('export-format-select').value : 'stl-binary',
    scaleFactor: document.getElementById('scale-factor-select') ? document.getElementById('scale-factor-select').value : '1',
    centerOrigin: document.getElementById('chk-center-origin') ? document.getElementById('chk-center-origin').checked : false,
    alignGround: document.getElementById('chk-align-ground') ? document.getElementById('chk-align-ground').checked : false,
    flipNormals: document.getElementById('chk-flip-normals') ? document.getElementById('chk-flip-normals').checked : false,
    theme: document.getElementById('viewport-theme-select') ? document.getElementById('viewport-theme-select').value : 'cad-dark'
  }),
  setInputs: (data) => {
    if (!data) return;
    if (data.material && document.getElementById('material-select')) {
      document.getElementById('material-select').value = data.material;
      toggleCustomDensity();
    }
    if (data.customDensity && document.getElementById('custom-density-input')) {
      document.getElementById('custom-density-input').value = data.customDensity;
    }
    if (data.unit) {
      setUnit(data.unit);
    }
    if (data.exportFormat && document.getElementById('export-format-select')) {
      document.getElementById('export-format-select').value = data.exportFormat;
    }
    if (data.scaleFactor && document.getElementById('scale-factor-select')) {
      document.getElementById('scale-factor-select').value = data.scaleFactor;
      toggleCustomScale();
    }
    if (data.centerOrigin !== undefined && document.getElementById('chk-center-origin')) {
      document.getElementById('chk-center-origin').checked = data.centerOrigin;
    }
    if (data.alignGround !== undefined && document.getElementById('chk-align-ground')) {
      document.getElementById('chk-align-ground').checked = data.alignGround;
    }
    if (data.flipNormals !== undefined && document.getElementById('chk-flip-normals')) {
      document.getElementById('chk-flip-normals').checked = data.flipNormals;
    }
    if (data.theme && document.getElementById('viewport-theme-select')) {
      document.getElementById('viewport-theme-select').value = data.theme;
      applyViewportTheme(data.theme);
    }
    updateMassEstimate();
  }
};

// ── State ────────────────────────────────────────────────────────
let scene, camera, renderer, controls;
let modelGroup = null;
let currentGeometry = null;
let currentRawMeshData = null; // { positions, normals, indices }
let currentFileName = "";
let currentFileFormat = "";
let currentFileSize = 0;
let currentUnit = "mm"; // "mm" or "in"
let renderMode = "solid"; // "solid" | "edges" | "wire" | "xray" | "normals"
let currentBBox = null;
let currentMetrology = null;
let edgeLinesObject = null;
let comMarkerObject = null;
let gridHelper = null;
let axesHelper = null;

// Measurement state
let measureMode = false;
let measurePoints = [];
let measureMarkers = [];
let measureLine = null;

// Clipping planes
let clipPlanes = {
  x: new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0),
  y: new THREE.Plane(new THREE.Vector3(0, -1, 0), 0),
  z: new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)
};
let clipEnabled = { x: false, y: false, z: false };
let clipFlipped = { x: false, y: false, z: false };

// ── Initialization ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }

  initThree();
  bindUIEvents();
  window.addEventListener('resize', onWindowResize);
});

function initThree() {
  const canvas = document.getElementById('cad-canvas');
  const container = document.getElementById('viewport-container');

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f141f);

  // Camera
  const aspect = container.clientWidth / container.clientHeight;
  camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 10000);
  camera.position.set(120, 100, 140);

  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.localClippingEnabled = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Controls
  controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;

  // Lighting Setup
  setupLights();

  // Helpers
  gridHelper = new THREE.GridHelper(200, 40, 0x38bdf8, 0x1e293b);
  gridHelper.position.y = 0;
  scene.add(gridHelper);

  axesHelper = new THREE.AxesHelper(30);
  axesHelper.renderOrder = 1;
  scene.add(axesHelper);

  modelGroup = new THREE.Group();
  scene.add(modelGroup);

  // Render loop
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}

function setupLights() {
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
  keyLight.position.set(100, 200, 150);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x90cdf4, 0.4);
  fillLight.position.set(-100, -100, -100);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
  rimLight.position.set(0, 200, -150);
  scene.add(rimLight);
}

function onWindowResize() {
  const container = document.getElementById('viewport-container');
  if (!container || !renderer || !camera) return;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

// ── UI Events Binding ───────────────────────────────────────────
function bindUIEvents() {
  // File Dropzone & Input
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('cad-file-input');

  ['dragenter', 'dragover'].forEach(eventName => {
    window.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    window.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });

  window.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleCADFile(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleCADFile(e.target.files[0]);
    }
  });

  const replaceBtn = document.getElementById('btn-replace-model');
  if (replaceBtn) {
    replaceBtn.addEventListener('click', () => fileInput.click());
  }

  // View Preset Buttons
  document.getElementById('btn-view-iso').addEventListener('click', () => setViewPreset('iso'));
  document.getElementById('btn-view-top').addEventListener('click', () => setViewPreset('top'));
  document.getElementById('btn-view-front').addEventListener('click', () => setViewPreset('front'));
  document.getElementById('btn-view-right').addEventListener('click', () => setViewPreset('right'));
  document.getElementById('btn-view-fit').addEventListener('click', fitModelToView);

  // Render Mode Buttons
  const modeButtons = [
    { id: 'btn-mode-solid', mode: 'solid' },
    { id: 'btn-mode-edges', mode: 'edges' },
    { id: 'btn-mode-wire', mode: 'wire' },
    { id: 'btn-mode-xray', mode: 'xray' },
    { id: 'btn-mode-normals', mode: 'normals' }
  ];

  modeButtons.forEach(({ id, mode }) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', () => {
        modeButtons.forEach(b => document.getElementById(b.id).classList.remove('active'));
        btn.classList.add('active');
        setRenderMode(mode);
      });
    }
  });

  // Measure Mode
  const measureBtn = document.getElementById('btn-toggle-measure');
  if (measureBtn) {
    measureBtn.addEventListener('click', toggleMeasureMode);
  }
  document.getElementById('btn-clear-measure').addEventListener('click', clearMeasurement);

  // Section Clipping
  const sectionBtn = document.getElementById('btn-toggle-section');
  const sectionPanel = document.getElementById('section-panel');
  const closeSectionBtn = document.getElementById('btn-close-section');

  sectionBtn.addEventListener('click', () => {
    sectionPanel.classList.toggle('hidden');
    sectionBtn.classList.toggle('active', !sectionPanel.classList.contains('hidden'));
  });

  closeSectionBtn.addEventListener('click', () => {
    sectionPanel.classList.add('hidden');
    sectionBtn.classList.remove('active');
  });

  setupClippingControls();

  // Snapshot
  document.getElementById('btn-take-snapshot').addEventListener('click', takeSnapshot);

  // Unit Buttons
  document.getElementById('unit-mm').addEventListener('click', () => setUnit('mm'));
  document.getElementById('unit-in').addEventListener('click', () => setUnit('in'));

  // Mass Material Select
  document.getElementById('material-select').addEventListener('change', () => {
    toggleCustomDensity();
    updateMassEstimate();
  });
  document.getElementById('custom-density-input').addEventListener('input', updateMassEstimate);

  // Scale Select
  document.getElementById('scale-factor-select').addEventListener('change', toggleCustomScale);

  // Viewport Theme & Helpers
  document.getElementById('viewport-theme-select').addEventListener('change', (e) => {
    applyViewportTheme(e.target.value);
  });

  const gridBtn = document.getElementById('btn-toggle-grid');
  gridBtn.addEventListener('click', () => {
    gridHelper.visible = !gridHelper.visible;
    gridBtn.classList.toggle('active', gridHelper.visible);
  });

  const comBtn = document.getElementById('btn-toggle-com');
  comBtn.addEventListener('click', () => {
    if (comMarkerObject) {
      comMarkerObject.visible = !comMarkerObject.visible;
      comBtn.classList.toggle('active', comMarkerObject.visible);
    }
  });

  // Convert & Download
  document.getElementById('btn-convert-download').addEventListener('click', executeConversion);

  // Canvas Click for Ruler Measurement
  document.getElementById('cad-canvas').addEventListener('pointerdown', onCanvasPointerDown);
}

// ── File Loading Pipeline ───────────────────────────────────────
async function handleCADFile(file) {
  if (!file) return;

  currentFileName = file.name;
  currentFileSize = file.size;
  const ext = file.name.split('.').pop().toLowerCase();
  currentFileFormat = ext.toUpperCase();

  showLoading(`Loading ${file.name}...`, `Processing 3D ${currentFileFormat} geometry`);

  try {
    const arrayBuffer = await file.arrayBuffer();

    if (ext === 'step' || ext === 'stp') {
      await loadSTEP(arrayBuffer);
    } else if (ext === 'iges' || ext === 'igs') {
      await loadIGES(arrayBuffer);
    } else if (ext === 'stl') {
      await loadSTL(arrayBuffer);
    } else if (ext === 'obj') {
      const text = new TextDecoder().decode(arrayBuffer);
      await loadOBJ(text);
    } else {
      throw new Error(`Unsupported CAD format: .${ext}. Supported: STEP, STP, IGES, STL, OBJ.`);
    }

    hideLoading();
    document.getElementById('dropzone').classList.add('hidden');
    document.getElementById('viewport-hud').classList.remove('hidden');
    document.getElementById('btn-convert-download').removeAttribute('disabled');

    updateModelMetadataUI();
    recalculateMetrology();
    updateMassEstimate();
    fitModelToView();

  } catch (err) {
    hideLoading();
    console.error('Error loading CAD file:', err);
    alert(`Failed to load ${file.name}:\n${err.message || err}`);
  }
}

function showLoading(text, subtext) {
  const overlay = document.getElementById('loading-overlay');
  document.getElementById('loading-text').textContent = text;
  document.getElementById('loading-subtext').textContent = subtext || '';
  overlay.classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loading-overlay').classList.add('hidden');
}

// ── Loaders ─────────────────────────────────────────────────────

// STEP Loader via occt-import-js
async function loadSTEP(buffer) {
  if (typeof occtimportjs === 'undefined') {
    throw new Error('WebAssembly STEP parser not loaded.');
  }
  const occt = await occtimportjs();
  const fileBytes = new Uint8Array(buffer);
  const result = occt.ReadStepFile(fileBytes);

  if (!result.success || !result.meshes || result.meshes.length === 0) {
    throw new Error('Failed to parse STEP B-Rep solid geometry.');
  }

  processOcctResult(result);
}

// IGES Loader via occt-import-js
async function loadIGES(buffer) {
  if (typeof occtimportjs === 'undefined') {
    throw new Error('WebAssembly IGES parser not loaded.');
  }
  const occt = await occtimportjs();
  const fileBytes = new Uint8Array(buffer);
  const result = occt.ReadIgesFile(fileBytes);

  if (!result.success || !result.meshes || result.meshes.length === 0) {
    throw new Error('Failed to parse IGES CAD geometry.');
  }

  processOcctResult(result);
}

function processOcctResult(result) {
  clearCurrentModel();

  // Combine meshes into unified BufferGeometry
  let totalPositions = 0;
  let totalIndices = 0;

  for (const m of result.meshes) {
    totalPositions += m.attributes.position.array.length;
    if (m.index) totalIndices += m.index.array.length;
  }

  const combinedPos = new Float32Array(totalPositions);
  const combinedNorm = new Float32Array(totalPositions);
  let combinedIdx = totalIndices > 0 ? new Uint32Array(totalIndices) : null;

  let posOffset = 0;
  let idxOffset = 0;
  let vertOffset = 0;

  for (const m of result.meshes) {
    const pos = m.attributes.position.array;
    combinedPos.set(pos, posOffset);

    if (m.attributes.normal) {
      combinedNorm.set(m.attributes.normal.array, posOffset);
    }

    if (m.index && combinedIdx) {
      const idx = m.index.array;
      for (let i = 0; i < idx.length; i++) {
        combinedIdx[idxOffset + i] = idx[i] + vertOffset;
      }
      idxOffset += idx.length;
    }

    vertOffset += pos.length / 3;
    posOffset += pos.length;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(combinedPos, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(combinedNorm, 3));
  if (combinedIdx) {
    geometry.setIndex(new THREE.BufferAttribute(combinedIdx, 1));
  } else {
    geometry.computeVertexNormals();
  }

  currentRawMeshData = {
    positions: combinedPos,
    normals: combinedNorm,
    indices: combinedIdx
  };

  createMeshFromGeometry(geometry);
}

// STL Loader
async function loadSTL(buffer) {
  const loader = new THREE.STLLoader();
  const geometry = loader.parse(buffer);
  geometry.computeVertexNormals();

  const pos = geometry.attributes.position.array;
  const norm = geometry.attributes.normal ? geometry.attributes.normal.array : null;
  const idx = geometry.index ? geometry.index.array : null;

  currentRawMeshData = { positions: pos, normals: norm, indices: idx };
  clearCurrentModel();
  createMeshFromGeometry(geometry);
}

// OBJ Loader
async function loadOBJ(text) {
  const loader = new THREE.OBJLoader();
  const obj = loader.parse(text);

  // Merge geometries
  const geometries = [];
  obj.traverse((child) => {
    if (child.isMesh && child.geometry) {
      geometries.push(child.geometry.clone());
    }
  });

  if (geometries.length === 0) {
    throw new Error('No 3D mesh objects found in OBJ file.');
  }

  let mergedGeo = geometries[0];
  if (geometries.length > 1) {
    // Merge positions
    let totalLen = 0;
    for (const g of geometries) totalLen += g.attributes.position.array.length;
    const allPos = new Float32Array(totalLen);
    let offset = 0;
    for (const g of geometries) {
      allPos.set(g.attributes.position.array, offset);
      offset += g.attributes.position.array.length;
    }
    mergedGeo = new THREE.BufferGeometry();
    mergedGeo.setAttribute('position', new THREE.BufferAttribute(allPos, 3));
    mergedGeo.computeVertexNormals();
  } else {
    mergedGeo.computeVertexNormals();
  }

  const pos = mergedGeo.attributes.position.array;
  const norm = mergedGeo.attributes.normal ? mergedGeo.attributes.normal.array : null;
  const idx = mergedGeo.index ? mergedGeo.index.array : null;

  currentRawMeshData = { positions: pos, normals: norm, indices: idx };
  clearCurrentModel();
  createMeshFromGeometry(mergedGeo);
}

// ── Mesh & Scene Representation ─────────────────────────────────
function createMeshFromGeometry(geometry) {
  currentGeometry = geometry;

  const material = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    metalness: 0.25,
    roughness: 0.35,
    clippingPlanes: getActiveClippingPlanes(),
    clipShadows: true,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  modelGroup.add(mesh);

  // Build Edge geometry for CAD mode
  const edgesGeometry = new THREE.EdgesGeometry(geometry, 24);
  edgeLinesObject = new THREE.LineSegments(edgesGeometry, new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.35
  }));
  edgeLinesObject.visible = (renderMode === 'edges');
  modelGroup.add(edgeLinesObject);

  // Apply active render mode
  setRenderMode(renderMode);
}

function clearCurrentModel() {
  while (modelGroup.children.length > 0) {
    const obj = modelGroup.children[0];
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material.dispose();
    }
    modelGroup.remove(obj);
  }
  if (comMarkerObject) {
    scene.remove(comMarkerObject);
    comMarkerObject = null;
  }
  clearMeasurement();
}

function fitModelToView() {
  if (!currentGeometry) return;

  currentGeometry.computeBoundingSphere();
  const sphere = currentGeometry.boundingSphere;
  if (!sphere) return;

  const radius = sphere.radius || 50;
  const center = sphere.center;

  // Move camera
  const fov = camera.fov * (Math.PI / 180);
  const distance = Math.abs(radius / Math.sin(fov / 2)) * 1.35;

  controls.target.copy(center);
  camera.position.set(center.x + distance * 0.7, center.y + distance * 0.5, center.z + distance * 0.7);
  camera.near = radius / 100;
  camera.far = radius * 100;
  camera.updateProjectionMatrix();
  controls.update();

  // Adjust grid to match model size
  gridHelper.position.y = currentBBox ? currentBBox.min.y : 0;
  gridHelper.scale.set(Math.max(1, radius / 50), 1, Math.max(1, radius / 50));

  updateClippingSliderRanges();
}

// ── Metrology & Dimensions ──────────────────────────────────────
function recalculateMetrology() {
  if (!currentRawMeshData || !window.CadEngine) return;

  const { positions, indices } = currentRawMeshData;

  currentBBox = CadEngine.calculateBoundingBox(positions);
  const surfaceArea = CadEngine.calculateSurfaceArea(positions, indices);
  const volResult = CadEngine.calculateVolumeAndCenterOfMass(positions, indices);
  const topology = CadEngine.checkMeshTopology(positions, indices);

  currentMetrology = {
    bbox: currentBBox,
    surfaceArea: surfaceArea,
    volume: volResult.volume,
    centerOfMass: volResult.centerOfMass,
    topology: topology
  };

  // Update UI readouts
  updateDimensionsUI();

  // HUD
  document.getElementById('hud-triangles').textContent = topology.triangleCount.toLocaleString();
  document.getElementById('hud-vertices').textContent = topology.vertexCount.toLocaleString();
  const wtTag = document.getElementById('hud-watertight');
  if (topology.isWatertight) {
    wtTag.textContent = 'Watertight';
    wtTag.className = 'hud-tag tag-success';
  } else {
    wtTag.textContent = 'Open Mesh';
    wtTag.className = 'hud-tag tag-warning';
  }

  // Create Center of Mass visual 3D Marker
  createCoMMarker(volResult.centerOfMass);
}

function updateDimensionsUI() {
  if (!currentMetrology) return;

  const bbox = currentMetrology.bbox;
  const isInch = currentUnit === 'in';
  const scale = isInch ? (1 / 25.4) : 1;
  const lenUnit = isInch ? 'in' : 'mm';
  const areaUnit = isInch ? 'in²' : 'mm²';
  const volUnit = isInch ? 'in³' : 'mm³';
  const areaScale = isInch ? (1 / (25.4 * 25.4)) : 1;
  const volScale = isInch ? (1 / (25.4 * 25.4 * 25.4)) : 1;

  document.getElementById('dim-x').textContent = (bbox.size.x * scale).toFixed(2);
  document.getElementById('dim-y').textContent = (bbox.size.y * scale).toFixed(2);
  document.getElementById('dim-z').textContent = (bbox.size.z * scale).toFixed(2);

  document.querySelectorAll('.dim-unit').forEach(el => el.textContent = lenUnit);

  document.getElementById('val-volume').textContent = `${(currentMetrology.volume * volScale).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${volUnit}`;
  document.getElementById('val-surface-area').textContent = `${(currentMetrology.surfaceArea * areaScale).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${areaUnit}`;

  const com = currentMetrology.centerOfMass;
  document.getElementById('val-com').textContent = `(${ (com.x * scale).toFixed(1) }, ${ (com.y * scale).toFixed(1) }, ${ (com.z * scale).toFixed(1) })`;
}

function updateModelMetadataUI() {
  document.getElementById('info-filename').textContent = currentFileName || 'Unknown';
  document.getElementById('info-filename').title = currentFileName || '';
  document.getElementById('info-format').textContent = currentFileFormat || '--';

  const sizeKb = (currentFileSize / 1024).toFixed(1);
  const sizeMb = (currentFileSize / (1024 * 1024)).toFixed(2);
  document.getElementById('info-filesize').textContent = currentFileSize > 1048576 ? `${sizeMb} MB` : `${sizeKb} KB`;

  if (currentMetrology && currentMetrology.topology) {
    const isWt = currentMetrology.topology.isWatertight;
    const manEl = document.getElementById('info-manifold');
    manEl.textContent = isWt ? 'Solid (Watertight)' : `Surface (${currentMetrology.topology.openEdgesCount} open edges)`;
    manEl.className = isWt ? 'info-val badge-success' : 'info-val badge-warning';
  }
}

function createCoMMarker(com) {
  if (comMarkerObject) scene.remove(comMarkerObject);

  const marker = new THREE.Group();
  const sphereGeo = new THREE.SphereGeometry(2, 16, 16);
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  marker.add(sphere);

  const ringsGeo = new THREE.RingGeometry(3, 3.8, 32);
  const ringsMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });
  const ringX = new THREE.Mesh(ringsGeo, ringsMat);
  const ringY = ringX.clone(); ringY.rotation.x = Math.PI / 2;
  const ringZ = ringX.clone(); ringZ.rotation.y = Math.PI / 2;
  marker.add(ringX, ringY, ringZ);

  marker.position.set(com.x, com.y, com.z);
  marker.visible = document.getElementById('btn-toggle-com').classList.contains('active');
  scene.add(marker);
  comMarkerObject = marker;
}

// ── Mass Estimator ──────────────────────────────────────────────
function updateMassEstimate() {
  if (!currentMetrology || !window.CadEngine) return;

  const matSelect = document.getElementById('material-select');
  const customInput = document.getElementById('custom-density-input');
  let density = 2.70;

  if (matSelect.value === 'custom') {
    density = parseFloat(customInput.value) || 1.0;
  } else if (CadEngine.MATERIALS_DB[matSelect.value]) {
    density = CadEngine.MATERIALS_DB[matSelect.value].density;
  }

  const volMm3 = currentMetrology.volume;
  const mass = CadEngine.estimateMass(volMm3, density);

  document.getElementById('mass-grams').textContent = mass.massGrams >= 1000
    ? mass.massGrams.toLocaleString(undefined, { maximumFractionDigits: 1 })
    : mass.massGrams.toFixed(2);

  document.getElementById('mass-alt').textContent = `${mass.massKg.toFixed(3)} kg • ${mass.massPounds.toFixed(3)} lbs • ${mass.massOunces.toFixed(2)} oz`;
}

function toggleCustomDensity() {
  const isCustom = document.getElementById('material-select').value === 'custom';
  document.getElementById('custom-density-group').classList.toggle('hidden', !isCustom);
}

function toggleCustomScale() {
  const isCustom = document.getElementById('scale-factor-select').value === 'custom';
  document.getElementById('custom-scale-group').classList.toggle('hidden', !isCustom);
}

function setUnit(unit) {
  currentUnit = unit;
  document.getElementById('unit-mm').classList.toggle('active', unit === 'mm');
  document.getElementById('unit-in').classList.toggle('active', unit === 'in');
  updateDimensionsUI();
}

// ── Render Modes ────────────────────────────────────────────────
function setRenderMode(mode) {
  renderMode = mode;
  if (!modelGroup) return;

  modelGroup.traverse((child) => {
    if (child.isMesh) {
      if (mode === 'normals') {
        child.material = new THREE.MeshNormalMaterial({
          side: THREE.DoubleSide,
          clippingPlanes: getActiveClippingPlanes()
        });
      } else if (mode === 'xray') {
        child.material = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.4,
          roughness: 0.2,
          metalness: 0.1,
          depthWrite: false,
          side: THREE.DoubleSide,
          clippingPlanes: getActiveClippingPlanes()
        });
      } else if (mode === 'wire') {
        child.material = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          wireframe: true,
          clippingPlanes: getActiveClippingPlanes()
        });
      } else {
        // Solid or Edges
        child.material = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          metalness: 0.25,
          roughness: 0.35,
          side: THREE.DoubleSide,
          clippingPlanes: getActiveClippingPlanes()
        });
      }
    }
  });

  if (edgeLinesObject) {
    edgeLinesObject.visible = (mode === 'edges');
  }
}

// ── View Presets ────────────────────────────────────────────────
function setViewPreset(preset) {
  if (!currentGeometry) return;
  const center = currentBBox ? currentBBox.center : { x: 0, y: 0, z: 0 };
  const dist = currentBBox ? currentBBox.diagonal * 1.3 : 150;

  ['btn-view-iso', 'btn-view-top', 'btn-view-front', 'btn-view-right'].forEach(id => {
    document.getElementById(id).classList.remove('active');
  });

  if (preset === 'iso') {
    camera.position.set(center.x + dist * 0.6, center.y + dist * 0.5, center.z + dist * 0.6);
    document.getElementById('btn-view-iso').classList.add('active');
  } else if (preset === 'top') {
    camera.position.set(center.x, center.y + dist, center.z);
    document.getElementById('btn-view-top').classList.add('active');
  } else if (preset === 'front') {
    camera.position.set(center.x, center.y, center.z + dist);
    document.getElementById('btn-view-front').classList.add('active');
  } else if (preset === 'right') {
    camera.position.set(center.x + dist, center.y, center.z);
    document.getElementById('btn-view-right').classList.add('active');
  }

  controls.target.set(center.x, center.y, center.z);
  controls.update();
}

// ── Cross-Section Clipping ──────────────────────────────────────
function setupClippingControls() {
  ['x', 'y', 'z'].forEach(axis => {
    const chk = document.getElementById(`clip-${axis}-enable`);
    const slider = document.getElementById(`clip-${axis}-slider`);
    const flipBtn = document.getElementById(`clip-${axis}-flip`);

    chk.addEventListener('change', () => {
      clipEnabled[axis] = chk.checked;
      slider.disabled = !chk.checked;
      flipBtn.disabled = !chk.checked;
      updateClippingPlanes();
    });

    slider.addEventListener('input', () => {
      const val = parseFloat(slider.value);
      const sign = clipFlipped[axis] ? 1 : -1;
      clipPlanes[axis].constant = sign * val;
    });

    flipBtn.addEventListener('click', () => {
      clipFlipped[axis] = !clipFlipped[axis];
      const normal = clipPlanes[axis].normal;
      normal.negate();
      const val = parseFloat(slider.value);
      const sign = clipFlipped[axis] ? 1 : -1;
      clipPlanes[axis].constant = sign * val;
    });
  });
}

function updateClippingSliderRanges() {
  if (!currentBBox) return;
  ['x', 'y', 'z'].forEach(axis => {
    const min = currentBBox.min[axis];
    const max = currentBBox.max[axis];
    const slider = document.getElementById(`clip-${axis}-slider`);
    slider.min = min;
    slider.max = max;
    slider.step = (max - min) / 200 || 0.1;
    slider.value = (min + max) / 2;
    clipPlanes[axis].constant = -slider.value;
  });
}

function getActiveClippingPlanes() {
  const active = [];
  if (clipEnabled.x) active.push(clipPlanes.x);
  if (clipEnabled.y) active.push(clipPlanes.y);
  if (clipEnabled.z) active.push(clipPlanes.z);
  return active;
}

function updateClippingPlanes() {
  const active = getActiveClippingPlanes();
  modelGroup.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material.clippingPlanes = active;
      child.material.needsUpdate = true;
    }
  });
}

// ── Point-to-Point Distance Measurement ─────────────────────────
function toggleMeasureMode() {
  measureMode = !measureMode;
  document.getElementById('btn-toggle-measure').classList.toggle('active', measureMode);
  document.getElementById('measure-banner').classList.toggle('hidden', !measureMode);
  document.getElementById('measure-result-row').classList.toggle('hidden', !measureMode);
  if (!measureMode) {
    clearMeasurement();
  }
}

function onCanvasPointerDown(event) {
  if (!measureMode || !currentGeometry) return;

  const canvas = document.getElementById('cad-canvas');
  const rect = canvas.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(modelGroup.children, true);
  if (intersects.length > 0) {
    const pt = intersects[0].point;
    addMeasurePoint(pt);
  }
}

function addMeasurePoint(pt) {
  if (measurePoints.length >= 2) {
    clearMeasurement();
  }

  measurePoints.push(pt);

  // Add marker sphere
  const markerGeo = new THREE.SphereGeometry(1.5, 16, 16);
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const marker = new THREE.Mesh(markerGeo, markerMat);
  marker.position.copy(pt);
  scene.add(marker);
  measureMarkers.push(marker);

  if (measurePoints.length === 1) {
    document.getElementById('measure-status-text').textContent = 'Point 1 selected. Click second point...';
  } else if (measurePoints.length === 2) {
    // Connect line
    const p1 = measurePoints[0];
    const p2 = measurePoints[1];
    const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 2 });
    measureLine = new THREE.Line(lineGeo, lineMat);
    scene.add(measureLine);

    const dist = p1.distanceTo(p2);
    const dx = Math.abs(p2.x - p1.x);
    const dy = Math.abs(p2.y - p1.y);
    const dz = Math.abs(p2.z - p1.z);

    const isInch = currentUnit === 'in';
    const scale = isInch ? (1 / 25.4) : 1;
    const unit = isInch ? 'in' : 'mm';

    const distStr = `${(dist * scale).toFixed(2)} ${unit}`;
    const deltaStr = `ΔX: ${(dx * scale).toFixed(1)}, ΔY: ${(dy * scale).toFixed(1)}, ΔZ: ${(dz * scale).toFixed(1)} ${unit}`;

    document.getElementById('measure-status-text').textContent = `Distance: ${distStr} (${deltaStr})`;
    document.getElementById('val-measured-dist').textContent = distStr;
  }
}

function clearMeasurement() {
  measurePoints = [];
  measureMarkers.forEach(m => scene.remove(m));
  measureMarkers = [];
  if (measureLine) {
    scene.remove(measureLine);
    measureLine = null;
  }
  document.getElementById('measure-status-text').textContent = 'Click first point on 3D model surface...';
  document.getElementById('val-measured-dist').textContent = '0.00 mm';
}

// ── Viewport Themes ─────────────────────────────────────────────
function applyViewportTheme(theme) {
  if (theme === 'studio') {
    scene.background = new THREE.Color(0x27272a);
    gridHelper.material.color.set(0x71717a);
  } else if (theme === 'blueprint') {
    scene.background = new THREE.Color(0x0f2d59);
    gridHelper.material.color.set(0x38bdf8);
  } else if (theme === 'clean-white') {
    scene.background = new THREE.Color(0xf8fafc);
    gridHelper.material.color.set(0xcbd5e1);
  } else {
    // cad-dark
    scene.background = new THREE.Color(0x0f141f);
    gridHelper.material.color.set(0x38bdf8);
  }
}

// ── Snapshot Render ─────────────────────────────────────────────
function takeSnapshot() {
  if (!renderer) return;
  renderer.render(scene, camera);
  const dataURL = renderer.domElement.toDataURL('image/png');
  const a = document.createElement('a');
  const baseName = currentFileName ? currentFileName.replace(/\.[^/.]+$/, '') : 'cad_model';
  a.download = `${baseName}_render.png`;
  a.href = dataURL;
  a.click();
}

// ── Format Conversion & Export Execution ────────────────────────
async function executeConversion() {
  if (!currentRawMeshData || !window.CadEngine) {
    alert('Please load a 3D model first.');
    return;
  }

  const exportFormat = document.getElementById('export-format-select').value;
  const scaleSelect = document.getElementById('scale-factor-select').value;
  let scale = 1.0;

  if (scaleSelect === 'custom') {
    scale = parseFloat(document.getElementById('custom-scale-input').value) || 1.0;
  } else {
    scale = parseFloat(scaleSelect) || 1.0;
  }

  const centerOrigin = document.getElementById('chk-center-origin').checked;
  const alignGround = document.getElementById('chk-align-ground').checked;
  const flipNormals = document.getElementById('chk-flip-normals').checked;

  showLoading('Converting 3D format...', `Exporting to ${exportFormat.toUpperCase()}`);

  try {
    // Transform mesh coordinates
    const transformed = CadEngine.transformMeshData(currentRawMeshData, {
      scale: scale,
      centerOrigin: centerOrigin,
      alignGround: alignGround,
      flipNormals: flipNormals
    });

    const baseName = currentFileName ? currentFileName.replace(/\.[^/.]+$/, '') : 'converted_model';

    if (exportFormat === 'stl-binary') {
      const buffer = CadEngine.exportSTL(transformed, { binary: true, name: baseName });
      downloadBlob(new Blob([buffer], { type: 'application/octet-stream' }), `${baseName}.stl`);
    } else if (exportFormat === 'stl-ascii') {
      const text = CadEngine.exportSTL(transformed, { binary: false, name: baseName });
      downloadBlob(new Blob([text], { type: 'text/plain' }), `${baseName}.stl`);
    } else if (exportFormat === 'obj') {
      const text = CadEngine.exportOBJ(transformed, { name: baseName });
      downloadBlob(new Blob([text], { type: 'text/plain' }), `${baseName}.obj`);
    }

    hideLoading();
  } catch (err) {
    hideLoading();
    console.error('Export error:', err);
    alert(`Conversion failed: ${err.message || err}`);
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Global Exporter for Project Manager & Header ────────────────
window.exportJSON = function() {
  const state = window.projectManagerConfig.getInputs();
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
  const a = document.createElement('a');
  a.setAttribute("href", dataStr);
  a.setAttribute("download", "cad-viewer-session.json");
  document.body.appendChild(a);
  a.click();
  a.remove();
};

window.importJSON = function(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      window.projectManagerConfig.setInputs(data);
    } catch (err) {
      alert("Invalid JSON configuration file.");
    }
  };
  reader.readAsText(file);
};

window.shareLink = function() {
  const state = window.projectManagerConfig.getInputs();
  let encoded = "";
  if (window.encodeToolShare) {
    encoded = window.encodeToolShare(state, "cad-viewer", 1);
  } else {
    encoded = encodeURIComponent(JSON.stringify(state));
  }
  const url = `${window.location.origin}${window.location.pathname}?state=${encoded}`;
  navigator.clipboard.writeText(url).then(() => {
    if (window.showToast) {
      window.showToast("Sharing link copied to clipboard!", true);
    } else {
      alert("Sharing link copied to clipboard!");
    }
  });
};

// Register with ToolExports on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  if (window.ToolExports) {
    window.ToolExports.register({
      json: () => window.exportJSON(),
      import: () => document.getElementById("import-file-input")?.click(),
      markdown: () => {
        const fn = currentFileName || "None";
        const fmt = currentFileFormat || "—";
        const vol = document.getElementById("val-volume")?.textContent || "—";
        const area = document.getElementById("val-surface-area")?.textContent || "—";
        const dimX = document.getElementById("dim-x")?.textContent || "0";
        const dimY = document.getElementById("dim-y")?.textContent || "0";
        const dimZ = document.getElementById("dim-z")?.textContent || "0";
        const mass = document.getElementById("mass-grams")?.textContent || "0";
        return `## 3D CAD Model Inspection\n\n| Property | Value |\n|---|---|\n| File Name | ${fn} |\n| Format | ${fmt} |\n| Dimensions (X × Y × Z) | ${dimX} × ${dimY} × ${dimZ} ${currentUnit} |\n| Surface Area | ${area} |\n| Volume | ${vol} |\n| Estimated Mass | ${mass} g |\n`;
      },
      hide: ['button[onclick*="exportJSON"]', 'button[onclick*="importJSON"]']
    });
    window.ToolExports.mount();
  }
});

