/**
 * Row shape for input_json/CharacterCustomVoiceDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CharacterCustomVoice'
 */

import type { EGameCustomVoiceCategory, EGameCustomVoiceIndexType } from "../enums.js";

export type CharacterCustomVoiceDataTableRow = {
  Category: EGameCustomVoiceCategory;
  ID: string;
  Id_Character: string;
  Id_Voice_Sample: readonly string[];
  IndexType: EGameCustomVoiceIndexType;
};

/** input_json/CharacterCustomVoiceDataTable.json — map of row key → row. */
export type CharacterCustomVoiceDataTableRowsMap = Readonly<Record<string, CharacterCustomVoiceDataTableRow>>;
