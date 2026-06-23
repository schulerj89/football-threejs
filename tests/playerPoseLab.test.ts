import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createPlayerModel, snapshotPlayerModel } from '../src/playerModel';
import {
  PLAYER_BODY_ROOT_NAME,
  createPlaceholderPlayerVisual,
  syncPlayerVisual,
} from '../src/playerVisual';
import {
  DEFAULT_PLAYER_POSE_CLIPS,
  DEFAULT_PLAYER_POSES,
  PLAYER_POSE_SCHEMA_VERSION,
  applyPlayerPoseDefinition,
  clonePlayerPoseDefinition,
  createPlayerPoseExportDocument,
  interpolatePlayerPoseDefinitions,
  parsePlayerPoseExportDocument,
  samplePlayerPoseClip,
  serializePlayerPoseExportDocument,
  validatePlayerPoseCollection,
} from '../src/presentation/players/PlayerPoseApplier';

describe('Player Pose Lab data model', () => {
  it('validates every built-in preset and animation clip', () => {
    const validation = validatePlayerPoseCollection(DEFAULT_PLAYER_POSES, DEFAULT_PLAYER_POSE_CLIPS);

    expect(validation.valid).toBe(true);
    expect(DEFAULT_PLAYER_POSES.map((pose) => pose.id)).toEqual([
      'neutral',
      'ready_offense',
      'ready_defense',
      'runner_idle',
      'running_contact_left',
      'running_contact_right',
      'blocker_ready',
      'receiver_ready',
      'quarterback_ready',
      'kickoff_kicker_ready',
      'coin_toss_captain',
      'touchdown_signal_placeholder',
    ]);
  });

  it('applies a pose to visual pivots without changing gameplay state or root transform', () => {
    const player = createPlayerModel({ x: 8, z: -12 }, {
      facingRadians: Math.PI / 4,
      id: 'pose-lab-player',
      role: 'runner',
      state: 'userControlled',
      team: 'offense',
    });
    const gameplayBefore = snapshotPlayerModel(player);
    const visual = createPlaceholderPlayerVisual(player);
    syncPlayerVisual(visual, player);
    const rootPositionBefore = visual.position.clone();
    const rootRotationBefore = visual.rotation.clone();
    const bodyRoot = visual.getObjectByName(PLAYER_BODY_ROOT_NAME);
    const leftArmPivot = getRequiredObject(visual, 'leftArmPivot');
    const leftLegPivot = getRequiredObject(visual, 'leftLegPivot');

    const result = applyPlayerPoseDefinition(
      visual,
      findPose('running_contact_left'),
    );

    expect(result.missingParts).toEqual([]);
    expect(result.targetType).toBe('proceduralMannequin');
    expect(snapshotPlayerModel(player)).toEqual(gameplayBefore);
    expect(visual.position).toEqual(rootPositionBefore);
    expect(visual.rotation.x).toBeCloseTo(rootRotationBefore.x);
    expect(visual.rotation.y).toBeCloseTo(rootRotationBefore.y);
    expect(visual.rotation.z).toBeCloseTo(rootRotationBefore.z);
    expect(bodyRoot?.rotation.y).toBeCloseTo(0);
    expect(leftArmPivot.rotation.x).not.toBeCloseTo(0);
    expect(leftLegPivot.rotation.x).not.toBeCloseTo(0);
    expect(visual.userData.playerPoseDefinitionId).toBe('running_contact_left');
  });

  it('exports and imports pose JSON without Object3D references', () => {
    const document = createPlayerPoseExportDocument(
      DEFAULT_PLAYER_POSES,
      DEFAULT_PLAYER_POSE_CLIPS,
      '2026-06-22T00:00:00.000Z',
    );
    const parsed = parsePlayerPoseExportDocument(serializePlayerPoseExportDocument(document));

    expect(parsed.schemaVersion).toBe(PLAYER_POSE_SCHEMA_VERSION);
    expect(parsed.units).toBe('radians');
    expect(parsed.poses).toHaveLength(DEFAULT_PLAYER_POSES.length);
    expect(parsed.clips).toHaveLength(DEFAULT_PLAYER_POSE_CLIPS.length);
    expect(parsed.poses.every((pose) => {
      return Object.values(pose.body).every((value) => typeof value === 'number') &&
        Object.values(pose.limbs).every((limb) =>
          Object.values(limb).every((value) => typeof value === 'number'),
        );
    })).toBe(true);
  });

  it('interpolates pose clips with numeric field blending only', () => {
    const sample = samplePlayerPoseClip(
      findClip('run_two_pose_loop'),
      DEFAULT_PLAYER_POSES,
      0.14,
    );

    expect(sample.id).toBe('run_two_pose_loop_sample');
    expect(sample.body.torsoPitch).toBeCloseTo(findPose('running_contact_left').body.torsoPitch);
    expect(sample.body.torsoRoll).toBeCloseTo(0);
    expect(sample.limbs.leftLeg.hipPitch).toBeCloseTo(-0.02);
    expect(sample.limbs.rightLeg.hipPitch).toBeCloseTo(-0.02);
  });

  it('rejects invalid pose JSON with useful validation errors', () => {
    const document = createPlayerPoseExportDocument([findPose('neutral')]);
    const payload = JSON.parse(serializePlayerPoseExportDocument(document)) as {
      poses: Array<Record<string, unknown>>;
    };
    payload.poses[0] = {
      ...payload.poses[0],
      body: {
        ...(payload.poses[0]?.body as Record<string, unknown>),
        extraBrokenAxis: 1,
      },
    };

    expect(() => parsePlayerPoseExportDocument(JSON.stringify(payload))).toThrow(/extraBrokenAxis is unknown/);
  });

  it('supports future rigged target metadata without applying a second implementation', () => {
    const neutral = clonePlayerPoseDefinition(findPose('neutral'));
    neutral.targetType = 'riggedSkeleton';
    const blended = interpolatePlayerPoseDefinitions(neutral, neutral, 0.5);

    expect(blended.targetType).toBe('riggedSkeleton');
    expect(validatePlayerPoseCollection([neutral], []).valid).toBe(true);
  });
});

function findPose(id: string) {
  const pose = DEFAULT_PLAYER_POSES.find((candidate) => candidate.id === id);
  if (!pose) {
    throw new Error(`Missing test pose ${id}`);
  }
  return pose;
}

function findClip(id: string) {
  const clip = DEFAULT_PLAYER_POSE_CLIPS.find((candidate) => candidate.id === id);
  if (!clip) {
    throw new Error(`Missing test clip ${id}`);
  }
  return clip;
}

function getRequiredObject(root: THREE.Object3D, name: string): THREE.Object3D {
  const object = root.getObjectByName(name);
  if (!object) {
    throw new Error(`Missing object ${name}`);
  }
  return object;
}
