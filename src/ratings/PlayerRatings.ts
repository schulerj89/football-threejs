import type { KickerRatings } from '../specialTeams/KickerRatings';
import type { FootballPosition, PlayerArchetype } from '../roster/RosterPlayer';
import {
  PLAYER_ATTRIBUTE_KEYS,
  isPlayerAttributeKey,
  type PlayerAttributeKey,
} from './PlayerAttribute';
import { getPositionRatingProfile } from './PositionRatingProfile';
import { getTeamStyleProfile } from './TeamStyleProfile';

export type PlayerRatings = Readonly<Partial<Record<PlayerAttributeKey, number>>>;

export interface DeterministicPlayerRatingOptions {
  readonly archetype: PlayerArchetype;
  readonly kickerRatings?: KickerRatings;
  readonly playerId: string;
  readonly position: FootballPosition;
  readonly teamId: string;
}

const DEFAULT_BASE_BY_POSITION: Readonly<Record<FootballPosition, number>> = {
  C: 74,
  CB: 73,
  DL: 75,
  FS: 74,
  ILB: 74,
  K: 76,
  LG: 74,
  LS: 70,
  LT: 75,
  OLB: 74,
  P: 75,
  QB: 75,
  RB: 75,
  RG: 74,
  RT: 74,
  SLOT: 74,
  SS: 74,
  TE: 74,
  WR: 74,
};

const ARCHETYPE_ATTRIBUTE_BIASES: Readonly<Record<PlayerArchetype, Partial<Record<PlayerAttributeKey, number>>>> = {
  accuratePasser: { AWR: 4, THA: 8, THP: -1 },
  balancedReceiver: { ACC: 2, AGI: 2, CIT: 2, CTH: 4, RTE: 4, SPD: 2 },
  coverageSpecialist: { AWR: 2, MCV: 5, PRC: 5, PUR: 2, ZCV: 5 },
  edgeRusher: { ACC: 2, BSH: 3, FMV: 5, PMV: 4, PUR: 3, SPD: 2 },
  fieldGeneral: { AWR: 8, THA: 4, THP: 2 },
  interiorAnchor: { AWR: 2, BSH: 3, PBK: 4, RBK: 5, STR: 6 },
  powerRunner: { BCV: 3, BTK: 6, CAR: 4, STR: 4 },
  specialist: { AWR: 3, KAC: 4, KPW: 4 },
  utility: { ACC: 2, AGI: 2, AWR: 1, SPD: 2, STA: 3 },
};

const POSITION_ATTRIBUTE_BIASES: Readonly<Record<FootballPosition, Partial<Record<PlayerAttributeKey, number>>>> = {
  C: { ACC: -8, AGI: -8, PBK: 5, RBK: 5, SPD: -12, STR: 8 },
  CB: { AGI: 5, BSH: -7, MCV: 5, SPD: 5, STR: -5, ZCV: 4 },
  DL: { ACC: -2, AGI: -6, BSH: 5, PMV: 3, SPD: -5, STR: 8 },
  FS: { AGI: 4, MCV: 3, SPD: 4, STR: -3, ZCV: 5 },
  ILB: { BSH: 3, MCV: -1, PRC: 3, STR: 3, TAK: 5, ZCV: 2 },
  K: { ACC: -12, AGI: -10, KAC: 7, KPW: 7, SPD: -14, STR: -6 },
  LG: { ACC: -8, AGI: -8, PBK: 5, RBK: 6, SPD: -12, STR: 8 },
  LS: { ACC: -9, AGI: -7, AWR: 3, PBK: 2, RBK: 2, SPD: -12, STR: 5 },
  LT: { ACC: -7, AGI: -7, PBK: 7, RBK: 4, SPD: -10, STR: 7 },
  OLB: { ACC: 2, BSH: 3, FMV: 3, PUR: 4, SPD: 2, TAK: 3 },
  P: { ACC: -12, AGI: -10, KAC: 5, KPW: 9, SPD: -14, STR: -6 },
  QB: { ACC: -1, AGI: -1, STR: -2, THA: 5, THP: 5 },
  RB: { ACC: 5, AGI: 4, BCV: 5, BTK: 3, CAR: 5, COD: 5, SPD: 4 },
  RG: { ACC: -8, AGI: -8, PBK: 4, RBK: 6, SPD: -12, STR: 8 },
  RT: { ACC: -7, AGI: -7, PBK: 5, RBK: 5, SPD: -10, STR: 7 },
  SLOT: { ACC: 5, AGI: 6, CIT: 2, CTH: 3, RTE: 5, SPD: 4, STR: -4 },
  SS: { BSH: 1, MCV: 2, PRC: 3, STR: 1, TAK: 5, ZCV: 4 },
  TE: { ACC: -2, CIT: 5, CTH: 3, PBK: 2, RBK: 4, RTE: 3, SPD: -1, STR: 5 },
  WR: { ACC: 5, AGI: 4, CIT: 3, CTH: 5, RTE: 5, SPD: 5, STR: -4 },
};

const LOW_RELEVANCE_DEFAULTS: Readonly<Partial<Record<PlayerAttributeKey, number>>> = {
  BSH: 42,
  BTK: 50,
  CAR: 55,
  CIT: 48,
  CTH: 48,
  FMV: 42,
  KAC: 35,
  KPW: 40,
  MCV: 44,
  PBK: 45,
  PMV: 44,
  RBK: 45,
  RTE: 48,
  THA: 35,
  THP: 45,
  ZCV: 44,
};

export function createDeterministicPlayerRatings(options: DeterministicPlayerRatingOptions): PlayerRatings {
  const profile = getPositionRatingProfile(options.position);
  const teamStyle = getTeamStyleProfile(options.teamId);
  const base = DEFAULT_BASE_BY_POSITION[options.position] +
    (teamStyle.positionBiases[options.position] ?? 0);
  const includedKeys = new Set<PlayerAttributeKey>([
    ...profile.required,
    ...profile.optional,
    ...Object.keys(profile.overallWeights).filter(isPlayerAttributeKey),
  ]);
  const ratings: Partial<Record<PlayerAttributeKey, number>> = {};

  for (const key of includedKeys) {
    const variation = deterministicVariation(`${options.playerId}:${key}`, 7);
    const value = base +
      variation +
      (POSITION_ATTRIBUTE_BIASES[options.position][key] ?? 0) +
      (ARCHETYPE_ATTRIBUTE_BIASES[options.archetype][key] ?? 0) +
      (teamStyle.attributeBiases[key] ?? 0);
    ratings[key] = clampRating(value);
  }

  applySpecialCaseRatings(ratings, options);

  return sortRatings(ratings);
}

export function clonePlayerRatings(ratings: PlayerRatings): PlayerRatings {
  return sortRatings({ ...ratings });
}

export function serializePlayerRatings(ratings: PlayerRatings): string {
  return PLAYER_ATTRIBUTE_KEYS
    .filter((key) => ratings[key] !== undefined)
    .map((key) => `${key}:${ratings[key]}`)
    .join('|');
}

function applySpecialCaseRatings(
  ratings: Partial<Record<PlayerAttributeKey, number>>,
  options: DeterministicPlayerRatingOptions,
): void {
  if (options.kickerRatings && (options.position === 'K' || options.position === 'P')) {
    ratings.KPW = clampRating(options.kickerRatings.kickPower);
    ratings.KAC = clampRating(options.kickerRatings.kickAccuracy);
  }

  if (options.position === 'LS') {
    ratings.AWR = clampRating((ratings.AWR ?? 70) + 3);
    ratings.PBK = clampRating(ratings.PBK ?? 70);
    ratings.RBK = clampRating(ratings.RBK ?? 70);
  }

  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    if (ratings[key] !== undefined) {
      continue;
    }
    const lowDefault = LOW_RELEVANCE_DEFAULTS[key];
    if (lowDefault !== undefined) {
      ratings[key] = clampRating(lowDefault + deterministicVariation(`${options.playerId}:low:${key}`, 4));
    }
  }
}

function sortRatings(ratings: Partial<Record<PlayerAttributeKey, number>>): PlayerRatings {
  const sorted: Partial<Record<PlayerAttributeKey, number>> = {};

  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    const value = ratings[key];
    if (value !== undefined) {
      sorted[key] = clampRating(value);
    }
  }

  return Object.freeze(sorted);
}

function deterministicVariation(seed: string, spread: number): number {
  const range = spread * 2 + 1;
  return (hashString(seed) % range) - spread;
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function clampRating(value: number): number {
  return Math.max(0, Math.min(99, Math.round(value)));
}
