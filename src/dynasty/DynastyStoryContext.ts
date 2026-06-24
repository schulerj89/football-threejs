import type { LeagueData } from '../league/LeagueTypes';
import type { DynastyMatchStoryContext } from '../match/MatchTypes';
import type { TeamProfile } from '../teams/TeamProfile';
import type {
  DynastySaveData,
  DynastyScheduledGame,
  DynastyTeamRecord,
} from './DynastyTypes';

export type DynastyPresentationSummaryPhase = 'halftime' | 'postgame';

export function createDynastyMatchStoryContext(options: {
  readonly game: DynastyScheduledGame;
  readonly league: LeagueData;
  readonly save: DynastySaveData;
}): DynastyMatchStoryContext {
  const teamProfiles = new Map(options.league.teams.map((team) => [team.id, team]));
  const records = new Map(options.save.currentSeason.standings.map((record) => [record.teamId, record]));
  const standingsRank = createStandingsRank(options.save.currentSeason.standings, teamProfiles);
  const week = options.save.currentSeason.weeks[options.game.weekIndex] ?? null;
  const user = resolveTeam(teamProfiles, options.save.userTeamId);
  const opponentId = options.game.homeTeamId === options.save.userTeamId
    ? options.game.awayTeamId
    : options.game.homeTeamId;
  const opponent = resolveTeam(teamProfiles, opponentId);
  const userRecordLabel = formatRecord(records.get(user.id));
  const opponentRecordLabel = formatRecord(records.get(opponent.id));
  const userStandingLabel = formatStanding(standingsRank.get(user.id));
  const opponentStandingLabel = formatStanding(standingsRank.get(opponent.id));
  const seasonLabel = `${options.save.currentSeason.year} Season`;
  const weekLabel = week?.label ?? `Week ${options.game.weekIndex + 1}`;
  const userIsHome = options.game.homeTeamId === options.save.userTeamId;
  const matchupLabel = `${userIsHome ? 'vs' : 'at'} ${opponent.displayName}`;
  const venuePhrase = userIsHome ? 'host' : 'visit';

  return {
    halftimeSummary: `Dynasty ${weekLabel}: ${user.shortName} entered ${userRecordLabel} against ${opponent.shortName} (${opponentRecordLabel}).`,
    hubSummary: `${weekLabel}: ${user.shortName} ${venuePhrase} ${opponent.shortName}. ${userStandingLabel} ${user.displayName} enter ${userRecordLabel}; ${opponentStandingLabel} ${opponent.displayName} enter ${opponentRecordLabel}.`,
    matchupLabel,
    opponentRecordLabel,
    opponentStandingLabel,
    postgameSummary: `Dynasty ${weekLabel}: ${user.shortName} started this matchup ${userRecordLabel}, with ${opponent.shortName} at ${opponentRecordLabel}.`,
    seasonLabel,
    userRecordLabel,
    userStandingLabel,
    weekLabel,
  };
}

export function createDynastyPresentationSummary(
  context: DynastyMatchStoryContext | null,
  phase: DynastyPresentationSummaryPhase,
): string | null {
  const safeContext = context ? normalizePresentationContext(context) : null;
  if (!safeContext) {
    return null;
  }

  if (phase === 'halftime') {
    return `Dynasty ${safeContext.weekLabel}: ${safeContext.matchupLabel}; records ${safeContext.userRecordLabel} and ${safeContext.opponentRecordLabel}.`;
  }

  return `Dynasty ${safeContext.weekLabel}: ${safeContext.matchupLabel} opened with records ${safeContext.userRecordLabel} and ${safeContext.opponentRecordLabel}.`;
}

export function createDynastyHubStorySummary(options: {
  readonly league: LeagueData;
  readonly save: DynastySaveData;
  readonly userGame: DynastyScheduledGame | null;
}): string {
  if (!options.userGame) {
    return 'The starter Dynasty regular season is complete.';
  }

  return createDynastyMatchStoryContext({
    game: options.userGame,
    league: options.league,
    save: options.save,
  }).hubSummary;
}

function createStandingsRank(
  records: readonly DynastyTeamRecord[],
  teams: ReadonlyMap<string, TeamProfile>,
): Map<string, number> {
  return new Map([...records]
    .sort((a, b) =>
      b.wins - a.wins ||
      a.losses - b.losses ||
      (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst) ||
      resolveTeam(teams, a.teamId).displayName.localeCompare(resolveTeam(teams, b.teamId).displayName))
    .map((record, index) => [record.teamId, index + 1]));
}

function formatRecord(record: DynastyTeamRecord | undefined): string {
  return `${record?.wins ?? 0}-${record?.losses ?? 0}`;
}

function formatStanding(rank: number | undefined): string {
  return rank ? `No. ${rank}` : 'Unranked';
}

function normalizePresentationContext(
  context: DynastyMatchStoryContext,
): Pick<DynastyMatchStoryContext, 'matchupLabel' | 'opponentRecordLabel' | 'userRecordLabel' | 'weekLabel'> | null {
  const weekLabel = normalizeWeekLabel(context.weekLabel);
  const matchupLabel = normalizeMatchupLabel(context.matchupLabel);
  const userRecordLabel = normalizeRecordLabel(context.userRecordLabel);
  const opponentRecordLabel = normalizeRecordLabel(context.opponentRecordLabel);
  if (!weekLabel || !matchupLabel || !userRecordLabel || !opponentRecordLabel) {
    return null;
  }

  return {
    matchupLabel,
    opponentRecordLabel,
    userRecordLabel,
    weekLabel,
  };
}

function normalizeWeekLabel(value: string): string | null {
  const trimmed = value.trim();
  return /^Week [1-9]\d*$/.test(trimmed) ? trimmed : null;
}

function normalizeMatchupLabel(value: string): string | null {
  const trimmed = value.trim();
  return /^(?:at|vs) [A-Za-z0-9 .']{2,48}$/.test(trimmed) ? trimmed : null;
}

function normalizeRecordLabel(value: string): string | null {
  const trimmed = value.trim();
  return /^(?:0|[1-9]\d*)-(?:0|[1-9]\d*)$/.test(trimmed) ? trimmed : null;
}

function resolveTeam(
  teams: ReadonlyMap<string, TeamProfile>,
  teamId: string,
): TeamProfile {
  const team = teams.get(teamId);
  if (!team) {
    throw new Error(`Dynasty team ${teamId} is missing from league data`);
  }
  return team;
}
