# JJK Mod Editor — React frontend

Vite + React 18 + TypeScript + Zustand + TanStack Query replacement for the
vanilla-JS `renderer/`. The Electron backend (`main.js`, `preload.js`, `lib/`)
is untouched — this talks to it over the same IPC bridge (`window.jjkApi`).

## State management map

| Old (`renderer/app.js`) | New |
|---|---|
| Global `S` object | `src/stores/project.ts` (project/config/tables/changed/chars), `src/stores/tabs.ts` (open tabs), `src/stores/ui.ts` (sidebar/panel/toasts/modals) |
| `call(ch, …)` IPC helper | `src/api/ipc.ts` typed wrappers (`api.*`) + `ipcRaw()` escape hatch |
| `loadTabRows` / `fetchRowData` / `rules:list` caches | TanStack Query hooks in `src/api/queries.ts` (`useTableRows`, `useRowData`, `useRules`, `useParamRows`, `useParamRow`, mutations with invalidation) |
| `render*` functions | Components: `Explorer.tsx` (sidebar), `TabView.tsx` (center), `RowCard.tsx`, `RulesView.tsx`, `Panels.tsx` (status bar, palette, modals), `FieldWidget.tsx` |

## Run

```bash
# install (one-time)
npm --prefix frontend install

# typecheck + production build → frontend/dist
npm run build:frontend        # or: npm --prefix frontend run build

# use it in Electron (loads frontend/dist when present, else legacy renderer/)
npm start

# dev with hot reload: terminal 1
npm run dev:frontend          # vite on :5173
# terminal 2
npm run electron:dev          # Electron pointed at the dev server
```

`main.js` resolution order: `VITE_DEV_SERVER_URL` → `frontend/dist/index.html` →
legacy `renderer/index.html`. Delete `frontend/dist` to go back to vanilla.

## Notes / known gaps vs vanilla

- Enum member dropdowns: baked snapshot (`frontend/src/api/enums.generated.ts`,
  via `npm run enums` from `data/enums.ts`) with automatic fallback to the
  `docs:field` IPC probe for anything missing — same source the vanilla
  renderer used. Re-run `npm run enums` after `npm run vendor:types`.
- Inline field docs, i18n find/replace, conflicts scan, checklist/moveset,
  presets, and asset-registry editing are not ported yet — see `renderer/app.js`
  for the reference implementations; all have IPC channels ready.
- Problems panel shows `diff:project` errors + `validate:project` output.
