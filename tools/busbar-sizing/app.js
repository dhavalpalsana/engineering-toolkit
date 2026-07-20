// ================================================================
//  PHYSICS — pure engine in js/physics.js (BusbarPhysics)
// ================================================================
const MAT = (typeof BusbarPhysics !== 'undefined' && BusbarPhysics.MAT) ? BusbarPhysics.MAT : {};
const MU0 = (typeof BusbarPhysics !== 'undefined') ? BusbarPhysics.MU0 : (4 * Math.PI * 1e-7);
const SIGMA_SB = (typeof BusbarPhysics !== 'undefined') ? BusbarPhysics.SIGMA_SB : 5.67e-8;
const KAPPA = (typeof BusbarPhysics !== 'undefined') ? BusbarPhysics.KAPPA : 1.8;
const K_N = (typeof BusbarPhysics !== 'undefined') ? BusbarPhysics.K_N : { 1: 1, 2: 1.8, 3: 2.5, 4: 3.2 };

const $ = id => document.getElementById(id);
const gv = id => parseFloat($(id).value);

function skinFactor(T_m, rho, f) {
  return BusbarPhysics.skinFactor(T_m, rho, f);
}

function runCalc() {
  return BusbarPhysics.runCalc({
    W_mm: gv('inp-W'),
    T_mm: gv('inp-T'),
    L: gv('inp-L'),
    N: parseInt($('inp-N').value, 10),
    span: gv('inp-span'),
    mat: $('inp-mat').value,
    eps: gv('inp-emis'),
    orient: $('inp-orient').value,
    acdc: $('inp-acdc').value,
    f: gv('inp-freq'),
    Tamb: gv('inp-Tamb'),
    dT: gv('inp-dT'),
    V_sys: gv('inp-V'),
    Isc_kA: gv('inp-Isc'),
    tf: gv('inp-tf'),
    d_mm: gv('inp-d'),
    cooling: $('inp-cooling').value,
    vel: gv('inp-vel')
  });
}

// ================================================================
//  RENDER RESULTS
// ================================================================
function fmt(v, dec=2) {
  if (!isFinite(v) || isNaN(v)) return '—';
  return v.toPrecision ? parseFloat(v.toFixed(dec)).toString() : v;
}
function sci(v, dec=3) {
  if (!isFinite(v) || isNaN(v)) return '—';
  if (Math.abs(v) < 1e-3 || Math.abs(v) >= 1e6) return v.toExponential(dec);
  return fmt(v, dec);
}
function badge(cls, icon_path, text) {
  return `<span class="status-badge ${cls}"><svg viewBox="0 0 24 24"><path d="${icon_path}"></path></svg>${text}</span>`;
}
const ICONS = {
  check: 'M20 6 9 17l-5-5',
  warn:  'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  x:     'M18 6 6 18M6 6l12 12'
};

function renderSVG(r) {
  const svg = $('busbar-svg');
  const VW = 380, VH = 140;

  // Set dimensions based on orientation
  let barW_mm, barH_mm;
  if (r.orient === 'vertical') {
    barW_mm = r.T_mm; // thickness is horizontal
    barH_mm = r.W_mm; // width is vertical
  } else {
    barW_mm = r.W_mm; // width is horizontal
    barH_mm = r.T_mm; // thickness is vertical
  }

  const MAX_W = 280, MAX_H = 100;
  const scale = Math.min(MAX_W / barW_mm, MAX_H / barH_mm, 5);

  const bW = barW_mm * scale;
  const bH = barH_mm * scale;

  const barsToShow = Math.min(r.N, 3);
  const gap = Math.max(4, r.T_mm * scale * 0.7);

  const barFill = '#fef3c7';
  const barStroke = '#d97706';
  const skinFill = 'rgba(245,158,11,0.18)';
  const textFill = '#64748b';
  const dimColor = '#2563eb';

  let html = '';

  if (r.orient === 'vertical') {
    // Bars are side-by-side horizontally
    const totalW = barsToShow * bW + (barsToShow - 1) * gap;
    const ox = (VW - totalW) / 2, oy = (VH - bH) / 2;

    for (let i = 0; i < barsToShow; i++) {
      const cx = ox + i * (bW + gap);

      // skin depth indicator (if AC and skin depth < half-thickness/half-width)
      if (r.acdc === 'AC' && r.ks > 1.02) {
        const sd_px = r.delta_mm * scale;
        // left/right skin depth
        if (sd_px < bW / 2) {
          html += `<rect x="${cx}" y="${oy}" width="${sd_px}" height="${bH}" fill="${skinFill}" rx="2"/>`;
          html += `<rect x="${cx + bW - sd_px}" y="${oy}" width="${sd_px}" height="${bH}" fill="${skinFill}" rx="2"/>`;
        }
        // top/bottom skin depth
        if (sd_px < bH / 2) {
          html += `<rect x="${cx}" y="${oy}" width="${bW}" height="${sd_px}" fill="${skinFill}" rx="2"/>`;
          html += `<rect x="${cx}" y="${oy + bH - sd_px}" width="${bW}" height="${sd_px}" fill="${skinFill}" rx="2"/>`;
        }
      }

      // Main bar
      html += `<rect x="${cx}" y="${oy}" width="${bW}" height="${bH}" fill="${barFill}" stroke="${barStroke}" stroke-width="1.5" rx="2"/>`;

      if (i === 0) {
        // Dimension arrows
        // Width arrow (vertical dimension) on the left
        const ax = cx - 16;
        html += `<line x1="${ax}" y1="${oy}" x2="${ax}" y2="${oy + bH}" stroke="${dimColor}" stroke-width="1" marker-start="url(#a)" marker-end="url(#a)"/>`;
        html += `<text x="${ax - 4}" y="${oy + bH/2 + 4}" text-anchor="end" font-size="10" fill="${dimColor}" font-family="JetBrains Mono,monospace" font-weight="600">${r.W_mm}mm</text>`;

        // Thickness label (horizontal dimension) at the bottom
        const ay = oy + bH + 16;
        html += `<line x1="${cx}" y1="${ay}" x2="${cx + bW}" y2="${ay}" stroke="${dimColor}" stroke-width="1" marker-start="url(#a)" marker-end="url(#a)"/>`;
        html += `<text x="${cx + bW/2}" y="${ay - 4}" text-anchor="middle" font-size="10" fill="${dimColor}" font-family="JetBrains Mono,monospace" font-weight="600">${r.T_mm}mm</text>`;
      }
    }

    // Support Clamps (gripping vertical edges at top/bottom)
    const clampH = 8;
    const overlap = 4;
    const clampColor = '#94a3b8';
    const clampStroke = '#64748b';
    html += `<rect x="${ox - 10}" y="${oy - clampH + overlap}" width="${totalW + 20}" height="${clampH}" fill="${clampColor}" stroke="${clampStroke}" stroke-width="1" rx="2" opacity="0.85"/>`;
    html += `<rect x="${ox - 10}" y="${oy + bH - overlap}" width="${totalW + 20}" height="${clampH}" fill="${clampColor}" stroke="${clampStroke}" stroke-width="1" rx="2" opacity="0.85"/>`;
    html += `<text x="${ox + totalW/2}" y="${oy - clampH - 2}" text-anchor="middle" font-size="8" fill="${textFill}" font-family="Plus Jakarta Sans,sans-serif" font-weight="700" letter-spacing="0.5">INSULATOR CLAMP (EDGE-MOUNTED)</text>`;

    if (barsToShow < r.N) {
      const dotX = ox + barsToShow * (bW + gap) + 6;
      html += `<text x="${dotX + 10}" y="${oy + bH/2 + 4}" text-anchor="start" font-size="11" fill="${textFill}" font-family="Plus Jakarta Sans,sans-serif">+${r.N - barsToShow} more</text>`;
    }

  } else {
    // Horizontal: bars are stacked vertically
    const totalH = barsToShow * bH + (barsToShow - 1) * gap;
    const ox = (VW - bW) / 2, oy = (VH - totalH) / 2;

    for (let i = 0; i < barsToShow; i++) {
      const cy = oy + i * (bH + gap);

      // skin depth indicator (if AC and skin depth < half-thickness/half-width)
      if (r.acdc === 'AC' && r.ks > 1.02) {
        const sd_px = r.delta_mm * scale;
        // left/right
        if (sd_px < bW / 2) {
          html += `<rect x="${ox}" y="${cy}" width="${sd_px}" height="${bH}" fill="${skinFill}" rx="2"/>`;
          html += `<rect x="${ox + bW - sd_px}" y="${cy}" width="${sd_px}" height="${bH}" fill="${skinFill}" rx="2"/>`;
        }
        // top/bottom
        if (sd_px < bH / 2) {
          html += `<rect x="${ox}" y="${cy}" width="${bW}" height="${sd_px}" fill="${skinFill}" rx="2"/>`;
          html += `<rect x="${ox}" y="${cy + bH - sd_px}" width="${bW}" height="${sd_px}" fill="${skinFill}" rx="2"/>`;
        }
      }

      // Main bar
      html += `<rect x="${ox}" y="${cy}" width="${bW}" height="${bH}" fill="${barFill}" stroke="${barStroke}" stroke-width="1.5" rx="2"/>`;

      if (i === 0) {
        // Dimension arrows
        // Width arrow (horizontal dimension) at the bottom of first bar
        const ay = cy + bH + 16;
        html += `<line x1="${ox}" y1="${ay}" x2="${ox + bW}" y2="${ay}" stroke="${dimColor}" stroke-width="1" marker-start="url(#a)" marker-end="url(#a)"/>`;
        html += `<text x="${ox + bW/2}" y="${ay - 4}" text-anchor="middle" font-size="10" fill="${dimColor}" font-family="JetBrains Mono,monospace" font-weight="600">${r.W_mm}mm</text>`;

        // Thickness label (vertical dimension) inside the bar or on the left
        if (bH > 16) {
          html += `<text x="${ox + bW/2}" y="${cy + bH/2 + 4}" text-anchor="middle" font-size="10" fill="${textFill}" font-family="JetBrains Mono,monospace" font-weight="600">${r.T_mm}mm</text>`;
        } else {
          const ax = ox - 16;
          html += `<line x1="${ax}" y1="${cy}" x2="${ax}" y2="${cy + bH}" stroke="${dimColor}" stroke-width="1" marker-start="url(#a)" marker-end="url(#a)"/>`;
          html += `<text x="${ax - 4}" y="${cy + bH/2 + 4}" text-anchor="end" font-size="10" fill="${dimColor}" font-family="JetBrains Mono,monospace" font-weight="600">${r.T_mm}mm</text>`;
        }
      }
    }

    // Support Clamps (gripping top and bottom flat horizontal faces of stack)
    const clampH = 8;
    const overlap = 4;
    const clampColor = '#94a3b8';
    const clampStroke = '#64748b';
    html += `<rect x="${ox - 10}" y="${oy - clampH + overlap}" width="${bW + 20}" height="${clampH}" fill="${clampColor}" stroke="${clampStroke}" stroke-width="1" rx="2" opacity="0.85"/>`;
    html += `<rect x="${ox - 10}" y="${oy + totalH - overlap}" width="${bW + 20}" height="${clampH}" fill="${clampColor}" stroke="${clampStroke}" stroke-width="1" rx="2" opacity="0.85"/>`;
    html += `<text x="${ox + bW/2}" y="${oy - clampH - 2}" text-anchor="middle" font-size="8" fill="${textFill}" font-family="Plus Jakarta Sans,sans-serif" font-weight="700" letter-spacing="0.5">INSULATOR CLAMP (FLAT-MOUNTED)</text>`;

    if (barsToShow < r.N) {
      const dotY = oy + barsToShow * (bH + gap) + 6;
      html += `<text x="${ox + bW/2}" y="${dotY + 10}" text-anchor="middle" font-size="11" fill="${textFill}" font-family="Plus Jakarta Sans,sans-serif">+${r.N - barsToShow} more bar${r.N - barsToShow > 1 ? 's' : ''}</text>`;
    }
  }

  // Legend for skin depth
  if (r.acdc === 'AC' && r.ks > 1.02 && r.delta_mm < Math.min(r.W_mm, r.T_mm) / 2) {
    html += `<rect x="12" y="8" width="10" height="10" fill="${skinFill}" stroke="${barStroke}" stroke-width="1" rx="2"/>`;
    html += `<text x="26" y="18" font-size="10" fill="${textFill}" font-family="Plus Jakarta Sans,sans-serif">Skin depth δ = ${fmt(r.delta_mm, 1)} mm</text>`;
  }

  svg.innerHTML = `
    <defs>
      <marker id="a" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6" fill="none" stroke="${dimColor}" stroke-width="1"/>
      </marker>
    </defs>
    ${html}`;
}

function statusClass(v, warn_pct, fail_pct, invert=false) {
  if (invert) {
    if (v >= fail_pct) return 'highlight-fail';
    if (v >= warn_pct) return 'highlight-warn';
    return 'highlight-pass';
  }
  if (v <= fail_pct) return 'highlight-fail';
  if (v <= warn_pct) return 'highlight-warn';
  return 'highlight-pass';
}

function renderModules(r) {
  const grid = $('mod-grid');

  // Helper: result row
  const row = (label, val, unit='') =>
    `<div class="result-row"><span class="result-label">${label}</span><span class="result-val">${val}<span class="result-unit">${unit}</span></span></div>`;

  const divider = `<div class="result-divider"></div>`;

  // ── MOD 1 ──
  const mod1 = `
  <div class="mod-card highlight-pass">
    <div class="mod-header">
      <div class="mod-icon" style="background:var(--blue-bg);color:var(--blue)">
        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18M9 21V9"></path></svg>
      </div>
      <div><div class="mod-title">1 · Geometry &amp; DC Resistance</div><div class="mod-subtitle">${r.M.name} · T_op = ${fmt(r.T_op,0)} °C</div></div>
    </div>
    <div class="mod-body">
      ${row('Cross-section', fmt(r.A_mm2,0), 'mm²')}
      ${row('Perimeter', fmt(2*(r.W_mm+r.T_mm),0), 'mm')}
      ${row('Weight', fmt(r.weight_pm,3), 'kg/m')}
      ${divider}
      ${row('Resistivity at T_op', sci(r.rho_T,3), 'Ω·m')}
      ${row('R_DC at T_op', sci(r.R_dc * 1000, 3), 'mΩ/m')}
      ${row('R_DC at T_op', sci(r.R_dc * 1e6, 2), 'µΩ/m')}
    </div>
  </div>`;

  // ── MOD 2 ──
  const skinNote = r.acdc === 'DC' ? 'DC — no skin effect' :
    r.ks < 1.005 ? 'Skin effect negligible' :
    r.ks < 1.05 ? 'Mild skin effect' :
    r.ks < 1.15 ? 'Moderate skin effect' : 'Significant skin effect';
  const skinClass = r.acdc === 'DC' || r.ks < 1.01 ? 'pass' : r.ks < 1.1 ? 'warn' : 'fail';
  const mod2 = `
  <div class="mod-card ${r.ks > 1.1 ? 'highlight-warn' : 'highlight-pass'}">
    <div class="mod-header">
      <div class="mod-icon" style="background:var(--amber-bg);color:var(--amber)">
        <svg viewBox="0 0 24 24"><path d="M2 12h4l3-9 4 18 3-9h6"></path></svg>
      </div>
      <div><div class="mod-title">2 · AC Skin Effect</div><div class="mod-subtitle">${r.acdc === 'DC' ? 'DC — k_s = 1.000' : `f = ${r.f} Hz`}</div></div>
    </div>
    <div class="mod-body">
      ${row('Skin depth δ', r.acdc === 'DC' ? '∞' : fmt(r.delta_mm, 2), 'mm')}
      ${row('T / (2δ)', r.acdc === 'DC' ? '—' : fmt(r.T_mm / (2 * r.delta_mm), 3), '')}
      ${row('Skin factor k_s = Rac/Rdc', fmt(r.ks, 4), '')}
      ${divider}
      ${row('R_AC at T_op', sci(r.R_ac * 1e6, 2), 'µΩ/m')}
      ${badge(skinClass, r.ks < 1.1 ? ICONS.check : ICONS.warn, skinNote)}
    </div>
  </div>`;

  // ── MOD 3 ──
  const coolingText = r.cooling === 'forced' ? `Forced (${r.vel} m/s)` : 'Natural';
  const mod3 = `
  <div class="mod-card highlight-pass">
    <div class="mod-header">
      <div class="mod-icon" style="background:var(--red-bg);color:var(--red)">
        <svg viewBox="0 0 24 24"><path d="M12 22a8 8 0 0 1-8-8c0-4.314 6-12 8-12s8 7.686 8 12a8 8 0 0 1-8 8z"></path></svg>
      </div>
      <div><div class="mod-title">3 · Continuous Current Capacity</div><div class="mod-subtitle">Cooling: ${coolingText} · ${r.orient} · ε = ${r.eps}</div></div>
    </div>
    <div class="mod-body">
      ${r.cooling === 'forced' ? row('Convective coeff h_c', fmt(r.h_forced, 2), 'W/(m²·K)') : ''}
      ${row('Q_convection', fmt(r.Q_conv, 2), 'W/m')}
      ${row('Q_radiation', fmt(r.Q_rad, 2), 'W/m')}
      ${row('Q_total dissipated', fmt(r.Q_total, 2), 'W/m')}
      ${divider}
      ${row('I_capacity (1 bar)', fmt(r.I_single, 0), 'A')}
      ${badge('info', ICONS.check, `At ΔT = ${r.dT} °C above ${r.Tamb} °C ambient`)}
    </div>
  </div>`;

  // ── MOD 4 ──
  const mod4 = `
  <div class="mod-card highlight-pass">
    <div class="mod-header">
      <div class="mod-icon" style="background:var(--green-bg);color:var(--green)">
        <svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="8" rx="1"></rect><path d="M3 12h18M7 8V6M17 8V6M7 16v2M17 16v2"></path></svg>
      </div>
      <div><div class="mod-title">4 · Multi-Bar Rating</div><div class="mod-subtitle">N = ${r.N} bar${r.N>1?'s':''} per phase · k = ${r.kN}</div></div>
    </div>
    <div class="mod-body">
      ${row('Single bar capacity', fmt(r.I_single, 0), 'A')}
      ${row('CDA derating factor k_N', r.kN.toFixed(2), '')}
      ${row('Total phase capacity', `<strong style="font-size:18px;color:var(--green)">${fmt(r.I_total, 0)}</strong>`, 'A')}
      ${divider}
      ${row('Current per bar', fmt(r.I_total / r.N, 0), 'A')}
      ${badge('pass', ICONS.check, `${r.N} × ${fmt(r.W_mm,0)}×${fmt(r.T_mm,0)} mm ${r.M.name}`)}
    </div>
  </div>`;

  // ── MOD 5 ──
  const scPass = r.I_withstand >= r.Isc_kA * 1e3;
  const scCard = scPass ? 'highlight-pass' : 'highlight-fail';
  const scBadge = scPass
    ? badge('pass', ICONS.check, `Withstands ${fmt(r.Isc_kA,0)} kA for ${r.tf} s ✓`)
    : badge('fail', ICONS.x, `FAILS — ${fmt(r.Isc_kA,0)} kA exceeds withstand`);
  const mod5 = `
  <div class="mod-card ${scCard}">
    <div class="mod-header">
      <div class="mod-icon" style="background:var(--red-bg);color:var(--red)">
        <svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
      </div>
      <div><div class="mod-title">5 · Short-Circuit Thermal Rating</div><div class="mod-subtitle">IEC 60865-1 Adiabatic · k_th = ${r.M.k_th} A·s^0.5/mm²</div></div>
    </div>
    <div class="mod-body">
      ${row('Fault current I_sc', fmt(r.Isc_kA, 1), 'kA rms')}
      ${row('Fault duration t_f', r.tf, 's')}
      ${row('I_withstand (this bar)', fmt(r.I_withstand/1000, 1), 'kA')}
      ${row('Min. area for I_sc', fmt(r.Isc_kA * 1000 * Math.sqrt(r.tf) / r.M.k_th, 0), 'mm²')}
      ${divider}
      ${row('Peak fault current i_peak', fmt(r.i_peak/1000, 1), 'kA peak')}
      ${row('EM force at fault', fmt(r.Fem_pm, 0), 'N/m')}
      ${scBadge}
    </div>
  </div>`;

  // ── MOD 6 ──
  const deflPct = r.span * 1000 / 200; // L/200 acceptance limit
  const deflOK = r.delta_mm_defl < deflPct;
  const stressOK = r.stress_ratio < 0.8;
  const mechClass = (deflOK && stressOK) ? 'highlight-pass' : r.stress_ratio >= 1.0 ? 'highlight-fail' : 'highlight-warn';
  const mod6 = `
  <div class="mod-card ${mechClass}">
    <div class="mod-header">
      <div class="mod-icon" style="background:var(--blue-bg);color:var(--blue)">
        <svg viewBox="0 0 24 24"><path d="M4 20 C4 20 8 4 12 4 S20 20 20 20"></path></svg>
      </div>
      <div><div class="mod-title">6 · Mechanical Deflection</div><div class="mod-subtitle">Simply supported · Span ${r.span} m · E = ${(r.M.E/1e9).toFixed(0)} GPa</div></div>
    </div>
    <div class="mod-body">
      ${row('UDL (EM force / span)', fmt(r.w_em, 2), 'N/m')}
      ${row('Max deflection δ_max', fmt(r.delta_mm_defl, 2), 'mm')}
      ${row('L/δ ratio', deflOK ? fmt(r.span*1000/r.delta_mm_defl,0) : '< 200', '')}
      ${divider}
      ${row('Bending stress σ', fmt(r.sigma_bend_MPa, 1), 'N/mm²')}
      ${row('Yield strength σ_y', (r.M.sigma_y/1e6).toFixed(0), 'N/mm²')}
      ${row('Stress utilisation', fmt(r.stress_ratio*100, 1), '%')}
      ${r.stress_ratio < 0.5 ? badge('pass', ICONS.check, 'Structurally adequate') :
        r.stress_ratio < 1.0 ? badge('warn', ICONS.warn, `${fmt(r.stress_ratio*100,0)}% of yield — check supports`) :
        badge('fail', ICONS.x, 'Stress exceeds yield — shorten span')}
    </div>
  </div>`;

  // ── MOD 7 ──
  const vdropClass = r.dV_pct < 1 ? 'highlight-pass' : r.dV_pct < 3 ? 'highlight-warn' : 'highlight-fail';
  const mod7 = `
  <div class="mod-card ${vdropClass}" style="grid-column: span 2;">
    <div class="mod-header">
      <div class="mod-icon" style="background:var(--green-bg);color:var(--green)">
        <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
      </div>
      <div><div class="mod-title">7 · Voltage Drop at Continuous Current</div><div class="mod-subtitle">I_total = ${fmt(r.I_total,0)} A · L = ${r.L} m · V_sys = ${r.V_sys} V</div></div>
    </div>
    <div class="mod-body" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
      <div>
        <div class="result-label">ΔV per metre</div>
        <div class="result-val" style="font-size:20px">${fmt(r.dV_mpm, 2)}<span class="result-unit">mV/m</span></div>
      </div>
      <div>
        <div class="result-label">Total ΔV over ${r.L} m</div>
        <div class="result-val" style="font-size:20px">${fmt(r.dV_total, 3)}<span class="result-unit">V</span></div>
      </div>
      <div>
        <div class="result-label">% of system voltage</div>
        <div class="result-val" style="font-size:20px;color:${r.dV_pct<1?'var(--green)':r.dV_pct<3?'var(--amber)':'var(--red)'}">${fmt(r.dV_pct, 2)}<span class="result-unit">%</span></div>
        ${r.dV_pct < 1 ? badge('pass', ICONS.check, '< 1% — Excellent') :
          r.dV_pct < 3 ? badge('warn', ICONS.warn, '1–3% — Acceptable') :
          badge('fail', ICONS.x, '> 3% — Increase cross-section')}
      </div>
    </div>
  </div>`;

  grid.innerHTML = mod1 + mod2 + mod3 + mod4 + mod5 + mod6 + mod7;
}

function renderResultsTab(r) {
  const el = $('results-tab-content');
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div class="preview-card">
        <div class="preview-header">
          <h3>${r.N} × ${r.W_mm}×${r.T_mm} mm ${r.M.name} · ${r.orient} · ΔT = ${r.dT} °C</h3>
          <div class="preview-meta">
            <span class="meta-pill">${fmt(r.I_total,0)} A</span>
            <span class="meta-pill">${fmt(r.I_withstand/1000,1)} kA SC</span>
            <span class="meta-pill">${fmt(r.dV_pct,2)}% ΔV</span>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:16px 0;">
          <div style="text-align:center;">
            <div style="font-size:28px;font-weight:800;color:var(--green);font-family:var(--font-mono)">${fmt(r.I_total,0)}</div>
            <div style="font-size:11px;color:var(--text-muted)">Continuous (A)</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:28px;font-weight:800;color:var(--accent);font-family:var(--font-mono)">${fmt(r.I_withstand/1000,1)}</div>
            <div style="font-size:11px;color:var(--text-muted)">SC Withstand (kA)</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:28px;font-weight:800;color:var(--accent-3);font-family:var(--font-mono)">${fmt(r.ks,3)}</div>
            <div style="font-size:11px;color:var(--text-muted)">Rac/Rdc (k_s)</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:28px;font-weight:800;color:${r.dV_pct<2?'var(--green)':'var(--amber)'};font-family:var(--font-mono)">${fmt(r.dV_pct,2)}</div>
            <div style="font-size:11px;color:var(--text-muted)">ΔV% drop</div>
          </div>
        </div>
      </div>
      <div class="mod-grid" id="results-tab-grid"></div>
    </div>`;
}

function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ================================================================
//  MAIN ENTRY
// ================================================================
function calculate() {
  try {
    const r = runCalc();

    // Show results in configure tab
    $('placeholder-card').style.display = 'none';
    const cr = $('calc-results');
    cr.style.display = 'flex';

    renderSVG(r);

    // Update preview meta pills
    $('preview-meta').innerHTML = `
      <span class="meta-pill">${r.N}×${fmt(r.W_mm,0)}×${fmt(r.T_mm,0)} mm</span>
      <span class="meta-pill">${r.M.name}</span>
      <span class="meta-pill">${r.acdc}${r.acdc==='AC'?' '+r.f+'Hz':''}</span>`;

    // Update thermal profile gauge
    const tMin = 0;
    const tMax = 120;
    const pctAmb = Math.min(100, Math.max(0, ((r.Tamb - tMin) / (tMax - tMin)) * 100));
    const pctOp = Math.min(100, Math.max(0, ((r.T_op - tMin) / (tMax - tMin)) * 100));

    $('marker-ambient').style.left = `${pctAmb}%`;
    $('marker-ambient').setAttribute('data-label', 'Ambient');
    $('val-ambient').textContent = `${fmt(r.Tamb,0)}°C`;
    $('card-val-amb').textContent = `${fmt(r.Tamb,0)}°C`;

    $('marker-operating').style.left = `${pctOp}%`;
    $('marker-operating').setAttribute('data-label', 'Busbar');
    $('val-operating').textContent = `${fmt(r.T_op,0)}°C`;
    $('card-val-op').textContent = `${fmt(r.T_op,0)}°C (+${fmt(r.dT,0)}°C)`;

    renderModules(r);
    renderResultsTab(r);

    // Auto-switch to results if on results tab
    if ($('tab-results').classList.contains('active')) {
      // just re-rendered, fine
    }

    showToast(`Calculated: ${fmt(r.I_total,0)} A continuous · ${fmt(r.I_withstand/1000,1)} kA`);
  } catch(e) {
    console.error(e);
    showToast('Calculation error — check inputs');
  }
}

// ================================================================
//  TABS
// ================================================================
document.querySelectorAll('.main-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.main-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ================================================================
//  AUTO-CALC on input changes
// ================================================================
// ================================================================
document.querySelectorAll('input[type=number], select').forEach(el => {
  el.addEventListener('change', calculate);
  el.addEventListener('input', calculate);
});
$('calc-btn').addEventListener('click', calculate);

// AC/DC toggle — disable frequency select when DC
$('inp-acdc').addEventListener('change', () => {
  $('inp-freq').disabled = $('inp-acdc').value === 'DC';
});

// Cooling mode toggle — show/hide velocity field
const toggleCoolingMode = () => {
  const isForced = $('inp-cooling').value === 'forced';
  $('field-velocity').style.display = isForced ? 'block' : 'none';
};
$('inp-cooling').addEventListener('change', toggleCoolingMode);
toggleCoolingMode();

// ================================================================
//  SAVED PROJECTS MANAGEMENT (Firebase + LocalStorage Fallback)
// ================================================================
function getInputsConfig() {
  return {
    W: gv('inp-W'),
    T: gv('inp-T'),
    L: gv('inp-L'),
    N: $('inp-N').value,
    span: gv('inp-span'),
    mat: $('inp-mat').value,
    emis: $('inp-emis').value,
    orient: $('inp-orient').value,
    acdc: $('inp-acdc').value,
    freq: $('inp-freq').value,
    Tamb: gv('inp-Tamb'),
    dT: gv('inp-dT'),
    V: gv('inp-V'),
    Isc: gv('inp-Isc'),
    tf: gv('inp-tf'),
    d: gv('inp-d'),
    cooling: $('inp-cooling').value,
    vel: gv('inp-vel')
  };
}

function setInputsConfig(c) {
  if (!c) return;
  if (c.W !== undefined) $('inp-W').value = c.W;
  if (c.T !== undefined) $('inp-T').value = c.T;
  if (c.L !== undefined) $('inp-L').value = c.L;
  if (c.N !== undefined) $('inp-N').value = c.N;
  if (c.span !== undefined) $('inp-span').value = c.span;
  if (c.mat !== undefined) $('inp-mat').value = c.mat;
  if (c.emis !== undefined) $('inp-emis').value = c.emis;
  if (c.orient !== undefined) $('inp-orient').value = c.orient;
  if (c.acdc !== undefined) $('inp-acdc').value = c.acdc;
  if (c.freq !== undefined) $('inp-freq').value = c.freq;
  if (c.Tamb !== undefined) $('inp-Tamb').value = c.Tamb;
  if (c.dT !== undefined) $('inp-dT').value = c.dT;
  if (c.V !== undefined) $('inp-V').value = c.V;
  if (c.Isc !== undefined) $('inp-Isc').value = c.Isc;
  if (c.tf !== undefined) $('inp-tf').value = c.tf;
  if (c.d !== undefined) $('inp-d').value = c.d;
  if (c.cooling !== undefined) {
    $('inp-cooling').value = c.cooling;
    toggleCoolingMode();
  }
  if (c.vel !== undefined) $('inp-vel').value = c.vel;
  $('inp-freq').disabled = $('inp-acdc').value === 'DC';
  calculate();
}

// ================================================================
//  PROJECT MANAGER CONFIGURATION (Auto-binds Header Open/Save buttons)
// ================================================================
window.projectManagerConfig = {
  toolId: "busbar-sizing",
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
      ? window.encodeToolShare("busbar-sizing", configData)
      : (window.encodeShareState ? window.encodeShareState(configData) : btoa(unescape(encodeURIComponent(JSON.stringify(configData)))));
    const url = new URL(window.location.href);
    url.searchParams.set('design', serialized);
    
    navigator.clipboard.writeText(url.toString()).then(() => {
      if (window.showToast) window.showToast("Design link copied to clipboard!");
      else alert("Design link copied to clipboard! You can share this URL with other engineers.");
      if (window.pmMaybeGuestUpgradeCta) window.pmMaybeGuestUpgradeCta();
    }).catch(() => {
      alert("Could not write to clipboard automatically. Copy URL manually: " + url.toString());
    });
  } catch (err) {
    console.error(err);
    alert("Failed to generate share link.");
  }
};

window.buildBusbarMarkdown = function() {
  const c = getInputsConfig();
  return [
    "## Busbar Capacity Summary",
    "",
    "| Parameter | Value |",
    "|---|---|",
    `| Material | ${c.material ?? "—"} |`,
    `| Width | ${c.width ?? "—"} |`,
    `| Thickness | ${c.thickness ?? "—"} |`,
    `| Current | ${c.current ?? "—"} |`,
    "",
    "_Engineering Toolkit · Busbar Sizing_"
  ].join("\n");
};

window.openBusbarReport = function() {
  if (!window.ToolExports) return;
  window.ToolExports.openPrintReport({
    title: "Busbar Capacity Report",
    metaLines: [`physics v${window.ToolExports.getPhysicsVersion("busbar-sizing")}`],
    sections: [{ heading: "Configuration", text: window.buildBusbarMarkdown() }]
  });
};

window.exportJSON = function() {
  try {
    const configData = getInputsConfig();
    const blob = new Blob([JSON.stringify(configData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `busbar-design-${Date.now()}.json`;
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
      document.dispatchEvent(new Event("input")); // Trigger auto-save if registered
    } catch (err) {
      alert("Invalid JSON file: " + err.message);
    }
  };
  reader.readAsText(file);
};

// ================================================================
//  INIT — run once on load
// ================================================================
// Check for URL parameter design
const urlParams = new URLSearchParams(window.location.search);
const design = urlParams.get('design');
if (design) {
  try {
    let decoded = null;
    if (window.decodeToolShare) {
      const res = window.decodeToolShare(design, "busbar-sizing");
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
  } catch (err) {
    console.error("Failed to load design from URL:", err);
  }
}

calculate();

// Export menu
if (window.ToolExports) {
  window.ToolExports.register({
    json: () => window.exportJSON(),
    import: () => document.getElementById("import-file-input")?.click(),
    report: () => window.openBusbarReport(),
    markdown: () => window.buildBusbarMarkdown(),
    hide: ['button[onclick*="exportJSON"]', 'button[onclick*="importJSON"]']
  });
  window.ToolExports.mount();
}

if (typeof lucide !== 'undefined') {
  lucide.createIcons();
}
