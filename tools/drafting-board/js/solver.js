// ==========================================================================
// 2D CAD Geometric Constraint Solver
// Core Optimization Engine (Levenberg-Marquardt Algorithm)
// ==========================================================================

class Variable {
  constructor(id, value, free = true) {
    this.id = id;
    this.value = value;
    this.free = free;
  }
}

class Constraint {
  constructor(type, targets, params = {}) {
    this.type = type; // "coincident", "horizontal", "vertical", "distance", "perpendicular", "parallel", "concentric", "tangent"
    this.targets = targets; // References to indices of variables or objects
    this.params = params; // Parameters like target distance value
  }

  evaluate(vars) {
    const getVal = (idx) => vars[idx].value;

    switch (this.type) {
      case "coincident": {
        // targets: [x1_idx, y1_idx, x2_idx, y2_idx]
        const dx = getVal(this.targets[0]) - getVal(this.targets[2]);
        const dy = getVal(this.targets[1]) - getVal(this.targets[3]);
        return [dx, dy];
      }
      case "horizontal": {
        // targets: [y1_idx, y2_idx]
        return [getVal(this.targets[1]) - getVal(this.targets[0])];
      }
      case "vertical": {
        // targets: [x1_idx, x2_idx]
        return [getVal(this.targets[1]) - getVal(this.targets[0])];
      }
      case "distance": {
        // targets: [x1_idx, y1_idx, x2_idx, y2_idx]
        const dx = getVal(this.targets[2]) - getVal(this.targets[0]);
        const dy = getVal(this.targets[3]) - getVal(this.targets[1]);
        const dist = Math.hypot(dx, dy);
        const targetDist = this.params.d !== undefined ? this.params.d : 0;
        return [dist - targetDist];
      }
      case "perpendicular": {
        // targets: [x1, y1, x2, y2, x3, y3, x4, y4] - Line 12 and Line 34
        const dx1 = getVal(this.targets[2]) - getVal(this.targets[0]);
        const dy1 = getVal(this.targets[3]) - getVal(this.targets[1]);
        const dx2 = getVal(this.targets[6]) - getVal(this.targets[4]);
        const dy2 = getVal(this.targets[7]) - getVal(this.targets[5]);
        const len1 = Math.hypot(dx1, dy1);
        const len2 = Math.hypot(dx2, dy2);
        if (len1 < 1e-6 || len2 < 1e-6) return [0];
        // Normalized dot product should be 0
        return [(dx1 * dx2 + dy1 * dy2) / (len1 * len2)];
      }
      case "parallel": {
        // targets: [x1, y1, x2, y2, x3, y3, x4, y4] - Line 12 and Line 34
        const dx1 = getVal(this.targets[2]) - getVal(this.targets[0]);
        const dy1 = getVal(this.targets[3]) - getVal(this.targets[1]);
        const dx2 = getVal(this.targets[6]) - getVal(this.targets[4]);
        const dy2 = getVal(this.targets[7]) - getVal(this.targets[5]);
        const len1 = Math.hypot(dx1, dy1);
        const len2 = Math.hypot(dx2, dy2);
        if (len1 < 1e-6 || len2 < 1e-6) return [0];
        // Normalized cross product should be 0
        return [(dx1 * dy2 - dy1 * dx2) / (len1 * len2)];
      }
      case "concentric": {
        // targets: [cx1_idx, cy1_idx, cx2_idx, cy2_idx]
        const dx = getVal(this.targets[0]) - getVal(this.targets[2]);
        const dy = getVal(this.targets[1]) - getVal(this.targets[3]);
        return [dx, dy];
      }
      case "tangent": {
        // targets: [x1, y1, x2, y2, cx, cy, r_idx] - Line 12, Circle center, Circle radius variable
        const x1 = getVal(this.targets[0]);
        const y1 = getVal(this.targets[1]);
        const x2 = getVal(this.targets[2]);
        const y2 = getVal(this.targets[3]);
        const cx = getVal(this.targets[4]);
        const cy = getVal(this.targets[5]);
        const r = getVal(this.targets[6]);

        const A = y1 - y2;
        const B = x2 - x1;
        const C = x1 * y2 - x2 * y1;
        const norm = Math.hypot(A, B);
        if (norm < 1e-6) return [0];
        
        const dist = (A * cx + B * cy + C) / norm;
        return [Math.abs(dist) - r];
      }
      default:
        return [0];
    }
  }
}

function evaluateAllResiduals(vars, constraints) {
  const residuals = [];
  for (const c of constraints) {
    const res = c.evaluate(vars);
    residuals.push(...res);
  }
  return new Float64Array(residuals);
}

function computeSumOfSquares(r) {
  let sum = 0;
  for (let i = 0; i < r.length; i++) {
    sum += r[i] * r[i];
  }
  return sum;
}

function computeJacobian(vars, constraints, rBase) {
  const freeVars = vars.filter(v => v.free);
  const n = freeVars.length;
  const m = rBase.length;
  const J = Array.from({ length: m }, () => new Float64Array(n));
  const eps = 1e-6;

  for (let j = 0; j < n; j++) {
    const v = freeVars[j];
    const origVal = v.value;

    v.value = origVal + eps;
    const rPerturb = evaluateAllResiduals(vars, constraints);
    v.value = origVal; // restore

    for (let i = 0; i < m; i++) {
      J[i][j] = (rPerturb[i] - rBase[i]) / eps;
    }
  }
  return J;
}

function solveLinearSystem(A, b) {
  const n = b.length;
  const M = Array.from({ length: n }, (_, i) => {
    const row = new Float64Array(n + 1);
    row.set(A[i]);
    row[n] = b[i];
    return row;
  });

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) {
        maxRow = k;
      }
    }

    const temp = M[i];
    M[i] = M[maxRow];
    M[maxRow] = temp;

    if (Math.abs(M[i][i]) < 1e-12) {
      return null; // Singular matrix
    }

    for (let k = i + 1; k < n; k++) {
      const c = -M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) {
        M[k][j] += c * M[i][j];
      }
    }
  }

  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * x[j];
    }
    x[i] = sum / M[i][i];
  }

  return x;
}

function solveConstraints(vars, constraints, maxIterations = 100, tolerance = 1e-15) {
  let lambda = 1e-3;
  const freeVars = vars.filter(v => v.free);
  const n = freeVars.length;
  if (n === 0) return true;

  let r = evaluateAllResiduals(vars, constraints);
  let error = computeSumOfSquares(r);

  for (let iter = 0; iter < maxIterations; iter++) {
    if (error < tolerance) {
      break;
    }

    const J = computeJacobian(vars, constraints, r);

    const JTJ = Array.from({ length: n }, () => new Float64Array(n));
    const JTr = new Float64Array(n);

    for (let i = 0; i < r.length; i++) {
      for (let j = 0; j < n; j++) {
        JTr[j] += J[i][j] * r[i];
        for (let k = 0; k < n; k++) {
          JTJ[j][k] += J[i][j] * J[i][k];
        }
      }
    }

    let success = false;
    const newVarsState = freeVars.map(v => v.value);

    const A = Array.from({ length: n }, (_, i) => {
      const row = new Float64Array(n);
      for (let j = 0; j < n; j++) {
        row[j] = JTJ[i][j] + (i === j ? lambda : 0);
      }
      return row;
    });

    const b = new Float64Array(n);
    for (let i = 0; i < n; i++) b[i] = -JTr[i];

    const dy = solveLinearSystem(A, b);
    if (dy) {
      for (let i = 0; i < n; i++) {
        freeVars[i].value += dy[i];
      }

      const rNew = evaluateAllResiduals(vars, constraints);
      const errorNew = computeSumOfSquares(rNew);

      if (errorNew < error) {
        error = errorNew;
        r = rNew;
        lambda *= 0.1;
        success = true;
      } else {
        for (let i = 0; i < n; i++) {
          freeVars[i].value = newVarsState[i]; // Restore
        }
        lambda *= 10;
      }
    } else {
      lambda *= 10;
    }

    if (lambda > 1e9) {
      break;
    }
  }

  return error < tolerance;
}

// Node.js module export support for tests
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    Variable,
    Constraint,
    solveConstraints,
    evaluateAllResiduals,
    computeSumOfSquares
  };
}
