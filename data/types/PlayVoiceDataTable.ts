/**
 * Row shape for input_json/PlayVoiceDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_PlayVoice'
 */

import type { EGamePlayVoiceType } from "../enums.js";

export type PlayVoiceDataTableRow = {
  DelayTime: number;
  ID: string;
  Id_Voice: readonly string[];
  PlayIndexOrder: number;
  PlayVoiceType: EGamePlayVoiceType;
  UserProgressFlag: number;
  Weights_VoiceLottery: readonly number[];
};

/** input_json/PlayVoiceDataTable.json — map of row key → row. */
export type PlayVoiceDataTableRowsMap = Readonly<Record<string, PlayVoiceDataTableRow>>;
