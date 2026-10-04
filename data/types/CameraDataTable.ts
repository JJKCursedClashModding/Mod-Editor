/**
 * Row shape for input_json/CameraDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_Camera'
 */
export type CameraDataTableRow = {
  CameraModeChange_InterpolationTime: number;
  Distance_AttenuateRate: number;
  FreeCamera_Distance: number;
  GazeLocation_AttenuateRate: number;
  ID: string;
  LimitAngleH_Max: number;
  LimitAngleH_Min: number;
  LimitAngleHDistance_Max: number;
  LimitAngleHDistance_Min: number;
  LimitAngleV_Max: number;
  LimitAngleV_Min: number;
  OwnerHeightScale: number;
  RotationPitch_AttenuateRate: number;
  RotationYaw_AttenuateRate: number;
  ShootCamera_Distance: number;
  TargetCamera_ActionDistance: number;
  TargetCamera_ActionDistanceChangeTime_Dash: number;
  TargetCamera_ActionDistanceChangeTime_Jump: number;
  TargetCamera_ActionDistanceChangeTime_Run: number;
  TargetCamera_ActionDistanceChangeTime_Step: number;
  TargetCamera_Distance: number;
  TargetCamera_DownDistance: number;
  TargetCamera_DownDistanceChangeTime: number;
  TargetCamera_NormalDistanceChangeTime: number;
  TargetCamera_NormalDistanceChangeWaitTime: number;
  TargetCamera_OffsetAngleV: number;
};

/** input_json/CameraDataTable.json — map of row key → row. */
export type CameraDataTableRowsMap = Readonly<Record<string, CameraDataTableRow>>;
