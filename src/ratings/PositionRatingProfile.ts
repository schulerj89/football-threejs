import type { FootballPosition } from '../roster/RosterPlayer';
import type { PlayerAttributeKey } from './PlayerAttribute';

export interface PositionRatingProfile {
  readonly optional: readonly PlayerAttributeKey[];
  readonly overallWeights: Readonly<Partial<Record<PlayerAttributeKey, number>>>;
  readonly position: FootballPosition;
  readonly required: readonly PlayerAttributeKey[];
}

const UNIVERSAL_ATTRIBUTES = ['AWR', 'SPD', 'ACC', 'AGI', 'STR', 'STA'] as const satisfies readonly PlayerAttributeKey[];

const OFFENSIVE_LINE_WEIGHTS = {
  AWR: 0.16,
  PBK: 0.28,
  RBK: 0.28,
  STA: 0.08,
  STR: 0.2,
} as const satisfies Partial<Record<PlayerAttributeKey, number>>;

const DEFENSIVE_BACK_WEIGHTS = {
  AGI: 0.14,
  MCV: 0.22,
  PRC: 0.16,
  SPD: 0.18,
  TAK: 0.1,
  ZCV: 0.2,
} as const satisfies Partial<Record<PlayerAttributeKey, number>>;

const LINEBACKER_WEIGHTS = {
  BSH: 0.15,
  MCV: 0.08,
  PRC: 0.16,
  PUR: 0.18,
  SPD: 0.12,
  TAK: 0.22,
  ZCV: 0.09,
} as const satisfies Partial<Record<PlayerAttributeKey, number>>;

export const POSITION_RATING_PROFILES: Readonly<Record<FootballPosition, PositionRatingProfile>> = {
  C: offensiveLineProfile('C'),
  CB: {
    optional: ['CTH', 'STA'],
    overallWeights: DEFENSIVE_BACK_WEIGHTS,
    position: 'CB',
    required: [...UNIVERSAL_ATTRIBUTES, 'TAK', 'PRC', 'MCV', 'ZCV'],
  },
  DL: {
    optional: ['ACC', 'AGI', 'AWR', 'FMV', 'SPD', 'STA'],
    overallWeights: {
      BSH: 0.22,
      FMV: 0.12,
      PMV: 0.16,
      PUR: 0.12,
      STR: 0.2,
      TAK: 0.18,
    },
    position: 'DL',
    required: [...UNIVERSAL_ATTRIBUTES, 'TAK', 'PUR', 'BSH', 'PMV', 'FMV'],
  },
  FS: {
    optional: ['CTH', 'STA'],
    overallWeights: DEFENSIVE_BACK_WEIGHTS,
    position: 'FS',
    required: [...UNIVERSAL_ATTRIBUTES, 'TAK', 'PRC', 'MCV', 'ZCV'],
  },
  ILB: {
    optional: ['AGI', 'FMV', 'PMV', 'STA'],
    overallWeights: LINEBACKER_WEIGHTS,
    position: 'ILB',
    required: [...UNIVERSAL_ATTRIBUTES, 'TAK', 'PUR', 'BSH', 'PRC', 'MCV', 'ZCV'],
  },
  K: kickingProfile('K'),
  LG: offensiveLineProfile('LG'),
  LS: {
    optional: ['ACC', 'AGI', 'KAC', 'KPW', 'SPD'],
    overallWeights: {
      AWR: 0.22,
      PBK: 0.18,
      RBK: 0.2,
      STA: 0.08,
      STR: 0.32,
    },
    position: 'LS',
    required: [...UNIVERSAL_ATTRIBUTES, 'PBK', 'RBK'],
  },
  LT: offensiveLineProfile('LT'),
  OLB: {
    optional: ['AGI', 'STA'],
    overallWeights: LINEBACKER_WEIGHTS,
    position: 'OLB',
    required: [...UNIVERSAL_ATTRIBUTES, 'TAK', 'PUR', 'BSH', 'PRC', 'PMV', 'FMV', 'MCV', 'ZCV'],
  },
  P: kickingProfile('P'),
  QB: {
    optional: ['AGI', 'BCV', 'CAR', 'COD', 'STA'],
    overallWeights: {
      ACC: 0.08,
      AWR: 0.18,
      SPD: 0.08,
      THA: 0.42,
      THP: 0.24,
    },
    position: 'QB',
    required: [...UNIVERSAL_ATTRIBUTES, 'THP', 'THA'],
  },
  RB: {
    optional: ['AWR', 'CTH', 'RTE', 'STA', 'STR'],
    overallWeights: {
      ACC: 0.16,
      BCV: 0.18,
      BTK: 0.16,
      CAR: 0.18,
      COD: 0.14,
      SPD: 0.18,
    },
    position: 'RB',
    required: [...UNIVERSAL_ATTRIBUTES, 'CAR', 'BCV', 'COD', 'BTK'],
  },
  RG: offensiveLineProfile('RG'),
  RT: offensiveLineProfile('RT'),
  SLOT: receiverProfile('SLOT'),
  SS: {
    optional: ['BSH', 'CTH', 'STA'],
    overallWeights: {
      AGI: 0.12,
      MCV: 0.18,
      PRC: 0.16,
      SPD: 0.14,
      TAK: 0.18,
      ZCV: 0.22,
    },
    position: 'SS',
    required: [...UNIVERSAL_ATTRIBUTES, 'TAK', 'PRC', 'MCV', 'ZCV'],
  },
  TE: {
    optional: ['AGI', 'BCV', 'BTK', 'CAR', 'COD', 'STA'],
    overallWeights: {
      CIT: 0.16,
      CTH: 0.18,
      PBK: 0.12,
      RBK: 0.16,
      RTE: 0.16,
      SPD: 0.1,
      STR: 0.12,
    },
    position: 'TE',
    required: [...UNIVERSAL_ATTRIBUTES, 'CTH', 'RTE', 'CIT', 'PBK', 'RBK'],
  },
  WR: receiverProfile('WR'),
} as const;

export function getPositionRatingProfile(position: FootballPosition): PositionRatingProfile {
  return POSITION_RATING_PROFILES[position];
}

export function getOverallWeightTotal(position: FootballPosition): number {
  return Object.values(getPositionRatingProfile(position).overallWeights)
    .reduce((sum, weight) => sum + (weight ?? 0), 0);
}

function offensiveLineProfile(position: 'C' | 'LG' | 'LT' | 'RG' | 'RT'): PositionRatingProfile {
  return {
    optional: ['ACC', 'AGI', 'SPD', 'STA'],
    overallWeights: OFFENSIVE_LINE_WEIGHTS,
    position,
    required: [...UNIVERSAL_ATTRIBUTES, 'PBK', 'RBK'],
  };
}

function receiverProfile(position: 'SLOT' | 'WR'): PositionRatingProfile {
  return {
    optional: ['BCV', 'BTK', 'CAR', 'STA'],
    overallWeights: {
      ACC: 0.16,
      AGI: 0.14,
      CIT: 0.16,
      CTH: 0.2,
      RTE: 0.2,
      SPD: 0.14,
    },
    position,
    required: [...UNIVERSAL_ATTRIBUTES, 'CTH', 'RTE', 'CIT'],
  };
}

function kickingProfile(position: 'K' | 'P'): PositionRatingProfile {
  return {
    optional: ['ACC', 'AGI', 'SPD', 'STA'],
    overallWeights: {
      AWR: 0.14,
      KAC: 0.38,
      KPW: 0.48,
    },
    position,
    required: ['AWR', 'KPW', 'KAC'],
  };
}
