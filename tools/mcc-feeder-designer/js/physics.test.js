const test = require('node:test');
const assert = require('node:assert/strict');
const Physics = require('./physics.js');

test('NEC Motor FLA lookup and voltage scaling', () => {
  // 10 HP @ 460V is 14.0 A
  const fla460 = Physics.getNECMotorFLA(10, 460);
  assert.strictEqual(fla460, 14.0);

  // 10 HP @ 230V scales inversely with voltage: 14 * (460 / 230) = 28.0 A
  const fla230 = Physics.getNECMotorFLA(10, 230);
  assert.strictEqual(fla230, 28.0);

  // 50 HP @ 460V is 65.0 A
  const fla50 = Physics.getNECMotorFLA(50, 460);
  assert.strictEqual(fla50, 65.0);
});

test('IEC Motor Full Load Current calculation', () => {
  // 15 kW motor @ 400V, 90% efficiency, 0.85 pf:
  // I = 15000 / (sqrt(3) * 400 * 0.90 * 0.85) = 28.3015 A
  const fla = Physics.calculateMotorFLA({
    power: 15,
    unit: 'kW',
    efficiency: 90,
    pf: 0.85,
    standard: 'IEC',
    voltage: 400
  });
  assert.ok(Math.abs(fla - 28.3015) < 0.01, `Expected ~28.3015 A, got ${fla}`);
});

test('Component standard sizing selectors', () => {
  // Breaker sizing: 35.39 A requires next standard size -> 40 A
  assert.strictEqual(Physics.selectBreakerSize(35.39), 40);
  assert.strictEqual(Physics.selectBreakerSize(80), 80);
  assert.strictEqual(Physics.selectBreakerSize(95), 100);

  // Contactor sizing: 28.31 A requires next standard size -> 32 A
  assert.strictEqual(Physics.selectContactorSize(28.31), 32);

  // Soft starter: 42 A requires next standard size -> 45 A
  assert.strictEqual(Physics.selectSoftStarterSize(42), 45);

  // VFD: 22 A requires next standard rating -> 25 A
  assert.strictEqual(Physics.selectVfdSize(22), 25);
});

test('Thermal and grouping derating factors', () => {
  // Reference ambient 30°C with grouping 1.0 -> factor 1.0
  const f30 = Physics.calculateDeratingFactor({ ambientTemp: 30, insulation: 'XLPE', groupingFactor: 1.0 });
  assert.strictEqual(f30, 1.0);

  // 45°C ambient with XLPE (90°C max): sqrt((90 - 45) / (90 - 30)) = sqrt(45/60) = sqrt(0.75) ~ 0.866
  const f45 = Physics.calculateDeratingFactor({ ambientTemp: 45, insulation: 'XLPE', groupingFactor: 1.0 });
  assert.ok(Math.abs(f45 - Math.sqrt(0.75)) < 1e-4, `Expected ~0.866, got ${f45}`);

  // With grouping factor 0.8: 0.866 * 0.8 = 0.6928
  const f45Group = Physics.calculateDeratingFactor({ ambientTemp: 45, insulation: 'XLPE', groupingFactor: 0.8 });
  assert.ok(Math.abs(f45Group - Math.sqrt(0.75) * 0.8) < 1e-4);
});

test('3-Phase voltage drop calculation', () => {
  // 28.31 A, 50 m, 6 mm² Cu conductor, 400 V, 0.85 pf
  const vd = Physics.calculateVoltageDrop3Phase({
    loadCurrent: 28.31,
    lengthM: 50,
    wireAreaMm2: 6,
    material: 'Cu',
    parallelRuns: 1,
    voltage: 400,
    pf: 0.85
  });

  // R = (0.0225 * 50) / 6 = 0.1875 Ohm
  assert.strictEqual(vd.R, 0.1875);
  // X = 0.00008 * 50 = 0.004 Ohm
  assert.strictEqual(vd.X, 0.004);
  // vdVolt ~ 7.91 V (< 3% limit -> ~1.98%)
  assert.ok(Math.abs(vd.vdVolt - 7.91) < 0.1, `Expected ~7.91 V, got ${vd.vdVolt}`);
  assert.ok(Math.abs(vd.vdPct - 1.98) < 0.05, `Expected ~1.98%, got ${vd.vdPct}`);
});
