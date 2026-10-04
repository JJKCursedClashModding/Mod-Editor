/**
 * Row shape for input_json/MissionLayoutDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_MissionLayout'
 */
export type MissionLayoutDataTableRow = {
  ID: string;
  Location: readonly ({
  X: number;
  Y: number;
  Z: number;
})[];
  Rotation: readonly ({
  Pitch: number;
  Roll: number;
  Yaw: number;
})[];
};

/** input_json/MissionLayoutDataTable.json — map of row key → row. */
export type MissionLayoutDataTableRowsMap = Readonly<Record<string, MissionLayoutDataTableRow>>;
