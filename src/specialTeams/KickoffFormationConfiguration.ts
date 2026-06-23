import { COLLEGE_SPECIAL_TEAMS_RULE_SPEC } from './CollegeSpecialTeamsRuleSpec';

export const KICKOFF_FORMATION_CONFIG = {
  coverageLateralSpacing: 4.65,
  coverageRowDepthBehindOrigin:
    COLLEGE_SPECIAL_TEAMS_RULE_SPEC.maximumNonKickerDepthBehindKickingLineYards,
  fieldEdgeInset: 2,
  frontLineDepthBeyondRestrainingLine: 3,
  frontLineLateralSpacing: 7.2,
  kickerDepthBehindOrigin: 1.8,
  minimumPlayerClearance: 1.25,
  returnerDepthBeyondRestrainingLine: 43,
  returnerDepthBeyondTarget: 3.2,
  returnerLateralSpacing: 7,
  secondLineDepthBeyondRestrainingLine: 19,
  secondLineLateralSpacing: 8.4,
} as const;
