import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { GameplaySnapshot, PlayState } from '../src/playState';
import { DEFAULT_PLAYER_MOVEMENT_PROFILE, type PlayerSnapshot } from '../src/playerModel';
import { createPlaceholderPlayerVisual, syncPlayerVisual } from '../src/playerVisual';
import {
  PLAYER_POSE_CONFIG,
  PlayerPoseController,
  calculateStablePhaseOffset,
  calculateStridePhaseAdvance,
  createPoseTarget,
  derivePlayerPoseIntent,
} from '../src/presentation/PlayerPoseController';
import {
  ensureRunAnimationPivots,
  updateKickAnimation,
  updateRunAnimation,
} from '../src/presentation/RunAnimation';

describe('player pose controller', () => {
  it('selects offensive and defensive ready poses during pre-snap', () => {
    expect(derivePlayerPoseIntent(createPlayer({ team: 'offense' }), 'preSnap')).toBe(
      'readyOffense',
    );
    expect(derivePlayerPoseIntent(createPlayer({ team: 'defense' }), 'preSnap')).toBe(
      'readyDefense',
    );
  });

  it('selects locomotion for moving active players', () => {
    const player = createPlayer({
      currentState: 'userControlled',
      velocity: { x: 0, z: 6 },
    });

    expect(derivePlayerPoseIntent(player, 'live')).toBe('locomotion');
  });

  it('returns stationary players to their team ready pose', () => {
    const player = createPlayer({
      currentState: 'userControlled',
      team: 'defense',
      velocity: { x: 0.01, z: 0 },
    });

    expect(derivePlayerPoseIntent(player, 'live')).toBe('readyDefense');
  });

  it('uses equal stride rates for equal velocities', () => {
    const first = calculateStridePhaseAdvance(0, 8, 0.05);
    const second = calculateStridePhaseAdvance(0, 8, 0.05);
    const slower = calculateStridePhaseAdvance(0, 4, 0.05);

    expect(first).toBeCloseTo(second);
    expect(first).toBeCloseTo(slower * 2);
  });

  it('uses deterministic phase offsets from stable player IDs', () => {
    expect(calculateStablePhaseOffset('offense-qb')).toBeCloseTo(
      calculateStablePhaseOffset('offense-qb'),
    );
    expect(calculateStablePhaseOffset('offense-qb')).not.toBeCloseTo(
      calculateStablePhaseOffset('defense-safety'),
    );
  });

  it('opposes arm and leg phases during locomotion within safe limits', () => {
    const pose = createPoseTarget('locomotion', Math.PI / 2);

    expect(pose.leftLegRotationX).toBeGreaterThan(0);
    expect(pose.rightLegRotationX).toBeLessThan(0);
    expect(pose.leftArmRotationX).toBeLessThan(0);
    expect(pose.rightArmRotationX).toBeGreaterThan(0);
    expect(Math.abs(pose.leftLegRotationX)).toBeLessThanOrEqual(
      PLAYER_POSE_CONFIG.safeLimits.legRotationX,
    );
    expect(Math.abs(pose.rightArmRotationX)).toBeLessThanOrEqual(
      PLAYER_POSE_CONFIG.safeLimits.armRotationX,
    );
  });

  it('does not mutate gameplay snapshots or authoritative root transforms', () => {
    const player = createPlayer({
      currentState: 'userControlled',
      velocity: { x: 0, z: 7 },
    });
    const gameplay = createGameplaySnapshot([player], 'live');
    const beforeGameplay = JSON.stringify(gameplay);
    const visual = createPlaceholderPlayerVisual(player);

    syncPlayerVisual(visual, player);
    const beforePosition = visual.position.clone();
    const beforeRotationY = visual.rotation.y;

    const controller = new PlayerPoseController();
    controller.update(gameplay, new Map([[player.id, visual]]), 0.1);

    expect(JSON.stringify(gameplay)).toBe(beforeGameplay);
    expect(visual.position.equals(beforePosition)).toBe(true);
    expect(visual.rotation.y).toBe(beforeRotationY);
    expect(visual.getObjectByName('leftLegPivot')?.rotation.x).not.toBe(0);
  });

  it('returns controller-owned run pivots to neutral after locomotion stops', () => {
    const movingPlayer = createPlayer({
      currentState: 'userControlled',
      velocity: { x: 0, z: 7 },
    });
    const stoppedPlayer = {
      ...movingPlayer,
      currentState: 'idle' as const,
      velocity: { x: 0, z: 0 },
    };
    const visual = createPlaceholderPlayerVisual(movingPlayer);
    const controller = new PlayerPoseController();

    controller.update(
      createGameplaySnapshot([movingPlayer], 'live'),
      new Map([[movingPlayer.id, visual]]),
      0.1,
    );
    const pivot = getPivot(visual, 'leftArmPivot');
    expect(Math.abs(pivot.rotation.x)).toBeGreaterThan(0);

    for (let index = 0; index < 30; index += 1) {
      controller.update(
        createGameplaySnapshot([stoppedPlayer], 'live'),
        new Map([[stoppedPlayer.id, visual]]),
        1 / 60,
      );
    }

    expect(Math.abs(pivot.rotation.x)).toBeLessThan(0.02);
  });

  it('can disable procedural motion for comparison', () => {
    const player = createPlayer({
      currentState: 'userControlled',
      velocity: { x: 0, z: 7 },
    });
    const visual = createPlaceholderPlayerVisual(player);
    const controller = new PlayerPoseController(undefined, { enabled: false });

    controller.update(createGameplaySnapshot([player], 'live'), new Map([[player.id, visual]]), 0.1);

    expect(controller.getPoseSnapshots()).toMatchObject([
      {
        intent: 'neutral',
        playerId: player.id,
      },
    ]);
    expect(visual.getObjectByName('leftLegPivot')?.rotation.equals(new THREE.Euler())).toBe(true);
  });

  it('updates stiff run animation with opposite arm and leg swing phases', () => {
    const visual = createPlaceholderPlayerVisual(createPlayer());

    updateRunAnimation(visual, 0.1, 7);

    const leftArmPivot = getPivot(visual, 'leftArmPivot');
    const rightArmPivot = getPivot(visual, 'rightArmPivot');
    const leftLegPivot = getPivot(visual, 'leftLegPivot');
    const rightLegPivot = getPivot(visual, 'rightLegPivot');

    expect(leftArmPivot.rotation.x).not.toBe(0);
    expect(rightArmPivot.rotation.x).toBeCloseTo(-leftArmPivot.rotation.x);
    expect(Math.sign(leftArmPivot.rotation.x)).toBe(-Math.sign(leftLegPivot.rotation.x));
    expect(Math.sign(rightArmPivot.rotation.x)).toBe(-Math.sign(rightLegPivot.rotation.x));
  });

  it('smoothly returns stiff run animation pivots to neutral when speed stops', () => {
    const visual = createPlaceholderPlayerVisual(createPlayer());

    updateRunAnimation(visual, 0.1, 7);
    const pivot = getPivot(visual, 'leftArmPivot');
    const initialSwing = Math.abs(pivot.rotation.x);

    for (let index = 0; index < 30; index += 1) {
      updateRunAnimation(visual, 1 / 60, 0);
    }

    expect(Math.abs(pivot.rotation.x)).toBeLessThan(initialSwing);
    expect(Math.abs(pivot.rotation.x)).toBeLessThan(0.02);
  });

  it('applies ready and locomotion poses directly to imported rig bones', () => {
    const player = createPlayer({ team: 'offense' });
    const rig = createRiggedPlayerVisual();
    const controller = new PlayerPoseController();

    controller.update(
      createGameplaySnapshot([player], 'preSnap'),
      new Map([[player.id, rig.root]]),
      1 / 60,
    );

    expect(Math.abs(rig.bones.hips.rotation.x - rig.rest.hips.x)).toBeGreaterThan(0.0001);
    expect(Math.abs(rig.bones.spine.rotation.x - rig.rest.spine.x)).toBeGreaterThan(0.0001);
    expect(Math.abs(rig.bones.spine01.rotation.x - rig.rest.spine01.x)).toBeGreaterThan(0.0001);
    expect(Math.abs(rig.bones.spine02.rotation.x - rig.rest.spine02.x)).toBeGreaterThan(0.0001);
    expect(rig.bones.leftArm.rotation.x).not.toBeCloseTo(rig.rest.leftArm.x);
    expect(rig.bones.rightArm.rotation.x).not.toBeCloseTo(rig.rest.rightArm.x);

    const movingPlayer = {
      ...player,
      currentState: 'userControlled' as const,
      velocity: { x: 0, z: 7 },
    };
    controller.update(
      createGameplaySnapshot([movingPlayer], 'live'),
      new Map([[player.id, rig.root]]),
      1 / 60,
    );

    expect(rig.bones.leftUpLeg.rotation.x).not.toBeCloseTo(rig.rest.leftUpLeg.x);
    expect(rig.bones.rightUpLeg.rotation.x).not.toBeCloseTo(rig.rest.rightUpLeg.x);
    expect(rig.bones.leftFoot.rotation.x).not.toBeCloseTo(rig.rest.leftFoot.x);
    expect(rig.bones.rightFoot.rotation.x).not.toBeCloseTo(rig.rest.rightFoot.x);
    expectSyntheticRunPivotsToBeMissing(rig.root);
    expect(rig.skinnedMesh.parent).toBe(rig.bodyRoot);
  });

  it('returns imported run bones to their authored rest rotations without synthetic pivots', () => {
    const rig = createRiggedPlayerVisual();

    updateRunAnimation(rig.root, 0.1, 7);
    expect(rig.bones.leftArm.rotation.x).not.toBeCloseTo(rig.rest.leftArm.x);
    expect(rig.bones.rightUpLeg.rotation.x).not.toBeCloseTo(rig.rest.rightUpLeg.x);

    for (let index = 0; index < 30; index += 1) {
      updateRunAnimation(rig.root, 1 / 60, 0);
    }

    expect(rig.bones.leftArm.rotation.x).toBeCloseTo(rig.rest.leftArm.x, 2);
    expect(rig.bones.rightArm.rotation.x).toBeCloseTo(rig.rest.rightArm.x, 2);
    expect(rig.bones.leftUpLeg.rotation.x).toBeCloseTo(rig.rest.leftUpLeg.x, 2);
    expect(rig.bones.rightUpLeg.rotation.x).toBeCloseTo(rig.rest.rightUpLeg.x, 2);
    expectSyntheticRunPivotsToBeMissing(rig.root);
    expect(rig.skinnedMesh.parent).toBe(rig.bodyRoot);
  });

  it('pitches the kicking hip backward before swinging forward through contact', () => {
    const visual = createPlaceholderPlayerVisual(createPlayer());

    updateKickAnimation(visual, 0.25);
    const rightLegPivot = getPivot(visual, 'rightLegPivot');
    const leftLegPivot = getPivot(visual, 'leftLegPivot');
    const backswing = rightLegPivot.rotation.x;

    updateKickAnimation(visual, 0.9);
    const followThrough = rightLegPivot.rotation.x;

    expect(visual.userData.kickAnimationInitialized).toBe(true);
    expect(backswing).toBeLessThan(-0.1);
    expect(followThrough).toBeGreaterThan(0.3);
    expect(Math.abs(leftLegPivot.rotation.x)).toBeLessThan(Math.abs(followThrough));
  });

  it('applies kick motion to imported bones without reparenting the skinned body', () => {
    const rig = createRiggedPlayerVisual();

    updateKickAnimation(rig.root, 0.25);
    const backswing = rig.bones.rightUpLeg.rotation.x - rig.rest.rightUpLeg.x;

    updateKickAnimation(rig.root, 0.9);
    const followThrough = rig.bones.rightUpLeg.rotation.x - rig.rest.rightUpLeg.x;

    expect(backswing).toBeLessThan(-0.1);
    expect(followThrough).toBeGreaterThan(0.3);
    expect(rig.bones.leftArm.rotation.x).not.toBeCloseTo(rig.rest.leftArm.x);
    expect(rig.bones.rightArm.rotation.x).not.toBeCloseTo(rig.rest.rightArm.x);
    expectSyntheticRunPivotsToBeMissing(rig.root);
    expect(rig.skinnedMesh.parent).toBe(rig.bodyRoot);
  });

  it('creates missing limb pivots without moving existing limb meshes', () => {
    const visual = new THREE.Group();
    const bodyRoot = new THREE.Group();
    bodyRoot.name = 'bodyRoot';
    visual.add(bodyRoot);

    const limbs = ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'].map((name, index) => {
      const limb = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.5, 0.2),
        new THREE.MeshBasicMaterial(),
      );
      limb.name = name;
      limb.position.set(index - 1.5, 0.25 - index * 0.1, index * 0.05);
      bodyRoot.add(limb);
      return limb;
    });
    visual.position.set(2, 1, -3);
    visual.rotation.y = 0.4;
    visual.updateWorldMatrix(true, true);
    const beforePositions = limbs.map((limb) => limb.getWorldPosition(new THREE.Vector3()));

    const pivots = ensureRunAnimationPivots(visual);
    visual.updateWorldMatrix(true, true);

    expect(visual.userData.leftArmPivot).toBe(pivots.leftArmPivot);
    expect(visual.userData.rightArmPivot).toBe(pivots.rightArmPivot);
    expect(visual.userData.leftLegPivot).toBe(pivots.leftLegPivot);
    expect(visual.userData.rightLegPivot).toBe(pivots.rightLegPivot);
    expect(pivots.leftArmPivot).toBeInstanceOf(THREE.Group);
    expect(pivots.leftLegPivot).toBeInstanceOf(THREE.Group);

    for (const [index, limb] of limbs.entries()) {
      expect(limb.getWorldPosition(new THREE.Vector3()).distanceTo(beforePositions[index])).toBeLessThan(
        0.000001,
      );
    }
  });
});

function createPlayer(overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  return {
    collisionRadius: 0.75,
    currentState: 'idle',
    facingRadians: 0,
    id: 'test-player',
    position: { x: 0, z: -20 },
    role: 'runner',
    team: 'offense',
    velocity: { x: 0, z: 0 },
    ...overrides,
    movement: overrides.movement ?? DEFAULT_PLAYER_MOVEMENT_PROFILE,
  };
}

function createGameplaySnapshot(
  players: PlayerSnapshot[],
  playState: PlayState,
): GameplaySnapshot {
  return {
    playState,
    players,
  } as unknown as GameplaySnapshot;
}

function getPivot(visual: THREE.Object3D, name: string): THREE.Object3D {
  const pivot = visual.getObjectByName(name);

  if (!pivot) {
    throw new Error(`Missing ${name}`);
  }

  return pivot;
}

interface RiggedPlayerVisualFixture {
  bodyRoot: THREE.Group;
  bones: {
    hips: THREE.Bone;
    leftArm: THREE.Bone;
    leftFoot: THREE.Bone;
    leftUpLeg: THREE.Bone;
    rightArm: THREE.Bone;
    rightFoot: THREE.Bone;
    rightUpLeg: THREE.Bone;
    spine: THREE.Bone;
    spine01: THREE.Bone;
    spine02: THREE.Bone;
  };
  rest: Record<keyof RiggedPlayerVisualFixture['bones'], THREE.Euler>;
  root: THREE.Group;
  skinnedMesh: THREE.SkinnedMesh;
}

function createRiggedPlayerVisual(): RiggedPlayerVisualFixture {
  const root = new THREE.Group();
  root.userData.playerBodyStyle = 'meshyRigged';
  root.userData.riggedPlayerVisual = true;
  const bodyRoot = new THREE.Group();
  bodyRoot.name = 'bodyRoot';
  root.add(bodyRoot);

  const armature = new THREE.Group();
  armature.name = 'Armature';
  const hips = createBone('Hips', { x: 0.07, z: -0.02 });
  const spine = createBone('Spine', { x: -0.03 });
  const spine01 = createBone('Spine01', { x: 0.02 });
  const spine02 = createBone('Spine02', { x: -0.01 });
  const leftArm = createBone('LeftArm', { x: 0.18, z: 0.04 });
  const rightArm = createBone('RightArm', { x: -0.16, z: -0.05 });
  const leftUpLeg = createBone('LeftUpLeg', { x: 0.09, z: 0.02 });
  const rightUpLeg = createBone('RightUpLeg', { x: -0.08, z: -0.03 });
  const leftFoot = createBone('LeftFoot', { x: 0.05 });
  const rightFoot = createBone('RightFoot', { x: -0.04 });

  armature.add(hips);
  hips.add(spine, leftUpLeg, rightUpLeg);
  spine.add(spine01);
  spine01.add(spine02);
  spine02.add(leftArm, rightArm);
  leftUpLeg.add(leftFoot);
  rightUpLeg.add(rightFoot);
  bodyRoot.add(armature);

  const skinnedMesh = new THREE.SkinnedMesh(
    new THREE.BoxGeometry(0.7, 1.8, 0.35),
    new THREE.MeshBasicMaterial(),
  );
  skinnedMesh.name = 'player_body_skinned';
  bodyRoot.add(skinnedMesh);

  const bones = {
    hips,
    leftArm,
    leftFoot,
    leftUpLeg,
    rightArm,
    rightFoot,
    rightUpLeg,
    spine,
    spine01,
    spine02,
  };
  const rest = Object.fromEntries(
    Object.entries(bones).map(([name, bone]) => [name, bone.rotation.clone()]),
  ) as RiggedPlayerVisualFixture['rest'];

  return { bodyRoot, bones, rest, root, skinnedMesh };
}

function createBone(
  name: string,
  rotation: { x?: number; y?: number; z?: number } = {},
): THREE.Bone {
  const bone = new THREE.Bone();
  bone.name = name;
  bone.rotation.set(rotation.x ?? 0, rotation.y ?? 0, rotation.z ?? 0);
  return bone;
}

function expectSyntheticRunPivotsToBeMissing(root: THREE.Object3D): void {
  expect(root.getObjectByName('leftArmPivot')).toBeUndefined();
  expect(root.getObjectByName('rightArmPivot')).toBeUndefined();
  expect(root.getObjectByName('leftLegPivot')).toBeUndefined();
  expect(root.getObjectByName('rightLegPivot')).toBeUndefined();
}
