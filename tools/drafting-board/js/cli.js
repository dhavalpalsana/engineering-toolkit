// ==========================================================================
// Explicit 2D CAD Command CLI Input and Parse Engine (Phase 3)
// Resolves absolute, relative (@dx,dy), and relative polar (@dist<angle) inputs
// Maintains command sub-states for continuous CLI workflow prompting
// ==========================================================================

let cliState = {
  activeCommand: null, // "line", "circle", "perpendicular", "parallel", "coincident", "concentric", "tangent"
  step: 0,
  data: {}
};

function parseCoordinateInput(input, lastPt) {
  input = input.trim();
  
  // 1. Relative polar: @dist<angle (e.g. @100<45)
  const polarMatch = input.match(/^@([\d.-]+)<([\d.-]+)$/);
  if (polarMatch) {
    if (!lastPt) {
      alert("No reference point found for relative polar coordinate.");
      return null;
    }
    const dist = parseFloat(polarMatch[1]);
    const angleDeg = parseFloat(polarMatch[2]);
    const angleRad = (angleDeg * Math.PI) / 180;
    return {
      x: Math.round(lastPt.x + dist * Math.cos(angleRad)),
      y: Math.round(lastPt.y + dist * Math.sin(angleRad))
    };
  }

  // 2. Relative Cartesian: @dx,dy (e.g. @10,-20)
  const relativeMatch = input.match(/^@([\d.-]+),([\d.-]+)$/);
  if (relativeMatch) {
    if (!lastPt) {
      alert("No reference point found for relative Cartesian coordinate.");
      return null;
    }
    const dx = parseFloat(relativeMatch[1]);
    const dy = parseFloat(relativeMatch[2]);
    return {
      x: Math.round(lastPt.x + dx),
      y: Math.round(lastPt.y + dy)
    };
  }

  // 3. Absolute Cartesian: x,y (e.g. 100,200)
  const absoluteMatch = input.match(/^([\d.-]+),([\d.-]+)$/);
  if (absoluteMatch) {
    const x = parseFloat(absoluteMatch[1]);
    const y = parseFloat(absoluteMatch[2]);
    return {
      x: Math.round(x),
      y: Math.round(y)
    };
  }

  return null;
}

// Handle key/text commands input inside CLI
function processCommandText(rawText, activeModeSetter, getActiveMode, lastPt, addNodeFn, addCircleFn, clearFn, undoFn, closeFn) {
  const text = rawText.trim().toLowerCase();
  if (text === "") return "";

  // Support exit or cancel out of current continuous command state
  if (text === "exit" || text === "cancel" || text === "esc") {
    cliState = { activeCommand: null, step: 0, data: {} };
    return "Command cancelled.";
  }

  // --- Sub-state machine routes ---
  if (cliState.activeCommand) {
    switch (cliState.activeCommand) {
      case "line": {
        if (text === "u" || text === "undo") {
          undoFn();
          return "Undone last segment point. Specify next point or [Undo]:";
        }
        const pt = parseCoordinateInput(rawText, lastPt);
        if (pt) {
          addNodeFn(pt.x, pt.y);
          cliState.step++;
          return "Added line segment. Specify next point or [Undo]:";
        }
        return "Invalid coordinate. Specify next point or [Undo]:";
      }

      case "circle": {
        if (cliState.step === 0) {
          const pt = parseCoordinateInput(rawText, lastPt);
          if (pt) {
            cliState.data.center = pt;
            cliState.step = 1;
            return "Center coordinate set. Specify radius of circle:";
          }
          return "Invalid center coordinate. Specify center point for circle:";
        } else if (cliState.step === 1) {
          const radius = parseFloat(rawText);
          if (!isNaN(radius) && radius > 0) {
            addCircleFn(cliState.data.center.x, cliState.data.center.y, radius);
            cliState = { activeCommand: null, step: 0, data: {} };
            return `Placed circle with radius ${radius} mm`;
          } else {
            const pt = parseCoordinateInput(rawText, cliState.data.center);
            if (pt) {
              const r = Math.round(Math.hypot(pt.x - cliState.data.center.x, pt.y - cliState.data.center.y));
              addCircleFn(cliState.data.center.x, cliState.data.center.y, r);
              cliState = { activeCommand: null, step: 0, data: {} };
              return `Placed circle with radius ${r} mm`;
            }
            return "Invalid radius/coordinate. Specify radius of circle:";
          }
        }
        break;
      }

      case "perpendicular": {
        const idx = parseInt(rawText);
        const firstLine = cliState.data.firstLine;
        const count = typeof window !== "undefined" && window.getVerticesCount ? window.getVerticesCount() : 0;
        if (!isNaN(idx) && idx >= 0 && idx < count) {
          if (window.addParametricConstraint) {
            window.addParametricConstraint({
              type: "perpendicular",
              targets: [firstLine, (firstLine + 1) % count, idx, (idx + 1) % count]
            });
            cliState = { activeCommand: null, step: 0, data: {} };
            return `Applied PERPENDICULAR constraint between Line ${firstLine} and Line ${idx}`;
          }
        }
        return `Invalid line segment index. Enter index of second line segment (0 to ${count - 1}):`;
      }

      case "parallel": {
        const idx = parseInt(rawText);
        const firstLine = cliState.data.firstLine;
        const count = typeof window !== "undefined" && window.getVerticesCount ? window.getVerticesCount() : 0;
        if (!isNaN(idx) && idx >= 0 && idx < count) {
          if (window.addParametricConstraint) {
            window.addParametricConstraint({
              type: "parallel",
              targets: [firstLine, (firstLine + 1) % count, idx, (idx + 1) % count]
            });
            cliState = { activeCommand: null, step: 0, data: {} };
            return `Applied PARALLEL constraint between Line ${firstLine} and Line ${idx}`;
          }
        }
        return `Invalid line segment index. Enter index of second line segment (0 to ${count - 1}):`;
      }

      case "coincident": {
        if (cliState.step === 0) {
          const idx = parseInt(rawText);
          const count = typeof window !== "undefined" && window.getVerticesCount ? window.getVerticesCount() : 0;
          if (!isNaN(idx) && idx >= 0 && idx < count) {
            cliState.data.v1 = idx;
            cliState.step = 1;
            return `First vertex set to Node ${idx}. Enter index of second vertex:`;
          }
          return `Invalid vertex index. Enter index of first vertex (0 to ${count - 1}):`;
        } else {
          const idx = parseInt(rawText);
          const count = typeof window !== "undefined" && window.getVerticesCount ? window.getVerticesCount() : 0;
          const v1 = cliState.data.v1;
          if (!isNaN(idx) && idx >= 0 && idx < count) {
            if (window.addParametricConstraint) {
              window.addParametricConstraint({
                type: "coincident",
                targets: [v1, idx]
              });
              cliState = { activeCommand: null, step: 0, data: {} };
              return `Applied COINCIDENT constraint between Node ${v1} and Node ${idx}`;
            }
          }
          return `Invalid vertex index. Enter index of second vertex (0 to ${count - 1}):`;
        }
      }

      case "concentric": {
        if (cliState.step === 0) {
          const idx = parseInt(rawText);
          const count = typeof window !== "undefined" && window.getCirclesCount ? window.getCirclesCount() : 0;
          if (!isNaN(idx) && idx >= 0 && idx < count) {
            cliState.data.c1 = idx;
            cliState.step = 1;
            return `First circle set to Circle ${idx}. Enter index of second circle:`;
          }
          return `Invalid circle index. Enter index of first circle (0 to ${count - 1}):`;
        } else {
          const idx = parseInt(rawText);
          const count = typeof window !== "undefined" && window.getCirclesCount ? window.getCirclesCount() : 0;
          const c1 = cliState.data.c1;
          if (!isNaN(idx) && idx >= 0 && idx < count) {
            if (window.addParametricConstraint) {
              window.addParametricConstraint({
                type: "concentric",
                targets: [c1, idx]
              });
              cliState = { activeCommand: null, step: 0, data: {} };
              return `Applied CONCENTRIC constraint between Circle ${c1} and Circle ${idx}`;
            }
          }
          return `Invalid circle index. Enter index of second circle (0 to ${count - 1}):`;
        }
      }

      case "tangent": {
        if (cliState.step === 0) {
          const idx = parseInt(rawText);
          const lineCount = typeof window !== "undefined" && window.getVerticesCount ? window.getVerticesCount() : 0;
          if (!isNaN(idx) && idx >= 0 && idx < lineCount) {
            cliState.data.lineIdx = idx;
            cliState.step = 1;
            const circleCount = typeof window !== "undefined" && window.getCirclesCount ? window.getCirclesCount() : 0;
            return `Line segment set to Line ${idx}. Enter index of circle (0 to ${circleCount - 1}):`;
          }
          return `Invalid line segment index. Enter index of line segment (0 to ${lineCount - 1}):`;
        } else {
          const idx = parseInt(rawText);
          const circleCount = typeof window !== "undefined" && window.getCirclesCount ? window.getCirclesCount() : 0;
          const lineIdx = cliState.data.lineIdx;
          const count = typeof window !== "undefined" && window.getVerticesCount ? window.getVerticesCount() : 0;
          if (!isNaN(idx) && idx >= 0 && idx < circleCount) {
            if (window.addParametricConstraint) {
              window.addParametricConstraint({
                type: "tangent",
                targets: [lineIdx, (lineIdx + 1) % count, idx]
              });
              cliState = { activeCommand: null, step: 0, data: {} };
              return `Applied TANGENT constraint between Line ${lineIdx} and Circle ${idx}`;
            }
          }
          return `Invalid circle index. Enter index of circle (0 to ${circleCount - 1}):`;
        }
      }
    }
  }

  // --- Parse primary commands ---
  if (text === "l" || text === "line") {
    activeModeSetter("draw");
    cliState.activeCommand = "line";
    cliState.step = 0;
    return "Mode set to LINE. Specify first point:";
  }
  if (text === "c" || text === "circle") {
    activeModeSetter("circle");
    cliState.activeCommand = "circle";
    cliState.step = 0;
    return "Mode set to CIRCLE. Specify center point for circle:";
  }
  if (text === "r" || text === "rect" || text === "rectangle") {
    activeModeSetter("rect");
    return "Mode set to RECTANGLE. Click/drag on canvas.";
  }
  if (text === "p" || text === "poly" || text === "polygon") {
    activeModeSetter("poly");
    return "Mode set to POLYGON. Click/drag on canvas.";
  }
  if (text === "f" || text === "fillet") {
    activeModeSetter("fillet");
    return "Mode set to FILLET. Click a vertex corner.";
  }
  if (text === "d" || text === "dim" || text === "dimension") {
    activeModeSetter("dimension");
    return "Mode set to DIMENSION. Select nodes/entities.";
  }
  if (text === "m" || text === "measure") {
    activeModeSetter("measure");
    return "Mode set to MEASURE. Click two points.";
  }
  if (text === "u" || text === "undo") {
    undoFn();
    return "Undone last segment point";
  }
  if (text === "clear") {
    clearFn();
    return "Cleared workspace";
  }
  if (text === "close") {
    closeFn();
    return "Closed sketch loop";
  }

  // Direct constraint typing when line is selected
  if (text === "horizontal" || text === "hor" || text === "h") {
    const sel = typeof window !== "undefined" && window.getSelectedEntity ? window.getSelectedEntity() : null;
    if (sel && sel.type === "line") {
      const idx = sel.index;
      const count = typeof window !== "undefined" && window.getVerticesCount ? window.getVerticesCount() : 0;
      if (window.addParametricConstraint) {
        window.addParametricConstraint({
          type: "horizontal",
          targets: [idx, (idx + 1) % count]
        });
        return `Applied HORIZONTAL constraint to Line segment ${idx}`;
      }
    }
    return "No line segment selected. Please select a line segment first.";
  }

  if (text === "vertical" || text === "ver" || text === "v") {
    const sel = typeof window !== "undefined" && window.getSelectedEntity ? window.getSelectedEntity() : null;
    if (sel && sel.type === "line") {
      const idx = sel.index;
      const count = typeof window !== "undefined" && window.getVerticesCount ? window.getVerticesCount() : 0;
      if (window.addParametricConstraint) {
        window.addParametricConstraint({
          type: "vertical",
          targets: [idx, (idx + 1) % count]
        });
        return `Applied VERTICAL constraint to Line segment ${idx}`;
      }
    }
    return "No line segment selected. Please select a line segment first.";
  }

  if (text === "perpendicular" || text === "perp") {
    const sel = typeof window !== "undefined" && window.getSelectedEntity ? window.getSelectedEntity() : null;
    if (sel && sel.type === "line") {
      cliState.activeCommand = "perpendicular";
      cliState.step = 0;
      cliState.data.firstLine = sel.index;
      const count = typeof window !== "undefined" && window.getVerticesCount ? window.getVerticesCount() : 0;
      return `First line: Line ${sel.index}. Enter index of second line segment (0 to ${count - 1}):`;
    }
    return "No line segment selected. Please select the first line segment first.";
  }

  if (text === "parallel" || text === "par") {
    const sel = typeof window !== "undefined" && window.getSelectedEntity ? window.getSelectedEntity() : null;
    if (sel && sel.type === "line") {
      cliState.activeCommand = "parallel";
      cliState.step = 0;
      cliState.data.firstLine = sel.index;
      const count = typeof window !== "undefined" && window.getVerticesCount ? window.getVerticesCount() : 0;
      return `First line: Line ${sel.index}. Enter index of second line segment (0 to ${count - 1}):`;
    }
    return "No line segment selected. Please select the first line segment first.";
  }

  if (text === "coincident" || text === "coin") {
    cliState.activeCommand = "coincident";
    cliState.step = 0;
    const count = typeof window !== "undefined" && window.getVerticesCount ? window.getVerticesCount() : 0;
    return `Enter index of first vertex (0 to ${count - 1}):`;
  }

  if (text === "concentric" || text === "conc") {
    cliState.activeCommand = "concentric";
    cliState.step = 0;
    const circleCount = typeof window !== "undefined" && window.getCirclesCount ? window.getCirclesCount() : 0;
    return `Enter index of first circle (0 to ${circleCount - 1}):`;
  }

  if (text === "tangent" || text === "tan") {
    cliState.activeCommand = "tangent";
    cliState.step = 0;
    const lineCount = typeof window !== "undefined" && window.getVerticesCount ? window.getVerticesCount() : 0;
    return `Enter index of line segment (0 to ${lineCount - 1}):`;
  }

  // Otherwise, treat as coordinate entry
  const pt = parseCoordinateInput(rawText, lastPt);
  if (pt) {
    const currentMode = getActiveMode();
    if (currentMode === "draw") {
      addNodeFn(pt.x, pt.y);
      return `Added line node at (${pt.x}, ${pt.y})`;
    } 
    else if (currentMode === "circle") {
      if (!window.activeCircleCenter) {
        window.activeCircleCenter = pt;
        return `Set circle center at (${pt.x}, ${pt.y}). Input radius/next coordinate.`;
      } else {
        const radius = Math.round(Math.hypot(pt.x - window.activeCircleCenter.x, pt.y - window.activeCircleCenter.y));
        addCircleFn(window.activeCircleCenter.x, window.activeCircleCenter.y, radius);
        window.activeCircleCenter = null;
        return `Placed circle with radius ${radius} mm`;
      }
    }
    else {
      return `Coordinate (${pt.x}, ${pt.y}) processed but no active mode supports keyboard input.`;
    }
  }

  return `Unknown command or coordinate syntax: "${rawText}"`;
}

// Export for tests and browser scope
if (typeof window !== "undefined") {
  window.parseCoordinateInput = parseCoordinateInput;
  window.processCommandText = processCommandText;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { parseCoordinateInput, processCommandText };
}
