/**
 * Row shape for input_json/VoiceGroupDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_VoiceGroup'
 */
export type VoiceGroupDataTableRow = {
  ID: string;
  Id_Voice: readonly string[];
};

/** input_json/VoiceGroupDataTable.json — map of row key → row. */
export type VoiceGroupDataTableRowsMap = Readonly<Record<string, VoiceGroupDataTableRow>>;
