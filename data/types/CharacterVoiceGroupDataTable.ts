/**
 * Row shape for input_json/CharacterVoiceGroupDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CharacterVoiceGroup'
 */
export type CharacterVoiceGroupDataTableRow = {
  ID: string;
  Id_VoiceGroup: readonly string[];
};

/** input_json/CharacterVoiceGroupDataTable.json — map of row key → row. */
export type CharacterVoiceGroupDataTableRowsMap = Readonly<Record<string, CharacterVoiceGroupDataTableRow>>;
