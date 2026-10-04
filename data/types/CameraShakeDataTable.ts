/**
 * Row shape for input_json/CameraShakeDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CameraShake'
 */
export type CameraShakeDataTableRow = {
  ID: string;
  OscillationBlendInTime: number;
  OscillationBlendOutTime: number;
  OscillationDuration: number;
  RotOscillation_Pitch_Amplitude: number;
  RotOscillation_Pitch_Frequency: number;
  RotOscillation_Yaw_Amplitude: number;
  RotOscillation_Yaw_Frequency: number;
};

/** input_json/CameraShakeDataTable.json — map of row key → row. */
export type CameraShakeDataTableRowsMap = Readonly<Record<string, CameraShakeDataTableRow>>;
