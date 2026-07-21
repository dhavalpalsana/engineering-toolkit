/**
 * Unified undo/redo stack for plot extractor.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PlotHistory = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function create(max) {
    return {
      max: max || 60,
      stack: [],
      pointer: -1
    };
  }

  function push(hist, snapshot) {
    hist.stack = hist.stack.slice(0, hist.pointer + 1);
    hist.stack.push(JSON.parse(JSON.stringify(snapshot)));
    if (hist.stack.length > hist.max) hist.stack.shift();
    hist.pointer = hist.stack.length - 1;
  }

  function canUndo(hist) { return hist.pointer > 0; }
  function canRedo(hist) { return hist.pointer < hist.stack.length - 1; }

  function undo(hist) {
    if (!canUndo(hist)) return null;
    hist.pointer--;
    return JSON.parse(JSON.stringify(hist.stack[hist.pointer]));
  }

  function redo(hist) {
    if (!canRedo(hist)) return null;
    hist.pointer++;
    return JSON.parse(JSON.stringify(hist.stack[hist.pointer]));
  }

  return { create, push, undo, redo, canUndo, canRedo };
});
