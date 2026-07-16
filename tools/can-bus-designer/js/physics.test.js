/**
 * Unit tests for CAN physical-layer helpers.
 * Run: node --test tools/can-bus-designer/js/physics.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const P = require('./physics.js');

describe('parallelResistance', () => {
  it('two 120 Ω terminators → 60 Ω', () => {
    assert.equal(P.parallelResistance([120, 120]), 60);
  });
  it('four 120 Ω → 30 Ω', () => {
    assert.equal(P.parallelResistance([120, 120, 120, 120]), 30);
  });
  it('empty → Infinity', () => {
    assert.equal(P.parallelResistance([]), Infinity);
  });
  it('single 120 → 120', () => {
    assert.equal(P.parallelResistance([120]), 120);
  });
});

describe('computeArbitrationTiming', () => {
  it('bit time at 250 kbps is 4000 ns', () => {
    const t = P.computeArbitrationTiming({
      baudKbps: 250,
      samplePointPct: 80,
      trunkLengthM: 0,
      propDelayNsPerM: 5,
      loopDelayNs: 0,
      marginNs: 0
    });
    assert.equal(t.bitTimeNs, 4000);
    assert.equal(t.budgetNs, 3200); // 80% of 4000
  });

  it('bit time at 1000 kbps is 1000 ns', () => {
    const t = P.computeArbitrationTiming({
      baudKbps: 1000,
      samplePointPct: 75,
      trunkLengthM: 0,
      propDelayNsPerM: 5,
      loopDelayNs: 0,
      marginNs: 0
    });
    assert.equal(t.bitTimeNs, 1000);
    assert.equal(t.budgetNs, 750);
  });

  it('prop delay uses 2×(L·τ + loop) + margin', () => {
    // L=40m, τ=5 ns/m → cable RT = 400 ns; loop=150 → 2*(400? wait)
    // 2 * (40*5 + 150) + 50 = 2*(200+150)+50 = 700+50 = 750
    const t = P.computeArbitrationTiming({
      baudKbps: 1000,
      samplePointPct: 80,
      trunkLengthM: 40,
      propDelayNsPerM: 5,
      loopDelayNs: 150,
      marginNs: 50
    });
    assert.equal(t.propNs, 750);
    // budget 800 ns → just OK
    assert.equal(t.ok, true);
  });

  it('fails when prop exceeds sample budget', () => {
    const t = P.computeArbitrationTiming({
      baudKbps: 1000,
      samplePointPct: 75,
      trunkLengthM: 100,
      propDelayNsPerM: 5,
      loopDelayNs: 150,
      marginNs: 50
    });
    // 2*(500+150)+50 = 1350 > 750
    assert.equal(t.ok, false);
    assert.ok(t.propNs > t.budgetNs);
  });
});

describe('maxTrunkLengthM', () => {
  it('matches common ISO 11898 rule-of-thumb table', () => {
    assert.equal(P.maxTrunkLengthM(1000), 40);
    assert.equal(P.maxTrunkLengthM(500), 100);
    assert.equal(P.maxTrunkLengthM(250), 250);
  });
});

describe('maxStubLimitM', () => {
  it('classic 1 Mbps stub ≤ 0.3 m', () => {
    assert.equal(P.maxStubLimitM(1000), 0.3);
  });
  it('CAN FD 5 Mbps data stub is tighter than nominal', () => {
    assert.equal(P.maxStubLimitM(500, { canFd: true, dataBaudKbps: 5000 }), 0.08);
    assert.ok(P.maxStubLimitM(500, { canFd: true, dataBaudKbps: 5000 }) < P.maxStubLimitM(500));
  });
});

describe('trunkLengthFromStations', () => {
  it('sums spacing from the second station onward', () => {
    const L = P.trunkLengthFromStations([
      { distanceFromPrev: 99 }, // ignored
      { distanceFromPrev: 12 },
      { distanceFromPrev: 15 },
      { distanceFromPrev: 8 }
    ]);
    assert.equal(L, 35);
  });
  it('empty → 0', () => {
    assert.equal(P.trunkLengthFromStations([]), 0);
  });
});

describe('branched topology', () => {
  it('longest path uses Y-branch diameter', () => {
    const stations = [
      { id: 'a', parentId: null, distanceFromParent: 0 },
      { id: 'j', parentId: 'a', distanceFromParent: 5 },
      { id: 'b', parentId: 'j', distanceFromParent: 6 },
      { id: 'c', parentId: 'j', distanceFromParent: 3 }
    ];
    const edges = P.trunkEdgesFromStations(stations);
    // A—5—J—6—B = 11 (longest path endpoints A–B)
    assert.equal(P.longestPathLengthM(['a', 'j', 'b', 'c'], edges), 11);
  });
  it('leaves are degree-1 nodes', () => {
    const stations = [
      { id: 'a', parentId: null },
      { id: 'j', parentId: 'a', distanceFromParent: 1 },
      { id: 'b', parentId: 'j', distanceFromParent: 1 },
      { id: 'c', parentId: 'j', distanceFromParent: 1 }
    ];
    const edges = P.trunkEdgesFromStations(stations);
    const leaves = P.leafStationIds(['a', 'j', 'b', 'c'], edges).sort();
    assert.deepEqual(leaves, ['a', 'b', 'c']);
  });
});

describe('standards packs', () => {
  it('exposes ISO, J1939, CiA packs', () => {
    assert.ok(P.getStandardsPack('iso11898-2'));
    assert.ok(P.getStandardsPack('j1939'));
    assert.ok(P.getStandardsPack('cia'));
  });
  it('J1939 allows longer stubs at 250 kbps than ISO', () => {
    assert.ok(
      P.maxStubLimitM(250, { packId: 'j1939' }) >
      P.maxStubLimitM(250, { packId: 'iso11898-2' })
    );
  });
});

console.log('CAN physics unit tests defined.');
