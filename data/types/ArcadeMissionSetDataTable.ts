/**
 * Row shape for input_json/ArcadeMissionSetDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_ArcadeMissionSet'
 */
export type ArcadeMissionSetDataTableRow = {
  ID: string;
  Id_ArcadeMission_Easy: readonly string[];
  Id_ArcadeMission_Hard: readonly string[];
  Id_ArcadeMission_Normal: readonly string[];
  Id_Text_Title: string;
};

/** input_json/ArcadeMissionSetDataTable.json — map of row key → row. */
export type ArcadeMissionSetDataTableRowsMap = Readonly<Record<string, ArcadeMissionSetDataTableRow>>;
