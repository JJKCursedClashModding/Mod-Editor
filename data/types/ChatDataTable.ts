/**
 * Row shape for input_json/ChatDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_Chat'
 */

import type { EGameChatCategory, EGameChatLabel } from "../enums.js";

export type ChatDataTableRow = {
  bUseBattleEnabled: boolean;
  bUseBattleIntervalEnabled: boolean;
  bUseBattleResultEnabled: boolean;
  bUseLobbyEnabled: boolean;
  bUseVsEnabled: boolean;
  ChatCategory: EGameChatCategory;
  ChatLabel: EGameChatLabel;
  ID: string;
};

/** input_json/ChatDataTable.json — map of row key → row. */
export type ChatDataTableRowsMap = Readonly<Record<string, ChatDataTableRow>>;
