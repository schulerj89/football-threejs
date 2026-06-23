import {
  FAR_GOAL_LINE_Z,
  NEAR_GOAL_LINE_Z,
  OPPOSING_GOAL_LINE_Z,
  PLAYABLE_FIELD_BOUNDS,
} from '../fieldSpec';
import type { FootballSpot } from '../fieldScale';
import type { KickoffDirection } from './KickoffTypes';

export const COLLEGE_SPECIAL_TEAMS_RULE_SPEC = {
  kickoffYardLine: 35,
  maximumNonKickerDepthBehindKickingLineYards: 5,
  minimumKickingPlayersPerSideOfKicker: 4,
  receivingRestrainingLineDistanceYards: 10,
  touchbackReceivingYardLine: 25,
  tryLineYardsFromOpponentGoal: 3,
} as const;

export function resolveKickoffLineSpot(direction: KickoffDirection): FootballSpot {
  return {
    x: 0,
    z: direction > 0
      ? NEAR_GOAL_LINE_Z + COLLEGE_SPECIAL_TEAMS_RULE_SPEC.kickoffYardLine
      : FAR_GOAL_LINE_Z - COLLEGE_SPECIAL_TEAMS_RULE_SPEC.kickoffYardLine,
  };
}

export function resolveReceivingRestrainingLineZ(direction: KickoffDirection): number {
  return resolveKickoffLineSpot(direction).z +
    direction * COLLEGE_SPECIAL_TEAMS_RULE_SPEC.receivingRestrainingLineDistanceYards;
}

export function resolveTouchbackSpot(receivingDirection: KickoffDirection): FootballSpot {
  return {
    x: 0,
    z: receivingDirection > 0
      ? NEAR_GOAL_LINE_Z + COLLEGE_SPECIAL_TEAMS_RULE_SPEC.touchbackReceivingYardLine
      : FAR_GOAL_LINE_Z - COLLEGE_SPECIAL_TEAMS_RULE_SPEC.touchbackReceivingYardLine,
  };
}

export function resolveTryLineSpot(direction: KickoffDirection): FootballSpot {
  return {
    x: 0,
    z: direction > 0
      ? OPPOSING_GOAL_LINE_Z - COLLEGE_SPECIAL_TEAMS_RULE_SPEC.tryLineYardsFromOpponentGoal
      : PLAYABLE_FIELD_BOUNDS.minZ + COLLEGE_SPECIAL_TEAMS_RULE_SPEC.tryLineYardsFromOpponentGoal,
  };
}
