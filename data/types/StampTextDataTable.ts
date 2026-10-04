/**
 * Merged row shape for localized DataTables: StampTextDataTable_De.json, StampTextDataTable_En.json, StampTextDataTable_Es.json, StampTextDataTable_Es_LA.json, StampTextDataTable_Fr.json, StampTextDataTable_It.json, StampTextDataTable_Ja.json, StampTextDataTable_Ko.json, StampTextDataTable_Pt.json, StampTextDataTable_Zh_Hans.json, StampTextDataTable_Zh_Hant.json.
 * Same row ids across locales (one schema).
 * UE row struct: Class'GameDataTableRow_GameText'
 */
export type StampTextDataTableRow = {
  ID: string;
  Text: string;
};

/** Merged locales StampTextDataTable_De.json, StampTextDataTable_En.json, StampTextDataTable_Es.json, StampTextDataTable_Es_LA.json, StampTextDataTable_Fr.json, StampTextDataTable_It.json, StampTextDataTable_Ja.json, StampTextDataTable_Ko.json, StampTextDataTable_Pt.json, StampTextDataTable_Zh_Hans.json, StampTextDataTable_Zh_Hant.json — map of row key → row. */
export type StampTextDataTableRowsMap = Readonly<Record<string, StampTextDataTableRow>>;
