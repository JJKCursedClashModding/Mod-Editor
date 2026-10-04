/**
 * Row shape for input_json/ScriptDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_Script'
 */
export type ScriptDataTableRow = {
  ID: string;
  Id_Bgm: string;
  Id_Map: string;
  ScriptFileName: string;
};

/** input_json/ScriptDataTable.json — map of row key → row. */
export type ScriptDataTableRowsMap = Readonly<Record<string, ScriptDataTableRow>>;
