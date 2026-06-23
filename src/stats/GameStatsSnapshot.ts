import type { MatchPossession } from '../match/MatchTypes';
import type {
  GameStatsSnapshot,
  GameStatsState,
  PlayerGameStats,
  TeamGameStats,
} from './GameStatsTypes';

export function createGameStatsSnapshot(state: GameStatsState): GameStatsSnapshot {
  return {
    duplicateSuppressionCount: state.duplicateSuppressionCount,
    invariantFailures: [...state.invariantFailures],
    lastEvent: state.lastEvent ? { ...state.lastEvent } : null,
    players: clonePlayers(state.players),
    possessionSeconds: {
      opponent: state.possessionSeconds.opponent,
      user: state.possessionSeconds.user,
    },
    processedEventCount: state.processedEventIds.size,
    teams: {
      opponent: cloneTeamStats(state.teams.opponent),
      user: cloneTeamStats(state.teams.user),
    },
  };
}

export function refreshGameStatsSnapshot(state: GameStatsState): void {
  state.snapshot = createGameStatsSnapshot(state);
}

export function getGameStatsSnapshot(state: GameStatsState): GameStatsSnapshot {
  return state.snapshot;
}

export function formatGameStatsDebugSnapshot(snapshot: GameStatsSnapshot | null): string {
  if (!snapshot) {
    return 'Stats unavailable';
  }

  const user = snapshot.teams.user;
  const opponent = snapshot.teams.opponent;
  const lastEvent = snapshot.lastEvent
    ? `${snapshot.lastEvent.accepted ? 'accepted' : 'suppressed'} ${snapshot.lastEvent.type} (${snapshot.lastEvent.eventId})`
    : 'none';
  const invariants = snapshot.invariantFailures.length
    ? snapshot.invariantFailures.join('\n')
    : 'none';

  return [
    'Stats',
    `Last event: ${lastEvent}`,
    `Duplicate suppressions: ${snapshot.duplicateSuppressionCount}`,
    `User: ${user.points} pts, ${user.totalYards} yds, ${user.firstDowns} 1D, TOP ${formatSeconds(snapshot.possessionSeconds.user)}`,
    `Opponent: ${opponent.points} pts, ${opponent.totalYards} yds, ${opponent.firstDowns} 1D, TOP ${formatSeconds(snapshot.possessionSeconds.opponent)}`,
    `Player rows: ${Object.keys(snapshot.players).length}`,
    `Invariant failures: ${invariants}`,
  ].join('\n');
}

function clonePlayers(
  players: Record<string, PlayerGameStats>,
): Readonly<Record<string, PlayerGameStats>> {
  const clone: Record<string, PlayerGameStats> = {};
  for (const [id, stats] of Object.entries(players)) {
    clone[id] = { ...stats };
  }
  return clone;
}

function cloneTeamStats(stats: TeamGameStats): TeamGameStats {
  return { ...stats };
}

function formatSeconds(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

