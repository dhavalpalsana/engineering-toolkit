/**
 * 1D Euler–Bernoulli beam FEA (pure, browser + Node).
 * Units: L m, E GPa, loads kN / kN·m / kN/m, section in m / m² / m⁴ / m³.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.BeamFea = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function sectionProperties(shape, params) {
    let A = 0.0;
    let Iz = 0.0;
    let Sz = 0.0;
    let d = 0.0;

    if (shape === "rect-solid") {
      const b = params.b / 1000.0;
      d = params.d / 1000.0;
      A = b * d;
      Iz = (b * Math.pow(d, 3)) / 12.0;
      Sz = Iz / (d / 2.0);
    } else if (shape === "rect-hollow") {
      const b = params.b / 1000.0;
      d = params.d / 1000.0;
      const t = params.t / 1000.0;
      const bi = b - 2.0 * t;
      const di = d - 2.0 * t;
      A = b * d - bi * di;
      Iz = (b * Math.pow(d, 3) - bi * Math.pow(di, 3)) / 12.0;
      Sz = Iz / (d / 2.0);
    } else if (shape === "circ-solid") {
      d = params.d / 1000.0;
      A = (Math.PI * Math.pow(d, 2)) / 4.0;
      Iz = (Math.PI * Math.pow(d, 4)) / 64.0;
      Sz = Iz / (d / 2.0);
    } else if (shape === "circ-hollow") {
      d = params.d / 1000.0;
      const t = params.t / 1000.0;
      const di = d - 2.0 * t;
      A = (Math.PI * (Math.pow(d, 2) - Math.pow(di, 2))) / 4.0;
      Iz = (Math.PI * (Math.pow(d, 4) - Math.pow(di, 4))) / 64.0;
      Sz = Iz / (d / 2.0);
    } else if (shape === "i-beam") {
      d = params.d / 1000.0;
      const b = params.b / 1000.0;
      const tf = params.tf / 1000.0;
      const tw = params.tw / 1000.0;
      const dw = d - 2.0 * tf;
      A = 2.0 * b * tf + dw * tw;
      Iz = (b * Math.pow(d, 3) - (b - tw) * Math.pow(dw, 3)) / 12.0;
      Sz = Iz / (d / 2.0);
    } else if (shape === "custom") {
      Iz = params.I * 1e-8;
      d = params.d / 1000.0;
      A = params.A != null ? params.A : 0.001;
      Sz = Iz / (d / 2.0);
    }

    return { A, Iz, Sz, d };
  }

  function solveLU(K, F) {
    const n = F.length;
    const A = K.map((row) => row.slice());
    const b = F.slice();

    for (let i = 0; i < n; i++) {
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) maxRow = k;
      }
      const tempRow = A[i];
      A[i] = A[maxRow];
      A[maxRow] = tempRow;
      const tempF = b[i];
      b[i] = b[maxRow];
      b[maxRow] = tempF;

      const pivot = A[i][i];
      if (Math.abs(pivot) < 1e-11) return null;

      for (let k = i + 1; k < n; k++) {
        const factor = A[k][i] / pivot;
        A[k][i] = 0.0;
        for (let j = i + 1; j < n; j++) {
          A[k][j] -= factor * A[i][j];
        }
        b[k] -= factor * b[i];
      }
    }

    const x = new Array(n).fill(0.0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = 0.0;
      for (let j = i + 1; j < n; j++) sum += A[i][j] * x[j];
      x[i] = (b[i] - sum) / A[i][i];
    }
    return x;
  }

  /**
   * @param {object} model
   *  L, E (GPa), density (kg/m³), selfWeightEnabled,
   *  section: { shape, params },
   *  supports: [{ type: pinned|roller|fixed, x }],
   *  loads: [{ type: point|moment|udl, val, x1, x2? }],
   *  Ne (default 100)
   */
  function solveBeam(model) {
    const L = Number(model.L);
    const E = Number(model.E);
    const density = Number(model.density) || 0;
    const selfWeightEnabled = !!model.selfWeightEnabled;
    const supports = model.supports || [];
    const loads = model.loads || [];
    const Ne = model.Ne != null ? model.Ne : 100;
    const sec =
      model.section && model.section.A != null
        ? model.section
        : sectionProperties(model.section.shape, model.section.params);

    const EI = E * 1e6 * sec.Iz;
    const h = L / Ne;
    const Nd = Ne + 1;
    const TotalDoF = Nd * 2;

    const K = Array.from({ length: TotalDoF }, () => new Array(TotalDoF).fill(0.0));
    const F = new Array(TotalDoF).fill(0.0);

    for (let e = 0; e < Ne; e++) {
      const n1 = e;
      const n2 = e + 1;
      const dofs = [2 * n1, 2 * n1 + 1, 2 * n2, 2 * n2 + 1];
      const k_e = [
        [12.0, 6.0 * h, -12.0, 6.0 * h],
        [6.0 * h, 4.0 * h * h, -6.0 * h, 2.0 * h * h],
        [-12.0, -6.0 * h, 12.0, -6.0 * h],
        [6.0 * h, 2.0 * h * h, -6.0 * h, 4.0 * h * h]
      ];
      const multiplier = EI / Math.pow(h, 3);
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          K[dofs[r]][dofs[c]] += k_e[r][c] * multiplier;
        }
      }
    }

    const K_orig = K.map((row) => row.slice());
    const F_orig = F.slice();

    const activeUDLs = [];
    if (selfWeightEnabled && sec.A > 0) {
      const w_sw = -1.0 * (density * sec.A * 9.81 * 1e-3);
      activeUDLs.push({ val: w_sw, x1: 0.0, x2: L });
    }

    loads.forEach((ld) => {
      if (ld.type === "point") {
        const idx = Math.min(Ne, Math.max(0, Math.round(ld.x1 / h)));
        F[2 * idx] += ld.val;
        F_orig[2 * idx] += ld.val;
      } else if (ld.type === "moment") {
        const idx = Math.min(Ne, Math.max(0, Math.round(ld.x1 / h)));
        F[2 * idx + 1] += ld.val;
        F_orig[2 * idx + 1] += ld.val;
      } else if (ld.type === "udl") {
        activeUDLs.push({ val: ld.val, x1: ld.x1, x2: ld.x2 });
      }
    });

    activeUDLs.forEach((udl) => {
      for (let e = 0; e < Ne; e++) {
        const x_e1 = e * h;
        const x_e2 = (e + 1) * h;
        const x_a = Math.max(x_e1, udl.x1);
        const x_b = Math.min(x_e2, udl.x2);
        if (x_b > x_a) {
          const overlap_ratio = (x_b - x_a) / h;
          const w_equiv = udl.val * overlap_ratio;
          const f_equiv = [
            (w_equiv * h) / 2.0,
            (w_equiv * h * h) / 12.0,
            (w_equiv * h) / 2.0,
            (-w_equiv * h * h) / 12.0
          ];
          const dofs = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
          for (let r = 0; r < 4; r++) {
            F[dofs[r]] += f_equiv[r];
            F_orig[dofs[r]] += f_equiv[r];
          }
        }
      }
    });

    const restrainedDoFs = new Array(TotalDoF).fill(false);
    supports.forEach((sup) => {
      const idx = Math.min(Ne, Math.max(0, Math.round(sup.x / h)));
      if (sup.type === "pinned" || sup.type === "roller") {
        restrainedDoFs[2 * idx] = true;
      } else if (sup.type === "fixed") {
        restrainedDoFs[2 * idx] = true;
        restrainedDoFs[2 * idx + 1] = true;
      }
    });

    for (let d = 0; d < TotalDoF; d++) {
      if (restrainedDoFs[d]) {
        for (let j = 0; j < TotalDoF; j++) K[d][j] = 0.0;
        K[d][d] = 1.0;
        F[d] = 0.0;
      }
    }

    const solution = solveLU(K, F);
    if (!solution) return { unstable: true };

    const R = new Array(TotalDoF).fill(0.0);
    for (let r = 0; r < TotalDoF; r++) {
      let sum = 0.0;
      for (let c = 0; c < TotalDoF; c++) sum += K_orig[r][c] * solution[c];
      R[r] = sum - F_orig[r];
    }

    const supportReactions = supports.map((sup) => {
      const idx = Math.min(Ne, Math.max(0, Math.round(sup.x / h)));
      return {
        x: sup.x,
        type: sup.type,
        Fy: R[2 * idx],
        M: sup.type === "fixed" ? R[2 * idx + 1] : 0.0
      };
    });

    const nodeX = [];
    const deflection = [];
    for (let i = 0; i < Nd; i++) {
      nodeX.push(i * h);
      deflection.push(solution[2 * i] * 1000.0);
    }

    const elemShear = [];
    const elemM1 = [];
    const elemM2 = [];
    for (let e = 0; e < Ne; e++) {
      const v1 = solution[2 * e];
      const t1 = solution[2 * e + 1];
      const v2 = solution[2 * e + 2];
      const t2 = solution[2 * e + 3];
      const vVal =
        (EI / Math.pow(h, 3)) * (-12.0 * v1 - 6.0 * h * t1 + 12.0 * v2 - 6.0 * h * t2);
      const m1Val =
        (EI / Math.pow(h, 2)) * (-6.0 * v1 - 4.0 * h * t1 + 6.0 * v2 - 2.0 * h * t2);
      const m2Val =
        (EI / Math.pow(h, 2)) * (6.0 * v1 + 2.0 * h * t1 - 6.0 * v2 + 4.0 * h * t2);
      elemShear.push(vVal);
      elemM1.push(m1Val);
      elemM2.push(m2Val);
    }

    const internalMoment = [];
    for (let i = 0; i < Nd; i++) {
      if (i === 0) internalMoment.push(elemM1[0]);
      else if (i === Nd - 1) internalMoment.push(elemM2[Ne - 1]);
      else internalMoment.push((elemM2[i - 1] + elemM1[i]) / 2.0);
    }

    const internalShear = [];
    for (let i = 0; i < Nd; i++) {
      if (i === 0) internalShear.push(elemShear[0]);
      else if (i === Nd - 1) internalShear.push(elemShear[Ne - 1]);
      else internalShear.push((elemShear[i - 1] + elemShear[i]) / 2.0);
    }

    const stress = internalMoment.map((M) => {
      if (sec.Sz === 0) return 0.0;
      return Math.abs(M) / sec.Sz / 1000.0;
    });

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
      if (Math.abs(elemShear[e]) > Math.abs(maxShear)) maxShear = elemShear[e];
    }

    let maxStress = 0.0;
    for (let i = 0; i < Nd; i++) {
      if (stress[i] > maxStress) maxStress = stress[i];
    }

    return {
      unstable: false,
      supportReactions,
      nodeX,
      deflection,
      shear: internalShear,
      elemShear,
      moment: internalMoment,
      stress,
      maxDeflection,
      maxDeflectionLoc,
      maxMoment,
      maxMomentLoc,
      maxShear,
      maxStress,
      section: sec
    };
  }

  return { sectionProperties, solveLU, solveBeam };
});
