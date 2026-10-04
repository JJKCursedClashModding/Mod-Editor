/**
 * Merged row shape for localized DataTables: GlossaryTextDataTable_De.json, GlossaryTextDataTable_En.json, GlossaryTextDataTable_Es.json, GlossaryTextDataTable_Es_LA.json, GlossaryTextDataTable_Fr.json, GlossaryTextDataTable_It.json, GlossaryTextDataTable_Ja.json, GlossaryTextDataTable_Ko.json, GlossaryTextDataTable_Pt.json, GlossaryTextDataTable_Zh_Hans.json, GlossaryTextDataTable_Zh_Hant.json.
 * Same row ids across locales (one schema).
 * UE row struct: Class'GameDataTableRow_GameText'
 */
export type GlossaryTextDataTableRow = {
  ID: string;
  Text: string;
};

/** Merged locales GlossaryTextDataTable_De.json, GlossaryTextDataTable_En.json, GlossaryTextDataTable_Es.json, GlossaryTextDataTable_Es_LA.json, GlossaryTextDataTable_Fr.json, GlossaryTextDataTable_It.json, GlossaryTextDataTable_Ja.json, GlossaryTextDataTable_Ko.json, GlossaryTextDataTable_Pt.json, GlossaryTextDataTable_Zh_Hans.json, GlossaryTextDataTable_Zh_Hant.json — map of row key → row. */
export type GlossaryTextDataTableRowsMap = Readonly<Record<string, GlossaryTextDataTableRow>>;
