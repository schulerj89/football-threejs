import { calculateOverallRating } from '../ratings/OverallRatingCalculator';
import { getTeamRosterOrDefault } from '../roster/RosterRegistry';
import type { FootballPosition } from '../roster/RosterPlayer';
import {
  createDynastySigningClassPreview,
  type DynastySigningClassPreview,
} from './DynastyRecruiting';
import { createDynastySeason } from './DynastySchedule';
import type {
  DynastySaveData,
  DynastySeason,
  DynastyTeamRecord,
  DynastyTeamSeasonStats,
} from './DynastyTypes';

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

export interface DynastyOffseasonTeamHistoryRow {
  readonly gamesPlayed: number;
  readonly losses: number;
  readonly pointsAgainst: number;
  readonly pointsFor: number;
  readonly pointsMargin: number;
  readonly rank: number;
  readonly teamId: string;
  readonly wins: number;
}

export interface DynastyOffseasonSeasonHistorySnapshot {
  readonly championRecordLabel: string;
  readonly championTeamId: string;
  readonly seasonComplete: boolean;
  readonly seasonId: string;
  readonly summaryLabel: string;
  readonly teamRows: readonly DynastyOffseasonTeamHistoryRow[];
  readonly userRecordLabel: string;
  readonly userTeamId: string;
  readonly year: number;
}

export interface DynastyOffseasonNextSeasonShell {
  readonly currentSeasonHistory: DynastyOffseasonSeasonHistorySnapshot;
  readonly nextSeason: DynastySeason;
  readonly nextSeasonYear: number;
  readonly rosterReview: DynastyOffseasonRosterReview;
  readonly seasonComplete: boolean;
  readonly summaryLabel: string;
  readonly teamId: string;
}

export interface DynastyOffseasonValidationIssue {
  readonly message: string;
  readonly severity: 'error' | 'warning';
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

export function createDynastyOffseasonNextSeasonShell(options: {
  readonly save: DynastySaveData;
  readonly teamId?: string;
}): DynastyOffseasonNextSeasonShell {
  const teamId = options.teamId ?? options.save.userTeamId;
  const nextSeasonYear = options.save.currentSeason.year + 1;
  const rosterReview = createDynastyOffseasonRosterReview({
    save: options.save,
    teamId,
  });
  const nextSeason = createDynastySeason({
    seed: `${options.save.seed}:next-season:${nextSeasonYear}`,
    teamIds: options.save.currentSeason.teamIds,
    year: nextSeasonYear,
  });
  const currentSeasonHistory = createSeasonHistorySnapshot({
    save: options.save,
    teamId,
  });

  return {
    currentSeasonHistory,
    nextSeason,
    nextSeasonYear,
    rosterReview,
    seasonComplete: options.save.status === 'complete',
    summaryLabel: `${nextSeasonYear} schedule shell | ${currentSeasonHistory.year} history preserved`,
    teamId,
  };
}

export function validateDynastyOffseasonDeparturePreview(
  preview: unknown,
): DynastyOffseasonValidationIssue[] {
  const issues: DynastyOffseasonValidationIssue[] = [];
  if (!isRecord(preview)) {
    return [error('Dynasty offseason departure preview is malformed')];
  }
  if (!Array.isArray(preview.departureCandidates)) {
    issues.push(error('Dynasty offseason departure candidates must be an array'));
    return issues;
  }
  const playerIds = new Set<string>();
  for (const candidate of preview.departureCandidates) {
    validateDepartureCandidate(issues, candidate, playerIds);
  }
  if (preview.departureCandidates.length > DYNASTY_OFFSEASON_DEPARTURE_PREVIEW_COUNT) {
    issues.push(error('Dynasty offseason departure preview has too many candidates'));
  }
  if (typeof preview.teamId !== 'string' || preview.teamId.length === 0) {
    issues.push(error('Dynasty offseason departure preview is missing teamId'));
  }
  if (!Number.isInteger(preview.seasonYear)) {
    issues.push(error('Dynasty offseason departure preview has invalid season year'));
  }
  if (typeof preview.seasonComplete !== 'boolean') {
    issues.push(error('Dynasty offseason departure preview has invalid season status'));
  }
  return issues;
}

export function validateDynastyOffseasonIncomingClassPreview(
  preview: unknown,
): DynastyOffseasonValidationIssue[] {
  const issues: DynastyOffseasonValidationIssue[] = [];
  if (!isRecord(preview)) {
    return [error('Dynasty offseason incoming class preview is malformed')];
  }
  if (!Array.isArray(preview.incomingCandidates)) {
    issues.push(error('Dynasty offseason incoming candidates must be an array'));
    return issues;
  }
  const prospectIds = new Set<string>();
  for (const candidate of preview.incomingCandidates) {
    validateIncomingCandidate(issues, candidate, prospectIds);
  }
  if (!isBoundedInteger(preview.currentRosterCount, 0, 99)) {
    issues.push(error('Dynasty offseason incoming class has invalid current roster count'));
  }
  if (!isBoundedInteger(preview.projectedRosterCount, 0, 120)) {
    issues.push(error('Dynasty offseason incoming class has invalid projected roster count'));
  } else if (
    typeof preview.currentRosterCount === 'number' &&
    preview.projectedRosterCount !== preview.currentRosterCount + preview.incomingCandidates.length
  ) {
    issues.push(error('Dynasty offseason incoming class projected roster count does not match candidates'));
  }
  if (!isBoundedInteger(preview.addressedNeedCount, 0, preview.incomingCandidates.length)) {
    issues.push(error('Dynasty offseason incoming class has invalid addressed need count'));
  }
  if (!isBoundedInteger(preview.classFitScore, 0, 100)) {
    issues.push(error('Dynasty offseason incoming class has invalid class fit score'));
  }
  if (typeof preview.teamId !== 'string' || preview.teamId.length === 0) {
    issues.push(error('Dynasty offseason incoming class is missing teamId'));
  }
  if (!Number.isInteger(preview.seasonYear)) {
    issues.push(error('Dynasty offseason incoming class has invalid season year'));
  }
  return issues;
}

export function validateDynastyOffseasonRosterReview(
  review: unknown,
): DynastyOffseasonValidationIssue[] {
  const issues: DynastyOffseasonValidationIssue[] = [];
  if (!isRecord(review)) {
    return [error('Dynasty offseason roster review is malformed')];
  }
  issues.push(...validateDynastyOffseasonDeparturePreview(review.departurePreview));
  issues.push(...validateDynastyOffseasonIncomingClassPreview(review.incomingClassPreview));
  if (!Array.isArray(review.reviewRows)) {
    issues.push(error('Dynasty offseason roster review rows must be an array'));
    return issues;
  }
  const rooms = new Set<string>();
  for (const row of review.reviewRows) {
    validateRosterReviewRow(issues, row, rooms);
  }
  validateRosterReviewTotal(issues, review, 'totalCurrentRosterCount', 'currentRosterCount');
  validateRosterReviewTotal(issues, review, 'totalDepartureCandidateCount', 'departureCandidateCount');
  validateRosterReviewTotal(issues, review, 'totalIncomingCandidateCount', 'incomingCandidateCount');
  validateRosterReviewTotal(issues, review, 'totalProjectedRosterCount', 'projectedRosterCount');
  if (typeof review.teamId !== 'string' || review.teamId.length === 0) {
    issues.push(error('Dynasty offseason roster review is missing teamId'));
  }
  if (!Number.isInteger(review.seasonYear)) {
    issues.push(error('Dynasty offseason roster review has invalid season year'));
  }
  return issues;
}

export function validateDynastyOffseasonSeasonHistorySnapshot(
  history: unknown,
): DynastyOffseasonValidationIssue[] {
  const issues: DynastyOffseasonValidationIssue[] = [];
  if (!isRecord(history)) {
    return [error('Dynasty offseason season history is malformed')];
  }
  if (!Array.isArray(history.teamRows)) {
    issues.push(error('Dynasty offseason season history rows must be an array'));
    return issues;
  }
  const teamIds = new Set<string>();
  const ranks = new Set<number>();
  for (const row of history.teamRows) {
    validateHistoryRow(issues, row, teamIds, ranks);
  }
  const championTeamId = typeof history.championTeamId === 'string' ? history.championTeamId : '';
  if (!teamIds.has(championTeamId)) {
    issues.push(error(`Dynasty offseason season history has unknown champion ${String(history.championTeamId)}`));
  }
  const userTeamId = typeof history.userTeamId === 'string' ? history.userTeamId : '';
  if (!teamIds.has(userTeamId)) {
    issues.push(error(`Dynasty offseason season history has unknown user team ${String(history.userTeamId)}`));
  }
  if (typeof history.seasonId !== 'string' || history.seasonId.length === 0) {
    issues.push(error('Dynasty offseason season history is missing seasonId'));
  }
  if (!Number.isInteger(history.year)) {
    issues.push(error('Dynasty offseason season history has invalid year'));
  }
  if (typeof history.seasonComplete !== 'boolean') {
    issues.push(error('Dynasty offseason season history has invalid completion status'));
  }
  return issues;
}

export function validateDynastyOffseasonNextSeasonShell(
  shell: unknown,
): DynastyOffseasonValidationIssue[] {
  const issues: DynastyOffseasonValidationIssue[] = [];
  if (!isRecord(shell)) {
    return [error('Dynasty offseason next-season shell is malformed')];
  }
  issues.push(...validateDynastyOffseasonRosterReview(shell.rosterReview));
  issues.push(...validateDynastyOffseasonSeasonHistorySnapshot(shell.currentSeasonHistory));
  if (!isRecord(shell.nextSeason)) {
    issues.push(error('Dynasty offseason next-season shell is missing nextSeason'));
    return issues;
  }
  if (!Number.isInteger(shell.nextSeasonYear) || shell.nextSeasonYear !== shell.nextSeason.year) {
    issues.push(error('Dynasty offseason next-season shell has invalid next-season year'));
  }
  if (
    isRecord(shell.currentSeasonHistory) &&
    Number.isInteger(shell.currentSeasonHistory.year) &&
    Number.isInteger(shell.nextSeasonYear) &&
    shell.nextSeasonYear !== Number(shell.currentSeasonHistory.year) + 1
  ) {
    issues.push(error('Dynasty offseason next-season shell year does not follow history'));
  }
  validateNextSeasonMetadata(issues, shell.nextSeason);
  if (typeof shell.teamId !== 'string' || shell.teamId.length === 0) {
    issues.push(error('Dynasty offseason next-season shell is missing teamId'));
  }
  if (typeof shell.seasonComplete !== 'boolean') {
    issues.push(error('Dynasty offseason next-season shell has invalid completion status'));
  }
  return issues;
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

function createSeasonHistorySnapshot(options: {
  readonly save: DynastySaveData;
  readonly teamId: string;
}): DynastyOffseasonSeasonHistorySnapshot {
  const statsByTeam = new Map(options.save.currentSeason.teamStats.map((row) => [row.teamId, row]));
  const teamRows = options.save.currentSeason.standings
    .map((record) => createTeamHistoryRow(record, statsByTeam.get(record.teamId)))
    .sort((a, b) =>
      b.wins - a.wins ||
      a.losses - b.losses ||
      b.pointsMargin - a.pointsMargin ||
      a.teamId.localeCompare(b.teamId))
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
  const champion = teamRows[0] ?? createTeamHistoryRow(
    options.save.currentSeason.standings[0] ?? {
      losses: 0,
      pointsAgainst: 0,
      pointsFor: 0,
      teamId: options.teamId,
      wins: 0,
    },
    undefined,
  );
  const userRow = teamRows.find((row) => row.teamId === options.teamId) ?? champion;

  return {
    championRecordLabel: `${champion.wins}-${champion.losses}`,
    championTeamId: champion.teamId,
    seasonComplete: options.save.status === 'complete',
    seasonId: options.save.currentSeason.seasonId,
    summaryLabel: `${options.save.currentSeason.year} history | ${champion.teamId} ${champion.wins}-${champion.losses}`,
    teamRows,
    userRecordLabel: `${userRow.wins}-${userRow.losses}`,
    userTeamId: options.teamId,
    year: options.save.currentSeason.year,
  };
}

function createTeamHistoryRow(
  record: DynastyTeamRecord,
  stats: DynastyTeamSeasonStats | undefined,
): DynastyOffseasonTeamHistoryRow {
  return {
    gamesPlayed: stats?.gamesPlayed ?? record.wins + record.losses,
    losses: record.losses,
    pointsAgainst: record.pointsAgainst,
    pointsFor: record.pointsFor,
    pointsMargin: record.pointsFor - record.pointsAgainst,
    rank: 0,
    teamId: record.teamId,
    wins: record.wins,
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

function validateDepartureCandidate(
  issues: DynastyOffseasonValidationIssue[],
  candidate: unknown,
  playerIds: Set<string>,
): void {
  if (!isRecord(candidate)) {
    issues.push(error('Dynasty offseason departure candidate is malformed'));
    return;
  }
  const playerId = typeof candidate.playerId === 'string' ? candidate.playerId : '';
  if (!playerId) {
    issues.push(error('Dynasty offseason departure candidate is missing playerId'));
  } else if (playerIds.has(playerId)) {
    issues.push(error(`Dynasty offseason departure duplicates ${playerId}`));
  } else {
    playerIds.add(playerId);
  }
  if (!isFootballPosition(candidate.footballPosition)) {
    issues.push(error(`Dynasty offseason departure ${playerId || 'unknown'} has invalid position`));
  }
  if (!isBoundedInteger(candidate.departureRisk, 0, 100)) {
    issues.push(error(`Dynasty offseason departure ${playerId || 'unknown'} has invalid risk`));
  }
  if (!isBoundedInteger(candidate.overall, 0, 99)) {
    issues.push(error(`Dynasty offseason departure ${playerId || 'unknown'} has invalid overall`));
  }
  if (!isDepartureReason(candidate.reason)) {
    issues.push(error(`Dynasty offseason departure ${playerId || 'unknown'} has invalid reason`));
  }
  if (typeof candidate.playerName !== 'string' || candidate.playerName.length === 0) {
    issues.push(error(`Dynasty offseason departure ${playerId || 'unknown'} has invalid name`));
  }
}

function validateIncomingCandidate(
  issues: DynastyOffseasonValidationIssue[],
  candidate: unknown,
  prospectIds: Set<string>,
): void {
  if (!isRecord(candidate)) {
    issues.push(error('Dynasty offseason incoming candidate is malformed'));
    return;
  }
  const prospectId = typeof candidate.prospectId === 'string' ? candidate.prospectId : '';
  if (!prospectId) {
    issues.push(error('Dynasty offseason incoming candidate is missing prospectId'));
  } else if (prospectIds.has(prospectId)) {
    issues.push(error(`Dynasty offseason incoming class duplicates ${prospectId}`));
  } else {
    prospectIds.add(prospectId);
  }
  if (!isFootballPosition(candidate.footballPosition)) {
    issues.push(error(`Dynasty offseason incoming ${prospectId || 'unknown'} has invalid position`));
  }
  if (!isBoundedInteger(candidate.projectedGrade, 58, 91)) {
    issues.push(error(`Dynasty offseason incoming ${prospectId || 'unknown'} has invalid projected grade`));
  }
  if (!isBoundedInteger(candidate.signingConfidence, 0, 100)) {
    issues.push(error(`Dynasty offseason incoming ${prospectId || 'unknown'} has invalid signing confidence`));
  }
  if (!isBoundedInteger(candidate.starRating, 1, 5)) {
    issues.push(error(`Dynasty offseason incoming ${prospectId || 'unknown'} has invalid star rating`));
  }
  if (typeof candidate.prospectName !== 'string' || candidate.prospectName.length === 0) {
    issues.push(error(`Dynasty offseason incoming ${prospectId || 'unknown'} has invalid name`));
  }
  if (candidate.rosterActionLabel !== 'Preview only' && candidate.rosterActionLabel !== 'Ready for offseason review') {
    issues.push(error(`Dynasty offseason incoming ${prospectId || 'unknown'} has invalid roster action`));
  }
}

function validateRosterReviewRow(
  issues: DynastyOffseasonValidationIssue[],
  row: unknown,
  rooms: Set<string>,
): void {
  if (!isRecord(row)) {
    issues.push(error('Dynasty offseason roster review row is malformed'));
    return;
  }
  const room = typeof row.room === 'string' ? row.room : '';
  if (!room) {
    issues.push(error('Dynasty offseason roster review row is missing room'));
  } else if (rooms.has(room)) {
    issues.push(error(`Dynasty offseason roster review duplicates ${room}`));
  } else {
    rooms.add(room);
  }
  if (!Array.isArray(row.positions) || row.positions.some((position) => !isFootballPosition(position))) {
    issues.push(error(`Dynasty offseason roster review ${room || 'unknown'} has invalid positions`));
  }
  const numericFields = [
    'averageOverall',
    'currentRosterCount',
    'departureCandidateCount',
    'incomingCandidateCount',
    'positionGap',
    'projectedRosterCount',
    'returningRosterCount',
    'targetRosterCount',
    'weakestOverall',
  ] as const;
  for (const field of numericFields) {
    if (!isBoundedInteger(row[field], 0, field.includes('Overall') ? 99 : 120)) {
      issues.push(error(`Dynasty offseason roster review ${room || 'unknown'} has invalid ${field}`));
    }
  }
  if (
    typeof row.currentRosterCount === 'number' &&
    typeof row.departureCandidateCount === 'number' &&
    typeof row.returningRosterCount === 'number' &&
    row.returningRosterCount !== row.currentRosterCount - row.departureCandidateCount
  ) {
    issues.push(error(`Dynasty offseason roster review ${room || 'unknown'} has mismatched returning count`));
  }
  if (
    typeof row.returningRosterCount === 'number' &&
    typeof row.incomingCandidateCount === 'number' &&
    typeof row.projectedRosterCount === 'number' &&
    row.projectedRosterCount !== row.returningRosterCount + row.incomingCandidateCount
  ) {
    issues.push(error(`Dynasty offseason roster review ${room || 'unknown'} has mismatched projected count`));
  }
}

function validateRosterReviewTotal(
  issues: DynastyOffseasonValidationIssue[],
  review: Record<string, unknown>,
  totalKey: string,
  rowKey: string,
): void {
  if (!isBoundedInteger(review[totalKey], 0, 240)) {
    issues.push(error(`Dynasty offseason roster review has invalid ${totalKey}`));
    return;
  }
  const rows = Array.isArray(review.reviewRows) ? review.reviewRows : [];
  const total = rows
    .filter(isRecord)
    .reduce((sum, row) => sum + (typeof row[rowKey] === 'number' ? row[rowKey] : 0), 0);
  if (review[totalKey] !== total) {
    issues.push(error(`Dynasty offseason roster review ${totalKey} does not match rows`));
  }
}

function validateHistoryRow(
  issues: DynastyOffseasonValidationIssue[],
  row: unknown,
  teamIds: Set<string>,
  ranks: Set<number>,
): void {
  if (!isRecord(row)) {
    issues.push(error('Dynasty offseason season history row is malformed'));
    return;
  }
  const teamId = typeof row.teamId === 'string' ? row.teamId : '';
  if (!teamId) {
    issues.push(error('Dynasty offseason season history row is missing teamId'));
  } else if (teamIds.has(teamId)) {
    issues.push(error(`Dynasty offseason season history duplicates ${teamId}`));
  } else {
    teamIds.add(teamId);
  }
  if (!isBoundedInteger(row.rank, 1, 120)) {
    issues.push(error(`Dynasty offseason season history ${teamId || 'unknown'} has invalid rank`));
  } else if (ranks.has(row.rank)) {
    issues.push(error(`Dynasty offseason season history duplicates rank ${String(row.rank)}`));
  } else {
    ranks.add(row.rank);
  }
  for (const field of ['gamesPlayed', 'losses', 'pointsAgainst', 'pointsFor', 'wins'] as const) {
    if (!isBoundedInteger(row[field], 0, 9999)) {
      issues.push(error(`Dynasty offseason season history ${teamId || 'unknown'} has invalid ${field}`));
    }
  }
  if (
    typeof row.gamesPlayed === 'number' &&
    typeof row.wins === 'number' &&
    typeof row.losses === 'number' &&
    row.gamesPlayed !== row.wins + row.losses
  ) {
    issues.push(error(`Dynasty offseason season history ${teamId || 'unknown'} has mismatched games played`));
  }
  if (
    typeof row.pointsFor === 'number' &&
    typeof row.pointsAgainst === 'number' &&
    row.pointsMargin !== row.pointsFor - row.pointsAgainst
  ) {
    issues.push(error(`Dynasty offseason season history ${teamId || 'unknown'} has mismatched points margin`));
  }
}

function validateNextSeasonMetadata(
  issues: DynastyOffseasonValidationIssue[],
  season: Record<string, unknown>,
): void {
  if (typeof season.seasonId !== 'string' || season.seasonId.length === 0) {
    issues.push(error('Dynasty offseason next-season shell has invalid seasonId'));
  }
  if (!Array.isArray(season.teamIds) || season.teamIds.length === 0) {
    issues.push(error('Dynasty offseason next-season shell has invalid teams'));
  } else if (new Set(season.teamIds).size !== season.teamIds.length) {
    issues.push(error('Dynasty offseason next-season shell duplicates teams'));
  }
  if (!Array.isArray(season.weeks) || season.weeks.length === 0) {
    issues.push(error('Dynasty offseason next-season shell has invalid weeks'));
  } else {
    for (const week of season.weeks) {
      if (!isRecord(week) || !Array.isArray(week.games)) {
        issues.push(error('Dynasty offseason next-season shell has malformed week'));
        continue;
      }
      for (const game of week.games) {
        if (!isRecord(game)) {
          issues.push(error('Dynasty offseason next-season shell has malformed game'));
          continue;
        }
        if (game.status !== 'scheduled' || game.result !== null) {
          issues.push(error(`Dynasty offseason next-season game ${String(game.gameId)} must be scheduled without a result`));
        }
      }
    }
  }
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

function error(message: string): DynastyOffseasonValidationIssue {
  return { message, severity: 'error' };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBoundedInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function isFootballPosition(value: unknown): value is FootballPosition {
  return typeof value === 'string' && ROSTER_REVIEW_ROOMS.some((room) =>
    room.positions.includes(value as FootballPosition));
}

function isDepartureReason(value: unknown): value is DynastyDepartureReason {
  return value === 'draftInterest' || value === 'eligibility' || value === 'roleChurn';
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
