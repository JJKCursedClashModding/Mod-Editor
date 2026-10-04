/**
 * Merged row shape for split DataTables: DlcStoryDemoVoiceDataTable1.json, DlcStoryDemoVoiceDataTable2.json.
 * Row keys are unique across all parts (same schema).
 * UE row struct: Class'GameDataTableRow_DlcStoryDemoVoice'
 */
export type DlcStoryDemoVoiceDataTableRow = {
  ID: string;
  Id_Voice: string;
};

/** Merged DlcStoryDemoVoiceDataTable1.json, DlcStoryDemoVoiceDataTable2.json — map of row key → row. */
export type DlcStoryDemoVoiceDataTableRowsMap = Readonly<Record<string, DlcStoryDemoVoiceDataTableRow>>;
