/**
 * Row shape for input_json/MissionWaveDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_MissionWave'
 */
export type MissionWaveDataTableRow = {
  bRevivalEnabled: readonly boolean[];
  ForceGaugeMax: number;
  ID: string;
  Id_Bgm: string;
  Id_MissionCharacter_Enemy: readonly string[];
  Id_MissionOrder: string;
  Id_MissionTaskLottery: string;
  MissionLayoutIndex: number;
  TimeLimit: number;
};

/** input_json/MissionWaveDataTable.json — map of row key → row. */
export type MissionWaveDataTableRowsMap = Readonly<Record<string, MissionWaveDataTableRow>>;
