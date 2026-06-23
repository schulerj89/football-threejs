import type { GameStatsSnapshot } from '../../stats/GameStatsTypes';
import type { TeamRatings } from '../../ratings/TeamRatingCalculator';
import {
  DEFAULT_VOICE_PACK_ID,
  isVoicePackId,
} from './VoicePackRegistry';
import type {
  AnnouncerVoiceSetting,
  GameOpinionCategory,
  HalftimeCategory,
  VoicePackId,
  VoicePackSelection,
  VoicePackSelectionInput,
} from './VoicePackTypes';

export function normalizeAnnouncerVoiceSetting(value: unknown): AnnouncerVoiceSetting {
  return value === 'auto' || isVoicePackId(value) ? value : 'auto';
}

export function selectVoicePack(input: VoicePackSelectionInput): VoicePackSelection {
  const setting = normalizeAnnouncerVoiceSetting(input.setting);
  const seedKey = [
    input.matchSeed ?? 'match',
    input.userTeamId ?? 'user',
    input.opponentTeamId ?? 'opponent',
  ].join(':');

  if (setting !== 'auto') {
    return {
      packId: setting,
      reason: 'forced',
      seedKey,
    };
  }

  const packId: VoicePackId = stableHash(seedKey) % 2 === 0 ? 'announcer-a' : 'announcer-b';

  return {
    packId,
    reason: 'seeded',
    seedKey,
  };
}

export function resolveTeamRatingOpinionCategory(
  userRatings: TeamRatings,
  opponentRatings: TeamRatings,
): GameOpinionCategory {
  const passingEdge = userRatings.passing - opponentRatings.coverage;
  const rushingEdge = userRatings.rushing - opponentRatings.defense;
  const opponentPassRushEdge = opponentRatings.passRush - userRatings.blocking;
  const opponentCoverageEdge = opponentRatings.coverage - userRatings.passing;
  const specialTeamsEdge = userRatings.specialTeams - opponentRatings.specialTeams;
  const overallGap = Math.abs(userRatings.overall - opponentRatings.overall);

  if (Math.abs(specialTeamsEdge) >= 7) {
    return 'specialTeamsAdvantage';
  }
  if (opponentPassRushEdge >= 6) {
    return 'opponentPassRushThreat';
  }
  if (opponentCoverageEdge >= 6) {
    return 'opponentCoverageThreat';
  }
  if (passingEdge >= 6) {
    return 'userPassingAdvantage';
  }
  if (rushingEdge >= 6) {
    return 'userRushingAdvantage';
  }
  if (Math.abs(userRatings.blocking - opponentRatings.passRush) <= 3) {
    return 'offensiveLineMatchup';
  }
  if (overallGap <= 3) {
    return 'evenlyMatchedTeams';
  }

  return 'turnoverImportance';
}

export function resolveHalftimeCategory(stats: GameStatsSnapshot): HalftimeCategory {
  const user = stats.teams.user;
  const opponent = stats.teams.opponent;
  const scoreGap = Math.abs(user.points - opponent.points);
  const totalPoints = user.points + opponent.points;
  const turnoverTotal = user.turnovers + opponent.turnovers;

  if (turnoverTotal >= 2) {
    return 'turnoverStory';
  }
  if (scoreGap >= 17) {
    return 'oneSidedGame';
  }
  if (scoreGap <= 7) {
    return 'closeGame';
  }
  if (totalPoints >= 42) {
    return 'highScoringGame';
  }
  if (totalPoints <= 13) {
    return 'lowScoringGame';
  }
  if (user.passingYards >= opponent.passingYards + 45) {
    return 'userPassingSuccess';
  }
  if (opponent.passingYards >= user.passingYards + 45) {
    return 'opponentPassingSuccess';
  }
  if (user.rushingYards >= opponent.rushingYards + 35) {
    return 'userRushingSuccess';
  }
  if (opponent.rushingYards >= user.rushingYards + 35) {
    return 'opponentRushingSuccess';
  }

  return 'defensiveGame';
}

export function getDefaultVoicePackId(): VoicePackId {
  return DEFAULT_VOICE_PACK_ID;
}

function stableHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
