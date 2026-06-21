import type { FootballSpot } from '../fieldScale';
import type { PlayResultType, PlayState } from '../playState';

export const OFFICIAL_IDS = [
  'official-referee',
  'official-umpire',
  'official-down-judge',
  'official-line-judge',
  'official-field-judge',
  'official-side-judge',
  'official-back-judge',
] as const;

export type OfficialId = typeof OFFICIAL_IDS[number];

export type OfficialRole =
  | 'backJudge'
  | 'downJudge'
  | 'fieldJudge'
  | 'lineJudge'
  | 'referee'
  | 'sideJudge'
  | 'umpire';

export type OfficialSideline = 'left' | 'right';
export type OfficialPoseIntent = 'neutral' | 'touchdown' | 'tracking';
export type OfficialUpdateState = 'deadBall' | 'formation' | 'tracking';
export type DirectionOfPlay = -1 | 1;

export interface OfficialDefinition {
  assignedSideline?: OfficialSideline;
  id: OfficialId;
  role: OfficialRole;
}

export interface OfficialFormationInput {
  ballPosition: FootballSpot;
  deadBallSpot?: FootballSpot | null;
  directionOfPlay?: DirectionOfPlay;
  lineOfScrimmage: FootballSpot;
  playResultType?: PlayResultType | null;
  playState: PlayState;
}

export interface OfficialModel {
  assignedSideline?: OfficialSideline;
  distanceFromBall: number;
  facingRadians: number;
  id: OfficialId;
  poseIntent: OfficialPoseIntent;
  position: FootballSpot;
  role: OfficialRole;
  targetPosition: FootballSpot;
  updateState: OfficialUpdateState;
}

export interface OfficialCrewState {
  lastFormationKey: string | null;
  lastPlayState: PlayState | null;
  lastTargetKey: string | null;
  officials: OfficialModel[];
  targetUpdateAccumulatorSeconds: number;
}

export interface OfficialSnapshot {
  assignedSideline?: OfficialSideline;
  currentPosition: FootballSpot;
  distanceFromBall: number;
  facingRadians: number;
  id: OfficialId;
  poseIntent: OfficialPoseIntent;
  role: OfficialRole;
  targetPosition: FootballSpot;
  updateState: OfficialUpdateState;
}

export interface OfficialVisualMetrics {
  geometryCount: number;
  materialCount: number;
  meshCount: number;
  triangleCount: number;
}

export interface OfficialsPresentationSnapshot {
  debugLabelsEnabled: boolean;
  enabled: boolean;
  targetUpdateHz: number;
  officials: OfficialSnapshot[];
  visibleOfficialCount: number;
  visualMetrics: OfficialVisualMetrics;
}
