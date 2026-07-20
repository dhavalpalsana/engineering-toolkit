/**
 * MOSFET power-loss pure model (browser + Node).
 * Inputs use UI units: mΩ, nC, ns, pF, kHz, % duty — same as the tool form.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MosfetPhysics = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /**
   * @param {object} cond — operating conditions
   * @param {object} device — device parameters (UI units)
   * @returns loss breakdown in watts
   */
  function calculateLosses(cond, device) {
    const vbus = Number(cond.vbus) || 0;
    const iload = Number(cond.iload) || 0;
    const fsw = Number(cond.fsw) || 0; // kHz
    const vgate = Number(cond.vgate) || 0;
    const tdead = Number(cond.tdead) || 0; // ns
    const duty = Number(cond.duty) || 0; // %

    const rdson = Number(device.rdson) || 0; // mΩ
    const qg = Number(device.qg) || 0; // nC
    const tr = Number(device.tr) || 0; // ns
    const tf = Number(device.tf) || 0; // ns
    const qrr = Number(device.qrr) || 0; // nC
    const vsd = Number(device.vsd) || 0; // V
    const coss = Number(device.coss) || 0; // pF

    const rdson_ohm = rdson / 1000.0;
    const qg_c = qg / 1e9;
    const tr_s = tr / 1e9;
    const tf_s = tf / 1e9;
    const qrr_c = qrr / 1e9;
    const coss_f = coss / 1e12;
    const tdead_s = tdead / 1e9;
    const fsw_hz = fsw * 1000.0;
    const duty_frac = duty / 100.0;

    const p_cond = iload * iload * rdson_ohm * duty_frac;
    const p_sw = 0.5 * vbus * iload * (tr_s + tf_s) * fsw_hz;
    const p_dead = 2.0 * iload * vsd * tdead_s * fsw_hz;
    const p_rr = qrr_c * vbus * fsw_hz;
    const p_gate = qg_c * vgate * fsw_hz;
    const p_coss = 0.5 * coss_f * vbus * vbus * fsw_hz;
    const p_total = p_cond + p_sw + p_dead + p_rr + p_gate + p_coss;

    return {
      p_cond,
      p_sw,
      p_dead,
      p_rr,
      p_gate,
      p_coss,
      p_total
    };
  }

  return { calculateLosses };
});
