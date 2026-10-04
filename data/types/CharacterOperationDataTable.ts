/**
 * Row shape for input_json/CharacterOperationDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CharacterOperation'
 */
export type CharacterOperationDataTableRow = {
  ID: string;
  Id_Voice_Carefully: string;
  Id_Voice_Cooperation: string;
  Id_Voice_Normal: string;
  Id_Voice_Onslaught: string;
  Id_Voice_Receive_Carefully: string;
  Id_Voice_Receive_Cooperation: string;
  Id_Voice_Receive_Normal: string;
  Id_Voice_Receive_Onslaught: string;
};

/** input_json/CharacterOperationDataTable.json — map of row key → row. */
export type CharacterOperationDataTableRowsMap = Readonly<Record<string, CharacterOperationDataTableRow>>;
