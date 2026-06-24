import {
  HALFTIME_SCRIPT_IDS,
} from '../../audio/voicePacks/VoicePackRegistry';
import type { HalftimeCategory } from '../../audio/voicePacks/VoicePackTypes';
import { createDynastyPresentationSummary } from '../../dynasty/DynastyStoryContext';
import type { MatchPossession, MatchSnapshot } from '../../match/MatchTypes';
import type { GameStatsSnapshot } from '../../stats/GameStatsTypes';
import type { HalftimeStory } from './HalftimePresentationTypes';

export function resolveHalftimeStory(match: MatchSnapshot): HalftimeStory {
  const stats = match.stats;
  const user = stats.teams.user;
  const opponent = stats.teams.opponent;
  const scoreGap = Math.abs(match.userScore - match.opponentScore);
  const turnoverDiff = user.turnovers - opponent.turnovers;
  const passingDiff = user.passingYards - opponent.passingYards;
  const rushingDiff = user.rushingYards - opponent.rushingYards;
  const totalPoints = match.userScore + match.opponentScore;
  let category: HalftimeCategory = 'closeGame';
  let supportingTeam: MatchPossession | null = null;
  let supportingStatKeys: readonly string[] = ['score', 'totalYards'];

  if (Math.abs(turnoverDiff) >= 2) {
    category = 'turnoverStory';
    supportingTeam = turnoverDiff < 0 ? 'user' : 'opponent';
    supportingStatKeys = ['turnovers'];
  } else if (scoreGap >= 17) {
    category = 'oneSidedGame';
    supportingTeam = match.userScore > match.opponentScore ? 'user' : 'opponent';
    supportingStatKeys = ['score', 'totalYards'];
  } else if (Math.abs(passingDiff) >= 75) {
    category = passingDiff > 0 ? 'userPassingSuccess' : 'opponentPassingSuccess';
    supportingTeam = passingDiff > 0 ? 'user' : 'opponent';
    supportingStatKeys = ['passingYards'];
  } else if (Math.abs(rushingDiff) >= 50) {
    category = rushingDiff > 0 ? 'userRushingSuccess' : 'opponentRushingSuccess';
    supportingTeam = rushingDiff > 0 ? 'user' : 'opponent';
    supportingStatKeys = ['rushingYards'];
  } else if (isDefensiveGame(stats, totalPoints)) {
    category = totalPoints >= 42 ? 'highScoringGame' : totalPoints <= 13 ? 'lowScoringGame' : 'defensiveGame';
    supportingTeam = null;
    supportingStatKeys = ['score', 'totalYards', 'turnovers'];
  } else if (scoreGap <= 7) {
    category = 'closeGame';
    supportingTeam = null;
    supportingStatKeys = ['score', 'firstDowns', 'totalYards'];
  } else {
    category = totalPoints >= 42 ? 'highScoringGame' : 'defensiveGame';
    supportingTeam = null;
    supportingStatKeys = ['score', 'totalYards'];
  }

  return {
    category,
    contextSummary: createDynastyPresentationSummary(match.dynastyStoryContext, 'halftime'),
    scriptId: selectScriptId(category, match.deterministicSeed),
    supportingStatKeys,
    supportingTeam,
  };
}

function isDefensiveGame(stats: GameStatsSnapshot, totalPoints: number): boolean {
  const user = stats.teams.user;
  const opponent = stats.teams.opponent;

  return totalPoints <= 13 || (user.totalYards < 160 && opponent.totalYards < 160);
}

function selectScriptId(category: HalftimeCategory, seed: number): string {
  const ids = HALFTIME_SCRIPT_IDS[category];
  const index = Math.abs(seed + stableHash(category)) % ids.length;
  return ids[index];
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
