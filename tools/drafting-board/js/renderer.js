// ==========================================================================
// Explicit 2D CAD WebGL Viewport Renderer (Phase 2 & 5)
// High-performance Three.js 2D Orthographic pipeline with GPU line batching
// Aligned with standard SVG layout coordinates (Y-down) for overlay sync.
// Dynamic visibility filtering based on CAD Layer Control states.
// ==========================================================================

class ExplicitCadRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    const container = canvas.parentElement;
    this.width = container ? container.clientWidth : (canvas.clientWidth || 800);
    this.height = container ? container.clientHeight : (canvas.clientHeight || 600);
    canvas.width = this.width;
    canvas.height = this.height;
    
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      preserveDrawingBuffer: true
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0F0F0F); // Classic dark CAD background

    // Camera setup (Orthographic, Y-down to align with SVG layout space)
    const aspect = this.width / this.height;
    const viewSize = 300; // default visible width in mm
    this.camera = new THREE.OrthographicCamera(
      -viewSize * aspect / 2, viewSize * aspect / 2,
      -viewSize / 2, viewSize / 2,  // Y-down: top is negative, bottom is positive
      0.1, 1000
    );
    this.camera.position.set(150, 100, 500);
    this.camera.lookAt(150, 100, 0);

    this.drawGroup = new THREE.Group();
    this.scene.add(this.drawGroup);

    this.setupEvents();
  }

  setupEvents() {
    let isPanning = false;
    let startMouse = { x: 0, y: 0 };
    let startCamPos = { x: 0, y: 0 };

    this.canvas.addEventListener("mousedown", (e) => {
      isPanning = true;
      startMouse.x = e.clientX;
      startMouse.y = e.clientY;
      startCamPos.x = this.camera.position.x;
      startCamPos.y = this.camera.position.y;
    });

    window.addEventListener("mousemove", (e) => {
      if (isPanning) {
        const dx = e.clientX - startMouse.x;
        const dy = e.clientY - startMouse.y;
        
        const viewportWidth = this.camera.right - this.camera.left;
        const scaleX = viewportWidth / this.width;
        
        const viewportHeight = this.camera.bottom - this.camera.top;
        const scaleY = viewportHeight / this.height;

        this.camera.position.x = startCamPos.x - dx * scaleX;
        this.camera.position.y = startCamPos.y - dy * scaleY; // match Y direction
        this.render();
        if (this.onViewChange) this.onViewChange();
      }
    });

    window.addEventListener("mouseup", () => {
      isPanning = false;
    });

    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      
      const zoomFactor = e.deltaY < 0 ? 0.9 : 1.1;
      
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const ndcX = (mouseX / this.width) * 2 - 1;
      const ndcY = -(mouseY / this.height) * 2 + 1;

      // Unproject mouse coordinate back to WCS model space (Y inverted relative to NDC)
      const worldX = this.camera.position.x + ndcX * (this.camera.right - this.camera.left) / 2;
      const worldY = this.camera.position.y - ndcY * (this.camera.bottom - this.camera.top) / 2;

      const aspect = this.width / this.height;
      const newViewSize = (this.camera.right - this.camera.left) * zoomFactor / aspect;
      
      this.camera.left = -newViewSize * aspect / 2;
      this.camera.right = newViewSize * aspect / 2;
      this.camera.top = -newViewSize / 2;
      this.camera.bottom = newViewSize / 2;

      this.camera.position.x = worldX - ndcX * (this.camera.right - this.camera.left) / 2;
      this.camera.position.y = worldY + ndcY * (this.camera.bottom - this.camera.top) / 2;

      this.camera.updateProjectionMatrix();
      this.render();
      if (this.onViewChange) this.onViewChange();
    }, { passive: false });
  }

  clearGeometries() {
    while (this.drawGroup.children.length > 0) {
      const obj = this.drawGroup.children[0];
      this.drawGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    }
  }

  // GPU batched draw-call vector line pipeline with layers visibility filtering
  updateDrawing(vertices, circles, isClosed, sheetWidth, sheetHeight, layersState, insertions = [], blockDefinitions = {}) {
    this.clearGeometries();

    const linePoints = [];
    const colors = [];
    
    const addLineSegment = (x1, y1, x2, y2, colorHex) => {
      const col = new THREE.Color(colorHex);
      linePoints.push(x1, y1, 0, x2, y2, 0);
      colors.push(col.r, col.g, col.b, col.r, col.g, col.b);
    };

    // Default layers state if none is active/passed
    const ls = layersState || {
      "PROFILE_OUTLINE": { visible: true, color: "#14b8a6" },
      "HOLES": { visible: true, color: "#3b82f6" },
      "CONSTRUCTION": { visible: true, color: "#64748b" },
      "SHEET_FORMAT": { visible: true, color: "#334155" }
    };

    // 1. Draw sheet background borders (locked layer equivalent)
    if (ls["SHEET_FORMAT"] && ls["SHEET_FORMAT"].visible) {
      const borderCol = ls["SHEET_FORMAT"].color || "#334155";
      addLineSegment(0, 0, sheetWidth, 0, borderCol);
      addLineSegment(sheetWidth, 0, sheetWidth, sheetHeight, borderCol);
      addLineSegment(sheetWidth, sheetHeight, 0, sheetHeight, borderCol);
      addLineSegment(0, sheetHeight, 0, 0, borderCol);

      addLineSegment(10, 10, sheetWidth - 10, 10, borderCol);
      addLineSegment(sheetWidth - 10, 10, sheetWidth - 10, sheetHeight - 10, borderCol);
      addLineSegment(sheetWidth - 10, sheetHeight - 10, 10, sheetHeight - 10, borderCol);
      addLineSegment(10, sheetHeight - 10, 10, 10, borderCol);

      // Title Block lines
      const tx = sheetWidth - 110;
      const ty = sheetHeight - 40;
      const tw = 100;
      addLineSegment(tx, ty, tx + tw, ty, borderCol);
      addLineSegment(tx, ty + 10, tx + tw, ty + 10, borderCol);
      addLineSegment(tx, ty + 20, tx + tw, ty + 20, borderCol);
      addLineSegment(tx + 60, ty + 10, tx + 60, ty + 30, borderCol);
    }

    // 2. Draw active sketch profile outline
    if (ls["PROFILE_OUTLINE"] && ls["PROFILE_OUTLINE"].visible) {
      const profileCol = ls["PROFILE_OUTLINE"].color || "#14b8a6";
      const numVerts = vertices.length;
      if (numVerts >= 2) {
        const limit = isClosed ? numVerts : numVerts - 1;
        for (let i = 0; i < limit; i++) {
          const p1 = vertices[i];
          const p2 = vertices[(i + 1) % numVerts];
          addLineSegment(p1.x, p1.y, p2.x, p2.y, profileCol);
        }
      }
    }

    // 3. Draw circles
    circles.forEach(c => {
      const drawLayer = c.construction ? "CONSTRUCTION" : "HOLES";
      if (ls[drawLayer] && ls[drawLayer].visible) {
        const color = ls[drawLayer].color || (c.construction ? "#64748b" : "#3b82f6");
        const segments = 64;
        const angleStep = (Math.PI * 2) / segments;
        for (let i = 0; i < segments; i++) {
          if (c.construction && i % 2 === 0) continue;
          const theta1 = i * angleStep;
          const theta2 = (i + 1) * angleStep;
          addLineSegment(
            c.cx + c.r * Math.cos(theta1),
            c.cy + c.r * Math.sin(theta1),
            c.cx + c.r * Math.cos(theta2),
            c.cy + c.r * Math.sin(theta2),
            color
          );
        }
      }
    });

    // Helper to transform block coordinates
    const transformPoint = (px, py, ins) => {
      const rad = ((ins.rotation || 0) * Math.PI) / 180;
      let sx = px * (ins.scaleX !== undefined ? ins.scaleX : 1);
      let sy = py * (ins.scaleY !== undefined ? ins.scaleY : 1);
      let rx = sx * Math.cos(rad) - sy * Math.sin(rad);
      let ry = sx * Math.sin(rad) + sy * Math.cos(rad);
      return {
        x: rx + ins.x,
        y: ry + ins.y
      };
    };

    // Draw Block Insertions
    insertions.forEach(ins => {
      const block = blockDefinitions[ins.blockName];
      if (!block) return;
      
      block.entities.forEach(ent => {
        const drawLayer = ent.layer || "PROFILE_OUTLINE";
        if (ls[drawLayer] && ls[drawLayer].visible) {
          const color = ls[drawLayer].color || "#ffffff";
          
          if (ent.type === "LINE") {
            const p1 = transformPoint(ent.x1, ent.y1, ins);
            const p2 = transformPoint(ent.x2, ent.y2, ins);
            addLineSegment(p1.x, p1.y, p2.x, p2.y, color);
          }
          else if (ent.type === "CIRCLE") {
            const center = transformPoint(ent.cx, ent.cy, ins);
            const rScaled = ent.r * Math.abs(ins.scaleX !== undefined ? ins.scaleX : 1);
            const segments = 64;
            const angleStep = (Math.PI * 2) / segments;
            for (let i = 0; i < segments; i++) {
              const theta1 = i * angleStep;
              const theta2 = (i + 1) * angleStep;
              addLineSegment(
                center.x + rScaled * Math.cos(theta1),
                center.y + rScaled * Math.sin(theta1),
                center.x + rScaled * Math.cos(theta2),
                center.y + rScaled * Math.sin(theta2),
                color
              );
            }
          }
        }
      });
    });

    // Create and attach single LineSegments geometry
    if (linePoints.length > 0) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.Float32BufferAttribute(linePoints, 3));
      geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

      const mat = new THREE.LineBasicMaterial({ vertexColors: true });
      const lineMesh = new THREE.LineSegments(geom, mat);
      this.drawGroup.add(lineMesh);
    }

    // 4. Endpoints visualization (only if profile layer is visible)
    if (ls["PROFILE_OUTLINE"] && ls["PROFILE_OUTLINE"].visible) {
      vertices.forEach(v => {
        const size = 1.6;
        const geom = new THREE.BoxGeometry(size, size, 0.1);
        const mat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(v.x, v.y, 0);
        this.drawGroup.add(mesh);
      });
    }

    this.render();
  }

  // Synchronize SVG overlay viewBox to WebGL camera projection bounds
  syncSvgOverlay() {
    const svgOverlay = document.getElementById("sketch-canvas-svg");
    if (!svgOverlay) return;

    const minX = this.camera.position.x + this.camera.left;
    const minY = this.camera.position.y + this.camera.top;
    const width = this.camera.right - this.camera.left;
    const height = this.camera.bottom - this.camera.top;

    svgOverlay.setAttribute("viewBox", `${minX} ${minY} ${width} ${height}`);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
    this.syncSvgOverlay();
  }

  resetView(sheetWidth, sheetHeight) {
    const aspect = this.width / this.height;
    const viewSize = Math.max(sheetWidth, sheetHeight) * 1.2;
    this.camera.left = -viewSize * aspect / 2;
    this.camera.right = viewSize * aspect / 2;
    this.camera.top = -viewSize / 2;
    this.camera.bottom = viewSize / 2;
    this.camera.position.set(sheetWidth / 2, sheetHeight / 2, 500);
    this.camera.lookAt(sheetWidth / 2, sheetHeight / 2, 0);
    this.camera.updateProjectionMatrix();
    this.render();
  }

  resize() {
    const container = this.canvas.parentElement;
    this.width = container ? container.clientWidth : (this.canvas.clientWidth || 800);
    this.height = container ? container.clientHeight : (this.canvas.clientHeight || 600);
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    const aspect = this.width / this.height;
    const currentHeight = this.camera.bottom - this.camera.top;
    
    this.camera.left = -currentHeight * aspect / 2;
    this.camera.right = currentHeight * aspect / 2;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(this.width, this.height);
    this.render();
  }
}

if (typeof window !== "undefined") {
  window.ExplicitCadRenderer = ExplicitCadRenderer;
}
