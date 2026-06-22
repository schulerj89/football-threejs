import { describe, expect, it } from 'vitest';
import { createGameplayModel, snapshotGameplayModel } from '../src/playState';
import { BROADCAST_EXPERIENCE_SETTINGS } from '../src/config/GameExperienceSettings';
import {
  arePregameWarmupZonesMirrored,
  createPregameWarmupLayout,
  isPregameWarmupPlacementOutsideProtectedField,
} from '../src/presentation/pregame/PregameWarmupLayout';
import {
  PregameWarmupController,
} from '../src/presentation/pregame/PregameWarmupController';
import {
  createPregameWarmupVisualResources,
} from '../src/presentation/pregame/PregameWarmupVisualFactory';
import {
  createGameplayRosterBinding,
} from '../src/roster/GameplayRosterBinding';
import {
  createQuarterbackScoutingProfile,
} from '../src/roster/QuarterbackScoutingProfile';
import {
  GENERIC_QUARTERBACK_RATINGS,
  validateQuarterbackRatings,
} from '../src/roster/PlayerRatings';
import {
  resolveTeamPresentationTheme,
} from '../src/teams/TeamThemeApplier';

describe('pregame warmup staging', () => {
  it('creates mirrored user and opponent warmup zones outside protected gameplay bounds', () => {
    const layout = createPregameWarmupLayout(createBinding());
    const userZone = layout.zones.find((zone) => zone.id === 'user-warmup');
    const opponentZone = layout.zones.find((zone) => zone.id === 'opponent-warmup');

    expect(userZone).toBeDefined();
    expect(opponentZone).toBeDefined();
    expect(arePregameWarmupZonesMirrored(userZone!, opponentZone!)).toBe(true);
    expect(layout.groups).toHaveLength(8);
    expect(layout.userQuarterback?.player?.id).toBe('metro-meteors-qb-12');
    expect(layout.opponentQuarterback?.player?.footballPosition).toBe('QB');

    for (const placement of [...layout.placements, ...layout.props]) {
      expect(isPregameWarmupPlacementOutsideProtectedField(placement)).toBe(true);
      expect(placement.id.startsWith('pregame-warmup-')).toBe(true);
    }
  });

  it('does not move or add gameplay players', () => {
    const gameplay = createGameplayModel({
      challengeMode: 'exhibition',
      playbookId: '11v11',
    });
    const before = snapshotGameplayModel(gameplay);

    createPregameWarmupLayout(createBinding());

    const after = snapshotGameplayModel(gameplay);
    expect(after.players).toHaveLength(22);
    expect(after.players).toEqual(before.players);
    expect(after.players.some((player) => player.id.startsWith('pregame-warmup-'))).toBe(false);
  });

  it('derives stable presentation-only quarterback ratings and archetype', () => {
    const layout = createPregameWarmupLayout(createBinding());
    const profile = createQuarterbackScoutingProfile(layout.userQuarterback?.player ?? null);

    expect(profile).toMatchObject({
      archetype: 'Strong Arm',
      formattedName: 'J. CARTER',
      jerseyNumber: 12,
      rosterPlayerId: 'metro-meteors-qb-12',
    });
    expect(profile.ratings).toEqual({
      accuracy: 82,
      mobility: 74,
      throwPower: 91,
    });
    expect(validateQuarterbackRatings(profile.ratings)).toBe(true);
  });

  it('uses a safe generic profile when ratings are missing', () => {
    const profile = createQuarterbackScoutingProfile(null);

    expect(profile.ratings).toEqual(GENERIC_QUARTERBACK_RATINGS);
    expect(validateQuarterbackRatings(profile.ratings)).toBe(true);
    expect(profile.rosterPlayerId).toBe('generic-quarterback');
  });

  it('uses bounded visual resources and disposes owned warmup roots', () => {
    const layout = createPregameWarmupLayout(createBinding());
    const resources = createPregameWarmupVisualResources(layout, createTheme());

    expect(resources.quarterbackClone?.userData.presentationOnly).toBe(true);
    expect(resources.metrics.drawCalls).toBeGreaterThan(0);
    expect(resources.metrics.instanceBufferBytes).toBeGreaterThan(0);
    expect(resources.metrics.materialCount).toBeLessThan(16);
    expect(resources.group.children.length).toBeGreaterThan(0);

    resources.dispose();
    expect(resources.group.children).toHaveLength(0);
  });

  it('repeated active settings changes do not accumulate warmup roots', () => {
    const controller = new PregameWarmupController({
      enabled: true,
      rosterBinding: createBinding(),
      teamTheme: createTheme(),
    });

    for (let index = 0; index < 12; index += 1) {
      controller.setActive(true);
      controller.applySettings({
        enabled: true,
        rosterBinding: createBinding(),
        teamTheme: createTheme(),
      });
      controller.update();
      expect(controller.group.children).toHaveLength(1);
      expect(controller.getSnapshot()).toMatchObject({
        noGameplayAuthority: true,
        playerCount: 30,
        ready: true,
      });
    }

    controller.setActive(false);
    expect(controller.group.visible).toBe(false);
    controller.dispose();
  });
});

function createBinding() {
  return createGameplayRosterBinding(
    '11v11',
    BROADCAST_EXPERIENCE_SETTINGS.teamProfiles,
  );
}

function createTheme() {
  return resolveTeamPresentationTheme(BROADCAST_EXPERIENCE_SETTINGS.teamProfiles);
}
