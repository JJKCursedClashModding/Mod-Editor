# JJK Mod Editor — React frontend

Vite + React 18 + TypeScript + Zustand + TanStack Query port of the
vanilla-JS `renderer/`. The Electron backend (`main.js`, `preload.js`, `lib/`)
is untouched — this talks to it over the same IPC bridge (`window.jjkApi`).

Parity with `renderer/app.js` is the goal: same element IDs/classes (so the
same stylesheet applies unchanged), same IPC channels, same flows —
multi-tab model with per-tab character snapshots, unified edited/new/vanilla
rows with provenance badges, global rules with Test counters and map actions,
per-row overrides, new/cloned rows, params against cooked-vanilla baselines,
character filter + registry, global search, text find/replace, EN propagation,
references (jump + reverse lookup + autocomplete), validation/problems,
changes, compare, snapshots (manual + auto), conflicts, checklist, moveset,
manifest/asset/registry editing, export preview + confirm, `.jjkmod`,
import, test patch, command palette + quick open, full native-menu handling,
undo/redo, tab persistence, auto-export toasts, document title.

## State management map

| Old (`renderer/app.js`) | New |
|---|---|
| Global `S` object | `src/stores/project.ts` (project/config/tables/changed/chars/charMode/prefixIndex), `src/stores/tabs.ts` (open tabs), `src/stores/ui.ts` (sidebar/filter panel/palette/prompt/problems/modals/toasts/char picker) |
| `call(ch, …)` IPC helper | `src/api/ipc.ts` typed wrappers (`api.*`) + `ipcRaw()` escape hatch |
| `loadTabRows` / `fetchRowData` / `rules:list` caches | TanStack Query hooks + shared fetchers in `src/api/queries.ts` (single `QueryClient` in `src/api/client.ts`, also used by flows) |
| Global flows (`selectScope`, `jumpToRow`, `doNewRow`, export, …) | `src/app/flows.ts` (no store cycles: stores never import it) |
| `render*` functions | Components: `Explorer.tsx` (sidebar), `TabView.tsx` (center), `RowCard.tsx`, `RulesView.tsx`, `Panels.tsx` (status bar, palette, problems, toasts), `Modals.tsx` (every dialog), `FieldWidget.tsx` |

## Run

```bash
# install (one-time)
npm --prefix frontend install

# typecheck + production build → frontend/dist
npm run build:frontend        # or: npm --prefix frontend run build

# use it in Electron (`npm start` builds dist first, then loads it;
# JJK_USE_VANILLA=1 forces the legacy renderer/)
npm start

# dev with hot reload: terminal 1
npm run dev:frontend          # vite on :5173
# terminal 2
npm run start:react-dev       # Electron pointed at the dev server
```

`main.js` resolution order: `VITE_DEV_SERVER_URL` → `frontend/dist/index.html`
(`JJK_USE_REACT=1`) → legacy `renderer/index.html`.

## Notes

- Enum member dropdowns: baked snapshot (`frontend/src/api/enums.generated.ts`,
  via `npm run enums` from `data/enums.ts`) with automatic fallback to the
  `docs:field` IPC probe for anything missing — same source the vanilla
  renderer used. Re-run `npm run enums` after `npm run vendor:types`.
- Field info-button tooltips and the docs editor read/write the same
  `docs:field` / `docs:save-*` channels (stored in `projects/field-docs.json`).
- Problems panel shows `validate:project` issues with jump-to-row links;
  the Changes view reads the same `diff:project` cache as vanilla.
