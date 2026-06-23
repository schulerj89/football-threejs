import * as THREE from 'three';
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
import {
  DEFAULT_PLAYER_TEAM_UNIFORMS,
  getPlayerVisualHeadAnchor,
  type PlayerTeamUniforms,
} from '../src/playerVisual';
import { readJerseyNumberVisualSnapshot } from '../src/presentation/players/JerseyNumberVisual';
import type { PlayerModel } from '../src/playerModel';

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
    expect(layout.props.some((prop) => prop.role === 'football')).toBe(false);

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
      accuracy: 94,
      mobility: 82,
      throwPower: 96,
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

  it('creates the spotlight quarterback as a complete helmeted presentation clone', async () => {
    const layout = createPregameWarmupLayout(createBinding());
    const theme = createTheme();
    const resources = createPregameWarmupVisualResources(layout, theme, {
      footballPlayerVisual: {
        attachHelmet: attachMockHelmet,
      },
    });

    await waitForMicrotasks();

    const helmets: THREE.Object3D[] = [];
    resources.quarterbackClone?.traverse((object) => {
      if (object.name === 'low-poly-helmet') {
        helmets.push(object);
      }
    });
    const audit = resources.getQuarterbackAppearanceAudit();
    const jerseyNumber = resources.quarterbackClone
      ? readJerseyNumberVisualSnapshot(resources.quarterbackClone)
      : null;

    expect(helmets).toHaveLength(1);
    expect(resources.quarterbackClone?.userData.presentationOnly).toBe(true);
    expect(resources.quarterbackClone?.getObjectByName('head')).toBeTruthy();
    expect(resources.quarterbackClone?.getObjectByName('pregame-warmup-held-football')).toBeFalsy();
    expect(resources.group.getObjectByName('pregame-warmup-footballs')).toBeFalsy();
    expect(audit).toMatchObject({
      bodyReady: true,
      fallbackReason: null,
      helmetAssetId: 'football-helmet-kit',
      helmetReady: true,
      rosterPlayerId: 'metro-meteors-qb-12',
      subjectReady: true,
      subjectVisible: true,
    });
    expect(jerseyNumber).toMatchObject({
      jerseyNumber: 12,
      missingBindingReason: null,
      rosterPlayerId: 'metro-meteors-qb-12',
      visible: true,
    });
    expect(audit.shellMaterialName).toContain(theme.uniforms.offense.helmetShell);
    expect(audit.faceguardMaterialName).toContain(theme.uniforms.offense.faceguard);

    resources.dispose();
  });

  it('keeps a failed spotlight helmet hidden instead of showing a bare-headed close-up', async () => {
    const layout = createPregameWarmupLayout(createBinding());
    const resources = createPregameWarmupVisualResources(layout, createTheme(), {
      footballPlayerVisual: {
        attachHelmet: async () => {
          throw new Error('helmet unavailable');
        },
      },
    });

    await waitForMicrotasks();

    const audit = resources.getQuarterbackAppearanceAudit();
    expect(resources.quarterbackClone?.visible).toBe(false);
    expect(resources.quarterbackClone?.getObjectByName('low-poly-helmet')).toBeFalsy();
    expect(audit).toMatchObject({
      bodyReady: true,
      fallbackReason: 'helmetFailed',
      helmetReady: false,
      subjectReady: false,
      subjectVisible: false,
    });

    resources.dispose();
  });

  it('repeated active settings changes do not accumulate warmup roots', () => {
    const controller = new PregameWarmupController({
      enabled: true,
      rosterBinding: createBinding(),
      teamTheme: createTheme(),
    });

    for (let index = 0; index < 25; index += 1) {
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

async function attachMockHelmet(
  playerVisual: THREE.Object3D,
  _player: PlayerModel,
  teamUniforms: PlayerTeamUniforms = DEFAULT_PLAYER_TEAM_UNIFORMS,
): Promise<boolean> {
  const headAnchor = getPlayerVisualHeadAnchor(playerVisual);
  if (!headAnchor) {
    return false;
  }
  if (headAnchor.getObjectByName('low-poly-helmet')) {
    return true;
  }

  const helmet = new THREE.Group();
  helmet.name = 'low-poly-helmet';
  helmet.userData.assetId = 'football-helmet-kit';
  const shellMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(teamUniforms.offense.helmetShell),
    name: `football-helmet-kit-offense-shell-${teamUniforms.offense.helmetShell}`,
  });
  const faceguardMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(teamUniforms.offense.faceguard),
    name: `football-helmet-kit-offense-faceguard-${teamUniforms.offense.faceguard}`,
  });
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.3), shellMaterial);
  shell.name = 'helmet_shell';
  const faceguard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.04), faceguardMaterial);
  faceguard.name = 'faceguard_standard';
  helmet.add(shell, faceguard);
  headAnchor.add(helmet);
  return true;
}

async function waitForMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function createBinding() {
  return createGameplayRosterBinding(
    '11v11',
    BROADCAST_EXPERIENCE_SETTINGS.teamProfiles,
  );
}

function createTheme() {
  return resolveTeamPresentationTheme(BROADCAST_EXPERIENCE_SETTINGS.teamProfiles);
}
