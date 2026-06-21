import {
  DEFAULT_OPPONENT_TEAM_ID,
  DEFAULT_USER_TEAM_ID,
  getTeamProfileOrDefault,
  isTeamProfileId,
} from './TeamRegistry';
import type { TeamColorOverrides, TeamProfile } from './TeamProfile';
import {
  normalizeHexColor,
  normalizeUniformPalette,
  type UniformVariant,
} from './UniformPalette';

export interface TeamProfileSettings {
  customProfiles: Record<string, TeamColorOverrides>;
  opponentTeamId: string;
  opponentUniform: UniformVariant;
  userTeamId: string;
  userUniform: UniformVariant;
}

export const DEFAULT_TEAM_PROFILE_SETTINGS: TeamProfileSettings = {
  customProfiles: {},
  opponentTeamId: DEFAULT_OPPONENT_TEAM_ID,
  opponentUniform: 'away',
  userTeamId: DEFAULT_USER_TEAM_ID,
  userUniform: 'home',
};

export function normalizeTeamProfileSettings(value: unknown): TeamProfileSettings {
  if (!isRecord(value)) {
    return cloneTeamProfileSettings(DEFAULT_TEAM_PROFILE_SETTINGS);
  }

  return {
    customProfiles: normalizeCustomProfiles(value.customProfiles),
    opponentTeamId: isTeamProfileId(value.opponentTeamId)
      ? value.opponentTeamId
      : DEFAULT_OPPONENT_TEAM_ID,
    opponentUniform: normalizeUniformVariant(value.opponentUniform, 'away'),
    userTeamId: isTeamProfileId(value.userTeamId)
      ? value.userTeamId
      : DEFAULT_USER_TEAM_ID,
    userUniform: normalizeUniformVariant(value.userUniform, 'home'),
  };
}

export function cloneTeamProfileSettings(settings: TeamProfileSettings): TeamProfileSettings {
  return {
    customProfiles: Object.fromEntries(
      Object.entries(settings.customProfiles).map(([teamId, overrides]) => [
        teamId,
        { ...overrides },
      ]),
    ),
    opponentTeamId: settings.opponentTeamId,
    opponentUniform: settings.opponentUniform,
    userTeamId: settings.userTeamId,
    userUniform: settings.userUniform,
  };
}

export function resolveCustomizedTeamProfile(
  teamId: string,
  settings: TeamProfileSettings,
): TeamProfile {
  const baseProfile = getTeamProfileOrDefault(teamId);
  const overrides = settings.customProfiles[baseProfile.id];

  if (!overrides) {
    return baseProfile;
  }

  const primary = normalizeHexColor(overrides.primary, baseProfile.colors.primary);
  const secondary = normalizeHexColor(overrides.secondary, baseProfile.colors.secondary);
  const helmetShell = normalizeHexColor(overrides.helmetShell, baseProfile.homeUniform.helmetShell);
  const pants = normalizeHexColor(overrides.pants, baseProfile.homeUniform.pants);
  const faceguard = normalizeHexColor(overrides.faceguard, baseProfile.homeUniform.faceguard);

  return {
    ...baseProfile,
    awayUniform: normalizeUniformPalette(
      {
        ...baseProfile.awayUniform,
        faceguard,
        helmetShell,
        jersey: secondary,
        pants,
        shoulder: secondary,
        stripe: primary,
      },
      baseProfile.awayUniform,
    ),
    colors: {
      ...baseProfile.colors,
      primary,
      secondary,
    },
    crowdAccentColor: primary,
    endZoneColor: primary,
    homeUniform: normalizeUniformPalette(
      {
        ...baseProfile.homeUniform,
        faceguard,
        helmetShell,
        jersey: primary,
        pants,
        shoulder: primary,
        stripe: secondary,
      },
      baseProfile.homeUniform,
    ),
  };
}

export function updateTeamColorOverride(
  settings: TeamProfileSettings,
  teamId: string,
  patch: Partial<TeamColorOverrides>,
): TeamProfileSettings {
  const normalized = normalizeTeamProfileSettings(settings);
  const baseProfile = getTeamProfileOrDefault(teamId);
  const existing = normalized.customProfiles[baseProfile.id] ?? {};
  const fallbackOverrides: Required<TeamColorOverrides> = {
    faceguard: baseProfile.homeUniform.faceguard,
    helmetShell: baseProfile.homeUniform.helmetShell,
    pants: baseProfile.homeUniform.pants,
    primary: baseProfile.colors.primary,
    secondary: baseProfile.colors.secondary,
  };
  const nextOverrides: TeamColorOverrides = { ...existing };

  for (const key of Object.keys(patch) as Array<keyof TeamColorOverrides>) {
    const value = patch[key];

    if (value === undefined) {
      continue;
    }

    nextOverrides[key] = normalizeHexColor(value, fallbackOverrides[key]);
  }

  return {
    ...normalized,
    customProfiles: {
      ...normalized.customProfiles,
      [baseProfile.id]: nextOverrides,
    },
  };
}

export function resetTeamColorOverrides(
  settings: TeamProfileSettings,
  teamId: string,
): TeamProfileSettings {
  const normalized = normalizeTeamProfileSettings(settings);
  const customProfiles = { ...normalized.customProfiles };
  delete customProfiles[teamId];

  return {
    ...normalized,
    customProfiles,
  };
}

function normalizeCustomProfiles(value: unknown): Record<string, TeamColorOverrides> {
  if (!isRecord(value)) {
    return {};
  }

  const normalized: Record<string, TeamColorOverrides> = {};

  for (const [teamId, overrides] of Object.entries(value)) {
    if (!isTeamProfileId(teamId) || !isRecord(overrides)) {
      continue;
    }

    const baseProfile = getTeamProfileOrDefault(teamId);
    normalized[teamId] = {
      faceguard: normalizeHexColor(overrides.faceguard, baseProfile.homeUniform.faceguard),
      helmetShell: normalizeHexColor(overrides.helmetShell, baseProfile.homeUniform.helmetShell),
      pants: normalizeHexColor(overrides.pants, baseProfile.homeUniform.pants),
      primary: normalizeHexColor(overrides.primary, baseProfile.colors.primary),
      secondary: normalizeHexColor(overrides.secondary, baseProfile.colors.secondary),
    };
  }

  return normalized;
}

function normalizeUniformVariant(value: unknown, fallback: UniformVariant): UniformVariant {
  return value === 'away' || value === 'home' ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
