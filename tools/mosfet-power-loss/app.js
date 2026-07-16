// ==========================================================================
//  MOSFET Power Loss Calculator & Comparator - Application Logic
// ==========================================================================

// Global state containing MOSFET parts being compared
let mosfets = [
  {
    id: "mosfet-1",
    partNumber: "BSC010NE2LS",
    rdson: 1.0,  // mΩ
    qg: 65,      // nC
    tdon: 12,    // ns
    tr: 18,      // ns
    tdoff: 32,   // ns
    tf: 10,      // ns
    qrr: 72,     // nC
    vsd: 0.85,   // V
    coss: 1800   // pF
  },
  {
    id: "mosfet-2",
    partNumber: "IRF3205",
    rdson: 8.0,  // mΩ
    qg: 146,     // nC
    tdon: 14,    // ns
    tr: 101,     // ns
    tdoff: 50,   // ns
    tf: 65,      // ns
    qrr: 250,    // nC
    vsd: 1.3,    // V
    coss: 700    // pF
  }
];

// Helper to format power display
function formatPower(p) {
  if (p === 0) return "0 W";
  if (p < 0.001) return (p * 1e6).toFixed(1) + " μW";
  if (p < 1) return (p * 1000).toFixed(1) + " mW";
  return p.toFixed(2) + " W";
}

// Render column HTML structure for each MOSFET
function renderColumns() {
  const container = document.getElementById('mosfet-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  mosfets.forEach((m, index) => {
    const col = document.createElement('div');
    col.className = 'mosfet-column';
    col.id = `col-${m.id}`;
    
    const showRemove = mosfets.length > 1;
    const removeBtnHtml = showRemove 
      ? `<button class="remove-col-btn" onclick="removeMosfetColumn('${m.id}')" title="Remove part">
           <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
         </button>`
      : '';
      
    col.innerHTML = `
      <div class="mosfet-col-header">
        <div class="mosfet-title">
          <input type="text" class="part-input" id="inp-part-${m.id}" value="${m.partNumber}" onchange="updatePartNumber('${m.id}', this.value)" title="Click to rename part">
          <span style="font-size: 10px; color: var(--text-muted);">MOSFET #${index + 1}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${removeBtnHtml}
        </div>
      </div>
      
      <div class="mosfet-col-inputs">
        <div class="input-lbl">RDS(on) <span class="unit">[mΩ]</span> <p>Drain-Source On-Resistance</p></div>
        <div class="mosfet-field-grp">
          <input type="number" id="inp-rdson-${m.id}" value="${m.rdson}" step="0.1" min="0" oninput="recalculateAll()">
        </div>

        <div class="input-lbl">Qg <span class="unit">[nC]</span> <p>Total Gate Charge</p></div>
        <div class="mosfet-field-grp">
          <input type="number" id="inp-qg-${m.id}" value="${m.qg}" step="1" min="0" oninput="recalculateAll()">
        </div>

        <div class="input-lbl">Tr <span class="unit">[ns]</span> <p>Rise Time</p></div>
        <div class="mosfet-field-grp">
          <input type="number" id="inp-tr-${m.id}" value="${m.tr}" step="1" min="0" oninput="recalculateAll()">
        </div>

        <div class="input-lbl">Tf <span class="unit">[ns]</span> <p>Fall Time</p></div>
        <div class="mosfet-field-grp">
          <input type="number" id="inp-tf-${m.id}" value="${m.tf}" step="1" min="0" oninput="recalculateAll()">
        </div>

        <div class="input-lbl">td(on) <span class="unit">[ns]</span> <p>Turn-on Delay (datasheet; not used in loss model)</p></div>
        <div class="mosfet-field-grp">
          <input type="number" id="inp-tdon-${m.id}" value="${m.tdon}" step="1" min="0" oninput="recalculateAll()" title="Stored for reference only — delay times do not contribute crossover loss in this model">
        </div>

        <div class="input-lbl">td(off) <span class="unit">[ns]</span> <p>Turn-off Delay (datasheet; not used in loss model)</p></div>
        <div class="mosfet-field-grp">
          <input type="number" id="inp-tdoff-${m.id}" value="${m.tdoff}" step="1" min="0" oninput="recalculateAll()" title="Stored for reference only — delay times do not contribute crossover loss in this model">
        </div>

        <div class="input-lbl">Qrr <span class="unit">[nC]</span> <p>Reverse Recovery Charge</p></div>
        <div class="mosfet-field-grp">
          <input type="number" id="inp-qrr-${m.id}" value="${m.qrr}" step="1" min="0" oninput="recalculateAll()">
        </div>

        <div class="input-lbl">Vsd <span class="unit">[V]</span> <p>Diode Forward Drop</p></div>
        <div class="mosfet-field-grp">
          <input type="number" id="inp-vsd-${m.id}" value="${m.vsd}" step="0.05" min="0" oninput="recalculateAll()">
        </div>

        <div class="input-lbl">Coss <span class="unit">[pF]</span> <p>Output Capacitance</p></div>
        <div class="mosfet-field-grp">
          <input type="number" id="inp-coss-${m.id}" value="${m.coss}" step="10" min="0" oninput="recalculateAll()">
        </div>
      </div>
      
      <div class="mosfet-col-results">
        <div class="total-loss-box">
          <span class="lbl">Total Loss</span>
          <span class="val" id="total-loss-${m.id}">-- W</span>
        </div>
        
        <div class="stacked-bar-container">
          <span class="stacked-bar-title">Loss Distribution</span>
          <div class="stacked-bar">
            <div class="bar-segment bar-segment-cond" id="bar-cond-${m.id}" style="width: 0%;" title="Conduction Loss"></div>
            <div class="bar-segment bar-segment-sw" id="bar-sw-${m.id}" style="width: 0%;" title="Switching Loss"></div>
            <div class="bar-segment bar-segment-dead" id="bar-dead-${m.id}" style="width: 0%;" title="Dead Time Loss"></div>
            <div class="bar-segment bar-segment-rr" id="bar-rr-${m.id}" style="width: 0%;" title="Reverse Recovery Loss"></div>
            <div class="bar-segment bar-segment-gate" id="bar-gate-${m.id}" style="width: 0%;" title="Gate Drive Loss"></div>
            <div class="bar-segment bar-segment-coss" id="bar-coss-${m.id}" style="width: 0%;" title="Output Capacitance Loss"></div>
          </div>
        </div>
        
        <div class="breakdown-list">
          
          <div class="breakdown-row">
            <div class="breakdown-row-info">
              <span class="breakdown-row-name"><span class="breakdown-dot breakdown-dot-cond"></span>Conduction</span>
              <span class="breakdown-row-val"><span id="val-cond-${m.id}">-- W</span><span class="breakdown-row-pct" id="pct-cond-${m.id}">0.0%</span></span>
            </div>
            <div class="breakdown-mini-bar">
              <div class="breakdown-mini-fill breakdown-dot-cond" id="fill-cond-${m.id}" style="width: 0%"></div>
            </div>
          </div>

          <div class="breakdown-row">
            <div class="breakdown-row-info">
              <span class="breakdown-row-name"><span class="breakdown-dot breakdown-dot-sw"></span>Switching</span>
              <span class="breakdown-row-val"><span id="val-sw-${m.id}">-- W</span><span class="breakdown-row-pct" id="pct-sw-${m.id}">0.0%</span></span>
            </div>
            <div class="breakdown-mini-bar">
              <div class="breakdown-mini-fill breakdown-dot-sw" id="fill-sw-${m.id}" style="width: 0%"></div>
            </div>
          </div>

          <div class="breakdown-row">
            <div class="breakdown-row-info">
              <span class="breakdown-row-name"><span class="breakdown-dot breakdown-dot-dead"></span>Dead Time</span>
              <span class="breakdown-row-val"><span id="val-dead-${m.id}">-- W</span><span class="breakdown-row-pct" id="pct-dead-${m.id}">0.0%</span></span>
            </div>
            <div class="breakdown-mini-bar">
              <div class="breakdown-mini-fill breakdown-dot-dead" id="fill-dead-${m.id}" style="width: 0%"></div>
            </div>
          </div>

          <div class="breakdown-row">
            <div class="breakdown-row-info">
              <span class="breakdown-row-name"><span class="breakdown-dot breakdown-dot-rr"></span>Reverse Recovery</span>
              <span class="breakdown-row-val"><span id="val-rr-${m.id}">-- W</span><span class="breakdown-row-pct" id="pct-rr-${m.id}">0.0%</span></span>
            </div>
            <div class="breakdown-mini-bar">
              <div class="breakdown-mini-fill breakdown-dot-rr" id="fill-rr-${m.id}" style="width: 0%"></div>
            </div>
          </div>

          <div class="breakdown-row">
            <div class="breakdown-row-info">
              <span class="breakdown-row-name"><span class="breakdown-dot breakdown-dot-gate"></span>Gate Drive</span>
              <span class="breakdown-row-val"><span id="val-gate-${m.id}">-- W</span><span class="breakdown-row-pct" id="pct-gate-${m.id}">0.0%</span></span>
            </div>
            <div class="breakdown-mini-bar">
              <div class="breakdown-mini-fill breakdown-dot-gate" id="fill-gate-${m.id}" style="width: 0%"></div>
            </div>
          </div>

          <div class="breakdown-row">
            <div class="breakdown-row-info">
              <span class="breakdown-row-name"><span class="breakdown-dot breakdown-dot-coss"></span>Coss</span>
              <span class="breakdown-row-val"><span id="val-coss-${m.id}">-- W</span><span class="breakdown-row-pct" id="pct-coss-${m.id}">0.0%</span></span>
            </div>
            <div class="breakdown-mini-bar">
              <div class="breakdown-mini-fill breakdown-dot-coss" id="fill-coss-${m.id}" style="width: 0%"></div>
            </div>
          </div>
          
        </div>
      </div>
    `;
    container.appendChild(col);
  });
}

// Perform loss calculation based on physics formulas
function recalculateAll() {
  const vbus = parseFloat(document.getElementById('inp-vbus').value) || 0;
  const iload = parseFloat(document.getElementById('inp-iload').value) || 0;
  const fsw = parseFloat(document.getElementById('inp-fsw').value) || 0; // kHz
  const vgate = parseFloat(document.getElementById('inp-vgate').value) || 0;
  const tdead = parseFloat(document.getElementById('inp-tdead').value) || 0; // ns
  const duty = parseFloat(document.getElementById('inp-duty').value) || 0; // %

  mosfets.forEach(m => {
    // Read input values directly from DOM elements if they exist, to stay synced
    const inputRdson = document.getElementById(`inp-rdson-${m.id}`);
    const inputQg = document.getElementById(`inp-qg-${m.id}`);
    const inputTr = document.getElementById(`inp-tr-${m.id}`);
    const inputTf = document.getElementById(`inp-tf-${m.id}`);
    const inputTdon = document.getElementById(`inp-tdon-${m.id}`);
    const inputTdoff = document.getElementById(`inp-tdoff-${m.id}`);
    const inputQrr = document.getElementById(`inp-qrr-${m.id}`);
    const inputVsd = document.getElementById(`inp-vsd-${m.id}`);
    const inputCoss = document.getElementById(`inp-coss-${m.id}`);

    if (inputRdson) m.rdson = parseFloat(inputRdson.value) || 0;
    if (inputQg) m.qg = parseFloat(inputQg.value) || 0;
    if (inputTr) m.tr = parseFloat(inputTr.value) || 0;
    if (inputTf) m.tf = parseFloat(inputTf.value) || 0;
    if (inputTdon) m.tdon = parseFloat(inputTdon.value) || 0;
    if (inputTdoff) m.tdoff = parseFloat(inputTdoff.value) || 0;
    if (inputQrr) m.qrr = parseFloat(inputQrr.value) || 0;
    if (inputVsd) m.vsd = parseFloat(inputVsd.value) || 0;
    if (inputCoss) m.coss = parseFloat(inputCoss.value) || 0;

    // Unit conversions
    const rdson_ohm = m.rdson / 1000.0;
    const qg_c = m.qg / 1e9;
    const tr_s = m.tr / 1e9;
    const tf_s = m.tf / 1e9;
    const qrr_c = m.qrr / 1e9;
    const coss_f = m.coss / 1e12;
    const tdead_s = tdead / 1e9;
    const fsw_hz = fsw * 1000.0;
    const duty_frac = duty / 100.0;

    // Loss Calculations
    // 1. Conduction loss
    const p_cond = iload * iload * rdson_ohm * duty_frac;

    // 2. Switching loss (Turn-on & Turn-off linear approximation)
    const p_sw = 0.5 * vbus * iload * (tr_s + tf_s) * fsw_hz;

    // 3. Dead Time loss (2 switch events per cycle)
    const p_dead = 2.0 * iload * m.vsd * tdead_s * fsw_hz;

    // 4. Reverse Recovery loss
    const p_rr = qrr_c * vbus * fsw_hz;

    // 5. Gate Drive loss
    const p_gate = qg_c * vgate * fsw_hz;

    // 6. Coss loss
    const p_coss = 0.5 * coss_f * vbus * vbus * fsw_hz;

    // Total Loss
    const p_total = p_cond + p_sw + p_dead + p_rr + p_gate + p_coss;

    // Update result elements in DOM
    const totalNode = document.getElementById(`total-loss-${m.id}`);
    if (totalNode) totalNode.textContent = formatPower(p_total);

    const condNode = document.getElementById(`val-cond-${m.id}`);
    if (condNode) condNode.textContent = formatPower(p_cond);
    const swNode = document.getElementById(`val-sw-${m.id}`);
    if (swNode) swNode.textContent = formatPower(p_sw);
    const deadNode = document.getElementById(`val-dead-${m.id}`);
    if (deadNode) deadNode.textContent = formatPower(p_dead);
    const rrNode = document.getElementById(`val-rr-${m.id}`);
    if (rrNode) rrNode.textContent = formatPower(p_rr);
    const gateNode = document.getElementById(`val-gate-${m.id}`);
    if (gateNode) gateNode.textContent = formatPower(p_gate);
    const cossNode = document.getElementById(`val-coss-${m.id}`);
    if (cossNode) cossNode.textContent = formatPower(p_coss);

    // Calculate percentages
    const pct_cond = p_total > 0 ? (p_cond / p_total) * 100 : 0;
    const pct_sw = p_total > 0 ? (p_sw / p_total) * 100 : 0;
    const pct_dead = p_total > 0 ? (p_dead / p_total) * 100 : 0;
    const pct_rr = p_total > 0 ? (p_rr / p_total) * 100 : 0;
    const pct_gate = p_total > 0 ? (p_gate / p_total) * 100 : 0;
    const pct_coss = p_total > 0 ? (p_coss / p_total) * 100 : 0;

    // Set percentage tags
    const pCondPct = document.getElementById(`pct-cond-${m.id}`);
    if (pCondPct) pCondPct.textContent = pct_cond.toFixed(1) + '%';
    const pSwPct = document.getElementById(`pct-sw-${m.id}`);
    if (pSwPct) pSwPct.textContent = pct_sw.toFixed(1) + '%';
    const pDeadPct = document.getElementById(`pct-dead-${m.id}`);
    if (pDeadPct) pDeadPct.textContent = pct_dead.toFixed(1) + '%';
    const pRrPct = document.getElementById(`pct-rr-${m.id}`);
    if (pRrPct) pRrPct.textContent = pct_rr.toFixed(1) + '%';
    const pGatePct = document.getElementById(`pct-gate-${m.id}`);
    if (pGatePct) pGatePct.textContent = pct_gate.toFixed(1) + '%';
    const pCossPct = document.getElementById(`pct-coss-${m.id}`);
    if (pCossPct) pCossPct.textContent = pct_coss.toFixed(1) + '%';

    // Set mini bars widths
    const fillCond = document.getElementById(`fill-cond-${m.id}`);
    if (fillCond) fillCond.style.width = `${pct_cond}%`;
    const fillSw = document.getElementById(`fill-sw-${m.id}`);
    if (fillSw) fillSw.style.width = `${pct_sw}%`;
    const fillDead = document.getElementById(`fill-dead-${m.id}`);
    if (fillDead) fillDead.style.width = `${pct_dead}%`;
    const fillRr = document.getElementById(`fill-rr-${m.id}`);
    if (fillRr) fillRr.style.width = `${pct_rr}%`;
    const fillGate = document.getElementById(`fill-gate-${m.id}`);
    if (fillGate) fillGate.style.width = `${pct_gate}%`;
    const fillCoss = document.getElementById(`fill-coss-${m.id}`);
    if (fillCoss) fillCoss.style.width = `${pct_coss}%`;

    // Set segments of the main stacked bar chart
    const bCond = document.getElementById(`bar-cond-${m.id}`);
    if (bCond) bCond.style.width = `${pct_cond}%`;
    const bSw = document.getElementById(`bar-sw-${m.id}`);
    if (bSw) bSw.style.width = `${pct_sw}%`;
    const bDead = document.getElementById(`bar-dead-${m.id}`);
    if (bDead) bDead.style.width = `${pct_dead}%`;
    const bRr = document.getElementById(`bar-rr-${m.id}`);
    if (bRr) bRr.style.width = `${pct_rr}%`;
    const bGate = document.getElementById(`bar-gate-${m.id}`);
    if (bGate) bGate.style.width = `${pct_gate}%`;
    const bCoss = document.getElementById(`bar-coss-${m.id}`);
    if (bCoss) bCoss.style.width = `${pct_coss}%`;
  });
}

// Add dynamic MOSFET column
window.addNewMosfetColumn = function() {
  const newId = "mosfet-" + Date.now();
  
  // Pick reference values from first or use a reasonable default
  const ref = mosfets[0] || {
    rdson: 4.0,
    qg: 80,
    tr: 30,
    tf: 20,
    tdon: 15,
    tdoff: 40,
    qrr: 100,
    vsd: 0.9,
    coss: 1000
  };

  const newPart = {
    id: newId,
    partNumber: "MOSFET_" + (mosfets.length + 1),
    rdson: ref.rdson,
    qg: ref.qg,
    tr: ref.tr,
    tf: ref.tf,
    tdon: ref.tdon,
    tdoff: ref.tdoff,
    qrr: ref.qrr,
    vsd: ref.vsd,
    coss: ref.coss
  };
  
  mosfets.push(newPart);
  renderColumns();
  recalculateAll();
  
  document.dispatchEvent(new Event("input")); // Save triggers
};

// Remove MOSFET column
window.removeMosfetColumn = function(id) {
  if (mosfets.length <= 1) return;
  mosfets = mosfets.filter(m => m.id !== id);
  renderColumns();
  recalculateAll();
  
  document.dispatchEvent(new Event("input"));
};

// Update part number from input
window.updatePartNumber = function(id, val) {
  const m = mosfets.find(item => item.id === id);
  if (m) {
    m.partNumber = val.trim() || "Unnamed MOSFET";
  }
  document.dispatchEvent(new Event("input"));
};

// Tab Switching
window.switchTab = function(tabId) {
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  document.querySelectorAll('.main-tab').forEach(btn => {
    btn.classList.remove('active');
  });

  const selectedPanel = document.getElementById(tabId);
  if (selectedPanel) selectedPanel.classList.add('active');

  if (tabId === 'calc-panel') {
    document.getElementById('tab-btn-calc').classList.add('active');
  } else if (tabId === 'def-panel') {
    document.getElementById('tab-btn-def').classList.add('active');
  } else if (tabId === 'formula-panel') {
    document.getElementById('tab-btn-formula').classList.add('active');
  }
};

// ================================================================
//  SAVED PROJECTS MANAGEMENT (Firebase + LocalStorage Fallback)
// ================================================================
function getInputsConfig() {
  const vbus = parseFloat(document.getElementById('inp-vbus').value) || 48;
  const iload = parseFloat(document.getElementById('inp-iload').value) || 15;
  const fsw = parseFloat(document.getElementById('inp-fsw').value) || 100;
  const vgate = parseFloat(document.getElementById('inp-vgate').value) || 10;
  const tdead = parseFloat(document.getElementById('inp-tdead').value) || 100;
  const duty = parseFloat(document.getElementById('inp-duty').value) || 50;

  const mosfetData = mosfets.map(m => {
    const inputRdson = document.getElementById(`inp-rdson-${m.id}`);
    const inputQg = document.getElementById(`inp-qg-${m.id}`);
    const inputTr = document.getElementById(`inp-tr-${m.id}`);
    const inputTf = document.getElementById(`inp-tf-${m.id}`);
    const inputTdon = document.getElementById(`inp-tdon-${m.id}`);
    const inputTdoff = document.getElementById(`inp-tdoff-${m.id}`);
    const inputQrr = document.getElementById(`inp-qrr-${m.id}`);
    const inputVsd = document.getElementById(`inp-vsd-${m.id}`);
    const inputCoss = document.getElementById(`inp-coss-${m.id}`);

    return {
      partNumber: m.partNumber,
      rdson: inputRdson ? (parseFloat(inputRdson.value) || 0) : m.rdson,
      qg: inputQg ? (parseFloat(inputQg.value) || 0) : m.qg,
      tr: inputTr ? (parseFloat(inputTr.value) || 0) : m.tr,
      tf: inputTf ? (parseFloat(inputTf.value) || 0) : m.tf,
      tdon: inputTdon ? (parseFloat(inputTdon.value) || 0) : m.tdon,
      tdoff: inputTdoff ? (parseFloat(inputTdoff.value) || 0) : m.tdoff,
      qrr: inputQrr ? (parseFloat(inputQrr.value) || 0) : m.qrr,
      vsd: inputVsd ? (parseFloat(inputVsd.value) || 0) : m.vsd,
      coss: inputCoss ? (parseFloat(inputCoss.value) || 0) : m.coss
    };
  });

  return {
    vbus,
    iload,
    fsw,
    vgate,
    tdead,
    duty,
    mosfets: mosfetData
  };
}

function setInputsConfig(config) {
  if (!config) return;
  
  if (config.vbus !== undefined) document.getElementById('inp-vbus').value = config.vbus;
  if (config.iload !== undefined) document.getElementById('inp-iload').value = config.iload;
  if (config.fsw !== undefined) document.getElementById('inp-fsw').value = config.fsw;
  if (config.vgate !== undefined) document.getElementById('inp-vgate').value = config.vgate;
  if (config.tdead !== undefined) document.getElementById('inp-tdead').value = config.tdead;
  if (config.duty !== undefined) document.getElementById('inp-duty').value = config.duty;

  if (config.mosfets && Array.isArray(config.mosfets)) {
    mosfets = config.mosfets.map((m, index) => ({
      id: "mosfet-" + index + "-" + Date.now(),
      partNumber: m.partNumber || ("MOSFET_" + (index + 1)),
      rdson: m.rdson !== undefined ? m.rdson : 4.0,
      qg: m.qg !== undefined ? m.qg : 80,
      tr: m.tr !== undefined ? m.tr : 30,
      tf: m.tf !== undefined ? m.tf : 20,
      tdon: m.tdon !== undefined ? m.tdon : 15,
      tdoff: m.tdoff !== undefined ? m.tdoff : 40,
      qrr: m.qrr !== undefined ? m.qrr : 100,
      vsd: m.vsd !== undefined ? m.vsd : 0.9,
      coss: m.coss !== undefined ? m.coss : 1000
    }));
  }
  
  renderColumns();
  recalculateAll();
}

// Project Manager Configuration
window.projectManagerConfig = {
  toolId: "mosfet-power-loss",
  getInputs: () => getInputsConfig(),
  setInputs: (data) => setInputsConfig(data)
};

// ================================================================
//  HEADER UTILITIES (Share, Export, Import)
// ================================================================
window.shareLink = function() {
  try {
    const configData = getInputsConfig();
    const serialized = window.encodeToolShare
      ? window.encodeToolShare("mosfet-power-loss", configData)
      : (window.encodeShareState ? window.encodeShareState(configData) : btoa(unescape(encodeURIComponent(JSON.stringify(configData)))));
    const url = new URL(window.location.href);
    url.searchParams.set('design', serialized);
    
    navigator.clipboard.writeText(url.toString()).then(() => {
      if (window.showToast) window.showToast("Design link copied to clipboard!");
      else alert("Design link copied to clipboard!");
      if (window.pmMaybeGuestUpgradeCta) window.pmMaybeGuestUpgradeCta();
    }).catch(() => {
      alert("Could not write to clipboard automatically. Copy URL manually: " + url.toString());
    });
  } catch (err) {
    console.error(err);
    alert("Failed to generate share link.");
  }
};

window.buildMosfetMarkdown = function() {
  const cfg = getInputsConfig();
  const rows = (cfg.devices || []).map((d, i) =>
    `| ${d.name || "Device " + (i + 1)} | ${d.rdsOn ?? "—"} | ${d.qg ?? "—"} |`
  );
  return [
    "## MOSFET Power Loss Comparison",
    "",
    `| Device | Rds(on) | Qg |`,
    `|---|---|---|`,
    ...rows,
    "",
    `_Conditions from Engineering Toolkit MOSFET calculator_`
  ].join("\n");
};

window.openMosfetReport = function() {
  if (!window.ToolExports) return;
  const cfg = getInputsConfig();
  const md = window.buildMosfetMarkdown();
  window.ToolExports.openPrintReport({
    title: "MOSFET Power Loss Report",
    metaLines: [
      `Devices: ${(cfg.devices || []).length}`,
      `physics v${window.ToolExports.getPhysicsVersion("mosfet-power-loss")}`
    ],
    sections: [{ heading: "Summary", text: md }]
  });
};

window.exportJSON = function() {
  try {
    const configData = getInputsConfig();
    const blob = new Blob([JSON.stringify(configData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mosfet-loss-comparison-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    alert("Export failed: " + err.message);
  }
};

window.importJSON = function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const data = JSON.parse(evt.target.result);
      setInputsConfig(data);
      document.dispatchEvent(new Event("input")); // Triggers project-manager auto-save
    } catch (err) {
      alert("Invalid JSON file: " + err.message);
    }
  };
  reader.readAsText(file);
};

document.addEventListener("DOMContentLoaded", () => {
  // Load from URL if design param is present
  const urlParams = new URLSearchParams(window.location.search);
  const design = urlParams.get('design');
  if (design) {
    try {
      let decoded = null;
      if (window.decodeToolShare) {
        const res = window.decodeToolShare(design, "mosfet-power-loss");
        if (!res.ok) {
          if (window.showToast) window.showToast(res.error || "Invalid share link", false);
        } else {
          if (res.warning && window.ToolExports) window.ToolExports.showPhysicsWarning(res.warning);
          decoded = res.payload;
        }
      } else {
        decoded = (window.decodeShareState ? window.decodeShareState(design) : JSON.parse(decodeURIComponent(escape(atob(design)))));
      }
      if (decoded) setInputsConfig(decoded);
      else {
        renderColumns();
        recalculateAll();
      }
    } catch (err) {
      console.error("Failed to load design from URL:", err);
      renderColumns();
      recalculateAll();
    }
  } else {
    // Initial Render and Recalculation
    renderColumns();
    recalculateAll();
  }

  // Export menu
  if (window.ToolExports) {
    window.ToolExports.register({
      json: () => window.exportJSON(),
      import: () => document.getElementById("import-file-input")?.click(),
      report: () => window.openMosfetReport(),
      markdown: () => window.buildMosfetMarkdown(),
      hide: ['button[onclick*="exportJSON"]', 'button[onclick*="importJSON"]']
    });
    window.ToolExports.mount();
  }

  // Render Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
});
