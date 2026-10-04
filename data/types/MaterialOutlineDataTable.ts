/**
 * Row shape for input_json/MaterialOutlineDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_MaterialOutline'
 */
export type MaterialOutlineDataTableRow = {
  FadeInTime: number;
  FadeOutTime: number;
  ID: string;
  OutlineEmissiveColor: {
  X: number;
  Y: number;
  Z: number;
};
  OutlineScale: number;
};

/** input_json/MaterialOutlineDataTable.json — map of row key → row. */
export type MaterialOutlineDataTableRowsMap = Readonly<Record<string, MaterialOutlineDataTableRow>>;
