import type { FootballPosition, PlayerArchetype } from '../roster/RosterPlayer';
import type { DynastySaveData } from './DynastyTypes';

export const DYNASTY_RECRUITING_PROSPECT_COUNT = 18;

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
  readonly summaryLabel: string;
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
}): DynastyRecruitingBoard {
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
    summaryLabel: `${prospects.length} fictional prospects | deterministic board`,
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
