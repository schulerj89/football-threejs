import { calculateOverallRating } from '../ratings/OverallRatingCalculator';
import { getTeamRosterOrDefault } from '../roster/RosterRegistry';
import type { FootballPosition } from '../roster/RosterPlayer';
import {
  createDynastySigningClassPreview,
  type DynastySigningClassPreview,
} from './DynastyRecruiting';
import type { DynastySaveData } from './DynastyTypes';

export const DYNASTY_OFFSEASON_DEPARTURE_PREVIEW_COUNT = 6;

export type DynastyDepartureReason =
  | 'draftInterest'
  | 'eligibility'
  | 'roleChurn';

export interface DynastyDepartureCandidate {
  readonly departureRisk: number;
  readonly footballPosition: FootballPosition;
  readonly overall: number;
  readonly playerId: string;
  readonly playerName: string;
  readonly reason: DynastyDepartureReason;
  readonly reasonLabel: string;
  readonly rosterStatusLabel: string;
}

export interface DynastyOffseasonDeparturePreview {
  readonly departureCandidates: readonly DynastyDepartureCandidate[];
  readonly seasonComplete: boolean;
  readonly seasonYear: number;
  readonly summaryLabel: string;
  readonly teamId: string;
}

export interface DynastyIncomingClassCandidate {
  readonly fitLabel: string;
  readonly footballPosition: FootballPosition;
  readonly projectedGrade: number;
  readonly prospectId: string;
  readonly prospectName: string;
  readonly rosterActionLabel: string;
  readonly room: string;
  readonly signingConfidence: number;
  readonly sourceLabel: string;
  readonly starRating: number;
}

export interface DynastyOffseasonIncomingClassPreview {
  readonly addressedNeedCount: number;
  readonly classFitScore: number;
  readonly currentRosterCount: number;
  readonly incomingCandidates: readonly DynastyIncomingClassCandidate[];
  readonly projectedRosterCount: number;
  readonly seasonComplete: boolean;
  readonly seasonYear: number;
  readonly signingClassPreview: DynastySigningClassPreview;
  readonly summaryLabel: string;
  readonly teamId: string;
}

export interface DynastyOffseasonRosterReviewRow {
  readonly averageOverall: number;
  readonly currentRosterCount: number;
  readonly departureCandidateCount: number;
  readonly gapLabel: string;
  readonly incomingCandidateCount: number;
  readonly positionGap: number;
  readonly positions: readonly FootballPosition[];
  readonly projectedRosterCount: number;
  readonly returningRosterCount: number;
  readonly room: string;
  readonly summaryLabel: string;
  readonly targetRosterCount: number;
  readonly weakestOverall: number;
}

export interface DynastyOffseasonRosterReview {
  readonly departurePreview: DynastyOffseasonDeparturePreview;
  readonly incomingClassPreview: DynastyOffseasonIncomingClassPreview;
  readonly reviewRows: readonly DynastyOffseasonRosterReviewRow[];
  readonly seasonComplete: boolean;
  readonly seasonYear: number;
  readonly summaryLabel: string;
  readonly teamId: string;
  readonly totalCurrentRosterCount: number;
  readonly totalDepartureCandidateCount: number;
  readonly totalIncomingCandidateCount: number;
  readonly totalProjectedRosterCount: number;
}

const ROSTER_REVIEW_ROOMS: readonly {
  readonly positions: readonly FootballPosition[];
  readonly room: string;
  readonly targetRosterCount: number;
}[] = [
  { positions: ['QB'], room: 'Quarterbacks', targetRosterCount: 2 },
  { positions: ['RB'], room: 'Backfield', targetRosterCount: 3 },
  { positions: ['WR', 'SLOT', 'TE'], room: 'Receivers', targetRosterCount: 6 },
  { positions: ['C', 'LG', 'LT', 'RG', 'RT', 'LS'], room: 'Line', targetRosterCount: 8 },
  { positions: ['DL', 'ILB', 'OLB'], room: 'Front Seven', targetRosterCount: 8 },
  { positions: ['CB', 'FS', 'SS'], room: 'Secondary', targetRosterCount: 6 },
  { positions: ['K', 'P'], room: 'Specialists', targetRosterCount: 2 },
];

export function createDynastyOffseasonDeparturePreview(options: {
  readonly save: DynastySaveData;
  readonly teamId?: string;
}): DynastyOffseasonDeparturePreview {
  const teamId = options.teamId ?? options.save.userTeamId;
  const roster = getTeamRosterOrDefault(teamId);
  const starterIds = new Set([
    ...roster.offensiveStarterIds,
    ...roster.defensiveStarterIds,
  ]);
  const specialistIds = new Set([
    roster.kickerId,
    roster.longSnapperId,
    roster.punterId,
  ]);
  const seasonComplete = options.save.status === 'complete';
  const candidates = roster.players
    .map((player) => {
      const overall = calculateOverallRating(player.footballPosition, player.ratings);
      const reason = createDepartureReason({
        isSpecialist: specialistIds.has(player.id),
        overall,
        seed: `${options.save.seed}:${options.save.currentSeason.year}:${player.id}:departure-reason`,
      });
      const departureRisk = createDepartureRisk({
        isReserve: roster.reserveIds.includes(player.id),
        isStarter: starterIds.has(player.id),
        isSpecialist: specialistIds.has(player.id),
        overall,
        seasonComplete,
        seed: `${options.save.seed}:${options.save.currentSeason.year}:${player.id}:departure-risk`,
      });

      return {
        departureRisk,
        footballPosition: player.footballPosition,
        overall,
        playerId: player.id,
        playerName: player.displayName,
        reason,
        reasonLabel: formatDepartureReason(reason),
        rosterStatusLabel: createRosterStatusLabel({
          isReserve: roster.reserveIds.includes(player.id),
          isSpecialist: specialistIds.has(player.id),
          isStarter: starterIds.has(player.id),
        }),
      };
    })
    .sort((a, b) =>
      b.departureRisk - a.departureRisk ||
      b.overall - a.overall ||
      a.playerName.localeCompare(b.playerName))
    .slice(0, DYNASTY_OFFSEASON_DEPARTURE_PREVIEW_COUNT);

  return {
    departureCandidates: candidates,
    seasonComplete,
    seasonYear: options.save.currentSeason.year,
    summaryLabel: `${candidates.length} departure candidates | ${seasonComplete ? 'season complete' : 'preview only'}`,
    teamId,
  };
}

export function createDynastyOffseasonIncomingClassPreview(options: {
  readonly save: DynastySaveData;
  readonly teamId?: string;
}): DynastyOffseasonIncomingClassPreview {
  const teamId = options.teamId ?? options.save.userTeamId;
  const roster = getTeamRosterOrDefault(teamId);
  const seasonComplete = options.save.status === 'complete';
  const signingClassPreview = createDynastySigningClassPreview({
    save: options.save,
    teamId,
  });
  const incomingCandidates = signingClassPreview.projectedSignees.map((signee) => ({
    fitLabel: signee.fitLabel,
    footballPosition: signee.footballPosition,
    projectedGrade: signee.projectedGrade,
    prospectId: signee.prospectId,
    prospectName: signee.prospectName,
    rosterActionLabel: seasonComplete ? 'Ready for offseason review' : 'Preview only',
    room: signee.room,
    signingConfidence: signee.signingConfidence,
    sourceLabel: `${signee.starRating}-star ${signee.room}`,
    starRating: signee.starRating,
  }));

  return {
    addressedNeedCount: signingClassPreview.addressedNeedCount,
    classFitScore: signingClassPreview.classFitScore,
    currentRosterCount: roster.players.length,
    incomingCandidates,
    projectedRosterCount: roster.players.length + incomingCandidates.length,
    seasonComplete,
    seasonYear: options.save.currentSeason.year,
    signingClassPreview,
    summaryLabel: `${incomingCandidates.length} incoming prospects | ${seasonComplete ? 'season complete' : 'preview only'}`,
    teamId,
  };
}

export function createDynastyOffseasonRosterReview(options: {
  readonly save: DynastySaveData;
  readonly teamId?: string;
}): DynastyOffseasonRosterReview {
  const teamId = options.teamId ?? options.save.userTeamId;
  const roster = getTeamRosterOrDefault(teamId);
  const departurePreview = createDynastyOffseasonDeparturePreview({
    save: options.save,
    teamId,
  });
  const incomingClassPreview = createDynastyOffseasonIncomingClassPreview({
    save: options.save,
    teamId,
  });
  const reviewRows = ROSTER_REVIEW_ROOMS.map((room) =>
    createRosterReviewRow({
      departureCandidates: departurePreview.departureCandidates,
      incomingCandidates: incomingClassPreview.incomingCandidates,
      room,
      roster,
    }));
  const totalDepartureCandidateCount = reviewRows.reduce(
    (sum, row) => sum + row.departureCandidateCount,
    0,
  );
  const totalIncomingCandidateCount = reviewRows.reduce(
    (sum, row) => sum + row.incomingCandidateCount,
    0,
  );
  const totalCurrentRosterCount = reviewRows.reduce(
    (sum, row) => sum + row.currentRosterCount,
    0,
  );
  const totalProjectedRosterCount = reviewRows.reduce(
    (sum, row) => sum + row.projectedRosterCount,
    0,
  );
  const gapRoomCount = reviewRows.filter((row) => row.positionGap > 0).length;

  return {
    departurePreview,
    incomingClassPreview,
    reviewRows,
    seasonComplete: options.save.status === 'complete',
    seasonYear: options.save.currentSeason.year,
    summaryLabel: `${totalProjectedRosterCount} projected roster | ${gapRoomCount} rooms with gaps`,
    teamId,
    totalCurrentRosterCount,
    totalDepartureCandidateCount,
    totalIncomingCandidateCount,
    totalProjectedRosterCount,
  };
}

function createDepartureRisk(options: {
  readonly isReserve: boolean;
  readonly isStarter: boolean;
  readonly isSpecialist: boolean;
  readonly overall: number;
  readonly seasonComplete: boolean;
  readonly seed: string;
}): number {
  const roleRisk = options.isStarter ? 18 : options.isSpecialist ? 14 : options.isReserve ? 10 : 12;
  const qualityRisk = Math.max(0, options.overall - 70);
  const completeSeasonRisk = options.seasonComplete ? 12 : 0;
  const stabilityRoll = hashToRange(options.seed, 0, 24);

  return clampRisk(roleRisk + qualityRisk + completeSeasonRisk + stabilityRoll);
}

function createDepartureReason(options: {
  readonly isSpecialist: boolean;
  readonly overall: number;
  readonly seed: string;
}): DynastyDepartureReason {
  if (options.overall >= 82 && !options.isSpecialist) {
    return 'draftInterest';
  }
  const roll = hashToRange(options.seed, 0, 99);
  if (roll >= 68) {
    return 'eligibility';
  }
  if (roll >= 34) {
    return 'roleChurn';
  }
  return options.isSpecialist ? 'eligibility' : 'draftInterest';
}

function createRosterStatusLabel(options: {
  readonly isReserve: boolean;
  readonly isSpecialist: boolean;
  readonly isStarter: boolean;
}): string {
  if (options.isStarter) {
    return 'Starter';
  }
  if (options.isSpecialist) {
    return 'Specialist';
  }
  if (options.isReserve) {
    return 'Reserve';
  }
  return 'Depth';
}

function createRosterReviewRow(options: {
  readonly departureCandidates: readonly DynastyDepartureCandidate[];
  readonly incomingCandidates: readonly DynastyIncomingClassCandidate[];
  readonly room: {
    readonly positions: readonly FootballPosition[];
    readonly room: string;
    readonly targetRosterCount: number;
  };
  readonly roster: ReturnType<typeof getTeamRosterOrDefault>;
}): DynastyOffseasonRosterReviewRow {
  const players = options.roster.players.filter((player) =>
    options.room.positions.includes(player.footballPosition));
  const overalls = players.map((player) => calculateOverallRating(player.footballPosition, player.ratings));
  const departureCandidateCount = options.departureCandidates.filter((candidate) =>
    options.room.positions.includes(candidate.footballPosition)).length;
  const incomingCandidateCount = options.incomingCandidates.filter((candidate) =>
    options.room.positions.includes(candidate.footballPosition)).length;
  const currentRosterCount = players.length;
  const returningRosterCount = Math.max(0, currentRosterCount - departureCandidateCount);
  const projectedRosterCount = returningRosterCount + incomingCandidateCount;
  const positionGap = Math.max(0, options.room.targetRosterCount - projectedRosterCount);

  return {
    averageOverall: overalls.length > 0
      ? Math.round(overalls.reduce((sum, overall) => sum + overall, 0) / overalls.length)
      : 0,
    currentRosterCount,
    departureCandidateCount,
    gapLabel: createGapLabel(projectedRosterCount, options.room.targetRosterCount),
    incomingCandidateCount,
    positionGap,
    positions: options.room.positions,
    projectedRosterCount,
    returningRosterCount,
    room: options.room.room,
    summaryLabel: `${options.room.room}: ${returningRosterCount} returning, ${departureCandidateCount} departure candidates, ${incomingCandidateCount} incoming`,
    targetRosterCount: options.room.targetRosterCount,
    weakestOverall: overalls.length > 0 ? Math.min(...overalls) : 0,
  };
}

function createGapLabel(projectedRosterCount: number, targetRosterCount: number): string {
  const gap = projectedRosterCount - targetRosterCount;
  if (gap === 0) {
    return 'On target';
  }
  if (gap > 0) {
    return `+${gap} over target`;
  }
  return `${Math.abs(gap)} below target`;
}

function formatDepartureReason(reason: DynastyDepartureReason): string {
  switch (reason) {
    case 'draftInterest':
      return 'Draft interest';
    case 'eligibility':
      return 'Eligibility window';
    case 'roleChurn':
      return 'Role churn';
  }
}

function clampRisk(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
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
