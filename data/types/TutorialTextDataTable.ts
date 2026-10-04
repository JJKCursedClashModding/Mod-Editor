/**
 * Merged row shape for localized DataTables: TutorialTextDataTable_De.json, TutorialTextDataTable_En.json, TutorialTextDataTable_Es.json, TutorialTextDataTable_Es_LA.json, TutorialTextDataTable_Fr.json, TutorialTextDataTable_It.json, TutorialTextDataTable_Ja.json, TutorialTextDataTable_Ko.json, TutorialTextDataTable_Pt.json, TutorialTextDataTable_Zh_Hans.json, TutorialTextDataTable_Zh_Hant.json.
 * Same row ids across locales (one schema).
 * UE row struct: Class'GameDataTableRow_GameText'
 */
export type TutorialTextDataTableRow = {
  ID: string;
  Text: string;
};

/** Merged locales TutorialTextDataTable_De.json, TutorialTextDataTable_En.json, TutorialTextDataTable_Es.json, TutorialTextDataTable_Es_LA.json, TutorialTextDataTable_Fr.json, TutorialTextDataTable_It.json, TutorialTextDataTable_Ja.json, TutorialTextDataTable_Ko.json, TutorialTextDataTable_Pt.json, TutorialTextDataTable_Zh_Hans.json, TutorialTextDataTable_Zh_Hant.json — map of row key → row. */
export type TutorialTextDataTableRowsMap = Readonly<Record<string, TutorialTextDataTableRow>>;
