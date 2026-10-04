/**
 * Row shape for input_json/CollisionModifyDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CollisionModify'
 */
export type CollisionModifyDataTableRow = {
  bLocation_AbsoluteRotation: boolean;
  ID: string;
  Life_Time: number;
  Location: {
  X: number;
  Y: number;
  Z: number;
};
  Location_Time: number;
  Location_WaitTime: number;
  Size: {
  X: number;
  Y: number;
  Z: number;
};
  Size_Time: number;
  Size_WaitTime: number;
};

/** input_json/CollisionModifyDataTable.json — map of row key → row. */
export type CollisionModifyDataTableRowsMap = Readonly<Record<string, CollisionModifyDataTableRow>>;
