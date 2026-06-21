import type { FootballSpot } from './fieldScale';
import type { PlayerModel } from './playerModel';

export const FORWARD_PASS_CONFIG = {
  lineOfScrimmageEpsilon: 0.001,
  pastLineWarningSeconds: 1,
} as const;

export function hasCrossedOriginalLineOfScrimmage(
  player: PlayerModel,
  lineOfScrimmage: FootballSpot,
): boolean {
  return player.position.z > lineOfScrimmage.z + FORWARD_PASS_CONFIG.lineOfScrimmageEpsilon;
}
