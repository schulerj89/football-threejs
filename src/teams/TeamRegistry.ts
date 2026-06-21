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
      faceguard: '#f3f5f8',
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
      faceguard: '#f3f5f8',
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
    shortName: 'Meteors',
  },
  {
    abbreviation: 'LFL',
    awayUniform: {
      faceguard: '#24282e',
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
      faceguard: '#24282e',
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
    shortName: 'Lights',
  },
  {
    abbreviation: 'SUM',
    awayUniform: {
      faceguard: '#1c2420',
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
      faceguard: '#1c2420',
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
    shortName: 'Forge',
  },
  {
    abbreviation: 'BAY',
    awayUniform: {
      faceguard: '#20323d',
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
      faceguard: '#20323d',
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
    shortName: 'Current',
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
