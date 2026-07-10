// ==========================================================================
// Mechanical Engineering Standards Database
// Reference specifications for threads, parallel keys, and installation torques
// ==========================================================================

const MetricThreads = {
  "M3": { pitch: 0.5, tapDrill: 2.5, clearanceHole: 3.4, maxTorque: 1.3 }, // Torque in N-m for Grade 8.8 steel
  "M4": { pitch: 0.7, tapDrill: 3.3, clearanceHole: 4.5, maxTorque: 3.0 },
  "M5": { pitch: 0.8, tapDrill: 4.2, clearanceHole: 5.5, maxTorque: 6.0 },
  "M6": { pitch: 1.0, tapDrill: 5.0, clearanceHole: 6.6, maxTorque: 10.0 },
  "M8": { pitch: 1.25, tapDrill: 6.8, clearanceHole: 9.0, maxTorque: 25.0 },
  "M10": { pitch: 1.5, tapDrill: 8.5, clearanceHole: 11.0, maxTorque: 49.0 },
  "M12": { pitch: 1.75, tapDrill: 10.2, clearanceHole: 14.0, maxTorque: 85.0 }
};

const ParallelKeys = {
  // Shaft diameter ranges to Key width x key height and depths (ISO 773 / DIN 6885)
  "6-8": { width: 2, height: 2, keywayShaft: 1.2, keywayHub: 1.0 },
  "8-10": { width: 3, height: 3, keywayShaft: 1.8, keywayHub: 1.4 },
  "10-12": { width: 4, height: 4, keywayShaft: 2.5, keywayHub: 1.8 },
  "12-17": { width: 5, height: 5, keywayShaft: 3.0, keywayHub: 2.3 },
  "17-22": { width: 6, height: 6, keywayShaft: 3.5, keywayHub: 2.8 },
  "22-30": { width: 8, height: 7, keywayShaft: 4.0, keywayHub: 3.3 }
};

// Export to window for browser access, and module.exports for Node tests
if (typeof window !== "undefined") {
  window.MetricThreads = MetricThreads;
  window.ParallelKeys = ParallelKeys;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { MetricThreads, ParallelKeys };
}
