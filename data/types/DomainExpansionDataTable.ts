/**
 * Row shape for input_json/DomainExpansionDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_DomainExpansion'
 */

import type { EGameCharacterActionType, EGameHitTargetType } from "../enums.js";

export type DomainExpansionDataTableRow = {
  bAdjustGroundLocation: boolean;
  bFinishOtherDomainExpansion: boolean;
  bTargetCharacterBind: boolean;
  bTeamMemberUniqueBind: boolean;
  CastingTime: number;
  CursedEnergyDisabledTime: number;
  Duration: number;
  HitTargetType: EGameHitTargetType;
  ID: string;
  Id_BuffDebuff_Enemy: string;
  Id_BuffDebuff_User: string;
  Id_DomainExpansionRate: string;
  Id_DomainExpansionRate_Ally: string;
  Id_DomainExpansionRate_Enemy: string;
  Id_Map: string;
  SetActionType_Ally: EGameCharacterActionType;
  SetActionType_Enemy: EGameCharacterActionType;
};

/** input_json/DomainExpansionDataTable.json — map of row key → row. */
export type DomainExpansionDataTableRowsMap = Readonly<Record<string, DomainExpansionDataTableRow>>;
