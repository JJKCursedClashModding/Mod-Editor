/**
 * Row shape for input_json/SequencerLightDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_SequencerLight'
 */
export type SequencerLightDataTableRow = {
  bDirectionalLightCastShadows: boolean;
  ID: string;
  Id_Map: string;
  LevelSequenceFileName: string;
};

/** input_json/SequencerLightDataTable.json — map of row key → row. */
export type SequencerLightDataTableRowsMap = Readonly<Record<string, SequencerLightDataTableRow>>;
