import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  HELMET_VISUAL_CONFIG,
  applyHelmetTeamMaterials,
  findHelmetPartMeshes,
  syncHelmetTeamMaterials,
} from '../src/helmetVisual';
import {
  applyHelmetUniformMaterials,
  createHelmetRuntimeMaterialKey,
} from '../src/presentation/helmet/HelmetAssetLibrary';
import {
  getHelmetMaterialCacheSnapshot,
  getHelmetUnlitExactMaterial,
  resetHelmetMaterialLibraryForTests,
} from '../src/presentation/helmet/HelmetMaterialLibrary';
import { createPlayerModel } from '../src/playerModel';
import {
  PLAYER_BODY_ROOT_NAME,
  PLAYER_HEAD_ANCHOR_NAME,
  createPlaceholderPlayerVisual,
} from '../src/playerVisual';
import { DEFAULT_USER_TEAM_ID } from '../src/teams/TeamRegistry';
import {
  DEFAULT_TEAM_PROFILE_SETTINGS,
  updateTeamColorOverride,
} from '../src/teams/TeamProfileStore';
import { resolveTeamPresentationTheme } from '../src/teams/TeamThemeApplier';

describe('helmet visual integration', () => {
  it('uses the generated modular helmet kit as the shared helmet asset', () => {
    expect(HELMET_VISUAL_CONFIG.assetUrl).toBe('/models/helmet/football-helmet-kit.glb');
    expect(HELMET_VISUAL_CONFIG.shellMeshNames).toContain('helmet_shell');
    expect(HELMET_VISUAL_CONFIG.faceguardMeshNames).toContain('faceguard_standard');
  });

  it('keeps a dedicated head anchor on the procedural player body', () => {
    const playerVisual = createPlaceholderPlayerVisual(createPlayerModel());
    const bodyRoot = playerVisual.getObjectByName(PLAYER_BODY_ROOT_NAME);

    expect(bodyRoot).toBeInstanceOf(THREE.Group);
    expect(bodyRoot?.getObjectByName(PLAYER_HEAD_ANCHOR_NAME)).toBeInstanceOf(THREE.Group);
    expect(bodyRoot?.getObjectByName('torso')).toBeInstanceOf(THREE.Mesh);
    expect(bodyRoot?.getObjectByName('shoulderPads')).toBeInstanceOf(THREE.Mesh);
  });

  it('finds shell and faceguard meshes by mesh or material name', () => {
    const root = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ name: 'primary-shell-material' }),
    );
    shell.name = 'Helmet_Shell';
    const faceguard = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ name: 'Faceguard_Material' }),
    );
    faceguard.name = 'front-bars';
    root.add(shell, faceguard);

    const parts = findHelmetPartMeshes(root);

    expect(parts.shellMeshes).toEqual([shell]);
    expect(parts.faceguardMeshes).toEqual([faceguard]);
  });

  it('does not invent a faceguard part when the GLB exposes a single shell mesh', () => {
    const root = new THREE.Group();
    const helmet = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xffffff }),
    );
    helmet.name = 'Mesh10';
    root.add(helmet);

    const parts = findHelmetPartMeshes(root);

    expect(parts.shellMeshes).toEqual([helmet]);
    expect(parts.faceguardMeshes).toEqual([]);
  });

  it('creates clean runtime shell and faceguard materials independently per team', () => {
    resetHelmetMaterialLibraryForTests();
    const shellTexture = new THREE.Texture();
    const faceguardTexture = new THREE.Texture();
    const shellMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    shellMaterial.name = 'imported-shell-source';
    shellMaterial.map = shellTexture;
    shellMaterial.vertexColors = true;
    shellMaterial.emissive.setHex(0xff00ff);
    const faceguardMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    faceguardMaterial.name = 'imported-faceguard-source';
    faceguardMaterial.map = faceguardTexture;
    faceguardMaterial.vertexColors = true;
    const shell = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shellMaterial);
    const faceguard = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), faceguardMaterial);

    applyHelmetTeamMaterials(
      {
        faceguardMeshes: [faceguard],
        shellMeshes: [shell],
      },
      'defense',
    );

    expect(shell.material).not.toBe(shellMaterial);
    expect(faceguard.material).not.toBe(faceguardMaterial);
    expect((shell.material as THREE.MeshStandardMaterial).color.getHex()).toBe(
      HELMET_VISUAL_CONFIG.teamColors.defense.shell,
    );
    expect((faceguard.material as THREE.MeshStandardMaterial).color.getHex()).toBe(
      HELMET_VISUAL_CONFIG.teamColors.defense.faceguard,
    );
    expect((shell.material as THREE.MeshStandardMaterial).map).toBeNull();
    expect((faceguard.material as THREE.MeshStandardMaterial).map).toBeNull();
    expect((shell.material as THREE.MeshStandardMaterial).emissive.getHex()).toBe(0x000000);
    expect((faceguard.material as THREE.MeshStandardMaterial).emissive.getHex()).toBe(0x000000);
    expect((shell.material as THREE.MeshStandardMaterial).vertexColors).toBe(false);
    expect((faceguard.material as THREE.MeshStandardMaterial).vertexColors).toBe(false);
    expect((shell.material as THREE.MeshStandardMaterial).side).toBe(THREE.FrontSide);
    expect((faceguard.material as THREE.MeshStandardMaterial).side).toBe(THREE.FrontSide);
    expect((shell.material as THREE.MeshStandardMaterial).name).not.toContain(shellMaterial.uuid);
    expect((faceguard.material as THREE.MeshStandardMaterial).name).not.toContain(faceguardMaterial.uuid);
  });

  it('uses helmet shell and faceguard colors from the active uniform palette', () => {
    const shellMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const faceguardMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const shell = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shellMaterial);
    const faceguard = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), faceguardMaterial);
    const accent = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), accentMaterial);
    const teamProfiles = updateTeamColorOverride(
      DEFAULT_TEAM_PROFILE_SETTINGS,
      DEFAULT_USER_TEAM_ID,
      {
        faceguard: '#101820',
        helmetShell: '#654321',
      },
    );
    const theme = resolveTeamPresentationTheme(teamProfiles);

    applyHelmetTeamMaterials(
      {
        accentMeshes: [accent],
        faceguardMeshes: [faceguard],
        shellMeshes: [shell],
      },
      'offense',
      theme.uniforms,
    );

    expect((shell.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0x654321);
    expect((faceguard.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0x101820);
    expect((accent.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0x654321);
  });

  it('shares cached runtime materials by component and requested color only', () => {
    resetHelmetMaterialLibraryForTests();
    const uniform = {
      faceguard: '#a0a0a0',
      helmetShell: '#112233',
      jersey: '#ffffff',
      number: '#112233',
      pants: '#ffffff',
      shoe: '#111111',
      shoulder: '#ffffff',
      socks: '#112233',
      stripe: '#ff00ff',
    };
    const shellA = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ name: 'source-a' }),
    );
    const shellB = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ name: 'source-b' }),
    );
    const faceguard = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ name: 'source-c' }),
    );

    applyHelmetUniformMaterials({ faceguardMeshes: [], shellMeshes: [shellA] }, uniform, 'team-a');
    applyHelmetUniformMaterials({ faceguardMeshes: [], shellMeshes: [shellB] }, uniform, 'team-b');
    applyHelmetUniformMaterials({ faceguardMeshes: [faceguard], shellMeshes: [] }, uniform, 'team-a');

    expect(shellA.material).toBe(shellB.material);
    expect(shellA.material).not.toBe(faceguard.material);
    expect(createHelmetRuntimeMaterialKey('shell', uniform)).toBe('shell:#112233:standard');
    expect(createHelmetRuntimeMaterialKey('faceguard', uniform)).toBe('faceguard:#a0a0a0:standard');
    expect(getHelmetMaterialCacheSnapshot()).toEqual([
      expect.objectContaining({
        cacheKey: 'shell:#112233:standard',
        component: 'shell',
      }),
      expect.objectContaining({
        cacheKey: 'faceguard:#a0a0a0:standard',
        component: 'faceguard',
      }),
    ]);
  });

  it('keeps unlit diagnostic preview materials exact and map-free', () => {
    const material = getHelmetUnlitExactMaterial({
      color: '#ff0000',
      component: 'shell',
    });

    expect(material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(material.color.getHex()).toBe(0xff0000);
    expect(material.map).toBeNull();
    expect(material.vertexColors).toBe(false);
    expect(material.wireframe).toBe(false);
  });

  it('reuses cached helmet parts when the team color is unchanged', () => {
    const player = createPlayerModel(undefined, {
      id: 'helmet-cache-player',
      role: 'runner',
      team: 'offense',
    });
    const playerVisual = createPlaceholderPlayerVisual(player);
    const headAnchor = playerVisual.getObjectByName(PLAYER_HEAD_ANCHOR_NAME);
    const helmet = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xffffff, name: 'shell-source' }),
    );
    const faceguard = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xffffff, name: 'faceguard-source' }),
    );

    if (!headAnchor) {
      throw new Error('Missing player head anchor');
    }

    helmet.name = 'low-poly-helmet';
    shell.name = 'helmet_shell';
    faceguard.name = 'faceguard';
    helmet.add(shell, faceguard);
    headAnchor.add(helmet);

    syncHelmetTeamMaterials(playerVisual, player);

    const offenseShellMaterial = shell.material;
    const offenseFaceguardMaterial = faceguard.material;
    const originalGetObjectByName = playerVisual.getObjectByName;
    const originalHelmetTraverse = helmet.traverse;

    playerVisual.getObjectByName = (() => {
      throw new Error('syncHelmetTeamMaterials should use cached helmet references');
    }) as typeof playerVisual.getObjectByName;
    helmet.traverse = (() => {
      throw new Error('syncHelmetTeamMaterials should not traverse cached helmet parts');
    }) as typeof helmet.traverse;

    try {
      syncHelmetTeamMaterials(playerVisual, player);

      expect(shell.material).toBe(offenseShellMaterial);
      expect(faceguard.material).toBe(offenseFaceguardMaterial);

      syncHelmetTeamMaterials(playerVisual, { ...player, team: 'defense' });

      expect((shell.material as THREE.MeshStandardMaterial).color.getHex()).toBe(
        HELMET_VISUAL_CONFIG.teamColors.defense.shell,
      );
      expect((faceguard.material as THREE.MeshStandardMaterial).color.getHex()).toBe(
        HELMET_VISUAL_CONFIG.teamColors.defense.faceguard,
      );
    } finally {
      playerVisual.getObjectByName = originalGetObjectByName;
      helmet.traverse = originalHelmetTraverse;
    }
  });
});
