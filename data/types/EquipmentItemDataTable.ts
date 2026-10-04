/**
 * Row shape for input_json/EquipmentItemDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_EquipmentItem'
 */
export type EquipmentItemDataTableRow = {
  Grade: number;
  ID: string;
  Id_EquipmentItemEffect: readonly string[];
};

/** input_json/EquipmentItemDataTable.json — map of row key → row. */
export type EquipmentItemDataTableRowsMap = Readonly<Record<string, EquipmentItemDataTableRow>>;
