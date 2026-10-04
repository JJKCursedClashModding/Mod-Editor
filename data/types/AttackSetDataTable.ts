/**
 * Row shape for input_json/AttackSetDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_AttackSet'
 */

import type { EGameAttackRangeType } from "../enums.js";

export type AttackSetDataTableRow = {
  AttackRangeType: EGameAttackRangeType;
  bCursedEnergyAttack: boolean;
  bRecoverCursedEnergyDisabled: boolean;
  ID: string;
  Id_Attack: readonly string[];
  Inherit_Inertia_Rate: number;
  Inherit_Inertia_RateZ: number;
};

/** input_json/AttackSetDataTable.json — map of row key → row. */
export type AttackSetDataTableRowsMap = Readonly<Record<string, AttackSetDataTableRow>>;
