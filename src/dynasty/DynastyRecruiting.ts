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

  return {
    pitchStyles: DYNASTY_RECRUITING_PITCH_STYLES,
    prospects,
    recruitingPlan: createDynastyWeeklyRecruitingPlan({
      prospects,
      save: options.save,
      teamId,
      teamNeeds,
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
