// Table categories override — EDIT ME.
//
// Shape: category -> tables[]
//   module.exports = {
//     "Battle": ["DamageDataTable1.json", "AttackDataTable.json"],
//     "Characters": ["CharacterDataTable.json"],
//   };
//
// Rules:
// - Category names are shown as-is in the left Tables pane (sorted A-Z,
//   except "Other" which always sorts last).
// - Entries match case-insensitively against the table file
//   ("DamageDataTable1.json"), the base name without extension
//   ("DamageDataTable1"), or the family ("DamageDataTable" covers
//   DamageDataTable1..5). A single string instead of an array is allowed.
// - Any table NOT listed here falls back to the wiki-derived group
//   (<JJKJsonEditor>/wiki/datatables/<group>/<Table>.md), then "Other".
// - One table should appear in ONE category (first match wins).
// - Restart the editor (or change Settings) after editing this file.
// - Run `npm run seed-categories` to fill this file with the current
//   wiki-derived groups (overwrites your edits).
//
// Example (commented out so current behaviour is unchanged):
// module.exports = {
//   "Battle": [
//     "DamageDataTable1.json",
//     "DamageDataTable2.json",
//     "AttackDataTable.json",
//     "AttackSetDataTable.json",
//   ],
//   "Characters": [
//     "CharacterDataTable",
//     "CharacterBaseParameterDataTable",
//   ],
// };

module.exports = {};
