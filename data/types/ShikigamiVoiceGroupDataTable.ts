/**
 * Row shape for input_json/ShikigamiVoiceGroupDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_ShikigamiVoiceGroup'
 */
export type ShikigamiVoiceGroupDataTableRow = {
  ID: string;
  Id_VoiceGroup: readonly string[];
};

/** input_json/ShikigamiVoiceGroupDataTable.json — map of row key → row. */
export type ShikigamiVoiceGroupDataTableRowsMap = Readonly<Record<string, ShikigamiVoiceGroupDataTableRow>>;
