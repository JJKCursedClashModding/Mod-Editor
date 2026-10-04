/**
 * Row shape for input_json/CharacterWeaponDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CharacterWeapon'
 */
export type CharacterWeaponDataTableRow = {
  bDefaultHidden: readonly boolean[];
  ID: string;
  Id_Weapon: readonly string[];
  SocketName: readonly string[];
};

/** input_json/CharacterWeaponDataTable.json — map of row key → row. */
export type CharacterWeaponDataTableRowsMap = Readonly<Record<string, CharacterWeaponDataTableRow>>;
