import { calculateOverallRating } from '../ratings/OverallRatingCalculator';
import { calculateTeamRatings, type TeamRatings } from '../ratings/TeamRatingCalculator';
import type { RosterPlayer } from '../roster/RosterPlayer';
import { getRosterPlayer, type TeamRoster } from '../roster/TeamRoster';
import type { TeamProfile } from '../teams/TeamProfile';

export interface TeamRatingCategorySummary {
  readonly key: keyof Pick<TeamRatings,
    | 'blocking'
    | 'coverage'
    | 'passRush'
    | 'passing'
    | 'rushing'
    | 'specialTeams'>;
  readonly label: string;
  readonly value: number;
}

export interface TeamSummaryViewModel {
  readonly bestDefensivePlayer: RosterPlayer | null;
  readonly bestOffensivePlayer: RosterPlayer | null;
  readonly colors: readonly TeamColorSummary[];
  readonly profile: TeamProfile;
  readonly ratingCategories: readonly TeamRatingCategorySummary[];
  readonly ratings: TeamRatings;
  readonly rosterSize: number;
  readonly startingQuarterback: RosterPlayer | null;
  readonly strengths: readonly TeamRatingCategorySummary[];
  readonly weaknesses: readonly TeamRatingCategorySummary[];
}

export interface TeamColorSummary {
  readonly color: string;
  readonly label: string;
}

export type RosterPlayerStatus =
  | 'Defensive starter'
  | 'Kicker'
  | 'Long snapper'
  | 'Offensive starter'
  | 'Punter'
  | 'Special teams reserve'
  | 'Roster player';

export function createTeamSummaryViewModel(
  profile: TeamProfile,
  roster: TeamRoster,
): TeamSummaryViewModel {
  const ratings = calculateTeamRatings(roster);
  const ratingCategories = createRatingCategories(ratings);
  const sortedCategories = [...ratingCategories].sort((a, b) => b.value - a.value);

  return {
    bestDefensivePlayer: getBestPlayer(roster, roster.defensiveStarterIds),
    bestOffensivePlayer: getBestPlayer(roster, roster.offensiveStarterIds),
    colors: [
      { color: profile.colors.primary, label: 'Primary' },
      { color: profile.colors.secondary, label: 'Secondary' },
      { color: profile.colors.accent, label: 'Accent' },
    ],
    profile,
    ratingCategories,
    ratings,
    rosterSize: roster.players.length,
    startingQuarterback: getStartingQuarterback(roster),
    strengths: sortedCategories.slice(0, 3),
    weaknesses: sortedCategories.slice(-2).reverse(),
  };
}

export function createRatingCategories(ratings: TeamRatings): readonly TeamRatingCategorySummary[] {
  return [
    { key: 'passing', label: 'Passing', value: ratings.passing },
    { key: 'rushing', label: 'Rushing', value: ratings.rushing },
    { key: 'blocking', label: 'Blocking', value: ratings.blocking },
    { key: 'passRush', label: 'Pass Rush', value: ratings.passRush },
    { key: 'coverage', label: 'Coverage', value: ratings.coverage },
    { key: 'specialTeams', label: 'Special Teams', value: ratings.specialTeams },
  ];
}

export function resolveRosterPlayerStatus(roster: TeamRoster, player: RosterPlayer): RosterPlayerStatus {
  if (roster.offensiveStarterIds.includes(player.id)) {
    return 'Offensive starter';
  }

  if (roster.defensiveStarterIds.includes(player.id)) {
    return 'Defensive starter';
  }

  if (player.id === roster.kickerId) {
    return 'Kicker';
  }

  if (player.id === roster.punterId) {
    return 'Punter';
  }

  if (player.id === roster.longSnapperId) {
    return 'Long snapper';
  }

  if (roster.reserveIds.includes(player.id)) {
    return 'Special teams reserve';
  }

  return 'Roster player';
}

function getStartingQuarterback(roster: TeamRoster): RosterPlayer | null {
  return roster.offensiveStarterIds
    .map((id) => getRosterPlayer(roster, id))
    .find((player) => player?.footballPosition === 'QB') ?? null;
}

function getBestPlayer(roster: TeamRoster, ids: readonly string[]): RosterPlayer | null {
  return ids
    .map((id) => getRosterPlayer(roster, id))
    .filter((player): player is RosterPlayer => player !== null)
    .sort((a, b) =>
      calculateOverallRating(b.footballPosition, b.ratings) -
      calculateOverallRating(a.footballPosition, a.ratings))[0] ?? null;
}
