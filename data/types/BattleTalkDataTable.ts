/**
 * Row shape for input_json/BattleTalkDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_BattleTalk'
 */
export type BattleTalkDataTableRow = {
  BattleTalkImageFileName: string;
  ID: string;
  Id_Character: string;
  Id_CharacterVariation: string;
  Id_Voice: string;
  TextId: string;
  WaitTime: number;
};

/** input_json/BattleTalkDataTable.json — map of row key → row. */
export type BattleTalkDataTableRowsMap = Readonly<Record<string, BattleTalkDataTableRow>>;
