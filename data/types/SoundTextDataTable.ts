/**
 * Merged row shape for localized DataTables: SoundTextDataTable_De.json, SoundTextDataTable_En.json, SoundTextDataTable_Es.json, SoundTextDataTable_Es_LA.json, SoundTextDataTable_Fr.json, SoundTextDataTable_It.json, SoundTextDataTable_Ja.json, SoundTextDataTable_Ko.json, SoundTextDataTable_Pt.json, SoundTextDataTable_Zh_Hans.json, SoundTextDataTable_Zh_Hant.json.
 * Same row ids across locales (one schema).
 * UE row struct: Class'GameDataTableRow_GameText'
 */
export type SoundTextDataTableRow = {
  ID: string;
  Text: string;
};

/** Merged locales SoundTextDataTable_De.json, SoundTextDataTable_En.json, SoundTextDataTable_Es.json, SoundTextDataTable_Es_LA.json, SoundTextDataTable_Fr.json, SoundTextDataTable_It.json, SoundTextDataTable_Ja.json, SoundTextDataTable_Ko.json, SoundTextDataTable_Pt.json, SoundTextDataTable_Zh_Hans.json, SoundTextDataTable_Zh_Hant.json — map of row key → row. */
export type SoundTextDataTableRowsMap = Readonly<Record<string, SoundTextDataTableRow>>;
