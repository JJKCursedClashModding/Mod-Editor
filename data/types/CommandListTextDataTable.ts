/**
 * Merged row shape for localized DataTables: CommandListTextDataTable_De.json, CommandListTextDataTable_En.json, CommandListTextDataTable_Es.json, CommandListTextDataTable_Es_LA.json, CommandListTextDataTable_Fr.json, CommandListTextDataTable_It.json, CommandListTextDataTable_Ja.json, CommandListTextDataTable_Ko.json, CommandListTextDataTable_Pt.json, CommandListTextDataTable_Zh_Hans.json, CommandListTextDataTable_Zh_Hant.json.
 * Same row ids across locales (one schema).
 * UE row struct: Class'GameDataTableRow_GameText'
 */
export type CommandListTextDataTableRow = {
  ID: string;
  Text: string;
};

/** Merged locales CommandListTextDataTable_De.json, CommandListTextDataTable_En.json, CommandListTextDataTable_Es.json, CommandListTextDataTable_Es_LA.json, CommandListTextDataTable_Fr.json, CommandListTextDataTable_It.json, CommandListTextDataTable_Ja.json, CommandListTextDataTable_Ko.json, CommandListTextDataTable_Pt.json, CommandListTextDataTable_Zh_Hans.json, CommandListTextDataTable_Zh_Hant.json — map of row key → row. */
export type CommandListTextDataTableRowsMap = Readonly<Record<string, CommandListTextDataTableRow>>;
