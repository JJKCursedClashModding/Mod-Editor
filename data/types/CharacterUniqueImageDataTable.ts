/**
 * Row shape for input_json/CharacterUniqueImageDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CharacterUniqueImage'
 */
export type CharacterUniqueImageDataTableRow = {
  ID: string;
  ImageFileName: readonly string[];
};

/** input_json/CharacterUniqueImageDataTable.json — map of row key → row. */
export type CharacterUniqueImageDataTableRowsMap = Readonly<Record<string, CharacterUniqueImageDataTableRow>>;
