import {
  DEFAULT_TEAM_PROFILE_SETTINGS,
  cloneTeamProfileSettings,
  normalizeTeamProfileSettings,
  type TeamProfileSettings,
} from '../teams/TeamProfileStore';
import {
  calculateHexColorDistance,
  resolveTeamPresentationTheme,
} from '../teams/TeamThemeApplier';
import type { UniformVariant } from '../teams/UniformPalette';

export interface MatchSetupSelection {
  teamProfiles: TeamProfileSettings;
}

export interface MatchupSelection {
  opponentTeamId: string;
  opponentUniform: UniformVariant;
  userTeamId: string;
  userUniform: UniformVariant;
}

export interface MatchSetupValidation {
  canConfirm: boolean;
  uniformConflict: boolean;
  issues: string[];
}

const UNIFORM_CONFLICT_THRESHOLD = 92;

export function createMatchSetupSelection(
  settings: TeamProfileSettings = DEFAULT_TEAM_PROFILE_SETTINGS,
): MatchSetupSelection {
  return {
    teamProfiles: createTeamProfileSettingsFromMatchupSelection(
      createMatchupSelection(settings),
      settings,
    ),
  };
}

export function createMatchupSelection(
  settings: TeamProfileSettings = DEFAULT_TEAM_PROFILE_SETTINGS,
): MatchupSelection {
  const teamProfiles = normalizeTeamProfileSettings(settings);
  return {
    opponentTeamId: teamProfiles.opponentTeamId,
    opponentUniform: teamProfiles.opponentUniform,
    userTeamId: teamProfiles.userTeamId,
    userUniform: teamProfiles.userUniform,
  };
}

export function createTeamProfileSettingsFromMatchupSelection(
  selection: MatchupSelection,
  baseSettings: TeamProfileSettings = DEFAULT_TEAM_PROFILE_SETTINGS,
): TeamProfileSettings {
  return normalizeTeamProfileSettings({
    ...baseSettings,
    opponentTeamId: selection.opponentTeamId,
    opponentUniform: selection.opponentUniform,
    userTeamId: selection.userTeamId,
    userUniform: selection.userUniform,
  });
}

export function createMatchSetupSelectionFromMatchupSelection(
  selection: MatchupSelection,
  baseSettings: TeamProfileSettings = DEFAULT_TEAM_PROFILE_SETTINGS,
): MatchSetupSelection {
  return {
    teamProfiles: createTeamProfileSettingsFromMatchupSelection(selection, baseSettings),
  };
}

export function cloneMatchSetupSelection(
  selection: MatchSetupSelection,
): MatchSetupSelection {
  return {
    teamProfiles: cloneTeamProfileSettings(selection.teamProfiles),
  };
}

export function validateMatchSetupSelection(
  selection: MatchSetupSelection,
): MatchSetupValidation {
  const teamProfiles = normalizeTeamProfileSettings(selection.teamProfiles);
  const issues: string[] = [];

  if (teamProfiles.userTeamId === teamProfiles.opponentTeamId) {
    issues.push('Choose two different teams.');
  }

  const uniformConflict = hasUniformConflict(teamProfiles);
  if (uniformConflict) {
    issues.push('Uniforms are visually similar.');
  }

  return {
    canConfirm: issues.length === 0,
    issues,
    uniformConflict,
  };
}

export function validateMatchupSelection(selection: MatchupSelection): MatchSetupValidation {
  return validateMatchSetupSelection(createMatchSetupSelectionFromMatchupSelection(selection));
}

export function updateMatchupTeam(
  selection: MatchupSelection,
  side: 'opponent' | 'user',
  teamId: string,
  baseSettings: TeamProfileSettings = DEFAULT_TEAM_PROFILE_SETTINGS,
): MatchupSelection {
  return createMatchupSelection(createTeamProfileSettingsFromMatchupSelection({
    ...selection,
    [side === 'user' ? 'userTeamId' : 'opponentTeamId']: teamId,
  }, baseSettings));
}

export function updateMatchupUniform(
  selection: MatchupSelection,
  side: 'opponent' | 'user',
  uniform: UniformVariant,
  baseSettings: TeamProfileSettings = DEFAULT_TEAM_PROFILE_SETTINGS,
): MatchupSelection {
  return createMatchupSelection(createTeamProfileSettingsFromMatchupSelection({
    ...selection,
    [side === 'user' ? 'userUniform' : 'opponentUniform']: uniform,
  }, baseSettings));
}

export function updateMatchSetupTeam(
  selection: MatchSetupSelection,
  side: 'opponent' | 'user',
  teamId: string,
): MatchSetupSelection {
  const teamProfiles = normalizeTeamProfileSettings(selection.teamProfiles);
  return {
    teamProfiles: normalizeTeamProfileSettings({
      ...teamProfiles,
      [side === 'user' ? 'userTeamId' : 'opponentTeamId']: teamId,
    }),
  };
}

export function updateMatchSetupUniform(
  selection: MatchSetupSelection,
  side: 'opponent' | 'user',
  uniform: UniformVariant,
): MatchSetupSelection {
  const teamProfiles = normalizeTeamProfileSettings(selection.teamProfiles);
  return {
    teamProfiles: normalizeTeamProfileSettings({
      ...teamProfiles,
      [side === 'user' ? 'userUniform' : 'opponentUniform']: uniform,
    }),
  };
}

export function createAutoUniformCorrection(
  selection: MatchSetupSelection,
): MatchSetupSelection {
  const teamProfiles = normalizeTeamProfileSettings(selection.teamProfiles);
  const candidates: TeamProfileSettings[] = [
    { ...teamProfiles, opponentUniform: flipUniform(teamProfiles.userUniform) },
    { ...teamProfiles, userUniform: flipUniform(teamProfiles.opponentUniform) },
    { ...teamProfiles, userUniform: 'home', opponentUniform: 'away' },
    { ...teamProfiles, userUniform: 'away', opponentUniform: 'home' },
  ].map(normalizeTeamProfileSettings);

  const corrected = candidates.find((candidate) =>
    candidate.userTeamId !== candidate.opponentTeamId && !hasUniformConflict(candidate)) ??
    candidates[0] ??
    teamProfiles;

  return {
    teamProfiles: corrected,
  };
}

export function createAutoUniformCorrectionForMatchup(
  selection: MatchupSelection,
  baseSettings: TeamProfileSettings = DEFAULT_TEAM_PROFILE_SETTINGS,
): MatchupSelection {
  return createMatchupSelection(
    createAutoUniformCorrection(createMatchSetupSelectionFromMatchupSelection(selection, baseSettings)).teamProfiles,
  );
}

function hasUniformConflict(teamProfiles: TeamProfileSettings): boolean {
  const theme = resolveTeamPresentationTheme(teamProfiles);
  const jerseyDistance = calculateHexColorDistance(
    theme.offense.uniform.jersey,
    theme.defense.uniform.jersey,
  );
  const helmetDistance = calculateHexColorDistance(
    theme.offense.uniform.helmetShell,
    theme.defense.uniform.helmetShell,
  );

  return (jerseyDistance + helmetDistance) / 2 < UNIFORM_CONFLICT_THRESHOLD;
}

function flipUniform(uniform: UniformVariant): UniformVariant {
  return uniform === 'home' ? 'away' : 'home';
}
