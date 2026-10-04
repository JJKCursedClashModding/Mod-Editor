/**
 * Row shape for input_json/CharacterSoundDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CharacterSound'
 */

import type { EGameFootstepType } from "../enums.js";

export type CharacterSoundDataTableRow = {
  CueSheetName: readonly string[];
  FootstepType: EGameFootstepType;
  ID: string;
  Id_CharacterVoiceGroupSet: readonly string[];
  Id_VoiceGroup: readonly string[];
};

/** input_json/CharacterSoundDataTable.json — map of row key → row. */
export type CharacterSoundDataTableRowsMap = Readonly<Record<string, CharacterSoundDataTableRow>>;
