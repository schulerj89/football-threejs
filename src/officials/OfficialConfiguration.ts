import { FIELD_BOUNDS } from '../fieldSpec';
import type {
  OfficialDefinition,
  OfficialRole,
  OfficialSideline,
} from './OfficialTypes';

export const OFFICIAL_CREW: readonly OfficialDefinition[] = [
  { id: 'official-referee', role: 'referee' },
  { id: 'official-umpire', role: 'umpire' },
] as const;

export const OFFICIAL_POSITIONING_CONFIG = {
  backJudgeDepthYards: 30,
  deadBallApproachDepthYards: 2.4,
  deadBallSpacingYards: 5.5,
  deepJudgeDepthYards: 22,
  fieldEndInsetYards: 1.6,
  liveBackJudgeTrailYards: 24,
  liveDeepJudgeTrailYards: 16,
  liveMaxSpeedYardsPerSecond: 18,
  liveRefereeTrailYards: 9,
  liveSidelineLeadYards: 1,
  liveTargetUpdateHz: 10,
  liveUmpireAheadYards: 5,
  refereeDepthBehindOffenseYards: 8,
  refereeLateralOffsetYards: 4,
  sidelineInsetYards: 1.35,
  sidelineLineOffsetYards: 0.75,
  turnRateRadiansPerSecond: Math.PI * 2.75,
  umpireDepthDefensiveYards: 5,
} as const;

export const OFFICIAL_VISUAL_CONFIG = {
  armLength: 0.72,
  armRadius: 0.055,
  capHeight: 0.11,
  capRadius: 0.17,
  footDepth: 0.28,
  footHeight: 0.08,
  footWidth: 0.16,
  headRadius: 0.18,
  legLength: 0.74,
  legRadius: 0.07,
  neckHeight: 0.15,
  neckRadius: 0.075,
  shoeForwardOffset: 0.06,
  shoulderWidth: 0.62,
  stripeCount: 4,
  stripeDepth: 0.028,
  stripeWidth: 0.05,
  torsoBottomRadius: 0.25,
  torsoHeight: 0.72,
  torsoTopRadius: 0.32,
} as const;

export const OFFICIAL_ROLE_LABELS: Record<OfficialRole, string> = {
  backJudge: 'Back Judge',
  downJudge: 'Down Judge',
  fieldJudge: 'Field Judge',
  lineJudge: 'Line Judge',
  referee: 'Referee',
  sideJudge: 'Side Judge',
  umpire: 'Umpire',
} as const;

export function getSafeSidelineX(sideline: OfficialSideline): number {
  return sideline === 'left'
    ? FIELD_BOUNDS.minX + OFFICIAL_POSITIONING_CONFIG.sidelineInsetYards
    : FIELD_BOUNDS.maxX - OFFICIAL_POSITIONING_CONFIG.sidelineInsetYards;
}
