const test = require('node:test');
const assert = require('node:assert/strict');
const Physics = require('./physics.js');

test('Julian Date golden values', () => {
  // J2000.0 Epoch: Jan 1, 2000 at 12:00:00 UTC = JD 2451545.0
  const j2000 = new Date(Date.UTC(2000, 0, 1, 12, 0, 0, 0));
  const jd2000 = Physics.dateToJulian(j2000);
  assert.strictEqual(jd2000, 2451545.0);

  // Unix Epoch: Jan 1, 1970 at 00:00:00 UTC = JD 2440587.5
  const unixEpoch = new Date(Date.UTC(1970, 0, 1, 0, 0, 0, 0));
  const jdUnix = Physics.dateToJulian(unixEpoch);
  assert.strictEqual(jdUnix, 2440587.5);

  // Round-trip
  const restoredDate = Physics.julianToDate(jd2000);
  assert.strictEqual(restoredDate.toISOString(), j2000.toISOString());
});

test('Modified Julian Date (MJD)', () => {
  // MJD for J2000.0 = 2451545.0 - 2400000.5 = 51544.5
  const j2000 = new Date(Date.UTC(2000, 0, 1, 12, 0, 0, 0));
  assert.strictEqual(Physics.dateToMJD(j2000), 51544.5);

  const restored = Physics.mjdToDate(51544.5);
  assert.strictEqual(restored.toISOString(), j2000.toISOString());
});

test('Ordinal / Julian Day-of-Year Conversions', () => {
  // Feb 1, 2024 (leap year) is day 32 of 2024
  const d = new Date(Date.UTC(2024, 1, 1, 0, 0, 0));
  const ord = Physics.dateToOrdinal(d);
  assert.strictEqual(ord.yyddd, '24032');
  assert.strictEqual(ord.yyyyddd, '2024032');
  assert.strictEqual(ord.cyyddd, '124032'); // C = 20 - 19 = 1

  // Parsing back
  const p5 = Physics.ordinalToDate('24032');
  assert.strictEqual(p5.getUTCFullYear(), 2024);
  assert.strictEqual(p5.getUTCMonth(), 1); // Feb
  assert.strictEqual(p5.getUTCDate(), 1);

  const p7 = Physics.ordinalToDate('2024032');
  assert.strictEqual(p7.getUTCFullYear(), 2024);
  assert.strictEqual(p7.getUTCDate(), 1);
});

test('Timezone offset helpers', () => {
  const d = new Date(Date.UTC(2024, 6, 1, 12, 0, 0)); // July 1 (EDT/BST in effect)
  assert.strictEqual(Physics.getTimezoneOffsetMinutes(d, 'UTC'), 0);
  assert.strictEqual(Physics.getTimezoneOffsetMinutes(d, 'GMT'), 0);
});
