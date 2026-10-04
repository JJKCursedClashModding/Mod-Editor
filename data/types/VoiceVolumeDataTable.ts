/**
 * Row shape for input_json/VoiceVolumeDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_VoiceVolume'
 */
export type VoiceVolumeDataTableRow = {
  ID: string;
  Volume: number;
};

/** input_json/VoiceVolumeDataTable.json — map of row key → row. */
export type VoiceVolumeDataTableRowsMap = Readonly<Record<string, VoiceVolumeDataTableRow>>;
