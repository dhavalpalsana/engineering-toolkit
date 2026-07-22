/**
 * analytics.js — Privacy-safe usage counters for Engineering Toolkit.
 *
 * Rules:
 *  - Never send emails, project names, drawing/risk/CAN payloads, or share URLs.
 *  - Only: toolId, event name, session id (anonymous), optional msBucket / path.
 *
 * Events: hub_view | tool_open | tool_engaged | tool_exit | bug_report_open | pm_open | share_copy
 *
 * Load after firebase.js (optional). Safe no-op if Firebase unavailable.
 */
(function () {
  "use strict";

  const SESSION_KEY = "et_analytics_session_v1";
  const ENGAGED_KEY = "et_analytics_engaged_";

  function sessionId() {
    try {
      let id = sessionStorage.getItem(SESSION_KEY);
      if (!id) {
        id = "s_" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
        sessionStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch (_) {
      return "anon";
    }
  }

  function detectToolId() {
    if (window.ToolShell && window.ToolShell.toolId) return window.ToolShell.toolId;
    if (window.projectManagerConfig && window.projectManagerConfig.toolId) {
      return window.projectManagerConfig.toolId;
    }
    const path = window.location.pathname || "";
    const match = path.match(/\/tools\/([^/]+)/);
    return match ? match[1] : null;
  }

  function isHub() {
    const path = window.location.pathname || "";
    return !path.includes("/tools/") || /\/index\.html$/.test(path) && !path.includes("/tools/");
  }

  function msBucket(ms) {
    if (ms < 10000) return "0-10s";
    if (ms < 60000) return "10-60s";
    if (ms < 300000) return "1-5m";
    return "5m+";
  }

  /**
   * Increment aggregate counters on tool_stats (cheap, no raw event flood).
   */
  function track(event, props) {
    if (!event || typeof event !== "string") return;
    const toolId = (props && props.toolId) || detectToolId() || (isHub() ? "_hub" : "unknown");
    const payload = {
      event,
      toolId,
      // sessionId stored only in memory path for future raw logs — not written to public stats
    };

    // Local debug buffer (dev only; capped)
    try {
      const buf = JSON.parse(sessionStorage.getItem("et_analytics_buf") || "[]");
      buf.push({ ...payload, t: Date.now() });
      if (buf.length > 40) buf.shift();
      sessionStorage.setItem("et_analytics_buf", JSON.stringify(buf));
    } catch (_) { /* ignore */ }

    if (typeof window.firebase === "undefined" || !firebase.apps || !firebase.apps.length) return;

    try {
      const docId = toolId === "_hub" ? "_hub" : toolId;
      // uses++ stays in project-manager for tool pages; we only touch event counters here
      const update = {
        lastEventAt: firebase.firestore.FieldValue.serverTimestamp(),
        [`events.${event}`]: firebase.firestore.FieldValue.increment(1)
      };
      if (event === "hub_view") {
        update.uses = firebase.firestore.FieldValue.increment(1);
      }
      firebase.firestore().collection("tool_stats").doc(docId).set(update, { merge: true })
        .catch((err) => console.warn("Analytics write failed:", err));
    } catch (err) {
      console.warn("Analytics error:", err);
    }
  }

  /** Fire once per session per tool for engagement. */
  function trackEngaged(toolId) {
    const id = toolId || detectToolId() || "unknown";
    try {
      const key = ENGAGED_KEY + id;
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
    } catch (_) { /* ignore */ }
    track("tool_engaged", { toolId: id });
  }

  const pageOpenedAt = Date.now();
  let exitSent = false;

  function trackExit() {
    if (exitSent) return;
    exitSent = true;
    const toolId = detectToolId() || (isHub() ? "_hub" : "unknown");
    const bucket = msBucket(Date.now() - pageOpenedAt);
    // Encode bucket in event name to avoid free-form payload fields
    track("tool_exit_" + bucket, { toolId });
  }

  function boot() {
    const hub = !detectToolId() && (
      !(window.location.pathname || "").includes("/tools/")
    );
    if (hub || (window.location.pathname || "").endsWith("/") && !(window.location.pathname || "").includes("/tools/")) {
      // Hub: site root (clean URL /)
      const path = window.location.pathname || "";
      if (!path.includes("/tools/")) {
        track("hub_view", { toolId: "_hub" });
      }
    }
    const toolId = detectToolId();
    if (toolId) {
      track("tool_open", { toolId });
    }

    window.addEventListener("pagehide", trackExit);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") trackExit();
    });
  }

  window.ETAnalytics = {
    track,
    trackEngaged,
    sessionId,
    detectToolId,
    msBucket
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
