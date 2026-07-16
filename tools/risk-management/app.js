// risk-management/app.js

// Register the tool with the global project manager before DOMContentLoaded.
// (project-manager.js defers boot, but top-level registration is still safest.)
window.projectManagerConfig = {
  toolId: "risk-management",
  getInputs: () => ({ risks: riskData }),
  setInputs: (data) => {
    if (data && Array.isArray(data.risks)) {
      replaceRiskData(data.risks);
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

// Shared risk-score thresholds (table badges + heatmap cells)
// CRITICAL ≥ 16, HIGH ≥ 12, MEDIUM ≥ 6, else LOW
const RISK_THRESHOLDS = { critical: 16, high: 12, medium: 6 };

// ----- State -----
let riskData = [];
let editingRiskId = null;
let authListenerAttached = false;
let loadedFromShareLink = false;
let readOnlyShareMode = false;
let activeRegisterId = localStorage.getItem("riskManagementActiveRegister") || "default";
let heatmapMode = sessionStorage.getItem("riskHeatmapMode") || "inherent"; // inherent | residual

// ----- Firebase Helpers -----
async function getCurrentUser() {
  // Prefer fbHelper which waits for the first auth state event
  if (window.fbHelper && window.fbHelper.isConfigured()) {
    try {
      return await window.fbHelper.getUser();
    } catch (_) { /* fall through */ }
  }
  if (window.firebase && firebase.auth && firebase.auth().currentUser) {
    return firebase.auth().currentUser;
  }
  return null;
}

function risksCollection(user) {
  return firebase.firestore()
    .collection("risk_registers")
    .doc(user.uid)
    .collection("risks");
}

async function loadRisksFromFirestore() {
  const user = await getCurrentUser();
  if (!user) return [];
  try {
    const snap = await risksCollection(user).orderBy("dateCreated", "desc").get();
    const arr = [];
    snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
    return arr;
  } catch (e) {
    console.warn("Failed to load risks from Firestore", e);
    // Fallback without orderBy if index is missing
    try {
      const user2 = await getCurrentUser();
      if (!user2) return [];
      const snap = await risksCollection(user2).get();
      const arr = [];
      snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      arr.sort((a, b) => new Date(b.dateCreated || 0) - new Date(a.dateCreated || 0));
      return arr;
    } catch (e2) {
      console.warn("Firestore risk load fallback failed", e2);
      return [];
    }
  }
}

async function saveRiskToFirestore(risk) {
  const user = await getCurrentUser();
  if (!user) return;
  try {
    const col = risksCollection(user);
    if (risk.id) {
      await col.doc(String(risk.id)).set(risk, { merge: true });
    } else {
      const docRef = await col.add(risk);
      risk.id = docRef.id;
    }
  } catch (e) {
    console.error("Failed to save risk", e);
  }
}

async function deleteRiskFromFirestore(id) {
  const user = await getCurrentUser();
  if (!user || !id) return;
  try {
    await risksCollection(user).doc(String(id)).delete();
  } catch (e) {
    console.error("Failed to delete risk from Firestore:", e);
  }
}

/**
 * Bulk-replace Firestore risks so import / PM load / migrate stay in sync.
 * Deletes docs not present in the new set, then upserts each risk.
 */
async function bulkWriteRisksToFirestore(risks) {
  const user = await getCurrentUser();
  if (!user) return;
  try {
    const col = risksCollection(user);
    const existing = await col.get();
    const keepIds = new Set(risks.map(r => String(r.id)).filter(Boolean));
    const toDelete = [];
    existing.forEach(doc => {
      if (!keepIds.has(doc.id)) toDelete.push(doc.ref);
    });

    const CHUNK = 450;
    for (let i = 0; i < toDelete.length; i += CHUNK) {
      const batch = firebase.firestore().batch();
      toDelete.slice(i, i + CHUNK).forEach(ref => batch.delete(ref));
      await batch.commit();
    }

    for (let i = 0; i < risks.length; i += CHUNK) {
      const batch = firebase.firestore().batch();
      const slice = risks.slice(i, i + CHUNK);
      slice.forEach(risk => {
        if (!risk.id) risk.id = "risk-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
        batch.set(col.doc(String(risk.id)), risk, { merge: true });
      });
      await batch.commit();
    }
  } catch (e) {
    console.error("Failed to bulk-write risks to Firestore", e);
  }
}

// ----- Local Storage Fallback -----
function registerStorageKey(regId) {
  const id = regId || activeRegisterId || "default";
  return id === "default" ? "riskManagementRisks" : `riskManagementRisks__${id}`;
}

function listRegisters() {
  try {
    const raw = localStorage.getItem("riskManagementRegisters");
    const list = raw ? JSON.parse(raw) : [];
    if (!list.find(r => r.id === "default")) {
      list.unshift({ id: "default", name: "Default Register" });
    }
    return list;
  } catch (_) {
    return [{ id: "default", name: "Default Register" }];
  }
}

function saveRegisterList(list) {
  localStorage.setItem("riskManagementRegisters", JSON.stringify(list));
}

function loadRisksFromLocal() {
  try {
    const json = localStorage.getItem(registerStorageKey());
    return json ? JSON.parse(json) : [];
  } catch (_) {
    return [];
  }
}

function clearLocalRisks() {
  localStorage.removeItem(registerStorageKey());
}

/**
 * Persist current riskData to the appropriate backend.
 * Logged out → localStorage. Logged in → full Firestore sync (not no-op).
 */
async function persistRisks() {
  const user = await getCurrentUser();
  if (!user) {
    localStorage.setItem(registerStorageKey(), JSON.stringify(riskData));
    return;
  }
  // Cloud path still uses per-user risk_registers; register id stored on each doc
  riskData.forEach(r => { r.registerId = activeRegisterId; });
  await bulkWriteRisksToFirestore(riskData);
}

/** Replace in-memory register and persist (used by PM setInputs + import). */
async function replaceRiskData(risks) {
  riskData = Array.isArray(risks) ? risks.map(normalizeRisk) : [];
  await persistRisks();
  renderAll();
}

function hasResidual(r) {
  const s = parseInt(r.residualSeverity, 10);
  const p = parseInt(r.residualProbability, 10);
  return !!(s && p);
}

function residualScore(r) {
  if (!hasResidual(r)) return null;
  return parseInt(r.residualSeverity, 10) * parseInt(r.residualProbability, 10);
}

/** Score used for matrix / ranking when residual mode is on. */
function effectiveScore(r, mode) {
  if (mode === "residual" && hasResidual(r)) return residualScore(r);
  return computeScore(r.severity, r.probability);
}

function parseJiraKey(url) {
  if (!url) return null;
  const m = String(url).match(/\b([A-Z][A-Z0-9]+-\d+)\b/);
  return m ? m[1] : null;
}

function isValidHttpUrl(str) {
  if (!str) return true;
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch (_) {
    return false;
  }
}

function normalizeRisk(r) {
  if (!r || typeof r !== "object") return r;
  const score = computeScore(r.severity, r.probability);
  const resScore = residualScore(r);
  return {
    ...r,
    id: r.id || ("risk-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8)),
    score,
    residualScore: resScore,
    level: determineLevel(score).level,
    residualLevel: resScore != null ? determineLevel(resScore).level : null,
    registerId: r.registerId || activeRegisterId,
    jiraLink: r.jiraLink || "",
    jiraKey: r.jiraKey || parseJiraKey(r.jiraLink) || ""
  };
}

// ----- Utility -----
function computeScore(severity, probability) {
  const s = parseInt(severity) || 0;
  const p = parseInt(probability) || 0;
  return s * p;
}

function determineLevel(score) {
  if (score >= RISK_THRESHOLDS.critical) {
    return { level: "CRITICAL", color: "#e11d48", cssClass: "badge-critical" };
  }
  if (score >= RISK_THRESHOLDS.high) {
    return { level: "HIGH", color: "#ef4444", cssClass: "badge-high" };
  }
  if (score >= RISK_THRESHOLDS.medium) {
    return { level: "MEDIUM", color: "#f59e0b", cssClass: "badge-medium" };
  }
  return { level: "LOW", color: "#10b981", cssClass: "badge-low" };
}

function getCellLevel(score) {
  if (score >= RISK_THRESHOLDS.critical) return "level-critical";
  if (score >= RISK_THRESHOLDS.high) return "level-high";
  if (score >= RISK_THRESHOLDS.medium) return "level-medium";
  return "level-low";
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
    tr.innerHTML = `<td colspan="12">
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
    const res = residualScore(risk);
    const lvl = determineLevel(score);
    const resLvl = res != null ? determineLevel(res) : null;
    const delta = res != null ? (score - res) : null;
    const jiraKey = risk.jiraKey || parseJiraKey(risk.jiraLink);
    const linkHtml = risk.jiraLink
      ? `<a href="${escapeHTML(risk.jiraLink)}" target="_blank" rel="noopener" title="${escapeHTML(risk.jiraLink)}" style="color:var(--accent-primary);">${escapeHTML(jiraKey || "Open")}</a>`
      : '<span style="color:var(--text-muted)">—</span>';
    const resCell = res != null
      ? `<span class="badge ${resLvl.cssClass}" title="Residual ${resLvl.level}${delta != null ? " · Δ " + delta : ""}">${res}</span>`
      : '<span style="color:var(--text-muted)">—</span>';
    const actions = readOnlyShareMode
      ? `<span style="color:var(--text-muted);font-size:11px;">view</span>`
      : `<button class="action-btn" data-action="edit" data-id="${risk.id}" title="Edit risk"><i data-lucide="pencil"></i></button>
        <button class="action-btn danger" data-action="delete" data-id="${risk.id}" title="Delete risk"><i data-lucide="trash-2"></i></button>`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHTML(risk.description)}</td>
      <td>${escapeHTML(risk.owner) || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>${escapeHTML(risk.category) || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td class="center"><span class="score-pill">${risk.severity}</span></td>
      <td class="center"><span class="score-pill">${risk.probability}</span></td>
      <td class="center"><span class="score-pill">${score}</span></td>
      <td class="center">${resCell}</td>
      <td class="center"><span class="badge ${lvl.cssClass}">${lvl.level}</span></td>
      <td>${linkHtml}</td>
      <td><span class="status-badge ${getStatusClass(risk.status)}">${escapeHTML(risk.status)}</span></td>
      <td>${risk.nextCheckpoint ? escapeHTML(risk.nextCheckpoint) : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td class="center">${actions}</td>
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

async function deleteRisk(id) {
  const idx = riskData.findIndex(r => String(r.id) === String(id));
  if (idx === -1) return;
  const [removed] = riskData.splice(idx, 1);
  if (removed && removed.id) {
    await deleteRiskFromFirestore(removed.id);
  }
  // Keep localStorage in sync when logged out
  const user = await getCurrentUser();
  if (!user) {
    localStorage.setItem(registerStorageKey(), JSON.stringify(riskData));
  }
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
  const critical = riskData.filter(r => computeScore(r.severity, r.probability) >= RISK_THRESHOLDS.critical).length;
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

  // Count risks per (severity, probability) cell — inherent or residual
  const counts = {};
  riskData.forEach(r => {
    let sev, prob;
    if (heatmapMode === "residual" && hasResidual(r)) {
      sev = parseInt(r.residualSeverity, 10);
      prob = parseInt(r.residualProbability, 10);
    } else {
      sev = r.severity;
      prob = r.probability;
    }
    const key = `${sev}-${prob}`;
    counts[key] = (counts[key] || 0) + 1;
  });

  let html = `<div style="display:flex;justify-content:flex-end;gap:6px;margin-bottom:8px;">
    <button type="button" class="btn-secondary heatmap-mode-btn${heatmapMode === "inherent" ? " active" : ""}" data-hm="inherent" style="font-size:11px;padding:4px 10px;${heatmapMode === "inherent" ? "border-color:var(--accent-primary);color:var(--accent-primary);" : ""}">Inherent</button>
    <button type="button" class="btn-secondary heatmap-mode-btn${heatmapMode === "residual" ? " active" : ""}" data-hm="residual" style="font-size:11px;padding:4px 10px;${heatmapMode === "residual" ? "border-color:var(--accent-primary);color:var(--accent-primary);" : ""}">Residual</button>
  </div>`;
  html += '<div class="heatmap-container">';

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
  heatmapEl.querySelectorAll(".heatmap-mode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      heatmapMode = btn.getAttribute("data-hm") || "inherent";
      try { sessionStorage.setItem("riskHeatmapMode", heatmapMode); } catch (_) {}
      renderHeatMap();
      renderTop5();
    });
  });
}

// ----- Dashboard: Top 5 -----
function renderTop5() {
  const top5El = document.getElementById("top5");
  if (!top5El) return;

  const sorted = [...riskData]
    .sort((a, b) => effectiveScore(b, heatmapMode) - effectiveScore(a, heatmapMode))
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
  const resS = document.getElementById("risk-residual-severity");
  const resP = document.getElementById("risk-residual-probability");
  const jira = document.getElementById("risk-jira-link");
  if (resS) resS.value = risk.residualSeverity || "";
  if (resP) resP.value = risk.residualProbability || "";
  if (jira) jira.value = risk.jiraLink || "";

  openModal("risk-modal");
}

function clearRiskForm() {
  const form = document.getElementById("risk-form");
  if (form) form.reset();
}

async function saveRisk() {
  const description = document.getElementById("risk-description")?.value.trim();
  if (!description) return;

  const resSevRaw = document.getElementById("risk-residual-severity")?.value;
  const resProbRaw = document.getElementById("risk-residual-probability")?.value;
  const riskObj = {
    description,
    owner: document.getElementById("risk-owner")?.value.trim() || "",
    category: document.getElementById("risk-category")?.value.trim() || "",
    severity: parseInt(document.getElementById("risk-severity")?.value) || 3,
    probability: parseInt(document.getElementById("risk-probability")?.value) || 3,
    residualSeverity: resSevRaw ? parseInt(resSevRaw, 10) : null,
    residualProbability: resProbRaw ? parseInt(resProbRaw, 10) : null,
    rationaleSeverity: document.getElementById("risk-rationale-severity")?.value.trim() || "",
    rationaleProbability: document.getElementById("risk-rationale-probability")?.value.trim() || "",
    mitigation: document.getElementById("risk-mitigation")?.value.trim() || "",
    blockers: document.getElementById("risk-blockers")?.value.trim() || "",
    jiraLink: document.getElementById("risk-jira-link")?.value.trim() || "",
    status: document.getElementById("risk-status")?.value || "Open",
    nextCheckpoint: document.getElementById("risk-checkpoint")?.value || "",
    registerId: activeRegisterId,
    dateCreated: new Date().toISOString(),
    dateResolved: null
  };

  if (riskObj.jiraLink && !isValidHttpUrl(riskObj.jiraLink)) {
    if (window.showToast) window.showToast("Jira link looks invalid — saved anyway. Use https://…", false);
  }
  riskObj.jiraKey = parseJiraKey(riskObj.jiraLink) || "";
  riskObj.score = computeScore(riskObj.severity, riskObj.probability);
  riskObj.level = determineLevel(riskObj.score).level;
  riskObj.residualScore = residualScore(riskObj);
  riskObj.residualLevel = riskObj.residualScore != null ? determineLevel(riskObj.residualScore).level : null;

  if (readOnlyShareMode) {
    if (window.showToast) window.showToast("Shared register is read-only. Import it first to edit.", false);
    return;
  }

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

  // Single-risk write when signed in; full local dump when signed out
  const user = await getCurrentUser();
  if (user) {
    await saveRiskToFirestore(riskObj);
  } else {
    localStorage.setItem(registerStorageKey(), JSON.stringify(riskData));
  }
  try { if (window.ETAnalytics) window.ETAnalytics.trackEngaged("risk-management"); } catch (_) {}
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

  // Multi-register + matrix export
  populateRegisterSelect();
  document.getElementById("risk-register-select")?.addEventListener("change", onRegisterChange);
  document.getElementById("new-register-btn")?.addEventListener("click", createNewRegister);
  document.getElementById("export-matrix-btn")?.addEventListener("click", exportRiskMatrixPdf);

  // Load data (wait for auth; migrate local → cloud on sign-in)
  loadInitialRiskData();
  attachAuthListener();
}

function populateRegisterSelect() {
  const sel = document.getElementById("risk-register-select");
  if (!sel) return;
  const list = listRegisters();
  sel.innerHTML = list.map(r =>
    `<option value="${escapeHTML(r.id)}" ${r.id === activeRegisterId ? "selected" : ""}>${escapeHTML(r.name)}</option>`
  ).join("");
}

async function onRegisterChange(e) {
  const next = e.target.value || "default";
  if (next === activeRegisterId) return;
  // Persist current register before switching
  await persistRisks();
  activeRegisterId = next;
  localStorage.setItem("riskManagementActiveRegister", activeRegisterId);
  riskData = loadRisksFromLocal();
  ensureSampleRisk(false);
  renderAll();
  if (window.showToast) window.showToast(`Switched to register: ${next}`);
}

async function createNewRegister() {
  const name = prompt("Name for the new risk register (e.g. Plant A / Site B):");
  if (!name || !name.trim()) return;
  const id = "reg-" + Date.now().toString(36);
  const list = listRegisters();
  list.push({ id, name: name.trim() });
  saveRegisterList(list);
  await persistRisks();
  activeRegisterId = id;
  localStorage.setItem("riskManagementActiveRegister", activeRegisterId);
  riskData = [];
  ensureSampleRisk(false);
  populateRegisterSelect();
  renderAll();
  if (window.showToast) window.showToast(`Created register "${name.trim()}"`);
}

function exportRiskMatrixPdf() {
  const regName = listRegisters().find(r => r.id === activeRegisterId)?.name || activeRegisterId;
  // Build 5x5 counts for inherent + residual
  const inherent = {};
  const residual = {};
  riskData.forEach(r => {
    const ik = `${r.severity}-${r.probability}`;
    inherent[ik] = (inherent[ik] || 0) + 1;
    const rs = parseInt(r.residualSeverity, 10) || r.severity;
    const rp = parseInt(r.residualProbability, 10) || r.probability;
    const rk = `${rs}-${rp}`;
    residual[rk] = (residual[rk] || 0) + 1;
  });

  const cell = (map, s, p) => map[`${s}-${p}`] || 0;
  const gridHtml = (map, title) => {
    let rows = "";
    for (let s = 5; s >= 1; s--) {
      rows += "<tr>";
      rows += `<td style="font-weight:700;padding:6px;">S${s}</td>`;
      for (let p = 1; p <= 5; p++) {
        const sc = s * p;
        const bg = sc >= 16 ? "#fecdd3" : sc >= 12 ? "#fed7aa" : sc >= 6 ? "#fef08a" : "#bbf7d0";
        rows += `<td style="text-align:center;padding:10px;background:${bg};border:1px solid #e2e8f0;">${cell(map, s, p) || "·"}</td>`;
      }
      rows += "</tr>";
    }
    return `<h2>${title}</h2>
      <table style="border-collapse:collapse;margin-bottom:20px;">
        <tr><td></td><td class="c">P1</td><td class="c">P2</td><td class="c">P3</td><td class="c">P4</td><td class="c">P5</td></tr>
        ${rows}
      </table>`;
  };

  const tableRows = riskData.map(r => {
    const res = residualScore(r);
    return `<tr>
      <td>${escapeHTML(r.description)}</td>
      <td>${escapeHTML(r.owner || "")}</td>
      <td>${escapeHTML(r.category || "")}</td>
      <td style="text-align:center">${r.severity}×${r.probability}=${computeScore(r.severity, r.probability)}</td>
      <td style="text-align:center">${res}</td>
      <td>${escapeHTML(r.status || "")}</td>
      <td>${r.jiraLink ? `<a href="${escapeHTML(r.jiraLink)}">${escapeHTML(r.jiraLink)}</a>` : ""}</td>
    </tr>`;
  }).join("");

  const w = window.open("", "_blank");
  if (!w) {
    alert("Pop-up blocked — allow pop-ups for matrix PDF export.");
    return;
  }
  w.document.write(`<!DOCTYPE html><html><head><title>Risk Matrix — ${escapeHTML(regName)}</title>
    <style>
      body{font-family:system-ui,sans-serif;margin:24px;color:#0f172a}
      h1{font-size:20px;margin:0 0 4px}
      .meta{color:#64748b;font-size:12px;margin-bottom:16px}
      table.data{width:100%;border-collapse:collapse;font-size:12px}
      table.data th,table.data td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}
      table.data th{background:#f8fafc}
      .c{text-align:center;font-weight:600;padding:6px}
      @media print{.noprint{display:none}}
    </style></head><body>
    <button class="noprint" onclick="window.print()" style="padding:8px 14px;margin-bottom:16px;cursor:pointer">Print / Save as PDF</button>
    <h1>Risk Matrix Report</h1>
    <div class="meta">Register: ${escapeHTML(regName)} · ${riskData.length} risks · ${new Date().toLocaleString()}</div>
    ${gridHtml(inherent, "Inherent Risk Matrix (count per cell)")}
    ${gridHtml(residual, "Residual Risk Matrix (after mitigation)")}
    <h2>Risk Register</h2>
    <table class="data">
      <thead><tr><th>Description</th><th>Owner</th><th>Category</th><th>Inherent</th><th>Residual</th><th>Status</th><th>Link</th></tr></thead>
      <tbody>${tableRows || "<tr><td colspan=7>No risks</td></tr>"}</tbody>
    </table>
    </body></html>`);
  w.document.close();
}

async function loadInitialRiskData() {
  // Shared URL payload already applied before init — keep it and persist
  if (loadedFromShareLink && riskData.length > 0) {
    await persistRisks();
    renderAll();
    return;
  }
  const user = await getCurrentUser();
  if (user) {
    await hydrateFromCloud(user);
  } else {
    riskData = loadRisksFromLocal();
    ensureSampleRisk(false);
    renderAll();
  }
}

function attachAuthListener() {
  if (authListenerAttached) return;
  if (!window.fbHelper || !window.fbHelper.isConfigured()) return;
  authListenerAttached = true;
  window.fbHelper.onAuthStateChange(async (user) => {
    // Avoid clobbering an in-progress share-link import on the first auth event
    if (loadedFromShareLink) {
      loadedFromShareLink = false;
      if (user) await persistRisks();
      return;
    }
    if (user) {
      await hydrateFromCloud(user);
    } else {
      riskData = loadRisksFromLocal();
      ensureSampleRisk(false);
      renderAll();
    }
  });
}

/**
 * Load cloud risks; if empty and local has data, migrate local → Firestore once.
 */
async function hydrateFromCloud(user) {
  let cloud = await loadRisksFromFirestore();
  const local = loadRisksFromLocal();
  // Prefer non-sample local data when cloud is empty (first sign-in migration)
  const localReal = local.filter(r => r && r.id && !String(r.id).startsWith("dummy-"));
  if (cloud.length === 0 && localReal.length > 0) {
    riskData = localReal.map(normalizeRisk);
    await bulkWriteRisksToFirestore(riskData);
    clearLocalRisks();
  } else {
    riskData = cloud;
    ensureSampleRisk(true); // in-memory only when signed in + empty
  }
  renderAll();
}

function ensureSampleRisk(skipPersist) {
  if (riskData.length === 0) {
    const dummyRisk = normalizeRisk({
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
    });
    riskData.push(dummyRisk);
    // Never auto-write the sample risk to Firestore
    if (!skipPersist) {
      localStorage.setItem(registerStorageKey(), JSON.stringify(riskData));
    }
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
  reader.onload = async e => {
    try {
      const data = JSON.parse(e.target.result);
      if (data && Array.isArray(data.risks)) {
        await replaceRiskData(data.risks);
        if (window.showToast) window.showToast("Risk register imported.");
      } else {
        console.warn('Invalid JSON format for risk data');
        alert("Invalid risk register file (expected { risks: [...] }).");
      }
    } catch (err) {
      console.error('Error parsing imported JSON', err);
      alert("Failed to import risk register: " + err.message);
    }
  };
  reader.readAsText(file);
  // Reset input so the same file can be re-imported
  event.target.value = "";
}

function shareLink() {
  try {
    const encode = window.encodeShareState || ((obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))));
    const reg = listRegisters().find(r => r.id === activeRegisterId);
    const payload = {
      v: 2,
      mode: "readonly",
      registerName: reg ? reg.name : "Shared Register",
      risks: riskData
    };
    const serialized = encode(payload);
    const url = new URL(window.location.href);
    url.searchParams.set("design", serialized);
    navigator.clipboard.writeText(url.toString())
      .then(() => {
        try { if (window.ETAnalytics) window.ETAnalytics.track("share_copy"); } catch (_) {}
        if (window.showToast) window.showToast("Read-only share link copied.");
        else alert("Link copied to clipboard");
      })
      .catch(() => {
        prompt("Copy this share link:", url.toString());
      });
  } catch (err) {
    console.error("Failed to create share link", err);
    alert("Failed to create share link: " + err.message);
  }
}

function applyReadOnlyChrome() {
  if (!readOnlyShareMode) return;
  let banner = document.getElementById("risk-readonly-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "risk-readonly-banner";
    banner.style.cssText = "background:rgba(13,148,136,0.12);border-bottom:1px solid var(--accent-primary);padding:10px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:13px;";
    banner.innerHTML = `
      <span><strong>Viewing shared register (read-only).</strong> Import a copy to edit in your workspace.</span>
      <button type="button" id="risk-import-share-btn" class="btn-primary" style="padding:6px 12px;font-size:12px;">Import to my registers</button>
    `;
    const main = document.querySelector("main.page-content") || document.body;
    main.insertBefore(banner, main.firstChild);
    document.getElementById("risk-import-share-btn")?.addEventListener("click", async () => {
      const name = prompt("Name for imported register:", "Imported register");
      if (!name) return;
      const id = "reg_" + Date.now().toString(36);
      const list = listRegisters();
      list.push({ id, name: name.trim() });
      saveRegisterList(list);
      activeRegisterId = id;
      localStorage.setItem("riskManagementActiveRegister", id);
      readOnlyShareMode = false;
      loadedFromShareLink = false;
      banner.remove();
      await persistRisks();
      document.getElementById("add-risk-btn")?.removeAttribute("disabled");
      if (window.showToast) window.showToast(`Imported as "${name.trim()}"`);
      renderAll();
      // Refresh register select if present
      const sel = document.getElementById("risk-register-select");
      if (sel) {
        sel.innerHTML = list.map(r => `<option value="${r.id}" ${r.id === id ? "selected" : ""}>${escapeHTML(r.name)}</option>`).join("");
      }
    });
  }
  document.getElementById("add-risk-btn")?.setAttribute("disabled", "true");
  document.getElementById("new-register-btn")?.setAttribute("disabled", "true");
}

function compareRegisters() {
  const regs = listRegisters();
  if (regs.length < 2) {
    if (window.showToast) window.showToast("Create at least two registers to compare.", false);
    return;
  }
  const aId = prompt(`Compare — enter first register id:\n${regs.map(r => r.id + " = " + r.name).join("\n")}`, regs[0].id);
  if (!aId) return;
  const bId = prompt(`Second register id:`, regs[1].id);
  if (!bId) return;

  const loadReg = (id) => {
    try {
      const raw = localStorage.getItem(registerStorageKey(id));
      return raw ? JSON.parse(raw).map(normalizeRisk) : [];
    } catch (_) { return []; }
  };
  // Active register may be in memory
  const aRisks = aId === activeRegisterId ? riskData : loadReg(aId);
  const bRisks = bId === activeRegisterId ? riskData : loadReg(bId);
  const aName = (regs.find(r => r.id === aId) || {}).name || aId;
  const bName = (regs.find(r => r.id === bId) || {}).name || bId;

  const stats = (arr) => {
    const scores = arr.map(r => computeScore(r.severity, r.probability));
    const resScores = arr.map(r => residualScore(r)).filter(s => s != null);
    return {
      n: arr.length,
      avg: scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "0",
      crit: scores.filter(s => s >= RISK_THRESHOLDS.critical).length,
      avgRes: resScores.length ? (resScores.reduce((a, b) => a + b, 0) / resScores.length).toFixed(1) : "—"
    };
  };
  const sa = stats(aRisks);
  const sb = stats(bRisks);
  const top = (arr) => [...arr].sort((x, y) => computeScore(y.severity, y.probability) - computeScore(x.severity, x.probability)).slice(0, 5);

  let overlay = document.getElementById("risk-compare-modal");
  if (overlay) overlay.remove();
  overlay = document.createElement("div");
  overlay.id = "risk-compare-modal";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(9,13,22,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;";
  overlay.innerHTML = `
    <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:14px;max-width:720px;width:100%;max-height:90vh;overflow:auto;padding:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <h3 style="margin:0;font-size:16px;">Register compare</h3>
        <button type="button" id="risk-compare-close" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text-secondary);">&times;</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div style="padding:12px;border:1px solid var(--border-color);border-radius:10px;">
          <div style="font-weight:700;margin-bottom:8px;">${escapeHTML(aName)}</div>
          <div style="font-size:12px;color:var(--text-secondary);">Risks: ${sa.n}<br>Avg score: ${sa.avg}<br>Critical: ${sa.crit}<br>Avg residual: ${sa.avgRes}</div>
        </div>
        <div style="padding:12px;border:1px solid var(--border-color);border-radius:10px;">
          <div style="font-weight:700;margin-bottom:8px;">${escapeHTML(bName)}</div>
          <div style="font-size:12px;color:var(--text-secondary);">Risks: ${sb.n}<br>Avg score: ${sb.avg}<br>Critical: ${sb.crit}<br>Avg residual: ${sb.avgRes}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:12px;">
        <div><strong>Top ${escapeHTML(aName)}</strong><ol style="margin:8px 0 0 18px;padding:0;">${top(aRisks).map(r => `<li>${escapeHTML(r.description)} (${computeScore(r.severity, r.probability)})</li>`).join("") || "<li>—</li>"}</ol></div>
        <div><strong>Top ${escapeHTML(bName)}</strong><ol style="margin:8px 0 0 18px;padding:0;">${top(bRisks).map(r => `<li>${escapeHTML(r.description)} (${computeScore(r.severity, r.probability)})</li>`).join("") || "<li>—</li>"}</ol></div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  document.getElementById("risk-compare-close")?.addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
}

window.shareLink = shareLink;
window.exportJSON = exportJSON;
window.importJSON = importJSON;
window.compareRegisters = compareRegisters;

document.addEventListener("DOMContentLoaded", () => {
  // Apply shared URL state before first paint of the register
  try {
    const params = new URLSearchParams(window.location.search);
    const design = params.get("design");
    if (design) {
      const decode = window.decodeShareState || ((str) => JSON.parse(decodeURIComponent(escape(atob(str)))));
      const decoded = decode(design);
      if (decoded && Array.isArray(decoded.risks)) {
        riskData = decoded.risks.map(normalizeRisk);
        loadedFromShareLink = true;
        // v2 readonly by default; legacy shares without mode stay editable import-only via flag
        readOnlyShareMode = decoded.mode !== "edit";
      }
    }
  } catch (err) {
    console.error("Failed to load shared risk design:", err);
  }
  init();
  if (readOnlyShareMode) applyReadOnlyChrome();
  document.getElementById("compare-registers-btn")?.addEventListener("click", compareRegisters);
});
