/**
 * Merged row shape for localized DataTables: ItemTextDataTable_De.json, ItemTextDataTable_En.json, ItemTextDataTable_Es.json, ItemTextDataTable_Es_LA.json, ItemTextDataTable_Fr.json, ItemTextDataTable_It.json, ItemTextDataTable_Ja.json, ItemTextDataTable_Ko.json, ItemTextDataTable_Pt.json, ItemTextDataTable_Zh_Hans.json, ItemTextDataTable_Zh_Hant.json.
 * Same row ids across locales (one schema).
 * UE row struct: Class'GameDataTableRow_GameText'
 */
export type ItemTextDataTableRow = {
  ID: string;
  Text: string;
};

/** Merged locales ItemTextDataTable_De.json, ItemTextDataTable_En.json, ItemTextDataTable_Es.json, ItemTextDataTable_Es_LA.json, ItemTextDataTable_Fr.json, ItemTextDataTable_It.json, ItemTextDataTable_Ja.json, ItemTextDataTable_Ko.json, ItemTextDataTable_Pt.json, ItemTextDataTable_Zh_Hans.json, ItemTextDataTable_Zh_Hant.json — map of row key → row. */
export type ItemTextDataTableRowsMap = Readonly<Record<string, ItemTextDataTableRow>>;
