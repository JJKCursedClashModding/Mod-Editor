/**
 * Row shape for input_json/CharacterCaptureDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CharacterCapture'
 */

import type { EGameCharacterCaptureType } from "../enums.js";

export type CharacterCaptureDataTableRow = {
  CaptureType: EGameCharacterCaptureType;
  CharacterEnterAnimationKey: string;
  CharacterIdleAnimationKey: string;
  ID: string;
  Id_AnimationWeapon: readonly string[];
  Id_CharacterAnimation: string;
  Id_ShikigamiCharacter: string;
  Id_ShikigamiCharacterAnimation: string;
  ShikigamiCharacterEnterAnimationKey: string;
  ShikigamiCharacterIdleAnimationKey: string;
  ShikigamiDefaultMaterialPattern: number;
  WeaponEnterAnimationName: readonly string[];
  WeaponIdleAnimationName: readonly string[];
};

/** input_json/CharacterCaptureDataTable.json — map of row key → row. */
export type CharacterCaptureDataTableRowsMap = Readonly<Record<string, CharacterCaptureDataTableRow>>;
