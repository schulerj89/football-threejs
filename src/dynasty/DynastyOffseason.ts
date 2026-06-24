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
