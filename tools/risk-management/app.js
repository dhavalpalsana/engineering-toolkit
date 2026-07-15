// risk-management/app.js

// Register the tool with the global project manager (must be defined before project-manager.js loads)
window.projectManagerConfig = {
  toolId: "risk-management",
  // Export current risk data for sharing/exporting
  getInputs: () => ({ risks: riskData }),
  // Load imported JSON data into the tool
  setInputs: (data) => {
    if (data && Array.isArray(data.risks)) {
      riskData = data.risks;
      persistRisks();
      renderAll();
    }
  }
};

// ----- Configuration -----
const SEVERITY_DEFINITIONS = {
  1: "Negligible",
  2: "Minor",
  3: "Moderate",
  4: "Major",
  5: "Critical"
};
const PROBABILITY_DEFINITIONS = {
  1: "Rare",
  2: "Unlikely",
  3: "Possible",
  4: "Likely",
  5: "Almost Certain"
};

// ----- State -----
let riskData = [];
let editingRiskId = null; // Track which risk is being edited

// ----- Firebase Helpers -----
async function getCurrentUser() {
  if (window.firebase && firebase.auth && firebase.auth().currentUser) {
    return firebase.auth().currentUser;
  }
  return null;
}

async function loadRisksFromFirestore() {
  const user = await getCurrentUser();
  if (!user) return [];
  try {
    const snap = await firebase.firestore()
      .collection("risk_registers")
      .doc(user.uid)
      .collection("risks")
      .orderBy("dateCreated", "desc")
      .get();
    const arr = [];
    snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
    return arr;
  } catch (e) {
    console.warn("Failed to load risks from Firestore", e);
    return [];
  }
}

async function saveRiskToFirestore(risk) {
  const user = await getCurrentUser();
  if (!user) return;
  try {
    const col = firebase.firestore()
      .collection("risk_registers")
      .doc(user.uid)
      .collection("risks");
    if (risk.id) {
      await col.doc(risk.id).set(risk, { merge: true });
    } else {
      const docRef = await col.add(risk);
      risk.id = docRef.id;
    }
  } catch (e) {
    console.error("Failed to save risk", e);
  }
}

// ----- Local Storage Fallback -----
function loadRisksFromLocal() {
  const json = localStorage.getItem("riskManagementRisks");
  return json ? JSON.parse(json) : [];
}

function persistRisks() {
  getCurrentUser().then(user => {
    if (!user) {
      localStorage.setItem("riskManagementRisks", JSON.stringify(riskData));
    }
    // Firestore persistence handled per‑risk in saveRiskToFirestore()
  });
}

// ----- Utility -----
function computeScore(severity, probability) {
  const s = parseInt(severity) || 0;
  const p = parseInt(probability) || 0;
  return s * p;
}

function determineLevel(score) {
  if (score >= 16) return { level: "CRITICAL", color: "#e11d48", cssClass: "badge-critical" };
  if (score >= 9) return { level: "MEDIUM", color: "#f59e0b", cssClass: "badge-medium" };
  return { level: "LOW", color: "#10b981", cssClass: "badge-low" };
}

function getStatusClass(status) {
  switch (status) {
    case "Open": return "status-open";
    case "In Progress": return "status-in-progress";
    case "Closed": return "status-closed";
    default: return "status-open";
  }
}

function escapeHTML(str) {
  if (!str) return "";
  const el = document.createElement("span");
  el.textContent = str;
  return el.innerHTML;
}

// ----- Rendering -----
function renderAll() {
  renderRiskList();
  renderHeatMap();
  renderTop5();
  renderTrend();
  renderStats();
  lucide.createIcons();
}

function switchView(view) {
  const editSection = document.getElementById('edit-view');
  const dashSection = document.getElementById('dashboard-view');
  const editBtn = document.getElementById('edit-view-btn');
  const dashBtn = document.getElementById('dashboard-view-btn');
  if (view === 'edit') {
    editSection?.classList.remove('section-hidden');
    dashSection?.classList.add('section-hidden');
    editBtn?.classList.add('active');
    dashBtn?.classList.remove('active');
  } else {
    editSection?.classList.add('section-hidden');
    dashSection?.classList.remove('section-hidden');
    dashBtn?.classList.add('active');
    editBtn?.classList.remove('active');
    // Re-render dashboard when switching to it
    renderHeatMap();
    renderTop5();
    renderTrend();
    renderStats();
    lucide.createIcons();
  }
}

// ----- Risk List (Table) -----
function renderRiskList() {
  const tbody = document.getElementById("risk-table-body");
  if (!tbody) return;

  // Get filter values
  const filterCategory = document.getElementById("filter-category")?.value.trim().toLowerCase() || "";
  const filterStatus = document.getElementById("filter-status")?.value || "";
  const filtered = riskData.filter(risk => {
    const matchCat = filterCategory === "" || (risk.category && risk.category.toLowerCase().includes(filterCategory));
    const matchStatus = filterStatus === "" || risk.status === filterStatus;
    return matchCat && matchStatus;
  });

  tbody.innerHTML = "";

  if (filtered.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="10">
      <div class="empty-state">
        <i data-lucide="shield-off"></i>
        <p><strong>No risks found</strong></p>
        <p>Add a risk to get started, or adjust your filters.</p>
      </div>
    </td>`;
    tbody.appendChild(tr);
    return;
  }

  filtered.forEach(risk => {
    const score = computeScore(risk.severity, risk.probability);
    const lvl = determineLevel(score);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHTML(risk.description)}</td>
      <td>${escapeHTML(risk.owner) || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>${escapeHTML(risk.category) || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td class="center"><span class="score-pill">${risk.severity}</span></td>
      <td class="center"><span class="score-pill">${risk.probability}</span></td>
      <td class="center"><span class="score-pill">${score}</span></td>
      <td class="center"><span class="badge ${lvl.cssClass}">${lvl.level}</span></td>
      <td><span class="status-badge ${getStatusClass(risk.status)}">${escapeHTML(risk.status)}</span></td>
      <td>${risk.nextCheckpoint || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td class="center">
        <button class="action-btn" data-action="edit" data-id="${risk.id}" title="Edit risk"><i data-lucide="pencil"></i></button>
        <button class="action-btn danger" data-action="delete" data-id="${risk.id}" title="Delete risk"><i data-lucide="trash-2"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Attach action handlers
  tbody.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const action = e.currentTarget.getAttribute('data-action');
      const id = e.currentTarget.getAttribute('data-id');
      if (action === 'delete') deleteRisk(id);
      else if (action === 'edit') openEditRisk(id);
    });
  });
}

function deleteRisk(id) {
  const idx = riskData.findIndex(r => r.id === id);
  if (idx === -1) return;
  const [removed] = riskData.splice(idx, 1);
  // Remove from Firestore if logged in
  const user = window.firebase && firebase.auth ? firebase.auth().currentUser : null;
  if (user && removed && removed.id) {
    firebase.firestore()
      .collection("risk_registers")
      .doc(user.uid)
      .collection("risks")
      .doc(removed.id)
      .delete()
      .catch(e => console.error("Failed to delete risk from Firestore:", e));
  }
  persistRisks();
  renderAll();
}

// ----- Dashboard: Stats -----
function renderStats() {
  const totalEl = document.getElementById("stat-total");
  const critEl = document.getElementById("stat-critical");
  const openEl = document.getElementById("stat-open");
  const avgEl = document.getElementById("stat-avg");
  if (!totalEl) return;

  const total = riskData.length;
  const critical = riskData.filter(r => computeScore(r.severity, r.probability) >= 16).length;
  const open = riskData.filter(r => r.status === "Open").length;
  const avg = total > 0
    ? (riskData.reduce((sum, r) => sum + computeScore(r.severity, r.probability), 0) / total).toFixed(1)
    : "0";

  totalEl.textContent = total;
  critEl.textContent = critical;
  openEl.textContent = open;
  avgEl.textContent = avg;
}

// ----- Dashboard: Heatmap -----
function renderHeatMap() {
  const heatmapEl = document.getElementById("heatmap");
  if (!heatmapEl) return;

  // Count risks per (severity, probability) cell
  const counts = {};
  riskData.forEach(r => {
    const key = `${r.severity}-${r.probability}`;
    counts[key] = (counts[key] || 0) + 1;
  });

  function getCellLevel(score) {
    if (score >= 20) return "level-critical";
    if (score >= 12) return "level-high";
    if (score >= 6) return "level-medium";
    return "level-low";
  }

  let html = '<div class="heatmap-container">';

  // Y-axis title
  html += '<div class="heatmap-y-title">Severity</div>';

  // Y-axis labels
  html += '<div class="heatmap-y-axis">';
  for (let sev = 5; sev >= 1; sev--) {
    html += `<div class="heatmap-y-label">${sev}</div>`;
  }
  html += '</div>';

  // Grid
  html += '<div class="heatmap-main">';
  html += '<div class="heatmap-grid">';
  for (let sev = 5; sev >= 1; sev--) {
    for (let prob = 1; prob <= 5; prob++) {
      const score = sev * prob;
      const key = `${sev}-${prob}`;
      const count = counts[key] || 0;
      const levelClass = getCellLevel(score);
      html += `<div class="heatmap-cell ${levelClass}" title="Severity ${sev} × Probability ${prob} = ${score}${count > 0 ? ' (' + count + ' risk' + (count > 1 ? 's' : '') + ')' : ''}">`;
      if (count > 0) {
        html += `<span class="cell-count">${count}</span>`;
      }
      html += `<span class="cell-score">${score}</span>`;
      html += `</div>`;
    }
  }
  html += '</div>';

  // X-axis labels
  html += '<div class="heatmap-x-axis">';
  for (let prob = 1; prob <= 5; prob++) {
    html += `<div class="heatmap-x-label">${prob}</div>`;
  }
  html += '</div>';
  html += '<div class="heatmap-x-title">Probability</div>';
  html += '</div>'; // heatmap-main
  html += '</div>'; // heatmap-container

  heatmapEl.innerHTML = html;
}

// ----- Dashboard: Top 5 -----
function renderTop5() {
  const top5El = document.getElementById("top5");
  if (!top5El) return;

  const sorted = [...riskData]
    .sort((a, b) => computeScore(b.severity, b.probability) - computeScore(a.severity, a.probability))
    .slice(0, 5);

  if (sorted.length === 0) {
    top5El.innerHTML = '<div class="empty-state"><i data-lucide="shield-check"></i><p>No risks yet</p></div>';
    return;
  }

  top5El.innerHTML = "";
  sorted.forEach((risk, idx) => {
    const score = computeScore(risk.severity, risk.probability);
    const lvl = determineLevel(score);
    const li = document.createElement("li");
    li.className = "top5-item";
    li.innerHTML = `
      <span class="top5-rank">${idx + 1}</span>
      <span class="top5-desc">${escapeHTML(risk.description)}</span>
      <span class="top5-score badge ${lvl.cssClass}">${score}</span>
    `;
    top5El.appendChild(li);
  });
}

// ----- Dashboard: Trend -----
function renderTrend() {
  const canvas = document.getElementById("trendChart");
  const wrapper = document.getElementById("trend-wrapper");
  if (!canvas || !wrapper) return;

  if (riskData.length === 0) {
    canvas.style.display = "none";
    // Show empty state
    let emptyEl = wrapper.querySelector('.trend-empty');
    if (!emptyEl) {
      emptyEl = document.createElement("div");
      emptyEl.className = "trend-empty";
      emptyEl.innerHTML = `<i data-lucide="bar-chart-3"></i><p>Add risks to see trend data</p>`;
      wrapper.appendChild(emptyEl);
    }
    if (window.trendChartInstance) {
      window.trendChartInstance.destroy();
      window.trendChartInstance = null;
    }
    return;
  }

  // Remove empty state if present
  const emptyEl = wrapper.querySelector('.trend-empty');
  if (emptyEl) emptyEl.remove();
  canvas.style.display = "block";

  const ctx = canvas.getContext("2d");
  const now = new Date();
  const weeks = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i * 7);
    weeks.push(d.toISOString().slice(0, 10));
  }
  const weeklyAvg = weeks.map(dateStr => {
    const start = new Date(dateStr);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const inWeek = riskData.filter(r => {
      const created = new Date(r.dateCreated || Date.now());
      return created >= start && created < end;
    });
    if (inWeek.length === 0) return 0;
    const total = inWeek.reduce((sum, r) => sum + computeScore(r.severity, r.probability), 0);
    return total / inWeek.length;
  });

  const accentColor = getComputedStyle(document.documentElement).getPropertyValue("--accent-primary").trim() || "#0d9488";
  const accentGlow = getComputedStyle(document.documentElement).getPropertyValue("--accent-primary-glow").trim() || "rgba(13,148,136,0.15)";
  const textColor = getComputedStyle(document.documentElement).getPropertyValue("--text-secondary").trim() || "#475569";
  const gridColor = getComputedStyle(document.documentElement).getPropertyValue("--border-color").trim() || "#e2e8f0";

  if (window.trendChartInstance) {
    window.trendChartInstance.data.labels = weeks;
    window.trendChartInstance.data.datasets[0].data = weeklyAvg;
    window.trendChartInstance.update();
  } else {
    window.trendChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: weeks,
        datasets: [{
          label: "Avg Risk Score",
          data: weeklyAvg,
          borderColor: accentColor,
          backgroundColor: accentGlow,
          tension: 0.4,
          fill: true,
          pointRadius: 5,
          pointBackgroundColor: accentColor,
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500 },
        scales: {
          y: {
            beginAtZero: true,
            max: 25,
            ticks: { color: textColor, font: { size: 11 } },
            grid: { color: gridColor }
          },
          x: {
            ticks: { color: textColor, font: { size: 11 } },
            grid: { color: gridColor }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: true }
        }
      }
    });
  }
}

// ----- Add/Edit Risk Modal -----
function openAddRisk() {
  editingRiskId = null;
  const title = document.getElementById("risk-modal-title");
  if (title) title.textContent = "Add Risk";
  clearRiskForm();
  openModal("risk-modal");
}

function openEditRisk(id) {
  const risk = riskData.find(r => r.id === id);
  if (!risk) return;
  editingRiskId = id;
  const title = document.getElementById("risk-modal-title");
  if (title) title.textContent = "Edit Risk";

  // Populate form
  const desc = document.getElementById("risk-description");
  const owner = document.getElementById("risk-owner");
  const cat = document.getElementById("risk-category");
  const sev = document.getElementById("risk-severity");
  const prob = document.getElementById("risk-probability");
  const ratS = document.getElementById("risk-rationale-severity");
  const ratP = document.getElementById("risk-rationale-probability");
  const mit = document.getElementById("risk-mitigation");
  const blk = document.getElementById("risk-blockers");
  const stat = document.getElementById("risk-status");
  const chk = document.getElementById("risk-checkpoint");

  if (desc) desc.value = risk.description || "";
  if (owner) owner.value = risk.owner || "";
  if (cat) cat.value = risk.category || "";
  if (sev) sev.value = risk.severity || 3;
  if (prob) prob.value = risk.probability || 3;
  if (ratS) ratS.value = risk.rationaleSeverity || "";
  if (ratP) ratP.value = risk.rationaleProbability || "";
  if (mit) mit.value = risk.mitigation || "";
  if (blk) blk.value = risk.blockers || "";
  if (stat) stat.value = risk.status || "Open";
  if (chk) chk.value = risk.nextCheckpoint || "";

  openModal("risk-modal");
}

function clearRiskForm() {
  const form = document.getElementById("risk-form");
  if (form) form.reset();
}

async function saveRisk() {
  const description = document.getElementById("risk-description")?.value.trim();
  if (!description) return;

  const riskObj = {
    description,
    owner: document.getElementById("risk-owner")?.value.trim() || "",
    category: document.getElementById("risk-category")?.value.trim() || "",
    severity: parseInt(document.getElementById("risk-severity")?.value) || 3,
    probability: parseInt(document.getElementById("risk-probability")?.value) || 3,
    rationaleSeverity: document.getElementById("risk-rationale-severity")?.value.trim() || "",
    rationaleProbability: document.getElementById("risk-rationale-probability")?.value.trim() || "",
    mitigation: document.getElementById("risk-mitigation")?.value.trim() || "",
    blockers: document.getElementById("risk-blockers")?.value.trim() || "",
    status: document.getElementById("risk-status")?.value || "Open",
    nextCheckpoint: document.getElementById("risk-checkpoint")?.value || "",
    dateCreated: new Date().toISOString(),
    dateResolved: null
  };

  riskObj.score = computeScore(riskObj.severity, riskObj.probability);
  riskObj.level = determineLevel(riskObj.score).level;

  if (editingRiskId) {
    // Update existing
    const idx = riskData.findIndex(r => r.id === editingRiskId);
    if (idx !== -1) {
      riskObj.id = editingRiskId;
      riskObj.dateCreated = riskData[idx].dateCreated; // Preserve original date
      riskData[idx] = riskObj;
    }
  } else {
    // New risk
    riskObj.id = "risk-" + Date.now();
    riskData.unshift(riskObj);
  }

  await saveRiskToFirestore(riskObj);
  persistRisks();
  renderAll();
  closeModal("risk-modal");
  editingRiskId = null;
}

// ----- Modal Helpers -----
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add("open");
    // Focus first input after animation
    setTimeout(() => {
      const firstInput = modal.querySelector("input, textarea, select");
      if (firstInput) firstInput.focus();
    }, 200);
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove("open");
}

// ----- Init -----
function init() {
  // Add Risk button
  const addBtn = document.getElementById("add-risk-btn");
  if (addBtn) addBtn.addEventListener("click", openAddRisk);

  // Risk modal save/cancel/close
  const saveBtn = document.getElementById("risk-modal-save");
  const cancelBtn = document.getElementById("risk-modal-cancel");
  const closeBtn = document.getElementById("risk-modal-close");
  if (saveBtn) saveBtn.addEventListener("click", saveRisk);
  if (cancelBtn) cancelBtn.addEventListener("click", () => closeModal("risk-modal"));
  if (closeBtn) closeBtn.addEventListener("click", () => closeModal("risk-modal"));

  // Close modal on overlay click
  document.getElementById("risk-modal")?.addEventListener("click", e => {
    if (e.target === e.currentTarget) closeModal("risk-modal");
  });

  // Filter inputs
  const filterCategory = document.getElementById("filter-category");
  const filterStatus = document.getElementById("filter-status");
  if (filterCategory) filterCategory.addEventListener("input", renderRiskList);
  if (filterStatus) filterStatus.addEventListener("change", () => { renderRiskList(); lucide.createIcons(); });

  // Config modal controls
  const configBtn = document.getElementById("config-btn");
  const configModal = document.getElementById("config-modal");
  const configCancel = document.getElementById("config-cancel");
  const configClose = document.getElementById("config-modal-close");
  const configSave = document.getElementById("config-save");

  if (configBtn) configBtn.addEventListener("click", () => openModal("config-modal"));
  if (configCancel) configCancel.addEventListener("click", () => closeModal("config-modal"));
  if (configClose) configClose.addEventListener("click", () => closeModal("config-modal"));
  if (configModal) configModal.addEventListener("click", e => {
    if (e.target === e.currentTarget) closeModal("config-modal");
  });

  if (configSave) {
    configSave.addEventListener("click", () => {
      const sevDefs = document.getElementById("severity-defs").value.trim();
      const probDefs = document.getElementById("probability-defs").value.trim();
      const parseDefs = txt => {
        const obj = {};
        txt.split(",").forEach(pair => {
          const [k, v] = pair.split(":").map(s => s.trim());
          if (k && v) obj[parseInt(k)] = v;
        });
        return obj;
      };
      if (sevDefs) Object.assign(SEVERITY_DEFINITIONS, parseDefs(sevDefs));
      if (probDefs) Object.assign(PROBABILITY_DEFINITIONS, parseDefs(probDefs));
      closeModal("config-modal");
    });
  }

  // View toggle buttons
  const editViewBtn = document.getElementById('edit-view-btn');
  const dashViewBtn = document.getElementById('dashboard-view-btn');
  if (editViewBtn) editViewBtn.addEventListener('click', () => switchView('edit'));
  if (dashViewBtn) dashViewBtn.addEventListener('click', () => switchView('dashboard'));
  // Initialize default view
  switchView('edit');

  // Load data
  getCurrentUser().then(user => {
    if (user) {
      loadRisksFromFirestore().then(data => {
        riskData = data;
        ensureSampleRisk();
        renderAll();
      });
    } else {
      riskData = loadRisksFromLocal();
      ensureSampleRisk();
      renderAll();
    }
  });
}

function ensureSampleRisk() {
  if (riskData.length === 0) {
    const dummyRisk = {
      id: 'dummy-' + Date.now(),
      description: 'Sample Risk – Edit or delete this entry',
      owner: 'Owner Name',
      category: 'General',
      severity: 3,
      probability: 3,
      rationaleSeverity: '',
      rationaleProbability: '',
      mitigation: '',
      blockers: '',
      status: 'Open',
      nextCheckpoint: '',
      dateCreated: new Date().toISOString(),
      dateResolved: null
    };
    riskData.push(dummyRisk);
    persistRisks();
  }
}

// ----- Export / Import / Share -----
function exportJSON() {
  const data = { risks: riskData };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'risk_register.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (data && Array.isArray(data.risks)) {
        riskData = data.risks;
        persistRisks();
        renderAll();
      } else {
        console.warn('Invalid JSON format for risk data');
      }
    } catch (err) {
      console.error('Error parsing imported JSON', err);
    }
  };
  reader.readAsText(file);
  // Reset input so the same file can be re-imported
  event.target.value = "";
}

function shareLink() {
  const link = window.location.href;
  navigator.clipboard.writeText(link)
    .then(() => {
      alert('Link copied to clipboard');
    })
    .catch(err => {
      console.error('Failed to copy link', err);
    });
}

document.addEventListener("DOMContentLoaded", init);
