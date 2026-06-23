import { offenseSpotToPossessionFieldPosition } from '../match/FieldPositionModel';
import { BroadcastScorebug } from './BroadcastScorebug';
import { formatMatchClock, formatScorebugFieldPosition } from './ScorebugViewModel';

export { BroadcastScorebug as MatchScorebug };
export { formatMatchClock };

export function formatBallLocation(spot: { x: number; z: number }): string {
  return formatScorebugFieldPosition(offenseSpotToPossessionFieldPosition(spot));
}
