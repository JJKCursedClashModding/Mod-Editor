/**
 * Merged row shape for localized DataTables: BattleTextDataTable_De.json, BattleTextDataTable_En.json, BattleTextDataTable_Es.json, BattleTextDataTable_Es_LA.json, BattleTextDataTable_Fr.json, BattleTextDataTable_It.json, BattleTextDataTable_Ja.json, BattleTextDataTable_Ko.json, BattleTextDataTable_Pt.json, BattleTextDataTable_Zh_Hans.json, BattleTextDataTable_Zh_Hant.json.
 * Same row ids across locales (one schema).
 * UE row struct: Class'GameDataTableRow_GameText'
 */
export type BattleTextDataTableRow = {
  ID: string;
  Text: string;
};

/** Merged locales BattleTextDataTable_De.json, BattleTextDataTable_En.json, BattleTextDataTable_Es.json, BattleTextDataTable_Es_LA.json, BattleTextDataTable_Fr.json, BattleTextDataTable_It.json, BattleTextDataTable_Ja.json, BattleTextDataTable_Ko.json, BattleTextDataTable_Pt.json, BattleTextDataTable_Zh_Hans.json, BattleTextDataTable_Zh_Hant.json — map of row key → row. */
export type BattleTextDataTableRowsMap = Readonly<Record<string, BattleTextDataTableRow>>;
