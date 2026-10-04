/**
 * Row shape for input_json/CharacterMouthAnimDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CharacterMouthAnim'
 */

import type { EGameCharacterFacialPartsMouth } from "../enums.js";

export type CharacterMouthAnimDataTableRow = {
  AnimationTime: number;
  ApplyTiming: number;
  ID: string;
  Id_Voice: string;
  MouthType: EGameCharacterFacialPartsMouth;
};

/** input_json/CharacterMouthAnimDataTable.json — map of row key → row. */
export type CharacterMouthAnimDataTableRowsMap = Readonly<Record<string, CharacterMouthAnimDataTableRow>>;
