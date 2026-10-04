/**
 * Row shape for input_json/PlayerCardNicknameDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_PlayerCardNickname'
 */

import type { EGameNicknameType } from "../enums.js";

export type PlayerCardNicknameDataTableRow = {
  ID: string;
  Id_Item: string;
  Id_ItemText: string;
  NicknameType: EGameNicknameType;
};

/** input_json/PlayerCardNicknameDataTable.json — map of row key → row. */
export type PlayerCardNicknameDataTableRowsMap = Readonly<Record<string, PlayerCardNicknameDataTableRow>>;
