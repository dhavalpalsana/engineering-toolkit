// ==========================================================================
// Explicit 2D CAD HTML5 Canvas Viewport Renderer
// High-performance 2D vector context with hardware-accelerated transforms.
// Aligned with standard WCS model space coordinates.
// Dynamic scaling of line widths & text to maintain screen-space clarity.
// ==========================================================================

class ExplicitCadRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    const container = canvas.parentElement;
    this.width = container ? container.clientWidth : (canvas.clientWidth || 800);
    this.height = container ? container.clientHeight : (canvas.clientHeight || 600);
    
    // Set up canvas buffer resolution for high-DPI retina screens
    this.resize();

    // Viewport transform (zoom level & pan offset in pixels)
    this.zoomLevel = 1.0;
    this.panOffset = { x: 50, y: 50 };

    this.currentState = null;
    this.setupEvents();
  }

  // Convert client cursor coordinates to WCS model coordinates (mm)
  getMouseWorldPos(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    return {
      x: (screenX - this.panOffset.x) / this.zoomLevel,
      y: (screenY - this.panOffset.y) / this.zoomLevel
    };
  }

  // Zoom viewport by a factor, keeping the cursor coordinate stable under the mouse
  zoom(factor, clientX, clientY) {
    let mouseX, mouseY;
    if (clientX !== undefined && clientY !== undefined) {
      const rect = this.canvas.getBoundingClientRect();
      mouseX = clientX - rect.left;
      mouseY = clientY - rect.top;
    } else {
      mouseX = this.width / 2;
      mouseY = this.height / 2;
    }

    const worldMouse = {
      x: (mouseX - this.panOffset.x) / this.zoomLevel,
      y: (mouseY - this.panOffset.y) / this.zoomLevel
    };

    this.zoomLevel *= factor;
    // Limit zoom factor
    this.zoomLevel = Math.max(0.02, Math.min(150, this.zoomLevel));

    this.panOffset.x = mouseX - worldMouse.x * this.zoomLevel;
    this.panOffset.y = mouseY - worldMouse.y * this.zoomLevel;

    this.render();
    if (this.onViewChange) this.onViewChange();
  }

  setupEvents() {
    let isPanning = false;
    let startMouse = { x: 0, y: 0 };
    let startPan = { x: 0, y: 0 };

    this.canvas.addEventListener("mousedown", (e) => {
      // Pan: middle-click, right-click, Shift+Left, Space+Left, or Pan mode
      const isPanMode = window.editorMode === "pan" || e.shiftKey;
      if (e.button === 1 || e.button === 2 || (e.button === 0 && isPanMode)) {
        isPanning = true;
        startMouse.x = e.clientX;
        startMouse.y = e.clientY;
        startPan.x = this.panOffset.x;
        startPan.y = this.panOffset.y;
        e.preventDefault();
      }
    });

    window.addEventListener("mousemove", (e) => {
      if (isPanning) {
        const dx = e.clientX - startMouse.x;
        const dy = e.clientY - startMouse.y;
        this.panOffset.x = startPan.x + dx;
        this.panOffset.y = startPan.y + dy;
        this.render();
        if (this.onViewChange) this.onViewChange();
      }
    });

    window.addEventListener("mouseup", () => {
      isPanning = false;
    });

    this.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault(); // disable right-click menu to enable smooth panning
    });

    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : (1 / 1.15);
      this.zoom(factor, e.clientX, e.clientY);
    }, { passive: false });
  }

  resize() {
    const container = this.canvas.parentElement;
    this.width = container ? container.clientWidth : (this.canvas.clientWidth || 800);
    this.height = container ? container.clientHeight : (this.canvas.clientHeight || 600);
    
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = this.width + "px";
    this.canvas.style.height = this.height + "px";
    this.render();
  }

  resetView(sheetWidth, sheetHeight) {
    const margin = 40; // margin in pixels
    const scaleX = (this.width - 2 * margin) / sheetWidth;
    const scaleY = (this.height - 2 * margin) / sheetHeight;
    this.zoomLevel = Math.min(scaleX, scaleY);

    const viewW = sheetWidth * this.zoomLevel;
    const viewH = sheetHeight * this.zoomLevel;
    this.panOffset.x = (this.width - viewW) / 2;
    this.panOffset.y = (this.height - viewH) / 2;

    this.render();
  }

  /** Fit an arbitrary world-space rectangle into the viewport */
  fitWorldRect(x, y, w, h) {
    const margin = 48;
    const scaleX = (this.width - 2 * margin) / Math.max(w, 1e-6);
    const scaleY = (this.height - 2 * margin) / Math.max(h, 1e-6);
    this.zoomLevel = Math.max(0.02, Math.min(150, Math.min(scaleX, scaleY)));
    const viewW = w * this.zoomLevel;
    const viewH = h * this.zoomLevel;
    this.panOffset.x = (this.width - viewW) / 2 - x * this.zoomLevel;
    this.panOffset.y = (this.height - viewH) / 2 - y * this.zoomLevel;
    this.render();
    if (this.onViewChange) this.onViewChange();
  }

  updateDrawing(state) {
    this.currentState = state;
    this.render();
  }

  render() {
    if (!this.currentState) return;
    const state = this.currentState;
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, this.width, this.height);

    // Paper / dark canvas background
    const dark = !!state.darkCanvas;
    ctx.fillStyle = dark ? "#0b1220" : "#ffffff";
    ctx.fillRect(0, 0, this.width, this.height);

    // Apply camera transformation mapping
    ctx.translate(this.panOffset.x, this.panOffset.y);
    ctx.scale(this.zoomLevel, this.zoomLevel);

    // 1. Draw Grid Lines (Dynamic based on zoom level)
    this.drawGrid(ctx, state.sheetWidth, state.sheetHeight, dark);

    // 2. Draw Page Borders & Title Block
    const isSheetVisible = state.layers["BACKGROUND"] && state.layers["BACKGROUND"].visible;
    if (isSheetVisible) {
      this.drawSheetFormat(ctx, state.sheetWidth, state.sheetHeight, dark);
    }

    // 3. Draw Construction Lines / Profile Geometry
    this.drawGeometry(ctx, state, dark);

    // 4. Draw Smart Dimensions & Annotations
    this.drawDimensions(ctx, state, dark);

    // 4b. Constraint icons (H/V)
    if (state.constraintIcons && state.constraintIcons.length) {
      this.drawConstraintIcons(ctx, state.constraintIcons, dark);
    }

    // 5. Draw Ruler Measurement Guide
    if (state.isMeasuring && state.measureStartPos && state.mousePos) {
      this.drawMeasurement(ctx, state);
    }

    // 6. Draw Orthogonal Snapping Line Help Guides
    if (state.orthoLockEnabled && state.vertices.length > 0 && state.mousePos && !state.isClosed) {
      this.drawOrthoGuides(ctx, state);
    }

    // 7. Draw Active Shape Drawing Guides (Circle, Rect, Poly previews)
    this.drawActiveToolPreviews(ctx, state);

    // 8. Full-viewport crosshair (screen-space thickness)
    if (state.crosshairEnabled && state.mousePos && !["select", "pan"].includes(state.editorMode)) {
      this.drawCrosshair(ctx, state.mousePos);
    }

    // 9. Block insert ghost preview
    if (state.insertPreview && state.blockDefinitions) {
      this.drawInsertPreview(ctx, state);
    }

    // 10. Selection grips (Phase B)
    if (state.grips && state.grips.length) {
      this.drawGrips(ctx, state.grips);
    }

    // 11. Draw Object Snap Targets
    if (state.hoveredSnapTarget) {
      this.drawSnapIndicator(ctx, state.hoveredSnapTarget);
    }

    ctx.restore();
  }

  drawGrips(ctx, grips) {
    ctx.save();
    const s = 5 / this.zoomLevel;
    grips.forEach(g => {
      ctx.fillStyle = g.kind === "mid" ? "#fbbf24" : "#38bdf8";
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1.2 / this.zoomLevel;
      ctx.fillRect(g.x - s, g.y - s, s * 2, s * 2);
      ctx.strokeRect(g.x - s, g.y - s, s * 2, s * 2);
    });
    ctx.restore();
  }

  drawInsertPreview(ctx, state) {
    const ins = state.insertPreview;
    const block = state.blockDefinitions[ins.blockName];
    if (!block) return;
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = "#0d9488";
    ctx.lineWidth = 1.5 / this.zoomLevel;
    ctx.setLineDash([4 / this.zoomLevel, 3 / this.zoomLevel]);
    const transformPoint = (px, py) => {
      const rad = ((ins.rotation || 0) * Math.PI) / 180;
      let sx = px * (ins.scaleX !== undefined ? ins.scaleX : 1);
      let sy = py * (ins.scaleY !== undefined ? ins.scaleY : 1);
      return {
        x: sx * Math.cos(rad) - sy * Math.sin(rad) + ins.x,
        y: sx * Math.sin(rad) + sy * Math.cos(rad) + ins.y
      };
    };
    block.entities.forEach(ent => {
      if (ent.type === "LINE") {
        const p1 = transformPoint(ent.x1, ent.y1);
        const p2 = transformPoint(ent.x2, ent.y2);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      } else if (ent.type === "CIRCLE") {
        const c = transformPoint(ent.cx, ent.cy);
        const r = ent.r * Math.abs(ins.scaleX !== undefined ? ins.scaleX : 1);
        ctx.beginPath();
        ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    // base point marker
    ctx.setLineDash([]);
    ctx.fillStyle = "#0d9488";
    const m = 3 / this.zoomLevel;
    ctx.fillRect(ins.x - m, ins.y - m, m * 2, m * 2);
    ctx.restore();
  }

  drawCrosshair(ctx, pos) {
    // Extent covers far beyond sheet in world units
    const left = -this.panOffset.x / this.zoomLevel;
    const right = (this.width - this.panOffset.x) / this.zoomLevel;
    const top = -this.panOffset.y / this.zoomLevel;
    const bottom = (this.height - this.panOffset.y) / this.zoomLevel;

    ctx.save();
    ctx.setLineDash([4 / this.zoomLevel, 4 / this.zoomLevel]);
    ctx.strokeStyle = "rgba(13, 148, 136, 0.55)";
    ctx.lineWidth = 1 / this.zoomLevel;
    ctx.beginPath();
    ctx.moveTo(left, pos.y);
    ctx.lineTo(right, pos.y);
    ctx.moveTo(pos.x, top);
    ctx.lineTo(pos.x, bottom);
    ctx.stroke();
    ctx.restore();
  }

  // Draw CAD grid layout, fading grids out dynamically when zoomed out
  drawGrid(ctx, sheetWidth, sheetHeight, dark = false) {
    if (window.gridVisible === false) return;

    let minorStep = 10;
    let majorStep = 50;

    // Adjust grid step size depending on zoom to avoid grid line bloat
    if (this.zoomLevel < 0.3) {
      minorStep = 50;
      majorStep = 250;
    }
    if (this.zoomLevel < 0.08) {
      minorStep = 250;
      majorStep = 1250;
    }

    const left = -this.panOffset.x / this.zoomLevel;
    const right = (this.width - this.panOffset.x) / this.zoomLevel;
    const top = -this.panOffset.y / this.zoomLevel;
    const bottom = (this.height - this.panOffset.y) / this.zoomLevel;

    const startX = Math.floor(left / minorStep) * minorStep;
    const endX = Math.ceil(right / minorStep) * minorStep;
    const startY = Math.floor(top / minorStep) * minorStep;
    const endY = Math.ceil(bottom / minorStep) * minorStep;

    ctx.save();
    
    // Draw minor grid lines
    ctx.strokeStyle = dark ? "#1e293b" : "#f1f5f9";
    ctx.lineWidth = 0.5 / this.zoomLevel;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += minorStep) {
      if (x % majorStep === 0) continue;
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    for (let y = startY; y <= endY; y += minorStep) {
      if (y % majorStep === 0) continue;
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    }
    ctx.stroke();

    // Draw major grid lines
    ctx.strokeStyle = dark ? "#334155" : "#cbd5e1";
    ctx.lineWidth = 1.0 / this.zoomLevel;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += minorStep) {
      if (x % majorStep !== 0) continue;
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    for (let y = startY; y <= endY; y += minorStep) {
      if (y % majorStep !== 0) continue;
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    }
    ctx.stroke();

    // Draw Red X-axis & Green Y-axis coordinate origin lines
    ctx.lineWidth = 1.5 / this.zoomLevel;
    ctx.strokeStyle = "rgba(239, 68, 68, 0.4)"; // Red
    ctx.beginPath();
    ctx.moveTo(left, 0);
    ctx.lineTo(right, 0);
    ctx.stroke();

    ctx.strokeStyle = "rgba(34, 197, 94, 0.4)"; // Green
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(0, bottom);
    ctx.stroke();

    ctx.restore();
  }

  // Draw paper sheet layout border and title block
  drawSheetFormat(ctx, width, height, dark = false) {
    ctx.save();
    
    // Soft shadow under drawing format border
    ctx.fillStyle = dark ? "rgba(0,0,0,0.35)" : "rgba(15, 23, 42, 0.08)";
    ctx.fillRect(4 / this.zoomLevel, 4 / this.zoomLevel, width, height);

    // Blueprint paper area
    ctx.fillStyle = dark ? "#111827" : "#ffffff";
    ctx.strokeStyle = dark ? "#475569" : "#94a3b8";
    ctx.lineWidth = 1.0 / this.zoomLevel;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeRect(0, 0, width, height);

    // Inner active boundary sheet margin (10mm offset)
    ctx.strokeStyle = dark ? "#64748b" : "#334155";
    ctx.lineWidth = 1.5 / this.zoomLevel;
    ctx.strokeRect(10, 10, width - 20, height - 20);

    // Title box lines in bottom-right corner
    const tx = width - 110;
    const ty = height - 40;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(width - 10, ty);
    ctx.moveTo(tx, ty + 10);
    ctx.lineTo(width - 10, ty + 10);
    ctx.moveTo(tx, ty + 20);
    ctx.lineTo(width - 10, ty + 20);
    ctx.moveTo(tx + 60, ty + 10);
    ctx.lineTo(tx + 60, height - 10);
    ctx.stroke();

    // Injected text labels
    ctx.fillStyle = dark ? "#cbd5e1" : "#1e293b";
    ctx.font = `${6.5 / this.zoomLevel}px var(--font-sans)`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("TITLE: CAD BLUEPRINT DESIGN", tx + 3, ty + 5);
    ctx.fillText("SCALE: 1:1", tx + 3, ty + 15);
    ctx.fillText("UNIT: mm", tx + 63, ty + 15);
    ctx.fillText("ENGINEERING TOOLKIT", tx + 3, ty + 25);
    
    ctx.restore();
  }

  // Draw active drawing geometries
  drawGeometry(ctx, state, dark = false) {
    const isSheetVisible = state.layers["BACKGROUND"] && state.layers["BACKGROUND"].visible;
    const defaultColor = dark ? "#e2e8f0" : "#000000";

    // 1. Draw Finalized Profiles
    if (state.layers["FOREGROUND"] && state.layers["FOREGROUND"].visible) {
      if (state.profiles) {
        state.profiles.forEach(prof => {
          const numVerts = prof.count;
          if (numVerts >= 2) {
            const limit = prof.isClosed ? numVerts : numVerts - 1;
            for (let i = 0; i < limit; i++) {
              const p1 = state.vertices[prof.startIndex + i];
              const p2 = state.vertices[prof.startIndex + (i + 1) % numVerts];
              const isSelected = state.selectedEntity && state.selectedEntity.type === "line" && state.selectedEntity.index === (prof.startIndex + i);

              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              
              ctx.strokeStyle = isSelected ? "#f97316" : defaultColor;
              ctx.lineWidth = (isSelected ? 3.5 : 2.2) / this.zoomLevel;
              ctx.setLineDash([]);
              ctx.stroke();
            }
          }
        });
      }

      // 2. Draw Active Open Polyline
      const activeStart = state.activeProfileStartIndex !== undefined ? state.activeProfileStartIndex : 0;
      const activeCount = state.vertices.length - activeStart;
      if (activeCount >= 2) {
        for (let i = 0; i < activeCount - 1; i++) {
          const p1 = state.vertices[activeStart + i];
          const p2 = state.vertices[activeStart + i + 1];
          const isSelected = state.selectedEntity && state.selectedEntity.type === "line" && state.selectedEntity.index === (activeStart + i);

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          
          ctx.strokeStyle = isSelected ? "#f97316" : defaultColor;
          ctx.lineWidth = (isSelected ? 3.5 : 2.2) / this.zoomLevel;
          ctx.setLineDash([]);
          ctx.stroke();
        }
      }
    }

    // 2. Draw Circles
    state.circles.forEach((c, idx) => {
      if (state.layers["FOREGROUND"] && state.layers["FOREGROUND"].visible) {
        const isSelected = state.selectedEntity && state.selectedEntity.type === "circle" && state.selectedEntity.index === idx;

        ctx.beginPath();
        ctx.arc(c.cx, c.cy, c.r, 0, 2 * Math.PI);
        
        ctx.strokeStyle = isSelected ? "#f97316" : (c.construction ? "#64748b" : defaultColor);
        ctx.lineWidth = (isSelected ? 3.0 : 2.0) / this.zoomLevel;
        
        if (c.construction) {
          ctx.setLineDash([4 / this.zoomLevel, 4 / this.zoomLevel]);
        } else {
          ctx.setLineDash([]);
        }
        ctx.stroke();

        // Draw standard tapped hole indicators (crosshair marks)
        if (c.standardHole) {
          ctx.save();
          ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
          ctx.lineWidth = 0.8 / this.zoomLevel;
          ctx.setLineDash([]);
          const tick = 3.5 / this.zoomLevel;
          ctx.beginPath();
          ctx.moveTo(c.cx - c.r - tick, c.cy);
          ctx.lineTo(c.cx + c.r + tick, c.cy);
          ctx.moveTo(c.cx, c.cy - c.r - tick);
          ctx.lineTo(c.cx, c.cy + c.r + tick);
          ctx.stroke();
          ctx.restore();
        }
      }
    });

    // 3. Draw Block Insertions
    const transformPoint = (px, py, ins) => {
      const rad = ((ins.rotation || 0) * Math.PI) / 180;
      let sx = px * (ins.scaleX !== undefined ? ins.scaleX : 1);
      let sy = py * (ins.scaleY !== undefined ? ins.scaleY : 1);
      let rx = sx * Math.cos(rad) - sy * Math.sin(rad);
      let ry = sx * Math.sin(rad) + sy * Math.cos(rad);
      return { x: rx + ins.x, y: ry + ins.y };
    };

    state.insertions.forEach((ins, insIdx) => {
      const block = state.blockDefinitions[ins.blockName];
      if (!block) return;
      
      const isSelected = state.selectedEntity && state.selectedEntity.type === "insertion" && state.selectedEntity.index === insIdx;
      
      block.entities.forEach(ent => {
        if (state.layers["FOREGROUND"] && state.layers["FOREGROUND"].visible) {
          ctx.strokeStyle = isSelected ? "#f97316" : defaultColor;
          ctx.lineWidth = (isSelected ? 3.0 : 2.0) / this.zoomLevel;
          ctx.setLineDash([]);
          
          if (ent.type === "LINE") {
            const p1 = transformPoint(ent.x1, ent.y1, ins);
            const p2 = transformPoint(ent.x2, ent.y2, ins);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
          else if (ent.type === "CIRCLE") {
            const center = transformPoint(ent.cx, ent.cy, ins);
            const rScaled = ent.r * Math.abs(ins.scaleX !== undefined ? ins.scaleX : 1);
            ctx.beginPath();
            ctx.arc(center.x, center.y, rScaled, 0, 2 * Math.PI);
            ctx.stroke();
          }
        }
      });
    });

    // 4. Draw Vertex handles (green boxes)
    if (state.layers["FOREGROUND"] && state.layers["FOREGROUND"].visible) {
      state.vertices.forEach((v, idx) => {
        const isSelected = state.selectedEntity && state.selectedEntity.type === "vertex" && state.selectedEntity.index === idx;
        const halfSize = (isSelected ? 4.0 : 2.2) / this.zoomLevel;
        
        ctx.fillStyle = isSelected ? "#f97316" : "#22c55e";
        ctx.fillRect(v.x - halfSize, v.y - halfSize, halfSize * 2, halfSize * 2);
        
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 0.6 / this.zoomLevel;
        ctx.strokeRect(v.x - halfSize, v.y - halfSize, halfSize * 2, halfSize * 2);
      });
    }
  }

  // Draw dimension annotations and leader lines (linear + radial + draft preview)
  drawDimensions(ctx, state, dark = false) {
    const style = state.dimStyle || { decimals: 1, textHeight: 10.5, arrowSize: 3, offset: 28, color: "#0d9488" };
    const decimals = style.decimals != null ? style.decimals : 1;
    const textH = style.textHeight != null ? style.textHeight : 10.5;
    const dimColor = style.color || "#0d9488";

    const drawLinear = (dim, idx, isPreview) => {
      const p1 = state.vertices[dim.v1];
      const p2 = state.vertices[dim.v2];
      if (!p1 || !p2) return;
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.1) return;
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      const theta = Math.atan2(dy, dx);
      const n = theta - Math.PI / 2;
      const off = dim.offset != null ? dim.offset : 28;
      const o1x = p1.x + off * Math.cos(n), o1y = p1.y + off * Math.sin(n);
      const o2x = p2.x + off * Math.cos(n), o2y = p2.y + off * Math.sin(n);
      const midx = mx + off * Math.cos(n), midy = my + off * Math.sin(n);
      const isSelected = !isPreview && state.selectedEntity && state.selectedEntity.type === "dimension" && state.selectedEntity.index === idx;
      const color = isPreview ? "#38bdf8" : (isSelected ? "#f97316" : dimColor);

      ctx.save();
      ctx.globalAlpha = isPreview ? 0.85 : 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.0 / this.zoomLevel;
      ctx.setLineDash(isPreview ? [3 / this.zoomLevel, 3 / this.zoomLevel] : []);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y); ctx.lineTo(o1x, o1y);
      ctx.moveTo(p2.x, p2.y); ctx.lineTo(o2x, o2y);
      ctx.moveTo(o1x, o1y); ctx.lineTo(o2x, o2y);
      ctx.stroke();
      ctx.setLineDash([]);
      this.drawArrowhead(ctx, o1x, o1y, o2x, o2y, style.arrowSize);
      this.drawArrowhead(ctx, o2x, o2y, o1x, o1y, style.arrowSize);

      const val = dim.d !== undefined ? dim.d : len;
      const labelText = `${Number(val).toFixed(decimals)} mm`;
      this.drawDimLabel(ctx, midx, midy, labelText, textH, color, dark, isSelected || isPreview);
      ctx.restore();
    };

    const drawRadial = (dim, idx, isPreview) => {
      const c = state.circles[dim.circleIndex];
      if (!c) return;
      const ang = dim.angle != null ? dim.angle : -Math.PI / 4;
      const isDia = dim.kind === "diameter";
      const textDist = dim.textDist != null ? dim.textDist : c.r * (isDia ? 1.4 : 1.6);
      const edgeX = c.cx + c.r * Math.cos(ang);
      const edgeY = c.cy + c.r * Math.sin(ang);
      const textX = c.cx + textDist * Math.cos(ang);
      const textY = c.cy + textDist * Math.sin(ang);
      const isSelected = !isPreview && state.selectedEntity && state.selectedEntity.type === "dimension" && state.selectedEntity.index === idx;
      const color = isPreview ? "#38bdf8" : (isSelected ? "#f97316" : dimColor);

      ctx.save();
      ctx.globalAlpha = isPreview ? 0.85 : 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.0 / this.zoomLevel;
      ctx.setLineDash(isPreview ? [3 / this.zoomLevel, 3 / this.zoomLevel] : []);

      if (isDia) {
        // Diameter through center
        const e2x = c.cx - c.r * Math.cos(ang);
        const e2y = c.cy - c.r * Math.sin(ang);
        ctx.beginPath();
        ctx.moveTo(e2x, e2y);
        ctx.lineTo(edgeX, edgeY);
        ctx.stroke();
        this.drawArrowhead(ctx, c.cx, c.cy, edgeX, edgeY, style.arrowSize);
        this.drawArrowhead(ctx, c.cx, c.cy, e2x, e2y, style.arrowSize);
        // leader to text if outside
        if (textDist > c.r * 1.05) {
          ctx.beginPath();
          ctx.moveTo(edgeX, edgeY);
          ctx.lineTo(textX, textY);
          ctx.stroke();
        }
      } else {
        // Radius from center to edge + leader
        ctx.beginPath();
        ctx.moveTo(c.cx, c.cy);
        ctx.lineTo(edgeX, edgeY);
        if (textDist > c.r) {
          ctx.lineTo(textX, textY);
        }
        ctx.stroke();
        this.drawArrowhead(ctx, c.cx, c.cy, edgeX, edgeY, style.arrowSize);
      }
      ctx.setLineDash([]);

      const val = dim.d !== undefined ? dim.d : (isDia ? c.r * 2 : c.r);
      const prefix = isDia ? "Ø" : "R";
      const labelText = `${prefix}${Number(val).toFixed(decimals)}`;
      this.drawDimLabel(ctx, textX, textY, labelText, textH, color, dark, isSelected || isPreview);
      ctx.restore();
    };

    (state.customDimensions || []).forEach((dim, idx) => {
      const kind = dim.kind || "linear";
      if (kind === "linear") drawLinear(dim, idx, false);
      else if (kind === "radius" || kind === "diameter") drawRadial(dim, idx, false);
    });

    // Live placement draft
    if (state.dimDraft && state.dimDraft.phase === "place") {
      const d = state.dimDraft;
      if (d.kind === "linear") drawLinear(d, -1, true);
      else drawRadial(d, -1, true);
    }

    // Leader annotations for tap fits/clearances
    state.circles.forEach((c) => {
      if (c.standardHole) {
        const thread = window.MetricThreads ? window.MetricThreads[c.standardHole] : null;
        const pitch = thread ? thread.pitch : "0.8";
        const angle = -Math.PI / 4;
        const sx = c.cx + c.r * Math.cos(angle);
        const sy = c.cy + c.r * Math.sin(angle);
        const ex = sx + 14 / this.zoomLevel;
        const ey = sy - 14 / this.zoomLevel;
        ctx.save();
        ctx.strokeStyle = dark ? "#94a3b8" : "#475569";
        ctx.lineWidth = 0.8 / this.zoomLevel;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.lineTo(ex + 20 / this.zoomLevel, ey);
        ctx.stroke();
        this.drawArrowhead(ctx, ex, ey, sx, sy);
        ctx.fillStyle = dark ? "#e2e8f0" : "#0f172a";
        ctx.font = `bold ${8 / this.zoomLevel}px var(--font-sans)`;
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(`${c.standardHole}x${pitch} TAP`, ex + 2 / this.zoomLevel, ey - 1 / this.zoomLevel);
        ctx.restore();
      }
    });
  }

  drawDimLabel(ctx, x, y, labelText, textH, color, dark, highlight) {
    ctx.font = `bold ${textH / this.zoomLevel}px var(--font-sans)`;
    const textWidth = ctx.measureText(labelText).width;
    const padX = 4.0 / this.zoomLevel;
    const boxW = textWidth + 2 * padX;
    const boxH = (textH + 4) / this.zoomLevel;
    ctx.fillStyle = dark ? "#1e293b" : "#ffffff";
    ctx.strokeStyle = highlight ? color : "rgba(148, 163, 184, 0.45)";
    ctx.lineWidth = 0.5 / this.zoomLevel;
    ctx.fillRect(x - boxW / 2, y - boxH / 2, boxW, boxH);
    ctx.strokeRect(x - boxW / 2, y - boxH / 2, boxW, boxH);
    ctx.fillStyle = highlight ? color : (dark ? "#e2e8f0" : "#0f172a");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(labelText, x, y);
  }

  drawConstraintIcons(ctx, icons, dark = false) {
    ctx.save();
    icons.forEach(ic => {
      const s = 7 / this.zoomLevel;
      ctx.fillStyle = dark ? "#1e293b" : "#ffffff";
      ctx.strokeStyle = ic.type === "horizontal" ? "#2563eb" : "#7c3aed";
      ctx.lineWidth = 1.4 / this.zoomLevel;
      ctx.beginPath();
      ctx.arc(ic.x, ic.y, s, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = ic.type === "horizontal" ? "#2563eb" : "#7c3aed";
      ctx.font = `bold ${8 / this.zoomLevel}px var(--font-sans)`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ic.type === "horizontal" ? "H" : "V", ic.x, ic.y);
    });
    ctx.restore();
  }

  // Draw arrow head on vectors
  drawArrowhead(ctx, x1, y1, x2, y2, sizeMm) {
    const scale = sizeMm != null ? sizeMm / 3 : 1;
    const arrowLen = (5.5 * scale) / this.zoomLevel;
    const arrowWidth = (3.5 * scale) / this.zoomLevel;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return;

    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;

    const ax = x2 - arrowLen * ux;
    const ay = y2 - arrowLen * uy;

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(ax + arrowWidth * nx, ay + arrowWidth * ny);
    ctx.lineTo(ax - arrowWidth * nx, ay - arrowWidth * ny);
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  }

  // Draw active measuring tool guide
  drawMeasurement(ctx, state) {
    ctx.save();
    ctx.strokeStyle = "#22c55e"; // bright green
    ctx.lineWidth = 1.6 / this.zoomLevel;
    ctx.setLineDash([3 / this.zoomLevel, 3 / this.zoomLevel]);
    
    ctx.beginPath();
    ctx.moveTo(state.measureStartPos.x, state.measureStartPos.y);
    ctx.lineTo(state.mousePos.x, state.mousePos.y);
    ctx.stroke();

    const dx = state.mousePos.x - state.measureStartPos.x;
    const dy = state.mousePos.y - state.measureStartPos.y;
    const dist = Math.round(Math.hypot(dx, dy));
    const mx = (state.measureStartPos.x + state.mousePos.x) / 2;
    const my = (state.measureStartPos.y + state.mousePos.y) / 2;

    const labelText = `Ruler: ${dist} mm`;
    ctx.font = `bold ${10 / this.zoomLevel}px var(--font-sans)`;
    ctx.fillStyle = "#15803d"; // dark green for text contrast
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(labelText, mx, my - 4 / this.zoomLevel);
    ctx.restore();
  }

  // Draw OrthoLock projection axis guides
  drawOrthoGuides(ctx, state) {
    const last = state.vertices[state.vertices.length - 1];
    ctx.save();
    ctx.strokeStyle = "rgba(239, 68, 68, 0.4)"; // subtle red projection guidelines
    ctx.lineWidth = 1.0 / this.zoomLevel;
    ctx.setLineDash([3 / this.zoomLevel, 3 / this.zoomLevel]);
    
    ctx.beginPath();
    ctx.moveTo(last.x - 3000, last.y);
    ctx.lineTo(last.x + 3000, last.y);
    ctx.moveTo(last.x, last.y - 3000);
    ctx.lineTo(last.x, last.y + 3000);
    ctx.stroke();
    ctx.restore();
  }

  // Draw temporary placement previews for tools
  drawActiveToolPreviews(ctx, state) {
    ctx.save();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
    ctx.lineWidth = 1.5 / this.zoomLevel;
    ctx.setLineDash([4 / this.zoomLevel, 4 / this.zoomLevel]);

    const activeStart = state.activeProfileStartIndex !== undefined ? state.activeProfileStartIndex : 0;
    if (state.editorMode === "draw" && state.vertices.length > activeStart && state.mousePos) {
      const last = state.vertices[state.vertices.length - 1];
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(state.mousePos.x, state.mousePos.y);
      ctx.stroke();
    }

    if (state.editorMode === "circle" && state.activeCircleCenter && state.mousePos) {
      const r = Math.hypot(state.mousePos.x - state.activeCircleCenter.x, state.mousePos.y - state.activeCircleCenter.y);
      ctx.beginPath();
      ctx.arc(state.activeCircleCenter.x, state.activeCircleCenter.y, r, 0, 2 * Math.PI);
      ctx.stroke();
    }
    else if (state.editorMode === "rect" && state.activeRectStart && state.mousePos) {
      ctx.beginPath();
      ctx.rect(
        state.activeRectStart.x, 
        state.activeRectStart.y, 
        state.mousePos.x - state.activeRectStart.x, 
        state.mousePos.y - state.activeRectStart.y
      );
      ctx.stroke();
    }
    else if (state.editorMode === "poly" && state.activePolyCenter && state.mousePos) {
      const r = Math.hypot(state.mousePos.x - state.activePolyCenter.x, state.mousePos.y - state.activePolyCenter.y);
      const step = (2 * Math.PI) / state.polySides;
      const angle = Math.atan2(state.mousePos.y - state.activePolyCenter.y, state.mousePos.x - state.activePolyCenter.x);
      
      ctx.beginPath();
      for (let i = 0; i < state.polySides; i++) {
        const theta = angle + i * step;
        const px = state.activePolyCenter.x + r * Math.cos(theta);
        const py = state.activePolyCenter.y + r * Math.sin(theta);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  // Draw object snap target indicators (AutoCAD-style glyphs)
  drawSnapIndicator(ctx, snap) {
    ctx.save();
    ctx.setLineDash([]);
    ctx.lineWidth = 2.2 / this.zoomLevel;

    // High-contrast CAD snap colors
    const colors = {
      endpoint: "#16a34a",
      midpoint: "#ca8a04",
      center: "#2563eb",
      intersection: "#dc2626",
      tangent: "#db2777",
      perpendicular: "#0891b2"
    };
    ctx.strokeStyle = colors[snap.type] || "#ec4899";
    ctx.fillStyle = "rgba(255,255,255,0.85)";

    // Slightly larger glyphs for readability (screen-ish size)
    const size = Math.max(5.5 / this.zoomLevel, 5.5 / this.zoomLevel);

    if (snap.type === "endpoint") {
      ctx.fillRect(snap.x - size, snap.y - size, size * 2, size * 2);
      ctx.strokeRect(snap.x - size, snap.y - size, size * 2, size * 2);
    }
    else if (snap.type === "midpoint") {
      ctx.beginPath();
      ctx.moveTo(snap.x, snap.y - size);
      ctx.lineTo(snap.x + size, snap.y + size);
      ctx.lineTo(snap.x - size, snap.y + size);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    else if (snap.type === "center") {
      ctx.beginPath();
      ctx.arc(snap.x, snap.y, size, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      // cross tick
      ctx.beginPath();
      ctx.moveTo(snap.x - size * 0.5, snap.y);
      ctx.lineTo(snap.x + size * 0.5, snap.y);
      ctx.moveTo(snap.x, snap.y - size * 0.5);
      ctx.lineTo(snap.x, snap.y + size * 0.5);
      ctx.stroke();
    }
    else if (snap.type === "intersection") {
      ctx.beginPath();
      ctx.moveTo(snap.x - size, snap.y - size);
      ctx.lineTo(snap.x + size, snap.y + size);
      ctx.moveTo(snap.x + size, snap.y - size);
      ctx.lineTo(snap.x - size, snap.y + size);
      ctx.stroke();
      // outer box
      ctx.strokeRect(snap.x - size * 0.85, snap.y - size * 0.85, size * 1.7, size * 1.7);
    }
    else if (snap.type === "perpendicular") {
      // corner square glyph
      ctx.beginPath();
      ctx.moveTo(snap.x - size, snap.y + size);
      ctx.lineTo(snap.x - size, snap.y - size);
      ctx.lineTo(snap.x + size, snap.y - size);
      ctx.stroke();
      ctx.strokeRect(snap.x - size * 0.35, snap.y - size * 0.35, size * 0.7, size * 0.7);
    }
    else {
      // Diamond for tangent / other
      ctx.beginPath();
      ctx.moveTo(snap.x, snap.y - size);
      ctx.lineTo(snap.x + size, snap.y);
      ctx.lineTo(snap.x, snap.y + size);
      ctx.lineTo(snap.x - size, snap.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

if (typeof window !== "undefined") {
  window.ExplicitCadRenderer = ExplicitCadRenderer;
}
