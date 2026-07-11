// ==========================================================================
// Explicit 2D CAD WebGL Viewport Renderer (Phase 2)
// High-performance Three.js 2D Orthographic pipeline with GPU line batching
// ==========================================================================

class ExplicitCadRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.width = canvas.width;
    this.height = canvas.height;
    
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      preserveDrawingBuffer: true
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0F0F0F); // Classic dark CAD background

    // Camera setup (Orthographic, looking down Z towards absolute XY plane)
    const aspect = this.width / this.height;
    const viewSize = 300; // default visible width in mm
    this.camera = new THREE.OrthographicCamera(
      -viewSize * aspect / 2, viewSize * aspect / 2,
      viewSize / 2, -viewSize / 2,
      0.1, 1000
    );
    // Position camera looking down Z-axis
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
      // Left or middle mouse drag for panning viewport bounds
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
        
        const viewportHeight = this.camera.top - this.camera.bottom;
        const scaleY = viewportHeight / this.height;

        this.camera.position.x = startCamPos.x - dx * scaleX;
        this.camera.position.y = startCamPos.y + dy * scaleY;
        this.render();
      }
    });

    window.addEventListener("mouseup", () => {
      isPanning = false;
    });

    // Zoom-to-cursor scaling by updating camera bounds
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      
      const zoomFactor = e.deltaY < 0 ? 0.9 : 1.1;
      
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const ndcX = (mouseX / this.width) * 2 - 1;
      const ndcY = -(mouseY / this.height) * 2 + 1;

      // Inverse projection mapping back to model WCS space
      const worldX = this.camera.position.x + ndcX * (this.camera.right - this.camera.left) / 2;
      const worldY = this.camera.position.y + ndcY * (this.camera.top - this.camera.bottom) / 2;

      const aspect = this.width / this.height;
      const newViewSize = (this.camera.right - this.camera.left) * zoomFactor / aspect;
      
      this.camera.left = -newViewSize * aspect / 2;
      this.camera.right = newViewSize * aspect / 2;
      this.camera.top = newViewSize / 2;
      this.camera.bottom = -newViewSize / 2;

      this.camera.position.x = worldX - ndcX * (this.camera.right - this.camera.left) / 2;
      this.camera.position.y = worldY - ndcY * (this.camera.top - this.camera.bottom) / 2;

      this.camera.updateProjectionMatrix();
      this.render();
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

  // GPU batched draw-call vector line pipeline
  updateDrawing(vertices, circles, isClosed, sheetWidth, sheetHeight) {
    this.clearGeometries();

    const linePoints = [];
    const colors = [];
    
    const addLineSegment = (x1, y1, x2, y2, colorHex) => {
      const col = new THREE.Color(colorHex);
      linePoints.push(x1, y1, 0, x2, y2, 0);
      colors.push(col.r, col.g, col.b, col.r, col.g, col.b);
    };

    // 1. Draw sheet background borders (locked layer equivalent)
    const borderCol = "#334155";
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

    // 2. Draw active sketch profile outline
    const numVerts = vertices.length;
    if (numVerts >= 2) {
      const limit = isClosed ? numVerts : numVerts - 1;
      for (let i = 0; i < limit; i++) {
        const p1 = vertices[i];
        const p2 = vertices[(i + 1) % numVerts];
        addLineSegment(p1.x, p1.y, p2.x, p2.y, "#14b8a6"); // Teal profile outline
      }
    }

    // 3. Draw circles
    circles.forEach(c => {
      const segments = 64;
      const angleStep = (Math.PI * 2) / segments;
      const color = c.construction ? "#64748b" : "#3b82f6";
      for (let i = 0; i < segments; i++) {
        // Skip ticks for dashed construction geometries
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
    });

    // Create and attach single LineSegments geometry for WebGL rendering performance
    if (linePoints.length > 0) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.Float32BufferAttribute(linePoints, 3));
      geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

      const mat = new THREE.LineBasicMaterial({ vertexColors: true });
      const lineMesh = new THREE.LineSegments(geom, mat);
      this.drawGroup.add(lineMesh);
    }

    // 4. Endpoints visualization
    vertices.forEach(v => {
      const size = 1.6;
      const geom = new THREE.BoxGeometry(size, size, 0.1);
      const mat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(v.x, v.y, 0);
      this.drawGroup.add(mesh);
    });

    this.render();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  resetView(sheetWidth, sheetHeight) {
    const aspect = this.width / this.height;
    const viewSize = Math.max(sheetWidth, sheetHeight) * 1.2;
    this.camera.left = -viewSize * aspect / 2;
    this.camera.right = viewSize * aspect / 2;
    this.camera.top = viewSize / 2;
    this.camera.bottom = -viewSize / 2;
    this.camera.position.set(sheetWidth / 2, sheetHeight / 2, 500);
    this.camera.lookAt(sheetWidth / 2, sheetHeight / 2, 0);
    this.camera.updateProjectionMatrix();
    this.render();
  }
}

if (typeof window !== "undefined") {
  window.ExplicitCadRenderer = ExplicitCadRenderer;
}
