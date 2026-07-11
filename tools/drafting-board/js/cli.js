// ==========================================================================
// Explicit 2D CAD Command CLI Input and Parse Engine (Phase 3)
// Resolves absolute, relative (@dx,dy), and relative polar (@dist<angle) inputs
// ==========================================================================

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
  if (text === "") return;

  // Check simple command aliases
  if (text === "l" || text === "line") {
    activeModeSetter("draw");
    return "Mode set to LINE (Profile)";
  }
  if (text === "c" || text === "circle") {
    activeModeSetter("circle");
    return "Mode set to CIRCLE";
  }
  if (text === "r" || text === "rect" || text === "rectangle") {
    activeModeSetter("rect");
    return "Mode set to RECTANGLE";
  }
  if (text === "p" || text === "poly" || text === "polygon") {
    activeModeSetter("poly");
    return "Mode set to POLYGON";
  }
  if (text === "f" || text === "fillet") {
    activeModeSetter("fillet");
    return "Mode set to FILLET";
  }
  if (text === "d" || text === "dim" || text === "dimension") {
    activeModeSetter("dimension");
    return "Mode set to DIMENSION";
  }
  if (text === "m" || text === "measure") {
    activeModeSetter("measure");
    return "Mode set to MEASURE";
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

  // Otherwise, treat as coordinate entry
  const pt = parseCoordinateInput(rawText, lastPt);
  if (pt) {
    const currentMode = getActiveMode();
    if (currentMode === "draw") {
      addNodeFn(pt.x, pt.y);
      return `Added line node at (${pt.x}, ${pt.y})`;
    } 
    else if (currentMode === "circle") {
      // If we don't have a center, set it
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
