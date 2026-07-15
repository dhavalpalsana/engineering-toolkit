# Implementation Plan: Platform, Risk, CAN, Analytics

**Branch:** continue on `dhaval/dev` (stack PRs or one long-lived branch with sequential commits)  
**Base:** `main` after #3 lands (or rebase onto latest `dhaval/dev`)  
**Owner plan date:** 2026-07-15  
**Scope source:** user-selected roadmap (all items in this document)

---

## 0. Decisions (locked)

| Decision | Choice | Why |
|---|---|---|
| Order | A → B → E(lite) → C → D1 → D2 → D3 → E(full) | Platform first; analytics hooks early; CAN depth last |
| Shell | Polish + enforce, not greenfield | All tools already load `tool-shell.js` / CSS |
| PM schema | Additive fields only | No break of existing Firestore projects |
| Analytics | First-party Firestore, no third-party cookies | Privacy-safe; `tool_stats` already exists |
| CAN station types | Explicit enum on station | Makes splitter = station obvious |
| Risk share | Read-only mode flag in share payload | Prevents accidental cloud overwrite |
| PR strategy | One PR per phase (A…E) | Reviewable diffs; can ship mid-stream |

**Out of scope for this plan:** drafting→beam bridge, bolt-torque, pressure-drop, offline PWA.

---

## 1. Current baseline (facts)

| Area | State |
|---|---|
| Tool shell | Loaded on all 14 tools; beta banner + footer + logo sync; bug modal requires sign-in via PM |
| Project Manager | Name search; group-by-tool in list; save/open/autosave; no folders/tags/duplicate/lastOpened filter UI |
| Analytics today | `tool_stats` uses++ on tool open only |
| Risk | Residual fields, multi-register local, Jira URL, share `?design=` loads editable state |
| CAN | Stations + devices; stub limits tables; BOM CSV; BO_/SG_ paste; `dragInfo` partial; Harness/Advanced/CANopen tabs |

---

## 2. Phase map

```
Week-ish flow (effort, not calendar commitment):

  A  Shell consistency          ~1 day
  B  Project Manager depth      ~3–4 days
  E0 Analytics lite hooks       ~0.5 day  (with B or right after A)
  C  Risk residual/share/compare ~3 days
  D1 CAN topology clarity       ~2–3 days
  D2 CAN wizard + export        ~3 days
  D3 CAN DBC + signal matrix    ~4–5 days
  E1 Analytics funnel complete  ~1 day
```

Total ~15–18 engineering days of focused work.

---

## 3. Phase A — Consistent tool shell

### Goals
- One bug-report and suggest path that always works once PM is loaded.
- Header/logo/footer parity across tools.
- Shell exposes stable `window.ToolShell` API for analytics and headers.

### Work items

| ID | Task | Files | Acceptance |
|---|---|---|---|
| A1 | Audit each tool: load order `tools-data → tool-shell → project-manager → app`; fix any missing | `tools/*/index.html` | Grep audit: all tools match order |
| A2 | Shell bug/suggest: queue click if PM modal not ready; never dead-end | `js/tool-shell.js` | Click Report Bug before/after PM boot always opens form or clear sign-in CTA |
| A3 | Pre-fill bug form with `toolId`, path, userAgent (no project data) | `js/project-manager.js` | Submitted `bug_reports` docs include toolId + path |
| A4 | Document shell contract in comment block / short AGENTS note | `js/tool-shell.js` | New tool checklist: 4 script tags + toolId |
| A5 | Optional: replace 1–2 drift headers with `ToolShell.renderHeader` only if low risk | selected tools | Visual parity with hub icons |

### Non-goals
- Redesign all headers visually.
- Force sign-in for suggest (keep current product rules unless already required).

### Test plan
- [ ] Open each tool: footer links work; beta tools show banner.
- [ ] Report Bug from beta banner and footer.
- [ ] Hub logos match tool header icons.

### PR
`chore(shell): unify bug path and tool shell contract`

---

## 4. Phase B — Project Manager depth

### Goals
Folders, tags, duplicate, last-opened, tool filter — without breaking existing saves.

### Schema (additive)

```js
// Firestore project document (existing fields kept)
{
  toolId, name, data, userId, createdAt, updatedAt,
  // NEW (all optional)
  tags: string[],           // lowercase trimmed, max 12, each ≤ 32 chars
  folderId: string | null,  // ref user_folders/{uid}/folders/{id}
  lastOpenedAt: Timestamp | null
}

// New collection: user_folders/{uid}/folders/{folderId}
{ name, order, createdAt }
```

Local/guest mode: mirror tags/folderId/lastOpenedAt in whatever local cache PM uses (if any); if PM is cloud-only when signed out, features degrade to “sign in to organize”.

### Work items

| ID | Task | Acceptance |
|---|---|---|
| B1 | Firestore read/write pass-through for tags, folderId, lastOpenedAt | Old projects load; missing fields default |
| B2 | On successful Open: set `lastOpenedAt = now` | Reopen sorts under Recent |
| B3 | Drawer UI: sort control `Recent \| Name \| Tool` | Default Recent when ≥1 lastOpened |
| B4 | Tool filter dropdown (hub = all tools; tool page = current + “All”) | Filter sticky for session |
| B5 | Duplicate action on card: copy name + ` (copy)`, new id, same data/tags | Opens as unsaved or auto-saved copy |
| B6 | Tags on Save modal + chip filter in drawer | Filter AND name search |
| B7 | Folders: create/rename/delete empty; assign project to folder; drawer sections | Delete folder unassigns projects (no cascade delete of projects) |
| B8 | Migration: no batch job; defaults on read | Zero downtime |

### UI sketch (drawer)

```
[ Search............ ] [ Tool ▾ ] [ Sort ▾ ]
Tags: [all] [harness] [wip] ...
Folders:  All | Unfiled | 📁 Site A | 📁 Lab
────────────────────────────
🔧 can-bus-designer
   My harness v2     tags  ⋯  [Open] [Dup] [Del]
…
```

### Test plan
- [ ] Save old-style project still opens.
- [ ] Duplicate then edit does not mutate original.
- [ ] Filter by tool + tag + folder intersection.
- [ ] lastOpened updates only on open, not on list view.

### PR
`feat(pm): folders, tags, duplicate, recent, tool filter`

---

## 5. Phase E0 — Analytics lite (hooks)

Ship minimal events while PM/shell are open so later phases instrument for free.

### Privacy rules (hard)
- **Never** send: emails, project names, drawing/risk/CAN payloads, share URLs, exact free text.
- **Do** send: `toolId`, `event`, `ts` (server time preferred), anonymous `sessionId` (sessionStorage UUID), optional `msBucket`, `path` (tool path only).

### Events (E0)

| Event | Trigger |
|---|---|
| `tool_open` | Tool page boot (replace or complement uses++ ) |
| `hub_view` | Hub load |
| `bug_report_open` | Shell opens bug modal |
| `pm_open` | Projects drawer opened |

### Implementation
- New `js/analytics.js` thin helper: `window.ETAnalytics.track(event, props?)`.
- Writes to `analytics_events` (append-only) **or** aggregate counters on `tool_stats` subfields to reduce cost:

**Preferred v1 (cheap):** extend `tool_stats/{toolId}`:

```js
{
  uses: N,
  lastUsed: ts,
  events: { tool_open: N, tool_engaged: N, bug_report_open: N }
}
```

Plus daily rollup doc optional later.

Hub: `tool_stats/_hub` or `analytics_meta/hub`.

### Firestore rules
- Authenticated or anonymous write increment only if rules allow public increment today for `tool_stats`; match existing pattern.
- No client read of other users’ events.

### PR
Can merge with A or B: `feat(analytics): privacy-safe tool open counters`

---

## 6. Phase C — Risk management

### Goals
Residual is first-class; Jira links trustworthy; multi-register compare; share is read-only by default.

### Work items

| ID | Task | Acceptance |
|---|---|---|
| C1 | Residual UX: show inherent score, residual score, Δ in table; color residual badge | Empty residual → show “—” and treat matrix as inherent |
| C2 | Heatmap toggle: Inherent \| Residual | Toggle persists in sessionStorage |
| C3 | Jira: validate URL; extract key `PROJ-123`; Open button; soft warning not hard block | Invalid URL still saves risk with warning toast |
| C4 | Cloud sync: residual + jira fields always on normalize/save | Round-trip JSON/cloud |
| C5 | Multi-register compare view: select 2 registers → summary cards + top-10 by score | Works offline/local registers |
| C6 | Share payload: `{ v:2, mode:"readonly", registerName, risks }` | Old payload still loads |
| C7 | Read-only mode: banner “Viewing shared register”; hide edit/delete; “Import to my registers” copies | Does not write cloud until import |
| C8 | Analytics: `tool_engaged` on first risk add/edit | Via ETAnalytics |

### Test plan
- [ ] Residual matrix differs from inherent when mitigations set.
- [ ] Shared link opens without sign-in; cannot overwrite owner data.
- [ ] Compare two registers with different risk counts.
- [ ] Jira open opens new tab for valid links.

### PR
`feat(risk): residual views, compare, readonly share, jira polish`

---

## 7. Phase D1 — CAN topology clarity

### Goals
User mental model: **splitter = station type splice/star**, not a device/node.

### Model

```js
station = {
  id, name, distanceFromPrev,
  type: "end" | "splice" | "star" | "terminator",  // NEW
  devices: [{ id, name, stubLength, termination, ... }]
}
```

**Inference on load (legacy):**  
- first/last station + any 120Ω device → prefer `terminator` or `end`  
- `devices.length >= 2` → `star`  
- else mid → `splice`  
- user override always wins once set

### Work items

| ID | Task | Acceptance |
|---|---|---|
| D1.1 | Add `type` to station cards + presets | Presets name splices as type splice/star |
| D1.2 | Diagram glyphs + legend (End / Splice / Star / Term) | Legend visible |
| D1.3 | Stub limit tooltip & inline helper under stub input | Shows max m for current baud (CAN FD data phase when enabled) |
| D1.4 | Finish drag-station: mousedown on station → move along trunk → update `distanceFromPrev` of self and next | Form fields and SVG stay in sync |
| D1.5 | Help blurb: “Harness splitter = Station (Splice/Star). Devices are ECUs only.” | First-run dismissible or Advanced help |
| D1.6 | `tool_engaged` on add station / drag | Analytics |

### Test plan
- [ ] Ideal-250 preset shows Cabin Splice as splice/star.
- [ ] Drag station changes spacing; undo not required if no undo stack (document).
- [ ] Stub over limit still flags compliance as today + tooltip explains limit.

### PR
`feat(can): station types, stub guidance, drag spacing`

---

## 8. Phase D2 — CAN wizard + harness export

### Work items

| ID | Task | Acceptance |
|---|---|---|
| D2.1 | New design wizard modal: (1) Multi-drop daisy-chain (2) Backbone + stubs (3) Empty | Creates 3–5 stations with sensible types/terms |
| D2.2 | SVG export of topology one-liner (download `.svg`) | Opens in browser; printable |
| D2.3 | PDF-ish: print stylesheet for diagram + station/device table OR `window.print` layout | Print preview usable |
| D2.4 | Connector / pin table CSV (station, device, stub m, term Ω, type) | Extends or sits beside BOM export |
| D2.5 | Wire wizard choice into presets dropdown as “Guided setup…” | Discoverable |

### PR
`feat(can): topology wizard and harness drawing export`

---

## 9. Phase D3 — DBC import + signal matrix

### Work items

| ID | Task | Acceptance |
|---|---|---|
| D3.1 | DBC parser module: `BU_`, `BO_`, `SG_`, `CM_BU_`, `CM_ BO_`, `VAL_` subset | Unit tests on sample DBC snippet |
| D3.2 | Import maps `BU_` nodes → suggest devices or CANopen name list | Non-destructive merge option |
| D3.3 | Signal matrix UI: rows = messages, cols = nodes, cells Tx/Rx/empty | Filter by name; export CSV |
| D3.4 | Keep LDF as stretch: only if DBC done early | Optional follow-up issue |
| D3.5 | Store imported DBC summary in project save payload | PM round-trip |

### PR
`feat(can): DBC import and signal matrix`

---

## 10. Phase E1 — Analytics funnel complete

### Additional events

| Event | Trigger |
|---|---|
| `tool_engaged` | First meaningful action per session per tool (drafting click, CAN add station, risk save, etc.) — fire once |
| `tool_exit` | `pagehide` with `msBucket`: `0-10s`, `10-60s`, `1-5m`, `5m+` |
| `share_copy` | Share link copied |
| `pm_duplicate` / `pm_filter` | Optional |

### Optional mini dashboard
- Hub admin-only later; **v1 = Firestore console / simple export script** not a full UI.
- Document how to read `tool_stats` in README or docs.

### PR
`feat(analytics): engagement and exit buckets`

---

## 11. Dependency graph

```
A1–A5 ──┬──► B1–B8 ──► C5 uses multi-project mental model (soft)
        │         │
        └──► E0 ──┴──► E1 (needs engaged hooks in C/D)
        
D1 ──► D2 ──► D3   (serial within CAN)
C parallel with D1 after B
```

**Critical path:** A → B → D1 → D2 → D3  
**Parallel after B:** C and D1  
**E0 early; E1 after engaged hooks exist**

---

## 12. Definition of Done (program)

- [ ] Shell: bug/suggest reliable on every tool; load order documented.
- [ ] PM: recent, tool filter, duplicate, tags, folders ship for signed-in users.
- [ ] Risk: residual views, compare, readonly share, jira open.
- [ ] CAN: station types, stub tooltips, drag spacing, wizard, SVG/print export, DBC + matrix.
- [ ] Analytics: open/engaged/exit (bucketed) without PII.
- [ ] Each phase has PR + manual test checklist ticked.
- [ ] README tools blurb updated if user-facing behavior changes materially.

---

## 13. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Firestore rules block new fields | Use existing project write path; additive fields only |
| PM drawer complexity | Ship B3–B5 first (recent/filter/dup), then tags, then folders |
| DBC parser rabbit hole | Cap at BO_/SG_/BU_/VAL_; tests; no full Vector parity |
| Analytics cost | Aggregate counters not raw event flood in v1 |
| Large CAN app.js | New files: `can-dbc.js`, `can-export.js` if >200 LOC features |
| Share URL size (risk) | Cap risks in share or compress; warn if too large |

---

## 14. Execution order (what to implement next)

1. **A** — shell polish  
2. **E0** — analytics helper + tool_open  
3. **B** — PM depth  
4. **C** — risk  
5. **D1** — CAN types/drag/tooltips  
6. **D2** — wizard/export  
7. **D3** — DBC/matrix  
8. **E1** — funnel complete  

Start implementation at **Phase A** unless blocked on merge of current `dhaval/dev` PR.

---

## 15. Ticket checklist (copy into issues)

- [ ] A1 Load order audit  
- [ ] A2 Bug click queue  
- [ ] A3 Bug metadata  
- [ ] A4 Shell contract docs  
- [ ] B1 Schema pass-through  
- [ ] B2 lastOpenedAt  
- [ ] B3 Sort Recent  
- [ ] B4 Tool filter  
- [ ] B5 Duplicate  
- [ ] B6 Tags  
- [ ] B7 Folders  
- [ ] E0 analytics.js + tool_open  
- [ ] C1–C2 Residual table/heatmap  
- [ ] C3–C4 Jira + normalize  
- [ ] C5 Compare  
- [ ] C6–C7 Readonly share  
- [ ] D1.1–D1.6 Station types + drag + stubs  
- [ ] D2.1–D2.5 Wizard + export  
- [ ] D3.1–D3.5 DBC + matrix  
- [ ] E1 engaged/exit  

---

*End of plan.*
