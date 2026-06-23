import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OPPONENT_TEAM_ID,
  DEFAULT_USER_TEAM_ID,
  listTeamProfiles,
} from '../src/teams/TeamRegistry';
import {
  DEFAULT_TEAM_PROFILE_SETTINGS,
  type TeamProfileSettings,
} from '../src/teams/TeamProfileStore';
import {
  createAutoUniformCorrection,
  createMatchSetupSelection,
  updateMatchSetupTeam,
  updateMatchSetupUniform,
  validateMatchSetupSelection,
} from '../src/ui/MatchSetupModel';
import {
  HELMET_DIAGNOSTIC_SWATCHES,
  resolveHelmetPreviewRotationY,
} from '../src/ui/MatchSetupHelmetPreview';

describe('match setup model', () => {
  it('validates the default fictional matchup', () => {
    const selection = createMatchSetupSelection(DEFAULT_TEAM_PROFILE_SETTINGS);

    expect(validateMatchSetupSelection(selection)).toEqual({
      canConfirm: true,
      issues: [],
      uniformConflict: false,
    });
  });

  it('blocks same-team matchups', () => {
    const selection = updateMatchSetupTeam(
      createMatchSetupSelection(DEFAULT_TEAM_PROFILE_SETTINGS),
      'opponent',
      DEFAULT_USER_TEAM_ID,
    );

    expect(validateMatchSetupSelection(selection)).toMatchObject({
      canConfirm: false,
      issues: ['Choose two different teams.'],
    });
  });

  it('detects uniform conflicts deterministically and can correct them without changing team IDs', () => {
    const conflictingSettings: TeamProfileSettings = {
      ...DEFAULT_TEAM_PROFILE_SETTINGS,
      customProfiles: {
        [DEFAULT_OPPONENT_TEAM_ID]: {
          faceguard: '#f3f5f8',
          helmetShell: '#2f66d8',
          pants: '#f2f4f6',
          primary: '#2f66d8',
          secondary: '#f2f4f6',
        },
      },
      opponentTeamId: DEFAULT_OPPONENT_TEAM_ID,
      opponentUniform: 'home',
      userTeamId: DEFAULT_USER_TEAM_ID,
      userUniform: 'home',
    };
    const selection = createMatchSetupSelection(conflictingSettings);
    const validation = validateMatchSetupSelection(selection);

    expect(validation.uniformConflict).toBe(true);

    const corrected = createAutoUniformCorrection(selection);
    expect(corrected.teamProfiles.userTeamId).toBe(DEFAULT_USER_TEAM_ID);
    expect(corrected.teamProfiles.opponentTeamId).toBe(DEFAULT_OPPONENT_TEAM_ID);
    expect(validateMatchSetupSelection(corrected).uniformConflict).toBe(false);
  });

  it('updates teams and uniforms independently', () => {
    const teamId = listTeamProfiles().find((profile) => profile.id !== DEFAULT_USER_TEAM_ID)?.id;
    expect(teamId).toBeTruthy();

    const withTeam = updateMatchSetupTeam(
      createMatchSetupSelection(DEFAULT_TEAM_PROFILE_SETTINGS),
      'user',
      teamId!,
    );
    const withUniform = updateMatchSetupUniform(withTeam, 'user', 'away');

    expect(withUniform.teamProfiles.userTeamId).toBe(teamId);
    expect(withUniform.teamProfiles.userUniform).toBe('away');
  });

  it('turns match setup helmet previews toward each other', () => {
    expect(resolveHelmetPreviewRotationY('user')).toBeLessThan(0);
    expect(resolveHelmetPreviewRotationY('opponent')).toBeGreaterThan(0);
    expect(resolveHelmetPreviewRotationY('user')).toBe(-resolveHelmetPreviewRotationY('opponent'));
  });

  it('offers diagnostic helmet swatches for exact-color previewing', () => {
    expect(HELMET_DIAGNOSTIC_SWATCHES).toEqual(expect.arrayContaining([
      '#ff0000',
      '#00ff00',
      '#0000ff',
      '#ffffff',
      '#101010',
    ]));

    for (const profile of listTeamProfiles()) {
      expect(HELMET_DIAGNOSTIC_SWATCHES).toContain(profile.homeUniform.helmetShell.toLowerCase());
    }
  });
});
