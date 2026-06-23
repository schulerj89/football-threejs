import type { FootballPosition } from '../roster/RosterPlayer';
import type { PlayerAttributeKey } from './PlayerAttribute';

export interface TeamStyleProfile {
  readonly attributeBiases: Readonly<Partial<Record<PlayerAttributeKey, number>>>;
  readonly description: string;
  readonly positionBiases: Readonly<Partial<Record<FootballPosition, number>>>;
  readonly teamId: string;
}

const DEFAULT_TEAM_STYLE_PROFILE: TeamStyleProfile = {
  attributeBiases: {},
  description: 'balanced prototype profile',
  positionBiases: {},
  teamId: 'default',
};

export const TEAM_STYLE_PROFILES: Readonly<Record<string, TeamStyleProfile>> = {
  'bay-city-current': {
    attributeBiases: {
      ACC: 5,
      AGI: 5,
      MCV: 4,
      RTE: 5,
      SPD: 6,
      ZCV: 3,
    },
    description: 'speed, agility, route running, and defensive-back athleticism',
    positionBiases: {
      CB: 3,
      FS: 2,
      SLOT: 3,
      WR: 3,
    },
    teamId: 'bay-city-current',
  },
  'desert-ridge-scorpions': {
    attributeBiases: {
      AWR: -4,
      FMV: 6,
      PRC: -2,
      SPD: 4,
      THP: 8,
    },
    description: 'throw power, receiver speed, and finesse rush with lower consistency',
    positionBiases: {
      DL: 2,
      OLB: 3,
      QB: 3,
      WR: 3,
    },
    teamId: 'desert-ridge-scorpions',
  },
  'ironwood-owls': {
    attributeBiases: {
      AWR: 5,
      BSH: 5,
      PBK: 4,
      RBK: 5,
      TAK: 5,
      STR: 3,
    },
    description: 'blocking, awareness, tackling, and run defense',
    positionBiases: {
      C: 3,
      DL: 3,
      ILB: 3,
      LG: 3,
      LT: 2,
      RG: 3,
      RT: 2,
    },
    teamId: 'ironwood-owls',
  },
  'lakefront-lights': {
    attributeBiases: {
      AWR: 6,
      MCV: 4,
      PRC: 5,
      THA: 7,
      ZCV: 4,
    },
    description: 'accuracy, awareness, and coverage',
    positionBiases: {
      CB: 3,
      FS: 3,
      QB: 3,
      SS: 2,
    },
    teamId: 'lakefront-lights',
  },
  'metro-meteors': {
    attributeBiases: {
      ACC: 3,
      SPD: 3,
      THA: 3,
      THP: 5,
    },
    description: 'balanced passing and mobile quarterback play',
    positionBiases: {
      QB: 3,
      RB: 2,
      SLOT: 2,
    },
    teamId: 'metro-meteors',
  },
  'summit-forge': {
    attributeBiases: {
      BSH: 5,
      BTK: 5,
      RBK: 7,
      STR: 6,
    },
    description: 'strength, run blocking, power rushing, and block shedding',
    positionBiases: {
      C: 2,
      DL: 4,
      LG: 3,
      RG: 3,
      RB: 4,
      TE: 2,
    },
    teamId: 'summit-forge',
  },
} as const;

export function getTeamStyleProfile(teamId: string): TeamStyleProfile {
  return TEAM_STYLE_PROFILES[teamId] ?? {
    ...DEFAULT_TEAM_STYLE_PROFILE,
    teamId,
  };
}

export function listTeamStyleProfiles(): readonly TeamStyleProfile[] {
  return Object.values(TEAM_STYLE_PROFILES);
}
