/**
 * CAN physical-layer helpers + standards packs (pure, browser + Node).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CanPhysics = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function parallelResistance(ohmsList) {
    const vals = (ohmsList || []).map(Number).filter((r) => r > 0 && Number.isFinite(r));
    if (vals.length === 0) return Infinity;
    return 1 / vals.reduce((s, r) => s + 1 / r, 0);
  }

  function computeArbitrationTiming({
    baudKbps,
    samplePointPct,
    trunkLengthM,
    propDelayNsPerM,
    loopDelayNs,
    marginNs = 50
  }) {
    const baud = Math.max(1, Number(baudKbps) || 250);
    const sp = Math.min(95, Math.max(50, Number(samplePointPct) || 80));
    const L = Math.max(0, Number(trunkLengthM) || 0);
    const tau = Math.max(0.1, Number(propDelayNsPerM) || 5);
    const loop = Math.max(0, Number(loopDelayNs) || 0);
    const margin = Math.max(0, Number(marginNs) || 0);
    const bitTimeNs = 1e6 / baud;
    const budgetNs = (sp / 100) * bitTimeNs;
    const propNs = 2 * (L * tau + loop) + margin;
    return {
      bitTimeNs,
      budgetNs,
      propNs,
      marginNs: margin,
      ok: propNs < budgetNs,
      tight: propNs >= budgetNs * 0.8 && propNs < budgetNs
    };
  }

  const TRUNK_ISO = {
    1000: 40, 800: 50, 500: 100, 250: 250, 125: 500, 50: 1000, 20: 2500, 10: 5000
  };

  // J1939 physical layer commonly designed around 250 kbps with longer drops allowed
  const STUB_ISO = {
    1000: 0.3, 800: 0.3, 500: 1.0, 250: 1.5, 125: 3.0, 50: 6.0, 20: 15.0, 10: 30.0
  };
  const STUB_J1939 = {
    1000: 0.3, 800: 0.3, 500: 1.0, 250: 3.0, 125: 6.0, 50: 10.0, 20: 20.0, 10: 40.0
  };
  const STUB_CIA = {
    1000: 0.3, 800: 0.3, 500: 0.3, 250: 1.0, 125: 2.0, 50: 5.0, 20: 12.0, 10: 25.0
  };

  const CUM_ISO = {
    1000: 3.0, 800: 3.0, 500: 10.0, 250: 15.0, 125: 30.0, 50: 60.0, 20: 150.0, 10: 300.0
  };
  const CUM_J1939 = {
    1000: 3.0, 800: 3.0, 500: 12.0, 250: 40.0, 125: 60.0, 50: 80.0, 20: 150.0, 10: 300.0
  };
  const CUM_CIA = {
    1000: 2.0, 800: 2.0, 500: 5.0, 250: 10.0, 125: 20.0, 50: 40.0, 20: 100.0, 10: 200.0
  };

  const DATA_STUB = {
    1000: 0.3, 2000: 0.2, 4000: 0.1, 5000: 0.08, 8000: 0.04
  };
  const DATA_CUM = {
    1000: 3.0, 2000: 1.5, 4000: 0.8, 5000: 0.5, 8000: 0.2
  };

  /**
   * Standards packs: hard checks = ISO-style must-haves for a functional bus.
   * guidelines = design practice (not always hard ISO "shall" clauses).
   */
  const STANDARDS_PACKS = {
    'iso11898-2': {
      id: 'iso11898-2',
      name: 'ISO 11898-2',
      shortName: 'ISO 11898-2',
      description: 'High-speed CAN physical layer. Exactly two end terminators, stub and trunk limits by bit rate.',
      stubLimits: STUB_ISO,
      cumStubLimits: CUM_ISO,
      trunkLimits: TRUNK_ISO,
      minNodeSpacingM: 0.1,
      starWarnAt: 2,
      starFailAt: 3,
      // hard = fail severity; guideline = advisory (never elevates to hard fail alone)
      hard: {
        terminationCount: true,
        terminationPlacement: true,
        trunkLength: true,
        individualStub: true,
        arbitrationTiming: true
      },
      guidelines: {
        cumulativeStub: true,
        starTopology: true,
        nodeSpacing: true
      }
    },
    j1939: {
      id: 'j1939',
      name: 'SAE J1939 (physical guidance)',
      shortName: 'J1939',
      description: 'Heavy-duty vehicle CAN (typ. 250 kbps). Allows longer stubs/drops than general ISO tables; still expects two terminators.',
      stubLimits: STUB_J1939,
      cumStubLimits: CUM_J1939,
      trunkLimits: Object.assign({}, TRUNK_ISO, { 250: 40 }), // J1939 backbone often ~40 m class at 250k
      minNodeSpacingM: 0.1,
      starWarnAt: 2,
      starFailAt: 4, // more tolerant of multi-drop junctions as guidelines
      hard: {
        terminationCount: true,
        terminationPlacement: true,
        trunkLength: true,
        individualStub: true,
        arbitrationTiming: true
      },
      guidelines: {
        cumulativeStub: true,
        starTopology: true,
        nodeSpacing: true
      }
    },
    cia: {
      id: 'cia',
      name: 'CiA recommendations',
      shortName: 'CiA',
      description: 'CAN in Automation design practice — often stricter stub guidance than bare ISO tables.',
      stubLimits: STUB_CIA,
      cumStubLimits: CUM_CIA,
      trunkLimits: TRUNK_ISO,
      minNodeSpacingM: 0.15,
      starWarnAt: 2,
      starFailAt: 3,
      hard: {
        terminationCount: true,
        terminationPlacement: true,
        trunkLength: true,
        individualStub: true,
        arbitrationTiming: true
      },
      guidelines: {
        cumulativeStub: true,
        starTopology: true,
        nodeSpacing: true
      }
    }
  };

  function getStandardsPack(id) {
    return STANDARDS_PACKS[id] || STANDARDS_PACKS['iso11898-2'];
  }

  function maxTrunkLengthM(baudKbps, packId) {
    const pack = getStandardsPack(packId);
    return (pack.trunkLimits && pack.trunkLimits[baudKbps]) || TRUNK_ISO[baudKbps] || 40;
  }

  function maxStubLimitM(baudKbps, { canFd = false, dataBaudKbps = 2000, packId = 'iso11898-2' } = {}) {
    if (canFd) return DATA_STUB[dataBaudKbps] ?? 0.3;
    const pack = getStandardsPack(packId);
    return (pack.stubLimits && pack.stubLimits[baudKbps]) || STUB_ISO[baudKbps] || 0.3;
  }

  function maxCumStubLimitM(baudKbps, { canFd = false, dataBaudKbps = 2000, packId = 'iso11898-2' } = {}) {
    if (canFd) return DATA_CUM[dataBaudKbps] ?? 3;
    const pack = getStandardsPack(packId);
    return (pack.cumStubLimits && pack.cumStubLimits[baudKbps]) || CUM_ISO[baudKbps] || 15;
  }

  /**
   * Tree / branched trunk helpers.
   * stations: [{ id, parentId, distanceFromParent|distanceFromPrev, busId }]
   * Returns undirected edge list with lengths.
   */
  function trunkEdgesFromStations(stations) {
    const byId = new Map((stations || []).map((s) => [s.id, s]));
    const edges = [];
    (stations || []).forEach((s) => {
      if (!s.parentId || !byId.has(s.parentId)) return;
      if (s.busId && byId.get(s.parentId).busId && s.busId !== byId.get(s.parentId).busId) return;
      const len = Number(s.distanceFromParent != null ? s.distanceFromParent : s.distanceFromPrev) || 0;
      edges.push({
        id: `e_${s.parentId}_${s.id}`,
        from: s.parentId,
        to: s.id,
        length: Math.max(0, len),
        busId: s.busId || byId.get(s.parentId).busId || 'bus-1'
      });
    });
    return edges;
  }

  function adjacencyFromEdges(edges) {
    const adj = new Map();
    const ensure = (id) => {
      if (!adj.has(id)) adj.set(id, []);
      return adj.get(id);
    };
    (edges || []).forEach((e) => {
      ensure(e.from).push({ to: e.to, length: e.length, id: e.id });
      ensure(e.to).push({ to: e.from, length: e.length, id: e.id });
    });
    return adj;
  }

  /** Total installed trunk cable length (sum of edges). */
  function totalTrunkCableM(edges) {
    return (edges || []).reduce((s, e) => s + (Number(e.length) || 0), 0);
  }

  /**
   * Longest path length in a tree (electrical diameter) for timing.
   * For multi-component graphs, returns max diameter among components.
   */
  function longestPathLengthM(stationIds, edges) {
    const ids = stationIds || [];
    if (ids.length <= 1) return 0;
    const adj = adjacencyFromEdges(edges);
    ids.forEach((id) => {
      if (!adj.has(id)) adj.set(id, []);
    });

    function farthest(start) {
      const dist = new Map([[start, 0]]);
      const q = [start];
      let far = start;
      while (q.length) {
        const u = q.shift();
        for (const { to, length } of adj.get(u) || []) {
          if (dist.has(to)) continue;
          const d = dist.get(u) + length;
          dist.set(to, d);
          q.push(to);
          if (d > (dist.get(far) || 0)) far = to;
        }
      }
      return { node: far, dist };
    }

    // Handle disconnected components
    let best = 0;
    const seen = new Set();
    ids.forEach((id) => {
      if (seen.has(id)) return;
      const a = farthest(id);
      a.dist.forEach((_, n) => seen.add(n));
      const b = farthest(a.node);
      const diam = Math.max(0, ...b.dist.values());
      if (diam > best) best = diam;
    });
    return best;
  }

  function nodeDegrees(stationIds, edges) {
    const deg = new Map((stationIds || []).map((id) => [id, 0]));
    (edges || []).forEach((e) => {
      deg.set(e.from, (deg.get(e.from) || 0) + 1);
      deg.set(e.to, (deg.get(e.to) || 0) + 1);
    });
    return deg;
  }

  /** Degree-1 stations = electrical ends of a tree network. */
  function leafStationIds(stationIds, edges) {
    const deg = nodeDegrees(stationIds, edges);
    const leaves = [];
    deg.forEach((d, id) => {
      if (d <= 1) leaves.push(id);
    });
    return leaves;
  }

  function trunkLengthFromStations(stations) {
    // Legacy linear: sum distanceFromPrev from index 1
    if (!stations || !stations.length) return 0;
    const edges = trunkEdgesFromStations(stations);
    if (edges.length) return totalTrunkCableM(edges);
    let sum = 0;
    for (let i = 1; i < stations.length; i++) {
      sum += Math.max(0, Number(stations[i].distanceFromPrev) || 0);
    }
    return sum;
  }

  return {
    parallelResistance,
    computeArbitrationTiming,
    maxTrunkLengthM,
    maxStubLimitM,
    maxCumStubLimitM,
    trunkLengthFromStations,
    trunkEdgesFromStations,
    totalTrunkCableM,
    longestPathLengthM,
    leafStationIds,
    nodeDegrees,
    getStandardsPack,
    STANDARDS_PACKS,
    STANDARD_STUB_LIMITS: STUB_ISO,
    STANDARD_CUMULATIVE_LIMITS: CUM_ISO,
    DATA_STUB_LIMITS: DATA_STUB,
    DATA_CUMULATIVE_LIMITS: DATA_CUM
  };
});
