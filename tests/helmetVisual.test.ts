import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  HELMET_VISUAL_CONFIG,
  applyHelmetTeamMaterials,
  findHelmetPartMeshes,
  syncHelmetTeamMaterials,
} from '../src/helmetVisual';
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

  it('clones and tints shell and faceguard materials independently per team', () => {
    const shellMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const faceguardMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
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
    expect((accent.material as THREE.MeshStandardMaterial).color.getHex()).toBe(
      parseInt(theme.offense.uniform.stripe.slice(1), 16),
    );
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
