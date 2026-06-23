import { getQuarterbackRatings } from '../roster/PlayerRatings';
import type { FootballPosition, PlayerArchetype, RosterPlayer } from '../roster/RosterPlayer';
import type { TeamRoster } from '../roster/TeamRoster';
import { getKickerRatings } from '../specialTeams/KickerRatings';

export type TeamStrengthCategory =
  | 'coverage'
  | 'kicking'
  | 'passProtection'
  | 'passRush'
  | 'passing'
  | 'quarterbackMobility'
  | 'returnAbility'
  | 'runDefense'
  | 'rushing'
  | 'tackling';

export interface TeamStrengthScore {
  category: TeamStrengthCategory;
  label: string;
  score: number;
  supportingPlayerIds: readonly string[];
}

export interface TeamStrengthProfile {
  scores: Readonly<Record<TeamStrengthCategory, TeamStrengthScore>>;
  teamId: string;
}

const CATEGORY_LABELS: Readonly<Record<TeamStrengthCategory, string>> = {
  coverage: 'Coverage',
  kicking: 'Kicking',
  passProtection: 'Pass Protection',
  passRush: 'Pass Rush',
  passing: 'Passing',
  quarterbackMobility: 'Quarterback Mobility',
  returnAbility: 'Return Ability',
  runDefense: 'Run Defense',
  rushing: 'Rushing',
  tackling: 'Tackling',
};

const ARCHETYPE_WEIGHTS: Readonly<Record<PlayerArchetype, number>> = {
  accuratePasser: 82,
  balancedReceiver: 76,
  coverageSpecialist: 80,
  edgeRusher: 82,
  fieldGeneral: 80,
  interiorAnchor: 79,
  powerRunner: 82,
  specialist: 74,
  utility: 72,
};

export function createTeamStrengthProfile(roster: TeamRoster): TeamStrengthProfile {
  const quarterback = findStarter(roster, 'QB');
  const runningBack = findStarter(roster, 'RB');
  const offensiveLine = findStarters(roster, ['C', 'LG', 'RG', 'LT', 'RT']);
  const receivers = findStarters(roster, ['SLOT', 'TE', 'WR']);
  const defensiveFront = findStarters(roster, ['DL', 'ILB', 'OLB']);
  const coveragePlayers = findStarters(roster, ['CB', 'FS', 'ILB', 'SS']);
  const kicker = roster.players.find((player) => player.id === roster.kickerId) ?? null;
  const returnPlayers = roster.reserveIds
    .map((id) => roster.players.find((player) => player.id === id) ?? null)
    .filter((player): player is RosterPlayer => Boolean(player))
    .filter((player) => ['RB', 'SLOT', 'WR', 'CB'].includes(player.footballPosition));
  const qbRatings = getQuarterbackRatings(quarterback);
  const kickerRatings = getKickerRatings(kicker);

  const scores: Record<TeamStrengthCategory, TeamStrengthScore> = {
    coverage: createScore('coverage', averageRosterScore(coveragePlayers, {
      coverageSpecialist: 90,
      edgeRusher: 58,
      interiorAnchor: 54,
    }), coveragePlayers),
    kicking: createScore('kicking', average([
      kickerRatings.kickAccuracy,
      kickerRatings.kickPower,
    ]), kicker ? [kicker] : []),
    passProtection: createScore('passProtection', averageRosterScore(offensiveLine, {
      interiorAnchor: 88,
      utility: 66,
    }), offensiveLine),
    passRush: createScore('passRush', averageRosterScore(defensiveFront, {
      coverageSpecialist: 60,
      edgeRusher: 92,
      interiorAnchor: 82,
    }), defensiveFront),
    passing: createScore('passing', average([
      qbRatings.accuracy,
      qbRatings.throwPower,
      averageRosterScore(receivers, {
        balancedReceiver: 82,
        utility: 66,
      }),
    ]), [quarterback, ...receivers].filter((player): player is RosterPlayer => Boolean(player))),
    quarterbackMobility: createScore('quarterbackMobility', qbRatings.mobility, quarterback ? [quarterback] : []),
    returnAbility: createScore('returnAbility', averageRosterScore(returnPlayers, {
      balancedReceiver: 78,
      coverageSpecialist: 74,
      powerRunner: 75,
      utility: 82,
    }), returnPlayers),
    runDefense: createScore('runDefense', averageRosterScore(defensiveFront, {
      coverageSpecialist: 66,
      edgeRusher: 78,
      interiorAnchor: 88,
    }), defensiveFront),
    rushing: createScore('rushing', average([
      archetypeScore(runningBack, {
        powerRunner: 90,
        utility: 70,
      }),
      averageRosterScore(offensiveLine, {
        interiorAnchor: 82,
      }),
    ]), [runningBack, ...offensiveLine].filter((player): player is RosterPlayer => Boolean(player))),
    tackling: createScore('tackling', averageRosterScore(
      [...defensiveFront, ...coveragePlayers],
      {
        coverageSpecialist: 78,
        edgeRusher: 80,
        interiorAnchor: 84,
      },
    ), [...defensiveFront, ...coveragePlayers]),
  };

  return {
    scores,
    teamId: roster.teamId,
  };
}

export function getTopTeamStrengths(
  profile: TeamStrengthProfile,
  categories: readonly TeamStrengthCategory[],
  count: number,
): TeamStrengthScore[] {
  return categories
    .map((category) => profile.scores[category])
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, count);
}

function createScore(
  category: TeamStrengthCategory,
  score: number,
  players: readonly RosterPlayer[],
): TeamStrengthScore {
  return {
    category,
    label: CATEGORY_LABELS[category],
    score: clamp(Math.round(score), 0, 99),
    supportingPlayerIds: players.map((player) => player.id),
  };
}

function findStarter(roster: TeamRoster, position: FootballPosition): RosterPlayer | null {
  return roster.offensiveStarterIds
    .concat(roster.defensiveStarterIds)
    .map((id) => roster.players.find((player) => player.id === id) ?? null)
    .find((player) => player?.footballPosition === position) ?? null;
}

function findStarters(
  roster: TeamRoster,
  positions: readonly FootballPosition[],
): RosterPlayer[] {
  return roster.offensiveStarterIds
    .concat(roster.defensiveStarterIds)
    .map((id) => roster.players.find((player) => player.id === id) ?? null)
    .filter((player): player is RosterPlayer =>
      player !== null && positions.includes(player.footballPosition));
}

function averageRosterScore(
  players: readonly RosterPlayer[],
  overrides: Partial<Record<PlayerArchetype, number>>,
): number {
  if (players.length === 0) {
    return 68;
  }

  return average(players.map((player) => archetypeScore(player, overrides)));
}

function archetypeScore(
  player: RosterPlayer | null,
  overrides: Partial<Record<PlayerArchetype, number>>,
): number {
  if (!player) {
    return 68;
  }

  return overrides[player.archetype] ?? ARCHETYPE_WEIGHTS[player.archetype] ?? 70;
}

function average(values: readonly number[]): number {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) {
    return 68;
  }

  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
