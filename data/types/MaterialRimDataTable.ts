/**
 * Row shape for input_json/MaterialRimDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_MaterialRim'
 */
export type MaterialRimDataTableRow = {
  Color: {
  X: number;
  Y: number;
  Z: number;
};
  FadeInTime: number;
  FadeOutTime: number;
  ID: string;
  Intensity: number;
  Offset: number;
};

/** input_json/MaterialRimDataTable.json — map of row key → row. */
export type MaterialRimDataTableRowsMap = Readonly<Record<string, MaterialRimDataTableRow>>;
