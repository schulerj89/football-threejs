import { offenseSpotToPossessionFieldPosition } from '../match/FieldPositionModel';
import { BroadcastScorebug, type BroadcastScorebugOptions } from './BroadcastScorebug';
import { formatMatchClock, formatScorebugFieldPosition } from './ScorebugViewModel';

export { BroadcastScorebug as MatchScorebug };
export type { BroadcastScorebugOptions as MatchScorebugOptions };
export { formatMatchClock };

export function formatBallLocation(spot: { x: number; z: number }): string {
  return formatScorebugFieldPosition(offenseSpotToPossessionFieldPosition(spot));
}
