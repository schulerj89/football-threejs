import type { LeagueData } from '../league/LeagueTypes';
import type { TeamProfile } from '../teams/TeamProfile';
import type {
  DynastySaveData,
  DynastyScheduledGame,
  DynastyTeamRecord,
} from './DynastyTypes';

export interface DynastyHubTeamView {
  readonly abbreviation: string;
  readonly displayName: string;
  readonly recordLabel: string;
  readonly teamId: string;
}

export interface DynastyHubGameView {
  readonly awayTeam: DynastyHubTeamView;
  readonly gameId: string;
  readonly homeTeam: DynastyHubTeamView;
  readonly matchupLabel: string;
  readonly statusLabel: string;
  readonly userOpponentLabel: string;
  readonly venueLabel: string;
  readonly weekLabel: string;
}

export interface DynastyHubStandingsRow {
  readonly losses: number;
  readonly pointsAgainst: number;
  readonly pointsFor: number;
  readonly pointsMargin: number;
  readonly rank: number;
  readonly team: DynastyHubTeamView;
  readonly wins: number;
}

export interface DynastyHubViewModel {
  readonly currentWeekLabel: string;
  readonly program: DynastyHubTeamView;
  readonly schedule: readonly DynastyHubGameView[];
  readonly seasonLabel: string;
  readonly standings: readonly DynastyHubStandingsRow[];
  readonly upcomingGame: DynastyHubGameView | null;
}

export function createDynastyHubViewModel(options: {
  readonly league: LeagueData;
  readonly save: DynastySaveData;
}): DynastyHubViewModel {
  const teamProfiles = new Map(options.league.teams.map((team) => [team.id, team]));
  const records = new Map(options.save.currentSeason.standings.map((record) => [record.teamId, record]));
  const program = createTeamView(
    resolveTeam(teamProfiles, options.save.userTeamId),
    records.get(options.save.userTeamId),
  );
  const currentWeek = options.save.currentSeason.weeks[options.save.currentWeekIndex] ?? null;
  const schedule = options.save.currentSeason.weeks.flatMap((week) =>
    week.games
      .filter((game) => game.awayTeamId === options.save.userTeamId || game.homeTeamId === options.save.userTeamId)
      .map((game) => createGameView({
        game,
        records,
        teamProfiles,
        userTeamId: options.save.userTeamId,
        weekLabel: week.label,
      })));
  const upcomingGame = currentWeek?.games.find((game) =>
    game.awayTeamId === options.save.userTeamId || game.homeTeamId === options.save.userTeamId) ?? null;
  const standings = options.save.currentSeason.standings
    .map((record) => ({
      losses: record.losses,
      pointsAgainst: record.pointsAgainst,
      pointsFor: record.pointsFor,
      pointsMargin: record.pointsFor - record.pointsAgainst,
      team: createTeamView(resolveTeam(teamProfiles, record.teamId), record),
      wins: record.wins,
    }))
    .sort(compareStandingsRows)
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));

  return {
    currentWeekLabel: currentWeek?.label ?? 'Season Complete',
    program,
    schedule,
    seasonLabel: `${options.save.currentSeason.year} Season`,
    standings,
    upcomingGame: upcomingGame
      ? createGameView({
          game: upcomingGame,
          records,
          teamProfiles,
          userTeamId: options.save.userTeamId,
          weekLabel: currentWeek?.label ?? 'Season Complete',
        })
      : null,
  };
}

function createGameView(options: {
  readonly game: DynastyScheduledGame;
  readonly records: ReadonlyMap<string, DynastyTeamRecord>;
  readonly teamProfiles: ReadonlyMap<string, TeamProfile>;
  readonly userTeamId: string;
  readonly weekLabel: string;
}): DynastyHubGameView {
  const awayTeam = createTeamView(
    resolveTeam(options.teamProfiles, options.game.awayTeamId),
    options.records.get(options.game.awayTeamId),
  );
  const homeTeam = createTeamView(
    resolveTeam(options.teamProfiles, options.game.homeTeamId),
    options.records.get(options.game.homeTeamId),
  );
  const userIsHome = options.game.homeTeamId === options.userTeamId;
  const opponent = userIsHome ? awayTeam : homeTeam;

  return {
    awayTeam,
    gameId: options.game.gameId,
    homeTeam,
    matchupLabel: `${awayTeam.abbreviation} at ${homeTeam.abbreviation}`,
    statusLabel: options.game.result
      ? `${options.game.result.awayScore}-${options.game.result.homeScore}`
      : 'Scheduled',
    userOpponentLabel: `${userIsHome ? 'vs' : 'at'} ${opponent.displayName}`,
    venueLabel: userIsHome ? 'Home' : 'Away',
    weekLabel: options.weekLabel,
  };
}

function createTeamView(
  profile: TeamProfile,
  record: DynastyTeamRecord | undefined,
): DynastyHubTeamView {
  return {
    abbreviation: profile.abbreviation,
    displayName: profile.displayName,
    recordLabel: `${record?.wins ?? 0}-${record?.losses ?? 0}`,
    teamId: profile.id,
  };
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

function compareStandingsRows(
  a: Omit<DynastyHubStandingsRow, 'rank'>,
  b: Omit<DynastyHubStandingsRow, 'rank'>,
): number {
  return b.wins - a.wins ||
    a.losses - b.losses ||
    b.pointsMargin - a.pointsMargin ||
    a.team.displayName.localeCompare(b.team.displayName);
}
