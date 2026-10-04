/**
 * Row shape for input_json/CharacterChatDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CharacterChat'
 */
export type CharacterChatDataTableRow = {
  ID: string;
  Id_ChatText: readonly string[];
  Id_Voice: readonly string[];
};

/** input_json/CharacterChatDataTable.json — map of row key → row. */
export type CharacterChatDataTableRowsMap = Readonly<Record<string, CharacterChatDataTableRow>>;
