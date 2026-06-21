import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { StorageLike } from '../src/audio/AudioSettings';
import {
  BROADCAST_EXPERIENCE_SETTINGS,
  GAME_EXPERIENCE_SETTINGS_STORAGE_KEY,
  resolveGameExperienceSettings,
  saveGameExperienceSettings,
} from '../src/config/GameExperienceSettings';
import { createFootballField, syncFootballFieldTeamColors } from '../src/field';
import {
  DEFAULT_OPPONENT_TEAM_ID,
  DEFAULT_USER_TEAM_ID,
  STARTER_TEAM_PROFILES,
  validateTeamProfile,
} from '../src/teams/TeamRegistry';
import {
  DEFAULT_TEAM_PROFILE_SETTINGS,
  updateTeamColorOverride,
} from '../src/teams/TeamProfileStore';
import {
  calculateHexColorDistance,
  getReadableTextColor,
  resolveTeamPresentationTheme,
} from '../src/teams/TeamThemeApplier';

describe('team profiles', () => {
  it('ships valid fictional starter profiles', () => {
    expect(STARTER_TEAM_PROFILES).toHaveLength(4);
    expect(STARTER_TEAM_PROFILES.map((profile) => profile.id)).toEqual([
      'metro-meteors',
      'lakefront-lights',
      'summit-forge',
      'bay-city-current',
    ]);

    for (const profile of STARTER_TEAM_PROFILES) {
      expect(validateTeamProfile(profile)).toEqual([]);
    }
  });

  it('persists custom colors through the versioned game settings store', () => {
    const storage = createMemoryStorage();
    const teamProfiles = updateTeamColorOverride(
      DEFAULT_TEAM_PROFILE_SETTINGS,
      DEFAULT_USER_TEAM_ID,
      {
        faceguard: '#445566',
        helmetShell: '#654321',
        pants: '#abcdef',
        primary: '#123456',
        secondary: '#fedcba',
      },
    );

    saveGameExperienceSettings({
      ...BROADCAST_EXPERIENCE_SETTINGS,
      teamProfiles,
    }, storage);

    const resolved = resolveGameExperienceSettings({
      searchParams: new URLSearchParams(),
      storage,
    });
    const theme = resolveTeamPresentationTheme(resolved.settings.teamProfiles);

    expect(theme.offense.profile.colors.primary).toBe('#123456');
    expect(theme.offense.profile.colors.secondary).toBe('#fedcba');
    expect(theme.offense.uniform.helmetShell).toBe('#654321');
    expect(theme.offense.uniform.pants).toBe('#abcdef');
    expect(theme.offense.uniform.faceguard).toBe('#445566');
  });

  it('migrates invalid persisted colors safely to profile defaults', () => {
    const storage = createMemoryStorage();
    storage.setItem(
      GAME_EXPERIENCE_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        preset: 'broadcast',
        settings: {
          ...BROADCAST_EXPERIENCE_SETTINGS,
          teamProfiles: {
            ...DEFAULT_TEAM_PROFILE_SETTINGS,
            customProfiles: {
              [DEFAULT_USER_TEAM_ID]: {
                faceguard: '#zzzzzz',
                helmetShell: 'nope',
                pants: '#12345',
                primary: 'blue',
                secondary: '#123456',
              },
            },
          },
        },
        version: 5,
      }),
    );

    const resolved = resolveGameExperienceSettings({
      searchParams: new URLSearchParams(),
      storage,
    });
    const theme = resolveTeamPresentationTheme(resolved.settings.teamProfiles);

    expect(theme.offense.profile.colors.primary).toBe('#2f66d8');
    expect(theme.offense.profile.colors.secondary).toBe('#123456');
    expect(theme.offense.uniform.helmetShell).toBe('#2f66d8');
    expect(theme.offense.uniform.pants).toBe('#f2f4f6');
    expect(theme.offense.uniform.faceguard).toBe('#f3f5f8');
  });

  it('resolves home and away palettes to the correct active teams', () => {
    const theme = resolveTeamPresentationTheme({
      ...DEFAULT_TEAM_PROFILE_SETTINGS,
      opponentTeamId: DEFAULT_OPPONENT_TEAM_ID,
      opponentUniform: 'home',
      userTeamId: DEFAULT_USER_TEAM_ID,
      userUniform: 'away',
    });

    expect(theme.offense.uniform.jersey).toBe('#f2f4f6');
    expect(theme.offense.uniform.pants).toBe('#2f66d8');
    expect(theme.defense.uniform.jersey).toBe('#b83737');
    expect(theme.defense.uniform.pants).toBe('#f2f4f6');
  });

  it('produces deterministic similarity warnings and readable text colors', () => {
    const similar = resolveTeamPresentationTheme({
      ...DEFAULT_TEAM_PROFILE_SETTINGS,
      opponentTeamId: DEFAULT_USER_TEAM_ID,
      opponentUniform: 'home',
      userTeamId: DEFAULT_USER_TEAM_ID,
      userUniform: 'home',
    });
    const defaultTheme = resolveTeamPresentationTheme(DEFAULT_TEAM_PROFILE_SETTINGS);

    expect(similar.similarityWarning).toBe(
      'Metro Meteors and Metro Meteors uniforms are visually similar.',
    );
    expect(defaultTheme.similarityWarning).toBeNull();
    expect(calculateHexColorDistance('#000000', '#ffffff')).toBeCloseTo(441.6729, 3);
    expect(getReadableTextColor('#ffffff')).toBe('#101512');
    expect(getReadableTextColor('#000000')).toBe('#f7fbf8');
  });

  it('applies active team colors to field end zones', () => {
    const field = createFootballField();
    const theme = resolveTeamPresentationTheme(DEFAULT_TEAM_PROFILE_SETTINGS);

    try {
      syncFootballFieldTeamColors(field, {
        farEndZone: theme.defense.profile.endZoneColor,
        nearEndZone: theme.offense.profile.endZoneColor,
      });

      const near = field.group.getObjectByName('near-end-zone');
      const far = field.group.getObjectByName('far-end-zone');

      expect(near).toBeInstanceOf(THREE.Mesh);
      expect(far).toBeInstanceOf(THREE.Mesh);
      expect(((near as THREE.Mesh).material as THREE.MeshLambertMaterial).color.getHexString())
        .toBe(theme.offense.profile.endZoneColor.replace('#', ''));
      expect(((far as THREE.Mesh).material as THREE.MeshLambertMaterial).color.getHexString())
        .toBe(theme.defense.profile.endZoneColor.replace('#', ''));
    } finally {
      field.dispose();
    }
  });
});

function createMemoryStorage(): StorageLike {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
