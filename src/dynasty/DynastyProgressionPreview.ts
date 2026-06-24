import { calculateOverallRating } from '../ratings/OverallRatingCalculator';
import { isPlayerAttributeKey, type PlayerAttributeKey } from '../ratings/PlayerAttribute';
import type { PlayerRatings } from '../ratings/PlayerRatings';
import { getPositionRatingProfile } from '../ratings/PositionRatingProfile';
import type { PlayerArchetype, RosterPlayer } from '../roster/RosterPlayer';
import { getTeamRosterOrDefault } from '../roster/RosterRegistry';
import type {
  DynastyProgressionApplication,
  DynastySaveData,
  DynastyTeamSeasonStats,
} from './DynastyTypes';
import { canAdvanceDynastyWeek } from './DynastyWeekAdvance';

export interface DynastyRatingDeltaPreview {
  readonly attribute: PlayerAttributeKey;
  readonly currentValue: number;
  readonly delta: number;
  readonly projectedValue: number;
}

export interface DynastyProgressionPreviewRow {
  readonly archetype: PlayerArchetype;
  readonly currentOverall: number;
  readonly developmentNote: string;
  readonly performancePoints: number;
  readonly playerId: string;
  readonly playerName: string;
  readonly position: string;
  readonly projectedOverall: number;
  readonly projectedOverallDelta: number;
  readonly ratingDeltas: readonly DynastyRatingDeltaPreview[];
}

export interface DynastyTrainingSummaryRow {
  readonly averagePoints: number;
  readonly focusLabel: string;
  readonly leaderName: string;
  readonly playerCount: number;
  readonly room: string;
  readonly totalPoints: number;
}

export interface DynastyProgressionPreview {
  readonly rows: readonly DynastyProgressionPreviewRow[];
  readonly summaryLabel: string;
  readonly teamId: string;
  readonly trainingSummary: readonly DynastyTrainingSummaryRow[];
}

export interface DynastyProgressionApprovalResult {
  readonly approved: boolean;
  readonly applications: readonly DynastyProgressionApplication[];
  readonly save: DynastySaveData;
}

export function createDynastyProgressionPreview(options: {
  readonly save: DynastySaveData;
  readonly teamId?: string;
}): DynastyProgressionPreview {
  const teamId = options.teamId ?? options.save.userTeamId;
  const roster = getTeamRosterOrDefault(teamId);
  const stats = options.save.currentSeason.teamStats.find((row) => row.teamId === teamId) ??
    createEmptyStats(teamId);
  const rows = roster.players
    .map((player) => createProgressionRow(player, stats, options.save.seed))
    .sort((a, b) =>
      b.performancePoints - a.performancePoints ||
      b.currentOverall - a.currentOverall ||
      a.playerName.localeCompare(b.playerName));

  return {
    rows,
    summaryLabel: stats.gamesPlayed > 0
      ? `${stats.gamesPlayed} game sample | presentation-only points`
      : 'No completed games | presentation-only points',
    teamId,
    trainingSummary: createTrainingSummary(rows),
  };
}

export function approveCurrentDynastyWeekProgression(options: {
  readonly appliedAt?: string;
  readonly save: DynastySaveData;
  readonly teamId?: string;
}): DynastyProgressionApprovalResult {
  const teamId = options.teamId ?? options.save.userTeamId;
  const weekIndex = options.save.currentWeekIndex;
  const existingApplications = options.save.currentSeason.progressionApplications ?? [];
  if (!canAdvanceDynastyWeek(options.save) || hasProgressionApplication(options.save, teamId, weekIndex)) {
    return {
      applications: [],
      approved: false,
      save: options.save,
    };
  }

  const appliedAt = options.appliedAt ?? new Date().toISOString();
  const preview = createDynastyProgressionPreview({
    save: options.save,
    teamId,
  });
  const applications = preview.rows
    .filter((row) => row.ratingDeltas.length > 0)
    .map((row): DynastyProgressionApplication => ({
      appliedAt,
      currentOverall: row.currentOverall,
      performancePoints: row.performancePoints,
      playerId: row.playerId,
      projectedOverall: row.projectedOverall,
      ratingDeltas: row.ratingDeltas.map((delta) => ({ ...delta })),
      teamId,
      weekIndex,
    }));

  return {
    applications,
    approved: applications.length > 0,
    save: {
      ...options.save,
      currentSeason: {
        ...options.save.currentSeason,
        progressionApplications: [
          ...existingApplications,
          ...applications,
        ],
      },
    },
  };
}

function hasProgressionApplication(
  save: DynastySaveData,
  teamId: string,
  weekIndex: number,
): boolean {
  return (save.currentSeason.progressionApplications ?? []).some((application) =>
    application.teamId === teamId &&
    application.weekIndex === weekIndex);
}

function createTrainingSummary(
  rows: readonly DynastyProgressionPreviewRow[],
): DynastyTrainingSummaryRow[] {
  const rooms = new Map<string, DynastyProgressionPreviewRow[]>();
  for (const row of rows) {
    const room = getPositionRoom(row.position);
    rooms.set(room, [...(rooms.get(room) ?? []), row]);
  }

  return [...rooms.entries()]
    .map(([room, roomRows]) => {
      const sortedRows = [...roomRows].sort((a, b) =>
        b.performancePoints - a.performancePoints ||
        b.currentOverall - a.currentOverall ||
        a.playerName.localeCompare(b.playerName));
      const totalPoints = sortedRows.reduce((sum, row) => sum + row.performancePoints, 0);
      const leader = sortedRows[0]!;
      const focusArchetype = findMostCommonArchetype(sortedRows);

      return {
        averagePoints: Math.round(totalPoints / sortedRows.length),
        focusLabel: `${focusArchetype} focus`,
        leaderName: leader.playerName,
        playerCount: sortedRows.length,
        room,
        totalPoints,
      };
    })
    .sort((a, b) =>
      b.totalPoints - a.totalPoints ||
      b.averagePoints - a.averagePoints ||
      a.room.localeCompare(b.room));
}

function getPositionRoom(position: string): string {
  switch (position) {
    case 'QB':
      return 'Quarterbacks';
    case 'RB':
      return 'Backfield';
    case 'WR':
    case 'SLOT':
    case 'TE':
      return 'Receivers';
    case 'C':
    case 'LG':
    case 'LT':
    case 'RG':
    case 'RT':
    case 'LS':
      return 'Line';
    case 'DL':
    case 'ILB':
    case 'OLB':
      return 'Front Seven';
    case 'CB':
    case 'FS':
    case 'SS':
      return 'Secondary';
    case 'K':
    case 'P':
      return 'Specialists';
    default:
      return 'Depth';
  }
}

function findMostCommonArchetype(rows: readonly DynastyProgressionPreviewRow[]): PlayerArchetype {
  const counts = new Map<PlayerArchetype, number>();
  for (const row of rows) {
    counts.set(row.archetype, (counts.get(row.archetype) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0];
}

function createProgressionRow(
  player: RosterPlayer,
  stats: DynastyTeamSeasonStats,
  dynastySeed: string,
): DynastyProgressionPreviewRow {
  const currentOverall = calculateOverallRating(player.footballPosition, player.ratings);
  const roleScore = calculateRoleScore(player, stats);
  const stabilityBonus = hashToRange(`${dynastySeed}:${player.id}:progression`, 0, 8);
  const performancePoints = clampPoints(Math.round(roleScore + stabilityBonus));
  const ratingDeltas = createRatingDeltaPreview(player, performancePoints);
  const projectedRatings = applyRatingDeltas(player.ratings, ratingDeltas);
  const projectedOverall = calculateOverallRating(player.footballPosition, projectedRatings);

  return {
    archetype: player.archetype,
    currentOverall,
    developmentNote: createDevelopmentNote(player, performancePoints),
    performancePoints,
    playerId: player.id,
    playerName: player.displayName,
    position: player.footballPosition,
    projectedOverall,
    projectedOverallDelta: Math.max(0, projectedOverall - currentOverall),
    ratingDeltas,
  };
}

function createRatingDeltaPreview(
  player: RosterPlayer,
  performancePoints: number,
): DynastyRatingDeltaPreview[] {
  const budget = getRatingDeltaBudget(performancePoints);
  if (budget <= 0) {
    return [];
  }

  return Object.entries(getPositionRatingProfile(player.footballPosition).overallWeights)
    .filter((entry): entry is [PlayerAttributeKey, number] =>
      isPlayerAttributeKey(entry[0]) &&
      typeof entry[1] === 'number' &&
      player.ratings[entry[0]] !== undefined)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, budget)
    .map(([attribute]) => {
      const currentValue = player.ratings[attribute] ?? 0;
      const projectedValue = Math.min(99, currentValue + 1);
      return {
        attribute,
        currentValue,
        delta: projectedValue - currentValue,
        projectedValue,
      };
    })
    .filter((delta) => delta.delta > 0);
}

function getRatingDeltaBudget(performancePoints: number): number {
  if (performancePoints >= 60) {
    return 3;
  }
  if (performancePoints >= 40) {
    return 2;
  }
  if (performancePoints >= 20) {
    return 1;
  }
  return 0;
}

function applyRatingDeltas(
  ratings: PlayerRatings,
  deltas: readonly DynastyRatingDeltaPreview[],
): PlayerRatings {
  const projected: Partial<Record<PlayerAttributeKey, number>> = { ...ratings };
  for (const delta of deltas) {
    projected[delta.attribute] = delta.projectedValue;
  }
  return projected;
}

function calculateRoleScore(
  player: RosterPlayer,
  stats: DynastyTeamSeasonStats,
): number {
  if (stats.gamesPlayed <= 0) {
    return 0;
  }

  const games = Math.max(1, stats.gamesPlayed);
  const offensiveYardsPerGame = stats.offensiveYards / games;
  const passingYardsPerGame = stats.passingYards / games;
  const rushingYardsPerGame = stats.rushingYards / games;
  const defensiveYardsAllowedPerGame = stats.defensiveYards / games;
  const pointsPerGame = stats.pointsFor / games;
  const fieldGoalsPerGame = stats.fieldGoals / games;
  const takeawaysPerGame = stats.takeaways / games;

  switch (player.footballPosition) {
    case 'QB':
      return passingYardsPerGame * 0.12 + pointsPerGame * 0.7;
    case 'RB':
      return rushingYardsPerGame * 0.16 + pointsPerGame * 0.35;
    case 'WR':
    case 'SLOT':
    case 'TE':
      return passingYardsPerGame * 0.08 + offensiveYardsPerGame * 0.035;
    case 'C':
    case 'LG':
    case 'LT':
    case 'RG':
    case 'RT':
    case 'LS':
      return offensiveYardsPerGame * 0.045 + rushingYardsPerGame * 0.055;
    case 'K':
    case 'P':
      return fieldGoalsPerGame * 10 + pointsPerGame * 0.12;
    case 'DL':
    case 'ILB':
    case 'OLB':
      return Math.max(0, 260 - defensiveYardsAllowedPerGame) * 0.06 + takeawaysPerGame * 9;
    case 'CB':
    case 'FS':
    case 'SS':
      return Math.max(0, 240 - defensiveYardsAllowedPerGame) * 0.055 + takeawaysPerGame * 10;
  }
}

function createDevelopmentNote(player: RosterPlayer, points: number): string {
  if (points >= 40) {
    return `${player.archetype} surge`;
  }
  if (points >= 20) {
    return `${player.archetype} progress`;
  }
  if (points > 0) {
    return `${player.archetype} tracked`;
  }
  return `${player.archetype} pending`;
}

function createEmptyStats(teamId: string): DynastyTeamSeasonStats {
  return {
    defensiveYards: 0,
    fieldGoals: 0,
    gamesPlayed: 0,
    giveaways: 0,
    offensiveYards: 0,
    passingYards: 0,
    pointsAgainst: 0,
    pointsFor: 0,
    rushingYards: 0,
    takeaways: 0,
    teamId,
    touchdowns: 0,
  };
}

function clampPoints(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function hashToRange(seed: string, min: number, max: number): number {
  const span = max - min + 1;
  return min + (hashString(seed) % span);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
