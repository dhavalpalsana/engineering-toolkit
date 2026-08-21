import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import CadEngine from './cad-engine.js';

// Helper: Generates an indexed box mesh with dimensions (dx, dy, dz) centered from (0,0,0) to (dx, dy, dz)
function createBoxMesh(dx, dy, dz) {
  // 8 vertices of a cuboid
  const positions = new Float32Array([
    0, 0, 0,    // 0
    dx, 0, 0,   // 1
    dx, dy, 0,  // 2
    0, dy, 0,   // 3
    0, 0, dz,   // 4
    dx, 0, dz,  // 5
    dx, dy, dz, // 6
    0, dy, dz   // 7
  ]);

  // 12 triangles (6 faces * 2 tris) with outward winding
  const indices = new Uint32Array([
    // Bottom (-Z)
    0, 2, 1,  0, 3, 2,
    // Top (+Z)
    4, 5, 6,  4, 6, 7,
    // Front (-Y)
    0, 1, 5,  0, 5, 4,
    // Back (+Y)
    2, 3, 7,  2, 7, 6,
    // Left (-X)
    0, 4, 7,  0, 7, 3,
    // Right (+X)
    1, 2, 6,  1, 6, 5
  ]);

  return { positions, indices };
}

describe('CadEngine — Bounding Box & Dimensions', () => {
  it('computes accurate bounds and extents for cuboid', () => {
    const { positions } = createBoxMesh(10, 20, 30);
    const bbox = CadEngine.calculateBoundingBox(positions);

    assert.equal(bbox.min.x, 0);
    assert.equal(bbox.min.y, 0);
    assert.equal(bbox.min.z, 0);

    assert.equal(bbox.max.x, 10);
    assert.equal(bbox.max.y, 20);
    assert.equal(bbox.max.z, 30);

    assert.equal(bbox.size.x, 10);
    assert.equal(bbox.size.y, 20);
    assert.equal(bbox.size.z, 30);

    assert.equal(bbox.center.x, 5);
    assert.equal(bbox.center.y, 10);
    assert.equal(bbox.center.z, 15);

    const expectedDiag = Math.sqrt(100 + 400 + 900);
    assert.ok(Math.abs(bbox.diagonal - expectedDiag) < 1e-6);
  });

  it('handles empty or zero coordinate lists gracefully', () => {
    const bbox = CadEngine.calculateBoundingBox([]);
    assert.equal(bbox.diagonal, 0);
    assert.equal(bbox.size.x, 0);
  });
});

describe('CadEngine — Surface Area & Volume Metrology', () => {
  it('calculates analytical surface area of 10x20x30 cuboid (2200 mm²)', () => {
    const { positions, indices } = createBoxMesh(10, 20, 30);
    const area = CadEngine.calculateSurfaceArea(positions, indices);

    // 2 * (10*20 + 20*30 + 10*30) = 2 * (200 + 600 + 300) = 2200 mm²
    assert.ok(Math.abs(area - 2200) < 1e-5, `Expected 2200 mm², got ${area}`);
  });

  it('calculates signed volume and center of mass of 10x20x30 cuboid (6000 mm³)', () => {
    const { positions, indices } = createBoxMesh(10, 20, 30);
    const result = CadEngine.calculateVolumeAndCenterOfMass(positions, indices);

    // Volume: 10 * 20 * 30 = 6000 mm³
    assert.ok(Math.abs(result.volume - 6000) < 1e-5, `Expected 6000 mm³, got ${result.volume}`);

    // Center of Mass: (5, 10, 15)
    assert.ok(Math.abs(result.centerOfMass.x - 5) < 1e-5);
    assert.ok(Math.abs(result.centerOfMass.y - 10) < 1e-5);
    assert.ok(Math.abs(result.centerOfMass.z - 15) < 1e-5);
  });
});

describe('CadEngine — Topology & Watertightness Verification', () => {
  it('identifies closed manifold cuboid as watertight', () => {
    const { positions, indices } = createBoxMesh(10, 10, 10);
    const topology = CadEngine.checkMeshTopology(positions, indices);

    assert.equal(topology.isWatertight, true);
    assert.equal(topology.triangleCount, 12);
    assert.equal(topology.openEdgesCount, 0);
    assert.equal(topology.nonManifoldEdgesCount, 0);
  });

  it('detects open edges on non-closed meshes (e.g. single triangle)', () => {
    const singleTrianglePos = new Float32Array([
      0, 0, 0,
      10, 0, 0,
      0, 10, 0
    ]);
    const singleTriangleIdx = new Uint32Array([0, 1, 2]);

    const topology = CadEngine.checkMeshTopology(singleTrianglePos, singleTriangleIdx);

    assert.equal(topology.isWatertight, false);
    assert.equal(topology.triangleCount, 1);
    assert.equal(topology.openEdgesCount, 3);
  });
});

describe('CadEngine — Physical Mass Estimator', () => {
  it('estimates mass for Aluminum 6061 (2.70 g/cm³) accurately', () => {
    // 6,000 mm³ = 6.0 cm³
    const volumeMm3 = 6000;
    const aluDensity = CadEngine.MATERIALS_DB['aluminum-6061'].density; // 2.70
    const mass = CadEngine.estimateMass(volumeMm3, aluDensity);

    // 6.0 * 2.70 = 16.2 grams
    assert.ok(Math.abs(mass.massGrams - 16.2) < 1e-5);
    assert.ok(Math.abs(mass.massKg - 0.0162) < 1e-6);
  });

  it('estimates mass for Stainless Steel 304 (8.00 g/cm³)', () => {
    const volumeMm3 = 10000; // 10 cm³
    const steelDensity = CadEngine.MATERIALS_DB['steel-stainless-304'].density; // 8.00
    const mass = CadEngine.estimateMass(volumeMm3, steelDensity);

    assert.ok(Math.abs(mass.massGrams - 80.0) < 1e-5);
  });
});

describe('CadEngine — Format Exporters & Serializers', () => {
  it('exports Binary STL with valid header and triangle byte count', () => {
    const { positions, indices } = createBoxMesh(5, 5, 5);
    const buffer = CadEngine.exportSTL({ positions, indices }, { binary: true, name: 'cube' });

    assert.ok(buffer instanceof ArrayBuffer);
    // 80 bytes header + 4 bytes tri count + 12 tris * 50 bytes = 684 bytes
    assert.equal(buffer.byteLength, 684);

    const view = new DataView(buffer);
    const triCount = view.getUint32(80, true);
    assert.equal(triCount, 12);
  });

  it('exports ASCII STL with solid/facet syntax', () => {
    const { positions, indices } = createBoxMesh(5, 5, 5);
    const asciiStl = CadEngine.exportSTL({ positions, indices }, { binary: false, name: 'test_box' });

    assert.equal(typeof asciiStl, 'string');
    assert.ok(asciiStl.startsWith('solid test_box'));
    assert.ok(asciiStl.includes('facet normal'));
    assert.ok(asciiStl.includes('outer loop'));
    assert.ok(asciiStl.endsWith('endsolid test_box\n'));
  });

  it('exports Wavefront OBJ format with vertex and face lists', () => {
    const { positions, indices } = createBoxMesh(5, 5, 5);
    const objText = CadEngine.exportOBJ({ positions, indices }, { name: 'sample_part' });

    assert.ok(typeof objText === 'string');
    assert.ok(objText.includes('o sample_part'));
    assert.ok(objText.includes('v 0.000000 0.000000 0.000000'));
    assert.ok(objText.includes('f 1 3 2'));
  });
});

describe('CadEngine — Mesh Transformation & Scaling', () => {
  it('scales mesh coordinates and shifts to origin', () => {
    const { positions, indices } = createBoxMesh(10, 20, 30);
    const transformed = CadEngine.transformMeshData({ positions, indices }, {
      scale: 2.0,
      centerOrigin: true
    });

    const newBbox = CadEngine.calculateBoundingBox(transformed.positions);
    assert.equal(newBbox.size.x, 20);
    assert.equal(newBbox.size.y, 40);
    assert.equal(newBbox.size.z, 60);

    assert.ok(Math.abs(newBbox.center.x) < 1e-5);
    assert.ok(Math.abs(newBbox.center.y) < 1e-5);
    assert.ok(Math.abs(newBbox.center.z) < 1e-5);
  });

  it('aligns lowest point to ground plane Z=0', () => {
    const { positions, indices } = createBoxMesh(10, 10, 10);
    // Shift initial Z up by 50
    for (let i = 2; i < positions.length; i += 3) {
      positions[i] += 50;
    }

    const transformed = CadEngine.transformMeshData({ positions, indices }, {
      alignGround: true
    });

    const bbox = CadEngine.calculateBoundingBox(transformed.positions);
    assert.ok(Math.abs(bbox.min.z) < 1e-5);
  });
});
