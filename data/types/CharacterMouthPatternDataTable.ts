/**
 * Row shape for input_json/CharacterMouthPatternDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CharacterMouthPattern'
 */

import type { EGameCharacterFacialPartsMouth } from "../enums.js";

export type CharacterMouthPatternDataTableRow = {
  AnimationTime: number;
  EndAnimationTime: number;
  ID: string;
  MouthTypeArray: readonly EGameCharacterFacialPartsMouth[];
};

/** input_json/CharacterMouthPatternDataTable.json — map of row key → row. */
export type CharacterMouthPatternDataTableRowsMap = Readonly<Record<string, CharacterMouthPatternDataTableRow>>;
