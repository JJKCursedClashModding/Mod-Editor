/**
 * Row shape for input_json/CharacterSpecialAttackDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CharacterSpecialAttack'
 */

import type { EGameRankingRecord } from "../enums.js";

export type CharacterSpecialAttackDataTableRow = {
  bMultiHitSoloSpecialAttack: boolean;
  ID: string;
  Id_Damage_SoloSpecialAttack: string;
  Id_Damage_SpecialTagCombo: string;
  Id_DomainExpansion: string;
  Id_GlossaryText_Name: string;
  RankingRecord: EGameRankingRecord;
};

/** input_json/CharacterSpecialAttackDataTable.json — map of row key → row. */
export type CharacterSpecialAttackDataTableRowsMap = Readonly<Record<string, CharacterSpecialAttackDataTableRow>>;
