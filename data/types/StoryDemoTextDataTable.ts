/**
 * Merged row shape for localized DataTables: StoryDemoTextDataTable_De.json, StoryDemoTextDataTable_En.json, StoryDemoTextDataTable_Es.json, StoryDemoTextDataTable_Es_LA.json, StoryDemoTextDataTable_Fr.json, StoryDemoTextDataTable_It.json, StoryDemoTextDataTable_Ja.json, StoryDemoTextDataTable_Ko.json, StoryDemoTextDataTable_Pt.json, StoryDemoTextDataTable_Zh_Hans.json, StoryDemoTextDataTable_Zh_Hant.json.
 * Same row ids across locales (one schema).
 * UE row struct: Class'GameDataTableRow_GameText'
 */
export type StoryDemoTextDataTableRow = {
  ID: string;
  Text: string;
};

/** Merged locales StoryDemoTextDataTable_De.json, StoryDemoTextDataTable_En.json, StoryDemoTextDataTable_Es.json, StoryDemoTextDataTable_Es_LA.json, StoryDemoTextDataTable_Fr.json, StoryDemoTextDataTable_It.json, StoryDemoTextDataTable_Ja.json, StoryDemoTextDataTable_Ko.json, StoryDemoTextDataTable_Pt.json, StoryDemoTextDataTable_Zh_Hans.json, StoryDemoTextDataTable_Zh_Hant.json — map of row key → row. */
export type StoryDemoTextDataTableRowsMap = Readonly<Record<string, StoryDemoTextDataTableRow>>;
