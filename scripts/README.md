# CI & verification scripts

| Command | What it does |
|---------|----------------|
| `npm run check` | Structural contracts, syntax (`node --check`), unit tests |
| `npm test` | Unit tests only (`node --test` + legacy drafting runners via check) |
| `npm run smoke` | Playwright: hub + every active/beta tool |
| `npm run verify` | check → test → smoke (full gate) |

## Local setup

```bash
npm install
npx playwright install chromium          # download browser
# On Linux CI/dev machines missing OS libs:
#   npx playwright install --with-deps chromium

npm run check
npm run smoke
npm run verify   # check + test + smoke
```

If Chromium cannot launch (missing `libnspr4` etc.), `npm run smoke` **falls back to HTTP-only** checks (status 200, header present, script includes). Full UI assertions (Export menu, page errors) run on GitHub Actions where `--with-deps` is used.

Optional:

```bash
HEADED=1 npm run smoke           # watch the browser
BASE_URL=https://eng-toolkit.web.app npm run smoke   # hit deployed site
SMOKE_PORT=4173 npm run smoke
```

## What check-site enforces

- Registry tools vs `tools/*/index.html`
- `physicsVersion` on live tools
- Shared script includes / order
- `ToolExports.register` + `projectManagerConfig.toolId`
- No `js/units.js`, no `img src="#"`
- Code-scanner File/Paste default + no camera probe on load
- All JS parses; unit tests pass

## Adding a new tool

1. Register in `js/tools-data.js` with `physicsVersion`
2. Load shell scripts in order (see `js/tool-shell.js` checklist)
3. Call `ToolExports.register({...})` if the tool has exports
4. Set `projectManagerConfig.toolId` to the folder name
5. Run `npm run verify`
