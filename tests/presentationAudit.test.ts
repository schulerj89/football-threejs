import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GameplayCameraController } from '../src/camera/GameplayCameraController';
import {
  SEVEN_ON_SEVEN_PLAYER_IDS,
  createFormationPreviewModel,
  snapshotFormationPreviewAsGameplay,
  snapshotFormationPreviewModel,
  type FormationPreviewModel,
} from '../src/formationPreview';
import {
  PRESENTATION_AUDIT_CONFIG,
  createCameraFramingSnapshot,
  createPresentationAuditGameplaySnapshot,
  createPresentationAuditSnapshot,
} from '../src/presentationAudit';
import {
  PlayerPoseController,
} from '../src/presentation/PlayerPoseController';
import {
  PLAYER_HEAD_ANCHOR_NAME,
  createPlaceholderPlayerVisual,
  syncPlayerVisual,
} from '../src/playerVisual';

describe('presentation audit', () => {
  it('creates a locomotion preview snapshot without mutating gameplay transforms', () => {
    const preview = createFormationPreviewModel('7v7', 'middle');
    const snapshot = snapshotFormationPreviewAsGameplay(preview);
    const before = JSON.stringify(snapshot);
    const locomotion = createPresentationAuditGameplaySnapshot(snapshot, 'locomotionPreview');

    expect(JSON.stringify(snapshot)).toBe(before);
    expect(locomotion.playState).toBe('live');
    expect(locomotion.players).toHaveLength(14);
    for (const player of locomotion.players) {
      const original = snapshot.players.find((candidate) => candidate.id === player.id);
      expect(original).toBeDefined();
      expect(player.position).toEqual(original?.position);
      expect(player.facingRadians).toBe(original?.facingRadians);
      expect(Math.hypot(player.velocity.x, player.velocity.z)).toBeGreaterThan(0);
    }
  });

  it('keeps pre-snap roots and gameplay transforms stable for repeated visual updates', () => {
    const preview = createFormationPreviewModel('7v7', 'middle');
    const snapshot = snapshotFormationPreviewAsGameplay(preview);
    const visuals = createPreviewVisuals(preview);
    const controller = new PlayerPoseController();
    const beforePlayers = JSON.stringify(snapshot.players);
    const beforeRoots = snapshotVisualRoots(visuals);

    for (let frame = 0; frame < 300; frame += 1) {
      controller.update(snapshot, visuals, 1 / 60);
    }

    expect(JSON.stringify(snapshot.players)).toBe(beforePlayers);
    expect(snapshotVisualRoots(visuals)).toEqual(beforeRoots);
  });

  it('reports grounded players, stable helmet gaps, and head-anchor helmet parenting', () => {
    const preview = createFormationPreviewModel('7v7', 'middle');
    const gameplay = snapshotFormationPreviewAsGameplay(preview);
    const visuals = createPreviewVisuals(preview);
    const poseController = new PlayerPoseController();
    const cameraController = new GameplayCameraController({
      height: 720,
      holdCinematicPreSnapEstablish: true,
      initialMode: 'cinematicBroadcast',
      width: 1280,
    });

    poseController.update(gameplay, visuals, 1 / 60);
    cameraController.update(gameplay, 0);

    const audit = createPresentationAuditSnapshot({
      camera: cameraController.camera,
      cameraDebug: cameraController.getDebugSnapshot(),
      formation: snapshotFormationPreviewModel(preview),
      gameplay,
      playerMotionEnabled: true,
      playerVisuals: visuals,
      poseSnapshots: poseController.getPoseSnapshots(),
      renderMetrics: null,
      state: 'preSnap',
    });

    expect(audit.players).toHaveLength(14);
    expect(audit.formationIssueCount).toBe(0);
    expect(audit.allFeetGrounded).toBe(true);
    expect(audit.allHelmetsAttached).toBe(true);
    expect(audit.stableHelmetGaps).toBe(true);
    expect(audit.issues).toEqual([]);
    for (const player of audit.players) {
      expect(player.rootMatchesGameplay).toBe(true);
      expect(player.helmetParentName).toBe(PLAYER_HEAD_ANCHOR_NAME);
      expect(player.body.helmetShoulderVerticalGap).toBeGreaterThanOrEqual(
        PRESENTATION_AUDIT_CONFIG.helmetShoulderGapMinimum,
      );
      expect(player.restingLimbSymmetryError).toBeLessThanOrEqual(
        PRESENTATION_AUDIT_CONFIG.limbSymmetryTolerance,
      );
    }
  });

  it('projects visual player bounds into the pre-snap framing margin for every camera mode', () => {
    const preview = createFormationPreviewModel('7v7', 'middle');
    const gameplay = snapshotFormationPreviewAsGameplay(preview);
    const visuals = createPreviewVisuals(preview);

    for (const mode of ['tacticalOrthographic', 'offensePerspective', 'cinematicBroadcast'] as const) {
      const cameraController = new GameplayCameraController({
        height: 720,
        holdCinematicPreSnapEstablish: true,
        initialMode: mode,
        width: 1280,
      });

      cameraController.update(gameplay, 0);

      const framing = createCameraFramingSnapshot(
        cameraController.camera,
        visuals,
        PRESENTATION_AUDIT_CONFIG.framingMarginNdc,
      );

      expect(framing.unframedPlayerIds).toEqual([]);
      expect(framing.players).toHaveLength(14);
    }
  });

  it('keeps every audit formation valid across snap lanes', () => {
    for (const lane of ['leftHash', 'middle', 'rightHash'] as const) {
      const preview = createFormationPreviewModel('7v7', lane);
      const snapshot = snapshotFormationPreviewModel(preview);

      expect(snapshot.players.map((player) => player.id).sort()).toEqual(
        [...SEVEN_ON_SEVEN_PLAYER_IDS].sort(),
      );
      expect(snapshot.issues).toEqual([]);
    }
  });

  it('disabling motion restores the neutral configured pose for fourteen players', () => {
    const preview = createFormationPreviewModel('7v7', 'middle');
    const gameplay = createPresentationAuditGameplaySnapshot(
      snapshotFormationPreviewAsGameplay(preview),
      'locomotionPreview',
    );
    const visuals = createPreviewVisuals(preview);
    const controller = new PlayerPoseController(undefined, { enabled: false });

    controller.update(gameplay, visuals, 1 / 60);

    expect(controller.getPoseSnapshots()).toHaveLength(14);
    for (const visual of visuals.values()) {
      expect(visual.getObjectByName('leftArmPivot')?.rotation.equals(new THREE.Euler())).toBe(true);
      expect(visual.getObjectByName('rightArmPivot')?.rotation.equals(new THREE.Euler())).toBe(true);
      expect(visual.getObjectByName('leftLegPivot')?.rotation.equals(new THREE.Euler())).toBe(true);
      expect(visual.getObjectByName('rightLegPivot')?.rotation.equals(new THREE.Euler())).toBe(true);
    }
  });
});

function createPreviewVisuals(preview: FormationPreviewModel): Map<string, THREE.Object3D> {
  const visuals = new Map<string, THREE.Object3D>();

  for (const player of preview.players) {
    const visual = createPlaceholderPlayerVisual(player);
    syncPlayerVisual(visual, player);
    attachTestHelmet(visual);
    visuals.set(player.id, visual);
  }

  return visuals;
}

function attachTestHelmet(playerVisual: THREE.Object3D): void {
  const headAnchor = playerVisual.getObjectByName(PLAYER_HEAD_ANCHOR_NAME);

  if (!headAnchor) {
    throw new Error('Missing head anchor');
  }

  const helmet = new THREE.Group();
  helmet.name = 'low-poly-helmet';
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.28, 0.38),
    new THREE.MeshBasicMaterial(),
  );
  shell.position.y = 0.02;
  helmet.add(shell);
  headAnchor.add(helmet);
}

function snapshotVisualRoots(visuals: Map<string, THREE.Object3D>): Record<string, unknown> {
  return Object.fromEntries(
    [...visuals.entries()].map(([playerId, visual]) => [
      playerId,
      {
        rotationY: visual.rotation.y,
        x: visual.position.x,
        y: visual.position.y,
        z: visual.position.z,
      },
    ]),
  );
}
