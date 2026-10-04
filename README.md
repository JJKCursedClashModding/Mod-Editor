# JJK Mod Editor

Visual Electron editor for **Jujutsu Kaisen Cursed Clash** datatable + parameter
mods. It replaces hand-editing `JJKJsonEditor` transformation scripts with typed
forms, while exporting the same **Mod Manager compatible** mod folders
(`datatables/*.json`, `parameters/*.json`, `manifest.json`, `AssetRegistry.json`,
duplicate assets) that `CookedDatatablePatcher` consumes.

## Concepts

A **project** = one mod. It stores, per table file:

- **Global rules** — edit a field for *all rows*: `set`, `+`, `−`, `×`, `÷`,
  each with an optional **if-condition** on another field of the same row
  (`is`, `is not`, `>`, `≥`, `<`, `≤`, `contains`, `does not contain`).
  Rules run top-to-bottom; conditions see already-ruled values.
- **Per-row overrides** — typed per-cell edits that win over global rules.
- **New rows** — blank or cloned from an existing row (clone keeps a `_base`
  reference; the export materializes it). The editor shows **every schema
  field** for a new row, and anything still untouched is auto-filled from the
  clone base (or the table's first row) at export, so new rows always ship
  the **full vanilla field set**, never sparse fragments. Fills are reported
  in the Changes tab and export warnings. IDs are validated as unique across
  the whole table family (`DamageDataTable1..5` share one namespace), because
  the patcher *adds* rows by name.

Every cell shows **provenance**: default (vanilla) · global rule (blue) ·
override (orange) · new row (green). Row lists show `EDITED n / G / O` badges.

Parameters (`sceneCapture`, `character`, `storyDemo`, `exchangeImage`,
`dynamicIcon` — the exact short names the Mod Manager merges) are edited
against **real vanilla values dumped from the cooked uassets** (shipped in
`data/parameters/`), so every row shows vanilla vs edited with provenance,
and any vanilla row can be cloned as a new ID. Modified-vanilla rows stay in
`parameters/*.json` for the runtime loader; new IDs are additionally **baked
 into patched `.uasset/.uexp` overrides** at
`assets/Jujutsu Kaisen CC/Content/Widgets/Commons/`. The bake is
**upsert-capable**: new IDs are added *and* existing vanilla rows are
replaced in the binary (datatable-style) — going beyond the stock cooker
and the Mod Manager merge, which are both add-only. No
`AssetRegistry.json` is needed for these file overrides.
`$comment` keys are preserved.

## Per-character mode

The top-bar character picker filters the whole app to one character
(`CP_010`, `CN_250`, …): the table list shows only tables containing that
character's rows (with match counts), row lists lock to the prefix, and the
parameter list narrows to files with matching vanilla or project rows. New-row
ID fields pre-fill the prefix. Global rules still evaluate against all rows
(the Changes view stays project-wide) — use rule conditions to scope them.
The prefix index is cached in `projects/.prefix-cache.json` after the first
background build. The mode persists across restarts.

## Character registry

The picker shows `CP_010 — Yuji` style names from `constants.ts`. The
**Characters…** button (top bar) manages `projects/characters.json`:
registering a new ID + name (e.g. `CP_300` = Urame) is how you add a new
character — it then appears named in the picker, table filters, and row
badges, and per-character mode works for it even before it has vanilla rows.
Inline rename creates a custom entry (shadowing built-ins is allowed);
deleting a custom entry restores the built-in name.

## Field documentation

Descriptions come from two JSON-editable layers:

1. `wiki/datatables/<group>/<Table>.md` bullets (`- **Field** — description`)
   in the JJKJsonEditor root — read-only fallback.
2. `projects/field-docs.json` — `{ fields: { "Table.Field": "..." },
   enums: { "EGameX": { "Member": "..." } } }`, editable in the app via the
   Inspector (click 📖 on any field). Covers enum *member* meanings too.

## Export

- **Export to Mods** → `<ModsFolder>/<Title>/` with **`manifest.json`
  (always written)**, changed `datatables/*.json` (sparse row→fields diffs
  for edits, full field set for new rows; enum style preserved),
  `parameters/*.json` (complete rows, Mod Manager compatible),
  baked parameter `.uasset/.uexp` overrides (toggle in Settings),
  `AssetRegistry.json` (only when the project defines new-asset rows —
  never needed for plain file overrides), icon and duplicate assets.
  A `.jjk-editor-receipt.json` tracks exactly which files the editor owns:
  stale owned files are removed, everything else (uassets, paks, other files)
  is **never touched**. Folders without a receipt (e.g. Urame) are overwritten
  in place with a warning. Nothing is packaged or deployed through the Mod
  Manager — output files are simply compatible with it.
- **Export .jjkmod** → zip with a single top-level `<Title>/` dir, same layout
  the Mod Manager installer accepts.
- **Test patch** → runs the Mod Manager's `CookedDatatablePatcher` build
  against its cooked `data/datatables` into a temp dir (needs the Mod Manager
  path in Settings). Smoke-tests that every exported JSON actually patches.
- **Import mod** → reads any existing mod folder back into a project
  (vanilla-matching fields dropped, the rest become overrides/new rows).

## Incorporated from JJKJsonEditor

- `run-transformations` field pipeline → global rules + per-row overrides UI
- `characters/*` per-character tuning → character row filter + **presets**
  (named rule bundles: save per table, append/replace onto any table/project)
- `input_by_char` split → per-character row filtering (`CP_010`, `CN_250`…)
- `tableRows` injections / `row-rename` → new-row creation from clone
  (duplicate-effective-row included, so globals carry over explicitly)
- `output_json` sparse diffs → export format + Changes tabs + project diff
- `wiki/` field docs → Inspector documentation layer
- `generate-input-json-types` + `enums.ts` → typed widgets (number, bool,
  enum dropdown with member docs, arrays, structs) + new-row ID validation
- `constants.ts` `CharacterId` map → character labels in filters

## General extras

- Project-wide changes view with jump-to-table
- Per-rule "Test" match counter before applying
- Manifest editor with arbitrary extra keys, icon picker, priority/version
- Duplicate-asset tracking (files/folders copied into the mod on export)
- `AssetRegistry.json` editor for new-asset mods
- Per-project changelog, duplicate/rename/reveal-in-explorer
- Settings for all source dirs; tables-count cache for fast startup

## More tools

- **References** — every `Id_*` field gets a → jump button resolving to the
  target row (family-guessed, global fallback), with autocomplete from known
  row IDs; rows have a “Referenced by…” reverse lookup across all tables.
- **Validate** (Project changes) — dangling `Id_*` references, broken global
  rules, bad clone bases, empty param rows, with jump-to-row links.
- **Checklist / Moveset** (character mode) — per-character table coverage
  (core vs extended + parameters) and an input → attack-set → hit → damage
  rollup for moveset review.
- **Search** — global row-ID/value search with jump + field flash.
- **Text find/replace** — scoped (file / family / all) bulk text edits;
  locale rows get a “Copy EN text here” button.
- **Undo/redo** — session history (Ctrl+Z / Ctrl+Shift+Z), capped by count
  and memory.
- **Snapshots** — manual named commits plus rotating autos (kept count in
  Settings); autos also fire on Export to Mods; restores are undoable.
- **Conflicts** — overlap scan vs installed `Content/Mods` folders with
  priority winner badges.
- **Compare** (Project changes) — full A-vs-B diff of rules, rows and params.
- **Auto-export** — optional export-to-Mods a few seconds after each change
  (debounced, serialized, toasted).
- **Auto-backup** — the mod folder is zipped to
  `.jjk-editor-backups/<Mod>/` before every overwrite (pruned count in
  Settings).

## Run

```bash
npm install
npm start
```

Defaults are pre-filled for this machine (JJKJsonEditor root, Steam
`Content/Mods`, Mod Manager dir). Override in Settings.

## Layout

```
main.js / preload.js      Electron shell + IPC
lib/config.js             settings (config.json)
lib/schema.js             input_json loading, type inference, enums/chars/wiki docs
lib/engine.js             global rules, conditions, overrides, diffs, coercion
lib/projects.js           project + preset storage
lib/exportMod.js          mod tree build, receipt-guarded folder export, .jjkmod, import
lib/patcher.js            optional CookedDatatablePatcher smoke test
lib/paramVanilla.js       vanilla param dumps from cooked uassets + binary bake
renderer/                 vanilla-JS UI (no build step)
projects/                 your projects (*.json), presets/, field-docs.json
data/parameters/          vendored pristine parameter .uasset/.uexp + manifest
data/input_json/          vendored vanilla datatable JSONs = the hardcoded defaults
                          (auto-seeded from JJKJsonEditor/input_json on first launch;
                          re-sync with npm run vendor-input-json)
vendor/cooked-patcher/    vendored CookedDatatablePatcher build + mappings.usmap
```
