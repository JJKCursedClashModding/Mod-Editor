/**
 * Merged row shape for localized DataTables: StoryTextDataTable_De.json, StoryTextDataTable_En.json, StoryTextDataTable_Es.json, StoryTextDataTable_Es_LA.json, StoryTextDataTable_Fr.json, StoryTextDataTable_It.json, StoryTextDataTable_Ja.json, StoryTextDataTable_Ko.json, StoryTextDataTable_Pt.json, StoryTextDataTable_Zh_Hans.json, StoryTextDataTable_Zh_Hant.json.
 * Same row ids across locales (one schema).
 * UE row struct: Class'GameDataTableRow_GameText'
 */
export type StoryTextDataTableRow = {
  ID: string;
  Text: string;
};

/** Merged locales StoryTextDataTable_De.json, StoryTextDataTable_En.json, StoryTextDataTable_Es.json, StoryTextDataTable_Es_LA.json, StoryTextDataTable_Fr.json, StoryTextDataTable_It.json, StoryTextDataTable_Ja.json, StoryTextDataTable_Ko.json, StoryTextDataTable_Pt.json, StoryTextDataTable_Zh_Hans.json, StoryTextDataTable_Zh_Hant.json — map of row key → row. */
export type StoryTextDataTableRowsMap = Readonly<Record<string, StoryTextDataTableRow>>;
