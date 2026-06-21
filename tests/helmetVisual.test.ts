import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  HELMET_VISUAL_CONFIG,
  applyHelmetTeamMaterials,
  findHelmetPartMeshes,
} from '../src/helmetVisual';
import { createPlayerModel } from '../src/playerModel';
import {
  PLAYER_BODY_ROOT_NAME,
  PLAYER_HEAD_ANCHOR_NAME,
  createPlaceholderPlayerVisual,
} from '../src/playerVisual';

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
});
