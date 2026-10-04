/**
 * Row shape for input_json/CharacterVariationDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CharacterVariation'
 */
export type CharacterVariationDataTableRow = {
  FileName_BP: string;
  FreeBattleImageFileName: string;
  ID: string;
  Id_CharacterImage: string;
  Id_CharacterMaterial: string;
  Id_CharacterSound: string;
  Id_CharacterUniqueImage: string;
  Id_CharacterWeapon: string;
  Id_Item: string;
  ImageFileName: string;
  ThumbnailImageFileName: string;
};

/** input_json/CharacterVariationDataTable.json — map of row key → row. */
export type CharacterVariationDataTableRowsMap = Readonly<Record<string, CharacterVariationDataTableRow>>;
