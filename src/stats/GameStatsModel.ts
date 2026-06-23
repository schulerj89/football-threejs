import type { MatchPossession } from '../match/MatchTypes';
import {
  createZeroPlayerGameStats,
  createZeroTeamGameStats,
  type GameStatsState,
  type PlayerGameStats,
} from './GameStatsTypes';
import { refreshGameStatsSnapshot } from './GameStatsSnapshot';

export function createGameStatsModel(): GameStatsState {
  const state: GameStatsState = {
    duplicateSuppressionCount: 0,
    invariantFailures: [],
    lastEvent: null,
    players: {},
    possessionSeconds: {
      opponent: 0,
      user: 0,
    },
    processedEventIds: new Set<string>(),
    snapshot: null as unknown as GameStatsState['snapshot'],
    teams: {
      opponent: createZeroTeamGameStats(),
      user: createZeroTeamGameStats(),
    },
  };
  refreshGameStatsSnapshot(state);
  return state;
}

export function resetGameStatsModel(state: GameStatsState): void {
  const reset = createGameStatsModel();
  state.duplicateSuppressionCount = reset.duplicateSuppressionCount;
  state.invariantFailures = reset.invariantFailures;
  state.lastEvent = reset.lastEvent;
  state.players = reset.players;
  state.possessionSeconds = reset.possessionSeconds;
  state.processedEventIds = reset.processedEventIds;
  state.teams = reset.teams;
  state.snapshot = reset.snapshot;
}

export function getOrCreatePlayerStats(
  state: GameStatsState,
  rosterPlayerId: string,
  team: MatchPossession,
): PlayerGameStats {
  const existing = state.players[rosterPlayerId];
  if (existing) {
    return existing;
  }

  const created = createZeroPlayerGameStats(rosterPlayerId, team);
  state.players[rosterPlayerId] = created;
  return created;
}

