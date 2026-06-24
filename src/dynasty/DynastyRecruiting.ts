import { calculateOverallRating } from '../ratings/OverallRatingCalculator';
import type { FootballPosition, PlayerArchetype } from '../roster/RosterPlayer';
import { getTeamRosterOrDefault } from '../roster/RosterRegistry';
import type { TeamRoster } from '../roster/TeamRoster';
import type { DynastySaveData } from './DynastyTypes';

export const DYNASTY_RECRUITING_PROSPECT_COUNT = 18;
export const DYNASTY_WEEKLY_RECRUITING_POINTS = 100;
export const DYNASTY_WEEKLY_RECRUITING_ALLOCATION_LIMIT = 5;

export type DynastyRecruitingPitchStyle =
  | 'playingTime'
  | 'programFit'
  | 'teamStrength';

export const DYNASTY_RECRUITING_PITCH_STYLES: readonly DynastyRecruitingPitchStyle[] = [
  'playingTime',
  'teamStrength',
  'programFit',
];

export interface DynastyRecruitingPitchFit {
  readonly playingTime: number;
  readonly programFit: number;
  readonly teamStrength: number;
}

export interface DynastyRecruitingTeamInterest {
  readonly pitchFit: DynastyRecruitingPitchFit;
  readonly score: number;
  readonly teamId: string;
}

export interface DynastyRecruitingProspect {
  readonly archetype: PlayerArchetype;
  readonly displayName: string;
  readonly firstName: string;
  readonly footballPosition: FootballPosition;
  readonly hometownRegion: string;
  readonly id: string;
  readonly interest: readonly DynastyRecruitingTeamInterest[];
  readonly lastName: string;
  readonly nationalRank: number;
  readonly overallGrade: number;
  readonly starRating: number;
}

export interface DynastyRecruitingBoard {
  readonly pitchStyles: readonly DynastyRecruitingPitchStyle[];
  readonly prospects: readonly DynastyRecruitingProspect[];
  readonly recruitingPlan: DynastyWeeklyRecruitingPlan;
  readonly signingClassPreview: DynastySigningClassPreview;
  readonly summaryLabel: string;
  readonly teamNeeds: readonly DynastyRecruitingTeamNeed[];
}

export interface DynastyRecruitingTeamNeed {
  readonly averageOverall: number;
  readonly priorityScore: number;
  readonly positions: readonly FootballPosition[];
  readonly room: string;
  readonly rosterCount: number;
  readonly starterCount: number;
  readonly summaryLabel: string;
  readonly targetRosterCount: number;
  readonly weakestOverall: number;
}

export interface DynastyRecruitingAllocation {
  readonly allocatedPoints: number;
  readonly needPriorityScore: number;
  readonly pitchStyle: DynastyRecruitingPitchStyle;
  readonly prospectId: string;
  readonly prospectName: string;
  readonly room: string;
  readonly totalFitScore: number;
}

export interface DynastyWeeklyRecruitingPlan {
  readonly allocations: readonly DynastyRecruitingAllocation[];
  readonly remainingPoints: number;
  readonly summaryLabel: string;
  readonly teamId: string;
  readonly totalPoints: number;
  readonly weekIndex: number;
}

export interface DynastySigningClassPreviewRow {
  readonly fitLabel: string;
  readonly footballPosition: FootballPosition;
  readonly projectedGrade: number;
  readonly prospectId: string;
  readonly prospectName: string;
  readonly room: string;
  readonly signingConfidence: number;
  readonly starRating: number;
}

export interface DynastySigningClassPreview {
  readonly addressedNeedCount: number;
  readonly classFitScore: number;
  readonly projectedSignees: readonly DynastySigningClassPreviewRow[];
  readonly summaryLabel: string;
  readonly teamId: string;
}

export interface DynastyRecruitingValidationIssue {
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

const PROSPECT_SLOTS: readonly {
  readonly archetype: PlayerArchetype;
  readonly footballPosition: FootballPosition;
}[] = [
  { archetype: 'fieldGeneral', footballPosition: 'QB' },
  { archetype: 'accuratePasser', footballPosition: 'QB' },
  { archetype: 'powerRunner', footballPosition: 'RB' },
  { archetype: 'balancedReceiver', footballPosition: 'WR' },
  { archetype: 'balancedReceiver', footballPosition: 'SLOT' },
  { archetype: 'balancedReceiver', footballPosition: 'TE' },
  { archetype: 'interiorAnchor', footballPosition: 'C' },
  { archetype: 'interiorAnchor', footballPosition: 'LG' },
  { archetype: 'interiorAnchor', footballPosition: 'LT' },
  { archetype: 'interiorAnchor', footballPosition: 'DL' },
  { archetype: 'edgeRusher', footballPosition: 'OLB' },
  { archetype: 'edgeRusher', footballPosition: 'ILB' },
  { archetype: 'coverageSpecialist', footballPosition: 'CB' },
  { archetype: 'coverageSpecialist', footballPosition: 'FS' },
  { archetype: 'coverageSpecialist', footballPosition: 'SS' },
  { archetype: 'specialist', footballPosition: 'K' },
  { archetype: 'specialist', footballPosition: 'P' },
  { archetype: 'utility', footballPosition: 'LS' },
];

const TEAM_NEED_ROOMS: readonly {
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

const FIRST_NAMES = [
  'Ari',
  'Bennett',
  'Caleb',
  'Darius',
  'Eli',
  'Finn',
  'Gavin',
  'Hayes',
  'Isaiah',
  'Jalen',
  'Kade',
  'Luca',
  'Micah',
  'Nico',
  'Orion',
  'Parker',
  'Quinn',
  'Rowan',
] as const;

const LAST_NAMES = [
  'Avery',
  'Bishop',
  'Coleman',
  'Dawson',
  'Ellis',
  'Foster',
  'Griffin',
  'Hayward',
  'Irving',
  'Jennings',
  'Keaton',
  'Lawson',
  'Mercer',
  'Nolan',
  'Pierce',
  'Reed',
  'Sullivan',
  'Turner',
] as const;

const REGIONS = [
  'Central Plains',
  'Great Lakes',
  'Gulf Coast',
  'High Desert',
  'Mountain West',
  'North Valley',
  'Pacific Sound',
  'Riverlands',
  'South Bay',
  'Upper Prairie',
] as const;

export function createDynastyRecruitingBoard(options: {
  readonly save: DynastySaveData;
  readonly teamId?: string;
}): DynastyRecruitingBoard {
  const teamId = options.teamId ?? options.save.userTeamId;
  const teamNeeds = createDynastyRecruitingTeamNeeds({
    save: options.save,
    teamId,
  });
  const prospects = PROSPECT_SLOTS.map((slot, index) =>
    createProspect({
      index,
      save: options.save,
      slot,
    }))
    .sort((a, b) =>
      b.overallGrade - a.overallGrade ||
      a.nationalRank - b.nationalRank ||
      a.displayName.localeCompare(b.displayName))
    .map((prospect, index) => ({
      ...prospect,
      nationalRank: index + 1,
    }));
  const recruitingPlan = createDynastyWeeklyRecruitingPlan({
    prospects,
    save: options.save,
    teamId,
    teamNeeds,
  });

  return {
    pitchStyles: DYNASTY_RECRUITING_PITCH_STYLES,
    prospects,
    recruitingPlan,
    signingClassPreview: createDynastySigningClassPreview({
      prospects,
      recruitingPlan,
      teamId,
    }),
    summaryLabel: `${prospects.length} fictional prospects | deterministic board`,
    teamNeeds,
  };
}

export function createDynastyRecruitingTeamNeeds(options: {
  readonly save: DynastySaveData;
  readonly teamId?: string;
}): DynastyRecruitingTeamNeed[] {
  const teamId = options.teamId ?? options.save.userTeamId;
  const roster = getTeamRosterOrDefault(teamId);
  const starterIds = new Set([
    ...roster.offensiveStarterIds,
    ...roster.defensiveStarterIds,
    roster.kickerId,
    roster.punterId,
    roster.longSnapperId,
  ]);

  return TEAM_NEED_ROOMS.map((room) => createTeamNeed(room, roster, starterIds))
    .sort((a, b) =>
      b.priorityScore - a.priorityScore ||
      a.averageOverall - b.averageOverall ||
      a.room.localeCompare(b.room));
}

export function createDynastyWeeklyRecruitingPlan(options: {
  readonly prospects?: readonly DynastyRecruitingProspect[];
  readonly save: DynastySaveData;
  readonly teamId?: string;
  readonly teamNeeds?: readonly DynastyRecruitingTeamNeed[];
}): DynastyWeeklyRecruitingPlan {
  const teamId = options.teamId ?? options.save.userTeamId;
  const prospects = options.prospects ?? createDynastyRecruitingBoard({
    save: options.save,
    teamId,
  }).prospects;
  const teamNeeds = options.teamNeeds ?? createDynastyRecruitingTeamNeeds({
    save: options.save,
    teamId,
  });
  const needByPosition = createNeedByPosition(teamNeeds);
  const rankedTargets = prospects
    .map((prospect) => createRecruitingTarget(prospect, teamId, needByPosition))
    .filter((target): target is DynastyRecruitingAllocation & { readonly rankScore: number } =>
      target !== null)
    .sort((a, b) =>
      b.rankScore - a.rankScore ||
      b.totalFitScore - a.totalFitScore ||
      a.prospectName.localeCompare(b.prospectName))
    .slice(0, DYNASTY_WEEKLY_RECRUITING_ALLOCATION_LIMIT);
  const pointSchedule = createPointSchedule(DYNASTY_WEEKLY_RECRUITING_POINTS, rankedTargets.length);
  const allocations = rankedTargets.map((target, index) => ({
    allocatedPoints: pointSchedule[index] ?? 0,
    needPriorityScore: target.needPriorityScore,
    pitchStyle: target.pitchStyle,
    prospectId: target.prospectId,
    prospectName: target.prospectName,
    room: target.room,
    totalFitScore: target.totalFitScore,
  }));
  const allocatedTotal = allocations.reduce((sum, allocation) => sum + allocation.allocatedPoints, 0);

  return {
    allocations,
    remainingPoints: DYNASTY_WEEKLY_RECRUITING_POINTS - allocatedTotal,
    summaryLabel: `${DYNASTY_WEEKLY_RECRUITING_POINTS} weekly points | ${allocations.length} active targets`,
    teamId,
    totalPoints: DYNASTY_WEEKLY_RECRUITING_POINTS,
    weekIndex: options.save.currentWeekIndex,
  };
}

export function createDynastySigningClassPreview(options: {
  readonly prospects?: readonly DynastyRecruitingProspect[];
  readonly recruitingPlan?: DynastyWeeklyRecruitingPlan;
  readonly save?: DynastySaveData;
  readonly teamId?: string;
}): DynastySigningClassPreview {
  if (!options.recruitingPlan && !options.save) {
    throw new Error('Dynasty signing class preview requires a recruiting plan or save');
  }
  const teamId = options.teamId ?? options.recruitingPlan?.teamId ?? options.save!.userTeamId;
  const prospects = options.prospects ?? createDynastyRecruitingBoard({
    save: options.save!,
    teamId,
  }).prospects;
  const recruitingPlan = options.recruitingPlan ?? createDynastyWeeklyRecruitingPlan({
    prospects,
    save: options.save!,
    teamId,
  });
  const prospectsById = new Map(prospects.map((prospect) => [prospect.id, prospect]));
  const projectedSignees = recruitingPlan.allocations
    .map((allocation): DynastySigningClassPreviewRow | null => {
      const prospect = prospectsById.get(allocation.prospectId);
      if (!prospect) {
        return null;
      }
      const signingConfidence = clampPriority(Math.round(
        allocation.allocatedPoints * 0.45 +
        allocation.totalFitScore * 0.35 +
        allocation.needPriorityScore * 0.2,
      ));

      return {
        fitLabel: createFitLabel(signingConfidence),
        footballPosition: prospect.footballPosition,
        projectedGrade: prospect.overallGrade,
        prospectId: prospect.id,
        prospectName: prospect.displayName,
        room: allocation.room,
        signingConfidence,
        starRating: prospect.starRating,
      };
    })
    .filter((row): row is DynastySigningClassPreviewRow => row !== null)
    .sort((a, b) =>
      b.signingConfidence - a.signingConfidence ||
      b.projectedGrade - a.projectedGrade ||
      a.prospectName.localeCompare(b.prospectName));
  const addressedNeedCount = new Set(projectedSignees.map((row) => row.room)).size;
  const classFitScore = projectedSignees.length > 0
    ? Math.round(projectedSignees.reduce((sum, row) => sum + row.signingConfidence, 0) / projectedSignees.length)
    : 0;

  return {
    addressedNeedCount,
    classFitScore,
    projectedSignees,
    summaryLabel: `${projectedSignees.length} projected signees | ${classFitScore} class fit`,
    teamId,
  };
}

export function validateDynastyRecruitingBoard(
  board: unknown,
  teamIds: readonly string[],
): DynastyRecruitingValidationIssue[] {
  const issues: DynastyRecruitingValidationIssue[] = [];
  const validTeamIds = new Set(teamIds);
  if (!isRecord(board)) {
    issues.push(error('Dynasty recruiting board is malformed'));
    return issues;
  }
  if (!Array.isArray(board.prospects)) {
    issues.push(error('Dynasty recruiting prospects must be an array'));
    return issues;
  }

  const prospectIds = new Set<string>();
  const prospectRanks = new Set<number>();
  for (const prospect of board.prospects) {
    validateRecruitingProspect(issues, prospect, prospectIds, prospectRanks, validTeamIds);
  }

  return issues;
}

function createProspect(options: {
  readonly index: number;
  readonly save: DynastySaveData;
  readonly slot: {
    readonly archetype: PlayerArchetype;
    readonly footballPosition: FootballPosition;
  };
}): DynastyRecruitingProspect {
  const seed = `${options.save.seed}:recruiting:${options.save.currentSeason.year}:${options.index}`;
  const firstName = FIRST_NAMES[pickIndex(`${seed}:first`, FIRST_NAMES.length)]!;
  const lastName = LAST_NAMES[pickIndex(`${seed}:last`, LAST_NAMES.length)]!;
  const overallGrade = hashToRange(`${seed}:grade`, 58, 91);
  const starRating = gradeToStars(overallGrade);

  return {
    archetype: options.slot.archetype,
    displayName: `${firstName} ${lastName}`,
    firstName,
    footballPosition: options.slot.footballPosition,
    hometownRegion: REGIONS[pickIndex(`${seed}:region`, REGIONS.length)]!,
    id: `dynasty-prospect-${options.save.currentSeason.year}-${hashText(seed)}`,
    interest: createTeamInterest(options.save, seed, options.slot.footballPosition),
    lastName,
    nationalRank: options.index + 1,
    overallGrade,
    starRating,
  };
}

function createTeamInterest(
  save: DynastySaveData,
  seed: string,
  position: FootballPosition,
): DynastyRecruitingTeamInterest[] {
  return save.currentSeason.teamIds.map((teamId) => {
    const pitchFit = {
      playingTime: hashToRange(`${seed}:${teamId}:playingTime:${position}`, 35, 95),
      programFit: hashToRange(`${seed}:${teamId}:programFit`, 35, 95),
      teamStrength: hashToRange(`${seed}:${teamId}:teamStrength`, 35, 95),
    };
    const score = Math.round(
      pitchFit.playingTime * 0.4 +
      pitchFit.teamStrength * 0.3 +
      pitchFit.programFit * 0.3,
    );

    return {
      pitchFit,
      score,
      teamId,
    };
  }).sort((a, b) =>
    b.score - a.score ||
    a.teamId.localeCompare(b.teamId));
}

function createTeamNeed(
  room: {
    readonly positions: readonly FootballPosition[];
    readonly room: string;
    readonly targetRosterCount: number;
  },
  roster: TeamRoster,
  starterIds: ReadonlySet<string>,
): DynastyRecruitingTeamNeed {
  const players = roster.players.filter((player) => room.positions.includes(player.footballPosition));
  const overalls = players.map((player) => calculateOverallRating(player.footballPosition, player.ratings));
  const averageOverall = overalls.length > 0
    ? Math.round(overalls.reduce((sum, overall) => sum + overall, 0) / overalls.length)
    : 0;
  const weakestOverall = overalls.length > 0 ? Math.min(...overalls) : 0;
  const starterCount = players.filter((player) => starterIds.has(player.id)).length;
  const depthGap = Math.max(0, room.targetRosterCount - players.length);
  const qualityGap = Math.max(0, 78 - averageOverall);
  const floorGap = Math.max(0, 70 - weakestOverall);
  const priorityScore = clampPriority(Math.round(depthGap * 18 + qualityGap + floorGap * 0.5));

  return {
    averageOverall,
    positions: room.positions,
    priorityScore,
    room: room.room,
    rosterCount: players.length,
    starterCount,
    summaryLabel: `${room.room}: ${players.length}/${room.targetRosterCount} rostered | ${averageOverall} avg OVR`,
    targetRosterCount: room.targetRosterCount,
    weakestOverall,
  };
}

function createNeedByPosition(
  teamNeeds: readonly DynastyRecruitingTeamNeed[],
): ReadonlyMap<FootballPosition, DynastyRecruitingTeamNeed> {
  const needs = new Map<FootballPosition, DynastyRecruitingTeamNeed>();
  for (const need of teamNeeds) {
    for (const position of need.positions) {
      needs.set(position, need);
    }
  }
  return needs;
}

function createRecruitingTarget(
  prospect: DynastyRecruitingProspect,
  teamId: string,
  needByPosition: ReadonlyMap<FootballPosition, DynastyRecruitingTeamNeed>,
): (DynastyRecruitingAllocation & { readonly rankScore: number }) | null {
  const interest = prospect.interest.find((row) => row.teamId === teamId);
  const need = needByPosition.get(prospect.footballPosition);
  if (!interest || !need) {
    return null;
  }
  const pitchStyle = selectBestPitchStyle(interest.pitchFit);
  const rankScore = Math.round(
    prospect.overallGrade * 0.35 +
    interest.score * 0.4 +
    need.priorityScore * 0.25,
  );

  return {
    allocatedPoints: 0,
    needPriorityScore: need.priorityScore,
    pitchStyle,
    prospectId: prospect.id,
    prospectName: prospect.displayName,
    rankScore,
    room: need.room,
    totalFitScore: interest.score,
  };
}

function selectBestPitchStyle(
  pitchFit: DynastyRecruitingPitchFit,
): DynastyRecruitingPitchStyle {
  return DYNASTY_RECRUITING_PITCH_STYLES
    .map((style) => ({
      score: pitchFit[style],
      style,
    }))
    .sort((a, b) => b.score - a.score || a.style.localeCompare(b.style))[0]!.style;
}

function createPointSchedule(totalPoints: number, targetCount: number): number[] {
  if (targetCount <= 0) {
    return [];
  }
  const baseWeights = [28, 24, 20, 16, 12];
  const weights = baseWeights.slice(0, targetCount);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const preliminary = weights.map((weight) => Math.floor((weight / weightTotal) * totalPoints));
  let remainder = totalPoints - preliminary.reduce((sum, points) => sum + points, 0);
  for (let index = 0; remainder > 0; index = (index + 1) % preliminary.length) {
    preliminary[index] += 1;
    remainder -= 1;
  }
  return preliminary;
}

function createFitLabel(signingConfidence: number): string {
  if (signingConfidence >= 70) {
    return 'Strong fit';
  }
  if (signingConfidence >= 55) {
    return 'Good fit';
  }
  if (signingConfidence >= 40) {
    return 'Development fit';
  }
  return 'Long shot';
}

function validateRecruitingProspect(
  issues: DynastyRecruitingValidationIssue[],
  prospect: unknown,
  prospectIds: Set<string>,
  prospectRanks: Set<number>,
  teamIds: ReadonlySet<string>,
): void {
  if (!isRecord(prospect)) {
    issues.push(error('Dynasty recruiting prospect row is malformed'));
    return;
  }
  const prospectId = typeof prospect.id === 'string' ? prospect.id : '';
  if (!prospectId) {
    issues.push(error('Dynasty recruiting prospect is missing an id'));
  } else if (prospectIds.has(prospectId)) {
    issues.push(error(`Dynasty recruiting prospect duplicates ${prospectId}`));
  } else {
    prospectIds.add(prospectId);
  }
  if (
    typeof prospect.displayName !== 'string' ||
    prospect.displayName.length === 0 ||
    typeof prospect.firstName !== 'string' ||
    prospect.firstName.length === 0 ||
    typeof prospect.lastName !== 'string' ||
    prospect.lastName.length === 0
  ) {
    issues.push(error(`Dynasty recruiting prospect ${prospectId || 'unknown'} has invalid identity`));
  }
  if (!isFootballPosition(prospect.footballPosition)) {
    issues.push(error(`Dynasty recruiting prospect ${prospectId || 'unknown'} has invalid position ${String(prospect.footballPosition)}`));
  }
  if (!isPlayerArchetype(prospect.archetype)) {
    issues.push(error(`Dynasty recruiting prospect ${prospectId || 'unknown'} has invalid archetype ${String(prospect.archetype)}`));
  }
  if (!isBoundedInteger(prospect.overallGrade, 58, 91)) {
    issues.push(error(`Dynasty recruiting prospect ${prospectId || 'unknown'} has invalid overall grade`));
  }
  if (!isBoundedInteger(prospect.starRating, 1, 5)) {
    issues.push(error(`Dynasty recruiting prospect ${prospectId || 'unknown'} has invalid star rating`));
  }
  if (!Number.isInteger(prospect.nationalRank) || (prospect.nationalRank as number) < 1) {
    issues.push(error(`Dynasty recruiting prospect ${prospectId || 'unknown'} has invalid national rank`));
  } else if (prospectRanks.has(prospect.nationalRank as number)) {
    issues.push(error(`Dynasty recruiting prospect duplicates national rank ${String(prospect.nationalRank)}`));
  } else {
    prospectRanks.add(prospect.nationalRank as number);
  }
  if (!Array.isArray(prospect.interest)) {
    issues.push(error(`Dynasty recruiting prospect ${prospectId || 'unknown'} interest must be an array`));
    return;
  }
  const interestTeamIds = new Set<string>();
  for (const interest of prospect.interest) {
    validateRecruitingInterest(issues, interest, prospectId || 'unknown', interestTeamIds, teamIds);
  }
  for (const teamId of teamIds) {
    if (!interestTeamIds.has(teamId)) {
      issues.push(error(`Dynasty recruiting prospect ${prospectId || 'unknown'} is missing interest for ${teamId}`));
    }
  }
}

function validateRecruitingInterest(
  issues: DynastyRecruitingValidationIssue[],
  interest: unknown,
  prospectId: string,
  interestTeamIds: Set<string>,
  teamIds: ReadonlySet<string>,
): void {
  if (!isRecord(interest)) {
    issues.push(error(`Dynasty recruiting prospect ${prospectId} has malformed interest row`));
    return;
  }
  const teamId = typeof interest.teamId === 'string' ? interest.teamId : '';
  if (!teamIds.has(teamId)) {
    issues.push(error(`Dynasty recruiting prospect ${prospectId} has unknown interest team ${String(interest.teamId)}`));
  } else if (interestTeamIds.has(teamId)) {
    issues.push(error(`Dynasty recruiting prospect ${prospectId} duplicates interest team ${teamId}`));
  } else {
    interestTeamIds.add(teamId);
  }
  if (!isBoundedInteger(interest.score, 35, 95)) {
    issues.push(error(`Dynasty recruiting prospect ${prospectId} has invalid interest score`));
  }
  if (!isRecord(interest.pitchFit)) {
    issues.push(error(`Dynasty recruiting prospect ${prospectId} has malformed pitch fit`));
    return;
  }
  for (const style of DYNASTY_RECRUITING_PITCH_STYLES) {
    if (!isBoundedInteger(interest.pitchFit[style], 35, 95)) {
      issues.push(error(`Dynasty recruiting prospect ${prospectId} has invalid ${style} pitch fit`));
    }
  }
}

function error(message: string): DynastyRecruitingValidationIssue {
  return { message, severity: 'error' };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBoundedInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function isFootballPosition(value: unknown): value is FootballPosition {
  return typeof value === 'string' && PROSPECT_SLOTS.some((slot) => slot.footballPosition === value);
}

function isPlayerArchetype(value: unknown): value is PlayerArchetype {
  return typeof value === 'string' && PROSPECT_SLOTS.some((slot) => slot.archetype === value);
}

function gradeToStars(grade: number): number {
  if (grade >= 88) {
    return 5;
  }
  if (grade >= 78) {
    return 4;
  }
  if (grade >= 68) {
    return 3;
  }
  if (grade >= 60) {
    return 2;
  }
  return 1;
}

function pickIndex(seed: string, length: number): number {
  return hashString(seed) % length;
}

function hashToRange(seed: string, min: number, max: number): number {
  const span = max - min + 1;
  return min + (hashString(seed) % span);
}

function clampPriority(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function hashText(seed: string): string {
  return hashString(seed)
    .toString(36)
    .padStart(6, '0');
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
