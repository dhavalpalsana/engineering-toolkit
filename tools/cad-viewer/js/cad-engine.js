/**
 * cad-engine.js — Pure UMD computation engine for 3D CAD analysis, metrology, and format conversion.
 * 
 * Works in Node.js (for unit testing) and in the browser.
 * No DOM dependencies.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CadEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Common engineering material densities in g/cm³
  const MATERIALS_DB = {
    'aluminum-6061': { name: 'Aluminum 6061-T6', density: 2.70, category: 'Metals' },
    'aluminum-7075': { name: 'Aluminum 7075-T6', density: 2.81, category: 'Metals' },
    'steel-mild-1018': { name: 'Steel (Mild 1018)', density: 7.87, category: 'Metals' },
    'steel-stainless-304': { name: 'Stainless Steel 304', density: 8.00, category: 'Metals' },
    'steel-stainless-316': { name: 'Stainless Steel 316', density: 8.00, category: 'Metals' },
    'titanium-gr5': { name: 'Titanium (Grade 5 / Ti-6Al-4V)', density: 4.43, category: 'Metals' },
    'brass-c360': { name: 'Brass (C360)', density: 8.50, category: 'Metals' },
    'copper-110': { name: 'Pure Copper (C110)', density: 8.94, category: 'Metals' },
    'pla': { name: 'PLA (3D Print)', density: 1.24, category: 'Polymers' },
    'abs': { name: 'ABS (3D Print)', density: 1.04, category: 'Polymers' },
    'petg': { name: 'PETG (3D Print)', density: 1.27, category: 'Polymers' },
    'nylon-pa12': { name: 'Nylon PA12 (SLS / FDM)', density: 1.01, category: 'Polymers' },
    'polycarbonate': { name: 'Polycarbonate (PC)', density: 1.20, category: 'Polymers' },
    'peek': { name: 'PEEK (High Performance)', density: 1.32, category: 'Polymers' },
    'carbon-fiber-cf': { name: 'Carbon Fiber Composite (60% Fiber)', density: 1.55, category: 'Composites' },
    'resin-standard': { name: 'Standard UV Resin (SLA)', density: 1.15, category: 'Polymers' }
  };

  /**
   * Calculates axis-aligned bounding box from vertex positions.
   * @param {ArrayLike<number>} positions - Flat array of [x0, y0, z0, x1, y1, z1, ...]
   * @returns {{min: {x:number, y:number, z:number}, max: {x:number, y:number, z:number}, size: {x:number, y:number, z:number}, center: {x:number, y:number, z:number}, diagonal: number}}
   */
  function calculateBoundingBox(positions) {
    if (!positions || positions.length < 3) {
      return {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 },
        size: { x: 0, y: 0, z: 0 },
        center: { x: 0, y: 0, z: 0 },
        diagonal: 0
      };
    }

    let minX = positions[0], maxX = positions[0];
    let minY = positions[1], maxY = positions[1];
    let minZ = positions[2], maxZ = positions[2];

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }

    const sizeX = maxX - minX;
    const sizeY = maxY - minY;
    const sizeZ = maxZ - minZ;
    const centerX = minX + sizeX / 2;
    const centerY = minY + sizeY / 2;
    const centerZ = minZ + sizeZ / 2;
    const diagonal = Math.sqrt(sizeX * sizeX + sizeY * sizeY + sizeZ * sizeZ);

    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
      size: { x: sizeX, y: sizeY, z: sizeZ },
      center: { x: centerX, y: centerY, z: centerZ },
      diagonal: diagonal
    };
  }

  /**
   * Calculates total surface area of triangular mesh in square millimeters (or model units).
   * Uses cross product: Area = 0.5 * |(v1 - v0) x (v2 - v0)|
   * @param {ArrayLike<number>} positions - Flat array of vertex coordinates
   * @param {ArrayLike<number>|null} indices - Optional index array
   * @returns {number} Total surface area
   */
  function calculateSurfaceArea(positions, indices) {
    if (!positions || positions.length < 9) return 0;

    let totalArea = 0;

    if (indices && indices.length >= 3) {
      for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i] * 3;
        const i1 = indices[i + 1] * 3;
        const i2 = indices[i + 2] * 3;

        const ax = positions[i0], ay = positions[i0 + 1], az = positions[i0 + 2];
        const bx = positions[i1], by = positions[i1 + 1], bz = positions[i1 + 2];
        const cx = positions[i2], cy = positions[i2 + 1], cz = positions[i2 + 2];

        totalArea += triangleArea(ax, ay, az, bx, by, bz, cx, cy, cz);
      }
    } else {
      for (let i = 0; i < positions.length; i += 9) {
        const ax = positions[i], ay = positions[i + 1], az = positions[i + 2];
        const bx = positions[i + 3], by = positions[i + 4], bz = positions[i + 5];
        const cx = positions[i + 6], cy = positions[i + 7], cz = positions[i + 8];

        totalArea += triangleArea(ax, ay, az, bx, by, bz, cx, cy, cz);
      }
    }

    return totalArea;
  }

  function triangleArea(ax, ay, az, bx, by, bz, cx, cy, cz) {
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;

    const crossX = aby * acz - abz * acy;
    const crossY = abz * acx - abx * acz;
    const crossZ = abx * acy - aby * acx;

    return 0.5 * Math.sqrt(crossX * crossX + crossY * crossY + crossZ * crossZ);
  }

  /**
   * Calculates signed volume and center of mass of a closed 3D mesh via signed tetrahedra summation.
   * Vol = 1/6 * sum( v0 . (v1 x v2) )
   * @param {ArrayLike<number>} positions
   * @param {ArrayLike<number>|null} indices
   * @returns {{volume: number, centerOfMass: {x:number, y:number, z:number}}}
   */
  function calculateVolumeAndCenterOfMass(positions, indices) {
    if (!positions || positions.length < 9) {
      return { volume: 0, centerOfMass: { x: 0, y: 0, z: 0 } };
    }

    let totalVolume = 0;
    let cxSum = 0, cySum = 0, czSum = 0;

    function processTriangle(ax, ay, az, bx, by, bz, cx, cy, cz) {
      // Signed volume of tetrahedron formed by (0,0,0) and triangle (a, b, c)
      // v = 1/6 * (a . (b x c))
      const crossX = by * cz - bz * cy;
      const crossY = bz * cx - bx * cz;
      const crossZ = bx * cy - by * cx;

      const tetVol = (ax * crossX + ay * crossY + az * crossZ) / 6.0;
      totalVolume += tetVol;

      // Centroid of tetrahedron is (a + b + c + 0)/4 = (a + b + c)/4
      const tetCentroidX = (ax + bx + cx) * 0.25;
      const tetCentroidY = (ay + by + cy) * 0.25;
      const tetCentroidZ = (az + bz + cz) * 0.25;

      cxSum += tetVol * tetCentroidX;
      cySum += tetVol * tetCentroidY;
      czSum += tetVol * tetCentroidZ;
    }

    if (indices && indices.length >= 3) {
      for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i] * 3;
        const i1 = indices[i + 1] * 3;
        const i2 = indices[i + 2] * 3;

        processTriangle(
          positions[i0], positions[i0 + 1], positions[i0 + 2],
          positions[i1], positions[i1 + 1], positions[i1 + 2],
          positions[i2], positions[i2 + 1], positions[i2 + 2]
        );
      }
    } else {
      for (let i = 0; i < positions.length; i += 9) {
        processTriangle(
          positions[i], positions[i + 1], positions[i + 2],
          positions[i + 3], positions[i + 4], positions[i + 5],
          positions[i + 6], positions[i + 7], positions[i + 8]
        );
      }
    }

    const volume = Math.abs(totalVolume);
    let centerOfMass = { x: 0, y: 0, z: 0 };

    if (Math.abs(totalVolume) > 1e-9) {
      centerOfMass = {
        x: cxSum / totalVolume,
        y: cySum / totalVolume,
        z: czSum / totalVolume
      };
    } else {
      // Fallback to bounding box center if volume is 0
      const bbox = calculateBoundingBox(positions);
      centerOfMass = bbox.center;
    }

    return {
      volume: volume,
      signedVolume: totalVolume,
      centerOfMass: centerOfMass
    };
  }

  /**
   * Verifies mesh manifold topology and watertightness.
   * Checks if every edge connects to exactly 2 faces.
   * @param {ArrayLike<number>} positions
   * @param {ArrayLike<number>|null} indices
   * @param {number} precisionTolerance - Distance tolerance for merging coincident vertices
   * @returns {{isWatertight: boolean, triangleCount: number, vertexCount: number, openEdgesCount: number, nonManifoldEdgesCount: number}}
   */
  function checkMeshTopology(positions, indices, precisionTolerance = 1e-4) {
    if (!positions || positions.length < 9) {
      return {
        isWatertight: false,
        triangleCount: 0,
        vertexCount: 0,
        openEdgesCount: 0,
        nonManifoldEdgesCount: 0
      };
    }

    // Step 1: Quantize vertex coordinates to canonical keys to handle shared geometric vertices
    const quant = 1 / precisionTolerance;
    const vertexMap = new Map(); // key -> unified vertex ID
    let unifiedVertexCount = 0;
    const vertexIndices = [];

    const numCoords = positions.length;
    for (let i = 0; i < numCoords; i += 3) {
      const qx = Math.round(positions[i] * quant);
      const qy = Math.round(positions[i + 1] * quant);
      const qz = Math.round(positions[i + 2] * quant);
      const key = `${qx}_${qy}_${qz}`;

      let unifiedId = vertexMap.get(key);
      if (unifiedId === undefined) {
        unifiedId = unifiedVertexCount++;
        vertexMap.set(key, unifiedId);
      }
      vertexIndices.push(unifiedId);
    }

    // Step 2: Build triangle index list
    const triangles = [];
    if (indices && indices.length >= 3) {
      for (let i = 0; i < indices.length; i += 3) {
        triangles.push([
          vertexIndices[indices[i]],
          vertexIndices[indices[i + 1]],
          vertexIndices[indices[i + 2]]
        ]);
      }
    } else {
      const count = Math.floor(positions.length / 9);
      for (let i = 0; i < count; i++) {
        triangles.push([
          vertexIndices[i * 3],
          vertexIndices[i * 3 + 1],
          vertexIndices[i * 3 + 2]
        ]);
      }
    }

    // Step 3: Count edge frequencies
    // Edge key: min(u, v) + "_" + max(u, v)
    const edgeCount = new Map();
    for (let t = 0; t < triangles.length; t++) {
      const [v0, v1, v2] = triangles[t];
      // Skip degenerate triangles
      if (v0 === v1 || v1 === v2 || v2 === v0) continue;

      const e0 = v0 < v1 ? `${v0}_${v1}` : `${v1}_${v0}`;
      const e1 = v1 < v2 ? `${v1}_${v2}` : `${v2}_${v1}`;
      const e2 = v2 < v0 ? `${v2}_${v0}` : `${v0}_${v2}`;

      edgeCount.set(e0, (edgeCount.get(e0) || 0) + 1);
      edgeCount.set(e1, (edgeCount.get(e1) || 0) + 1);
      edgeCount.set(e2, (edgeCount.get(e2) || 0) + 1);
    }

    let openEdgesCount = 0;
    let nonManifoldEdgesCount = 0;

    for (const count of edgeCount.values()) {
      if (count === 1) {
        openEdgesCount++;
      } else if (count > 2) {
        nonManifoldEdgesCount++;
      }
    }

    const isWatertight = (openEdgesCount === 0 && nonManifoldEdgesCount === 0 && triangles.length > 0);

    return {
      isWatertight: isWatertight,
      triangleCount: triangles.length,
      vertexCount: unifiedVertexCount,
      openEdgesCount: openEdgesCount,
      nonManifoldEdgesCount: nonManifoldEdgesCount
    };
  }

  /**
   * Estimates physical mass from volume and material density.
   * Assumes volume is in mm³.
   * @param {number} volumeMm3 - Volume in cubic millimeters
   * @param {number} densityGramsPerCm3 - Density in g/cm³
   * @returns {{massGrams: number, massKg: number, massPounds: number, massOunces: number}}
   */
  function estimateMass(volumeMm3, densityGramsPerCm3) {
    if (!volumeMm3 || volumeMm3 <= 0 || !densityGramsPerCm3 || densityGramsPerCm3 <= 0) {
      return { massGrams: 0, massKg: 0, massPounds: 0, massOunces: 0 };
    }

    // 1 cm³ = 1,000 mm³
    const volumeCm3 = volumeMm3 / 1000.0;
    const massGrams = volumeCm3 * densityGramsPerCm3;
    const massKg = massGrams / 1000.0;
    const massPounds = massGrams * 0.00220462;
    const massOunces = massGrams * 0.035274;

    return {
      massGrams: massGrams,
      massKg: massKg,
      massPounds: massPounds,
      massOunces: massOunces
    };
  }

  /**
   * Transforms raw mesh data (scaling, centering to origin, ground alignment, flipping normals).
   * @param {{positions: Float32Array|number[], normals?: Float32Array|number[], indices?: Uint32Array|number[]}} meshData
   * @param {{scale?: number, centerOrigin?: boolean, alignGround?: boolean, flipNormals?: boolean}} options
   * @returns {{positions: Float32Array, normals?: Float32Array, indices?: Uint32Array}}
   */
  function transformMeshData(meshData, options = {}) {
    const scale = options.scale !== undefined ? options.scale : 1.0;
    const centerOrigin = !!options.centerOrigin;
    const alignGround = !!options.alignGround;
    const flipNormals = !!options.flipNormals;

    const srcPos = meshData.positions;
    const outPos = new Float32Array(srcPos.length);

    // Apply scale
    for (let i = 0; i < srcPos.length; i++) {
      outPos[i] = srcPos[i] * scale;
    }

    // Calculate bbox after scale
    const bbox = calculateBoundingBox(outPos);

    let offsetX = 0, offsetY = 0, offsetZ = 0;
    if (centerOrigin) {
      offsetX = -bbox.center.x;
      offsetY = -bbox.center.y;
      offsetZ = -bbox.center.z;
    } else if (alignGround) {
      // Place lowest point (min.z or min.y depending on axis convention) on Z=0
      offsetZ = -bbox.min.z;
    }

    if (offsetX !== 0 || offsetY !== 0 || offsetZ !== 0) {
      for (let i = 0; i < outPos.length; i += 3) {
        outPos[i] += offsetX;
        outPos[i + 1] += offsetY;
        outPos[i + 2] += offsetZ;
      }
    }

    let outNormals = undefined;
    if (meshData.normals && meshData.normals.length === srcPos.length) {
      outNormals = new Float32Array(meshData.normals);
      if (flipNormals) {
        for (let i = 0; i < outNormals.length; i++) {
          outNormals[i] = -outNormals[i];
        }
      }
    }

    let outIndices = undefined;
    if (meshData.indices) {
      outIndices = new Uint32Array(meshData.indices);
      if (flipNormals) {
        // Reverse triangle vertex winding
        for (let i = 0; i < outIndices.length; i += 3) {
          const tmp = outIndices[i + 1];
          outIndices[i + 1] = outIndices[i + 2];
          outIndices[i + 2] = tmp;
        }
      }
    }

    return {
      positions: outPos,
      normals: outNormals,
      indices: outIndices
    };
  }

  /**
   * Pure JS STL Exporter (supports both Binary and ASCII formats).
   * @param {{positions: Float32Array|number[], normals?: Float32Array|number[], indices?: Uint32Array|number[]}} meshData
   * @param {{binary?: boolean, name?: string}} options
   * @returns {ArrayBuffer|string} Binary ArrayBuffer or ASCII STL string
   */
  function exportSTL(meshData, options = {}) {
    const isBinary = options.binary !== false; // default true
    const modelName = options.name || 'exported_model';
    const { positions, indices } = meshData;

    const numTriangles = indices && indices.length >= 3
      ? Math.floor(indices.length / 3)
      : Math.floor(positions.length / 9);

    if (isBinary) {
      // Binary STL format: 80-byte header + 4-byte uint32 triangle count + (50 bytes * numTriangles)
      const bufferSize = 84 + numTriangles * 50;
      const buffer = new ArrayBuffer(bufferSize);
      const view = new DataView(buffer);

      // Write 80-byte header
      const headerStr = `Engineering Toolkit STL Export - ${modelName}`.padEnd(80, ' ');
      for (let i = 0; i < 80; i++) {
        view.setUint8(i, headerStr.charCodeAt(i) || 32);
      }

      // Write triangle count
      view.setUint32(80, numTriangles, true);

      let offset = 84;

      function writeTri(ax, ay, az, bx, by, bz, cx, cy, cz) {
        // Compute facet normal
        const abx = bx - ax, aby = by - ay, abz = bz - az;
        const acx = cx - ax, acy = cy - ay, acz = cz - az;
        let nx = aby * acz - abz * acy;
        let ny = abz * acx - abx * acz;
        let nz = abx * acy - aby * acx;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (len > 1e-9) {
          nx /= len; ny /= len; nz /= len;
        } else {
          nx = 0; ny = 0; nz = 1;
        }

        // Normal (3 x Float32)
        view.setFloat32(offset, nx, true);
        view.setFloat32(offset + 4, ny, true);
        view.setFloat32(offset + 8, nz, true);
        // Vertex 1 (3 x Float32)
        view.setFloat32(offset + 12, ax, true);
        view.setFloat32(offset + 16, ay, true);
        view.setFloat32(offset + 20, az, true);
        // Vertex 2 (3 x Float32)
        view.setFloat32(offset + 24, bx, true);
        view.setFloat32(offset + 28, by, true);
        view.setFloat32(offset + 32, bz, true);
        // Vertex 3 (3 x Float32)
        view.setFloat32(offset + 36, cx, true);
        view.setFloat32(offset + 40, cy, true);
        view.setFloat32(offset + 44, cz, true);
        // Attribute byte count (Uint16 = 0)
        view.setUint16(offset + 48, 0, true);

        offset += 50;
      }

      if (indices && indices.length >= 3) {
        for (let i = 0; i < indices.length; i += 3) {
          const i0 = indices[i] * 3, i1 = indices[i + 1] * 3, i2 = indices[i + 2] * 3;
          writeTri(
            positions[i0], positions[i0 + 1], positions[i0 + 2],
            positions[i1], positions[i1 + 1], positions[i1 + 2],
            positions[i2], positions[i2 + 1], positions[i2 + 2]
          );
        }
      } else {
        for (let i = 0; i < positions.length; i += 9) {
          writeTri(
            positions[i], positions[i + 1], positions[i + 2],
            positions[i + 3], positions[i + 4], positions[i + 5],
            positions[i + 6], positions[i + 7], positions[i + 8]
          );
        }
      }

      return buffer;
    } else {
      // ASCII STL format
      let out = `solid ${modelName}\n`;

      function appendTri(ax, ay, az, bx, by, bz, cx, cy, cz) {
        const abx = bx - ax, aby = by - ay, abz = bz - az;
        const acx = cx - ax, acy = cy - ay, acz = cz - az;
        let nx = aby * acz - abz * acy;
        let ny = abz * acx - abx * acz;
        let nz = abx * acy - aby * acx;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (len > 1e-9) {
          nx /= len; ny /= len; nz /= len;
        } else {
          nx = 0; ny = 0; nz = 1;
        }

        out += `  facet normal ${nx.toFixed(6)} ${ny.toFixed(6)} ${nz.toFixed(6)}\n`;
        out += `    outer loop\n`;
        out += `      vertex ${ax.toFixed(6)} ${ay.toFixed(6)} ${az.toFixed(6)}\n`;
        out += `      vertex ${bx.toFixed(6)} ${by.toFixed(6)} ${bz.toFixed(6)}\n`;
        out += `      vertex ${cx.toFixed(6)} ${cy.toFixed(6)} ${cz.toFixed(6)}\n`;
        out += `    endloop\n`;
        out += `  endfacet\n`;
      }

      if (indices && indices.length >= 3) {
        for (let i = 0; i < indices.length; i += 3) {
          const i0 = indices[i] * 3, i1 = indices[i + 1] * 3, i2 = indices[i + 2] * 3;
          appendTri(
            positions[i0], positions[i0 + 1], positions[i0 + 2],
            positions[i1], positions[i1 + 1], positions[i1 + 2],
            positions[i2], positions[i2 + 1], positions[i2 + 2]
          );
        }
      } else {
        for (let i = 0; i < positions.length; i += 9) {
          appendTri(
            positions[i], positions[i + 1], positions[i + 2],
            positions[i + 3], positions[i + 4], positions[i + 5],
            positions[i + 6], positions[i + 7], positions[i + 8]
          );
        }
      }

      out += `endsolid ${modelName}\n`;
      return out;
    }
  }

  /**
   * Pure JS Wavefront OBJ Exporter.
   * @param {{positions: Float32Array|number[], normals?: Float32Array|number[], indices?: Uint32Array|number[]}} meshData
   * @param {{name?: string}} options
   * @returns {string} OBJ file text
   */
  function exportOBJ(meshData, options = {}) {
    const modelName = options.name || 'model';
    const { positions, normals, indices } = meshData;

    let out = `# Wavefront OBJ Exported from Engineering Toolkit (cad-viewer)\n`;
    out += `o ${modelName}\n`;

    // Write vertices
    for (let i = 0; i < positions.length; i += 3) {
      out += `v ${positions[i].toFixed(6)} ${positions[i + 1].toFixed(6)} ${positions[i + 2].toFixed(6)}\n`;
    }

    // Write normals if present
    const hasNormals = normals && normals.length === positions.length;
    if (hasNormals) {
      for (let i = 0; i < normals.length; i += 3) {
        out += `vn ${normals[i].toFixed(6)} ${normals[i + 1].toFixed(6)} ${normals[i + 2].toFixed(6)}\n`;
      }
    }

    out += `s 1\n`;

    // Write faces (1-indexed)
    if (indices && indices.length >= 3) {
      for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i] + 1;
        const i1 = indices[i + 1] + 1;
        const i2 = indices[i + 2] + 1;
        if (hasNormals) {
          out += `f ${i0}//${i0} ${i1}//${i1} ${i2}//${i2}\n`;
        } else {
          out += `f ${i0} ${i1} ${i2}\n`;
        }
      }
    } else {
      const numVerts = Math.floor(positions.length / 3);
      for (let i = 1; i <= numVerts; i += 3) {
        if (hasNormals) {
          out += `f ${i}//${i} ${i + 1}//${i + 1} ${i + 2}//${i + 2}\n`;
        } else {
          out += `f ${i} ${i + 1} ${i + 2}\n`;
        }
      }
    }

    return out;
  }

  return {
    MATERIALS_DB: MATERIALS_DB,
    calculateBoundingBox: calculateBoundingBox,
    calculateSurfaceArea: calculateSurfaceArea,
    calculateVolumeAndCenterOfMass: calculateVolumeAndCenterOfMass,
    checkMeshTopology: checkMeshTopology,
    estimateMass: estimateMass,
    transformMeshData: transformMeshData,
    exportSTL: exportSTL,
    exportOBJ: exportOBJ
  };
}));

