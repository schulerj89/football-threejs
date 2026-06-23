import type { TeamProfile } from './TeamProfile';
import {
  isHexColor,
  normalizeUniformPalette,
} from './UniformPalette';

export const DEFAULT_USER_TEAM_ID = 'metro-meteors';
export const DEFAULT_OPPONENT_TEAM_ID = 'lakefront-lights';

export const STARTER_TEAM_PROFILES: readonly TeamProfile[] = [
  {
    abbreviation: 'MET',
    awayUniform: {
      faceguard: '#f2f4f6',
      helmetShell: '#2f66d8',
      jersey: '#f2f4f6',
      number: '#2f66d8',
      pants: '#2f66d8',
      shoe: '#1c2228',
      shoulder: '#dfe8f5',
      socks: '#2f66d8',
      stripe: '#2f66d8',
    },
    colors: {
      accent: '#dfe8f5',
      primary: '#2f66d8',
      secondary: '#f2f4f6',
    },
    crowdAccentColor: '#2f66d8',
    displayName: 'Metro Meteors',
    endZoneColor: '#244b91',
    homeUniform: {
      faceguard: '#f2f4f6',
      helmetShell: '#2f66d8',
      jersey: '#2f66d8',
      number: '#f2f4f6',
      pants: '#f2f4f6',
      shoe: '#1c2228',
      shoulder: '#2f66d8',
      socks: '#2f66d8',
      stripe: '#dfe8f5',
    },
    id: DEFAULT_USER_TEAM_ID,
    identity: 'Balanced passing and mobile offense',
    logoAssetId: 'metro-meteors-logo',
    logoUrl: '/branding/teams/metro-meteors/logo.webp',
    rosterId: DEFAULT_USER_TEAM_ID,
    shortName: 'Meteors',
  },
  {
    abbreviation: 'LFL',
    awayUniform: {
      faceguard: '#f2f4f6',
      helmetShell: '#b83737',
      jersey: '#f2f4f6',
      number: '#b83737',
      pants: '#b83737',
      shoe: '#1c2228',
      shoulder: '#f2f4f6',
      socks: '#b83737',
      stripe: '#24282e',
    },
    colors: {
      accent: '#24282e',
      primary: '#b83737',
      secondary: '#f2f4f6',
    },
    crowdAccentColor: '#b83737',
    displayName: 'Lakefront Lights',
    endZoneColor: '#7b2f2f',
    homeUniform: {
      faceguard: '#f2f4f6',
      helmetShell: '#b83737',
      jersey: '#b83737',
      number: '#f2f4f6',
      pants: '#f2f4f6',
      shoe: '#1c2228',
      shoulder: '#b83737',
      socks: '#b83737',
      stripe: '#24282e',
    },
    id: DEFAULT_OPPONENT_TEAM_ID,
    identity: 'Accurate passing and disciplined coverage',
    logoAssetId: 'lakefront-lights-logo',
    logoUrl: '/branding/teams/lakefront-lights/logo.webp',
    rosterId: DEFAULT_OPPONENT_TEAM_ID,
    shortName: 'Lights',
  },
  {
    abbreviation: 'SUM',
    awayUniform: {
      faceguard: '#f4f2e8',
      helmetShell: '#285945',
      jersey: '#f4f2e8',
      number: '#285945',
      pants: '#285945',
      shoe: '#1b1f1d',
      shoulder: '#f4f2e8',
      socks: '#285945',
      stripe: '#d8b35f',
    },
    colors: {
      accent: '#d8b35f',
      primary: '#285945',
      secondary: '#f4f2e8',
    },
    crowdAccentColor: '#d8b35f',
    displayName: 'Summit Forge',
    endZoneColor: '#274b3d',
    homeUniform: {
      faceguard: '#f4f2e8',
      helmetShell: '#285945',
      jersey: '#285945',
      number: '#f4f2e8',
      pants: '#f4f2e8',
      shoe: '#1b1f1d',
      shoulder: '#285945',
      socks: '#285945',
      stripe: '#d8b35f',
    },
    id: 'summit-forge',
    identity: 'Power rushing and defensive pressure',
    logoAssetId: 'summit-forge-logo',
    logoUrl: '/branding/teams/summit-forge/logo.webp',
    rosterId: 'summit-forge',
    shortName: 'Forge',
  },
  {
    abbreviation: 'BAY',
    awayUniform: {
      faceguard: '#f4f7f2',
      helmetShell: '#1f6f7a',
      jersey: '#f4f7f2',
      number: '#1f6f7a',
      pants: '#1f6f7a',
      shoe: '#172127',
      shoulder: '#f4f7f2',
      socks: '#1f6f7a',
      stripe: '#e0a94d',
    },
    colors: {
      accent: '#e0a94d',
      primary: '#1f6f7a',
      secondary: '#f4f7f2',
    },
    crowdAccentColor: '#1f6f7a',
    displayName: 'Bay City Current',
    endZoneColor: '#215964',
    homeUniform: {
      faceguard: '#f4f7f2',
      helmetShell: '#1f6f7a',
      jersey: '#1f6f7a',
      number: '#f4f7f2',
      pants: '#f4f7f2',
      shoe: '#172127',
      shoulder: '#1f6f7a',
      socks: '#1f6f7a',
      stripe: '#e0a94d',
    },
    id: 'bay-city-current',
    identity: 'Speed, space, and athletic secondary play',
    logoAssetId: 'bay-city-current-logo',
    logoUrl: '/branding/teams/bay-city-current/logo.webp',
    rosterId: 'bay-city-current',
    shortName: 'Current',
  },
  {
    abbreviation: 'IWO',
    awayUniform: {
      faceguard: '#B86B3D',
      helmetShell: '#16233A',
      jersey: '#F1E7D0',
      number: '#16233A',
      pants: '#16233A',
      shoe: '#11151d',
      shoulder: '#F1E7D0',
      socks: '#16233A',
      stripe: '#B86B3D',
    },
    colors: {
      accent: '#B86B3D',
      primary: '#16233A',
      secondary: '#F1E7D0',
    },
    crowdAccentColor: '#B86B3D',
    displayName: 'Ironwood Owls',
    endZoneColor: '#16233A',
    homeUniform: {
      faceguard: '#B86B3D',
      helmetShell: '#16233A',
      jersey: '#16233A',
      number: '#F1E7D0',
      pants: '#F1E7D0',
      shoe: '#11151d',
      shoulder: '#16233A',
      socks: '#16233A',
      stripe: '#B86B3D',
    },
    id: 'ironwood-owls',
    identity: 'Strong line play and intelligent defense',
    logoAssetId: 'ironwood-owls-logo',
    logoUrl: '/branding/teams/ironwood-owls/logo.webp',
    rosterId: 'ironwood-owls',
    shortName: 'Owls',
  },
  {
    abbreviation: 'DRS',
    awayUniform: {
      faceguard: '#D5A849',
      helmetShell: '#472A69',
      jersey: '#E9DFC5',
      number: '#472A69',
      pants: '#472A69',
      shoe: '#18121e',
      shoulder: '#E9DFC5',
      socks: '#472A69',
      stripe: '#D5A849',
    },
    colors: {
      accent: '#D5A849',
      primary: '#472A69',
      secondary: '#E9DFC5',
    },
    crowdAccentColor: '#D5A849',
    displayName: 'Desert Ridge Scorpions',
    endZoneColor: '#472A69',
    homeUniform: {
      faceguard: '#D5A849',
      helmetShell: '#472A69',
      jersey: '#472A69',
      number: '#E9DFC5',
      pants: '#E9DFC5',
      shoe: '#18121e',
      shoulder: '#472A69',
      socks: '#472A69',
      stripe: '#D5A849',
    },
    id: 'desert-ridge-scorpions',
    identity: 'Explosive deep passing and aggressive edge defense',
    logoAssetId: 'desert-ridge-scorpions-logo',
    logoUrl: '/branding/teams/desert-ridge-scorpions/logo.webp',
    rosterId: 'desert-ridge-scorpions',
    shortName: 'Scorpions',
  },
] as const;

const PROFILES_BY_ID = new Map(STARTER_TEAM_PROFILES.map((profile) => [profile.id, profile]));

export function listTeamProfiles(): TeamProfile[] {
  return STARTER_TEAM_PROFILES.map(cloneTeamProfile);
}

export function getTeamProfile(id: string): TeamProfile | null {
  const profile = PROFILES_BY_ID.get(id);

  return profile ? cloneTeamProfile(profile) : null;
}

export function getTeamProfileOrDefault(id: string, fallbackId = DEFAULT_USER_TEAM_ID): TeamProfile {
  return getTeamProfile(id) ?? getTeamProfile(fallbackId) ?? cloneTeamProfile(STARTER_TEAM_PROFILES[0]);
}

export function isTeamProfileId(value: unknown): value is string {
  return typeof value === 'string' && PROFILES_BY_ID.has(value);
}

export function validateTeamProfile(profile: TeamProfile): string[] {
  const issues: string[] = [];
  const requiredText = [
    ['id', profile.id],
    ['displayName', profile.displayName],
    ['shortName', profile.shortName],
    ['abbreviation', profile.abbreviation],
    ['identity', profile.identity],
    ['logoAssetId', profile.logoAssetId],
    ['logoUrl', profile.logoUrl],
    ['rosterId', profile.rosterId ?? ''],
  ] as const;

  for (const [key, value] of requiredText) {
    if (!value.trim()) {
      issues.push(`${profile.id || 'team'}:${key}`);
    }
  }

  for (const [key, value] of Object.entries(profile.colors)) {
    if (!isHexColor(value)) {
      issues.push(`${profile.id}:colors.${key}`);
    }
  }

  for (const key of ['endZoneColor', 'crowdAccentColor'] as const) {
    if (!isHexColor(profile[key])) {
      issues.push(`${profile.id}:${key}`);
    }
  }

  for (const [uniformName, uniform] of [
    ['homeUniform', profile.homeUniform],
    ['awayUniform', profile.awayUniform],
  ] as const) {
    for (const [key, value] of Object.entries(uniform)) {
      if (!isHexColor(value)) {
        issues.push(`${profile.id}:${uniformName}.${key}`);
      }
    }
  }

  if (profile.logoUrl !== `/branding/teams/${profile.id}/logo.webp`) {
    issues.push(`${profile.id}:logoUrl`);
  }

  return issues;
}

export function cloneTeamProfile(profile: TeamProfile): TeamProfile {
  return {
    ...profile,
    awayUniform: normalizeUniformPalette(profile.awayUniform, profile.awayUniform),
    colors: { ...profile.colors },
    homeUniform: normalizeUniformPalette(profile.homeUniform, profile.homeUniform),
  };
}
