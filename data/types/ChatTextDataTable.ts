/**
 * Merged row shape for localized DataTables: ChatTextDataTable_De.json, ChatTextDataTable_En.json, ChatTextDataTable_Es.json, ChatTextDataTable_Es_LA.json, ChatTextDataTable_Fr.json, ChatTextDataTable_It.json, ChatTextDataTable_Ja.json, ChatTextDataTable_Ko.json, ChatTextDataTable_Pt.json, ChatTextDataTable_Zh_Hans.json, ChatTextDataTable_Zh_Hant.json.
 * Same row ids across locales (one schema).
 * UE row struct: Class'GameDataTableRow_GameText'
 */
export type ChatTextDataTableRow = {
  ID: string;
  Text: string;
};

/** Merged locales ChatTextDataTable_De.json, ChatTextDataTable_En.json, ChatTextDataTable_Es.json, ChatTextDataTable_Es_LA.json, ChatTextDataTable_Fr.json, ChatTextDataTable_It.json, ChatTextDataTable_Ja.json, ChatTextDataTable_Ko.json, ChatTextDataTable_Pt.json, ChatTextDataTable_Zh_Hans.json, ChatTextDataTable_Zh_Hant.json — map of row key → row. */
export type ChatTextDataTableRowsMap = Readonly<Record<string, ChatTextDataTableRow>>;
