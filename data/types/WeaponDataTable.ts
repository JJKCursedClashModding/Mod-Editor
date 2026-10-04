/**
 * Row shape for input_json/WeaponDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_Weapon'
 */
export type WeaponDataTableRow = {
  FileName_BP: string;
  ID: string;
};

/** input_json/WeaponDataTable.json — map of row key → row. */
export type WeaponDataTableRowsMap = Readonly<Record<string, WeaponDataTableRow>>;
