import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { resolveGameplayCameraFocus } from '../../src/camera/CameraFocusResolver';
import { SNAP_LANE_X, type SnapLane } from '../../src/ballSpotting';
import { FIELD_DIRECTION } from '../../src/fieldSpec';
import {
  OFFICIAL_CREW,
  getSafeSidelineX,
} from '../../src/officials/OfficialConfiguration';
import {
  isOfficialInsidePresentationBounds,
  resolveOfficialFormation,
} from '../../src/officials/OfficialFormation';
import {
  createOfficialCrewState,
  resetOfficialCrewState,
  updateOfficialCrewState,
} from '../../src/officials/OfficialSimulation';
import {
  createOfficialVisualResources,
} from '../../src/officials/OfficialVisualFactory';
import { OfficialsPresentationController } from '../../src/officials/OfficialsPresentationController';
import type {
  DirectionOfPlay,
  OfficialFormationInput,
  OfficialRole,
} from '../../src/officials/OfficialTypes';
import {
  createGameplayModel,
  snapshotGameplayModel,
  startPlay,
} from '../../src/playState';

describe('football officials formation', () => {
  it('defines the seven stable football-official IDs', () => {
    expect(OFFICIAL_CREW.map((official) => official.id)).toEqual([
      'official-referee',
      'official-umpire',
      'official-down-judge',
      'official-line-judge',
      'official-field-judge',
      'official-side-judge',
      'official-back-judge',
    ]);
  });

  it('resolves legal pre-snap positions at every snap lane', () => {
    const lanes: SnapLane[] = ['leftHash', 'middle', 'rightHash'];

    for (const lane of lanes) {
      const officials = resolveOfficialFormation(makeInput({
        ballX: SNAP_LANE_X[lane],
        playState: 'preSnap',
      }));

      expect(officials).toHaveLength(7);
      expect(new Set(officials.map((official) => official.id)).size).toBe(7);
      expect(officials.every(isOfficialInsidePresentationBounds)).toBe(true);
      expect(officials.every((official) => official.poseIntent === 'neutral')).toBe(true);
      expect(officials.every((official) => official.updateState === 'formation')).toBe(true);
    }
  });

  it('mirrors longitudinal offsets with direction of play', () => {
    const positiveDirection = resolveOfficialFormation(makeInput({
      directionOfPlay: 1,
      playState: 'preSnap',
    }));
    const negativeDirection = resolveOfficialFormation(makeInput({
      directionOfPlay: -1,
      playState: 'preSnap',
    }));

    for (const positiveOfficial of positiveDirection) {
      const negativeOfficial = negativeDirection.find(
        (candidate) => candidate.id === positiveOfficial.id,
      );
      if (!negativeOfficial) {
        throw new Error(`Missing mirrored official ${positiveOfficial.id}`);
      }

      const referenceZ = getPreSnapReferenceZ(positiveOfficial.role);
      expect(positiveOfficial.position.z - referenceZ).toBeCloseTo(
        -(negativeOfficial.position.z - referenceZ),
      );
    }
  });

  it('keeps sideline officials near their assigned sidelines', () => {
    const officials = resolveOfficialFormation(makeInput({ playState: 'preSnap' }));
    const sidelineOfficials = officials.filter((official) => official.assignedSideline);

    expect(sidelineOfficials).toHaveLength(4);
    for (const official of sidelineOfficials) {
      expect(official.position.x).toBeCloseTo(getSafeSidelineX(official.assignedSideline!));
    }
  });
});

describe('football officials simulation', () => {
  it('does not drift during repeated pre-snap updates', () => {
    const input = makeInput({ playState: 'preSnap' });
    const state = createOfficialCrewState(input);
    const initial = state.officials.map((official) => ({
      facingRadians: official.facingRadians,
      id: official.id,
      position: { ...official.position },
    }));

    for (let frame = 0; frame < 300; frame += 1) {
      updateOfficialCrewState(state, input, 1 / 60);
    }

    for (const official of state.officials) {
      const start = initial.find((candidate) => candidate.id === official.id);
      expect(start).toBeDefined();
      expect(official.position.x).toBeCloseTo(start!.position.x);
      expect(official.position.z).toBeCloseTo(start!.position.z);
      expect(official.facingRadians).toBeCloseTo(start!.facingRadians);
    }
  });

  it('tracks the ball live while staying inside presentation bounds', () => {
    const state = createOfficialCrewState(makeInput({ playState: 'preSnap' }));
    const liveInput = makeInput({
      ballX: 8,
      ballZ: 2,
      playState: 'live',
    });

    for (let frame = 0; frame < 30; frame += 1) {
      updateOfficialCrewState(state, liveInput, 1 / 60);
    }

    expect(state.officials.every(isOfficialInsidePresentationBounds)).toBe(true);
    expect(state.officials.some((official) => official.updateState === 'tracking')).toBe(true);
    expect(
      state.officials.some((official) => official.distanceFromBall < 18),
    ).toBe(true);
  });

  it('starts touchdown signals only after an authoritative touchdown result', () => {
    const state = createOfficialCrewState(makeInput({ playState: 'preSnap' }));
    updateOfficialCrewState(state, makeInput({ playState: 'live' }), 1 / 60);

    expect(state.officials.every((official) => official.poseIntent !== 'touchdown')).toBe(true);

    updateOfficialCrewState(
      state,
      makeInput({
        deadBallX: 3,
        deadBallZ: 50,
        playResultType: 'touchdown',
        playState: 'dead',
      }),
      1 / 60,
    );

    expect(state.officials.every((official) => official.poseIntent === 'touchdown')).toBe(true);
  });

  it('reset restores exact formation position and facing', () => {
    const preSnap = makeInput({ ballX: SNAP_LANE_X.rightHash, playState: 'preSnap' });
    const state = createOfficialCrewState(preSnap);
    updateOfficialCrewState(
      state,
      makeInput({ ballX: -10, ballZ: 18, playState: 'live' }),
      1,
    );

    resetOfficialCrewState(state, preSnap);
    const expected = resolveOfficialFormation(preSnap);

    for (const official of state.officials) {
      const expectedOfficial = expected.find((candidate) => candidate.id === official.id);
      expect(expectedOfficial).toBeDefined();
      expect(official.position.x).toBeCloseTo(expectedOfficial!.position.x);
      expect(official.position.z).toBeCloseTo(expectedOfficial!.position.z);
      expect(official.facingRadians).toBeCloseTo(expectedOfficial!.facingRadians);
    }
  });
});

describe('football officials presentation', () => {
  it('renders officials with bounded shared instanced resources', () => {
    const officials = resolveOfficialFormation(makeInput({ playState: 'preSnap' }));
    const resources = createOfficialVisualResources(officials);

    expect(resources.metrics.meshCount).toBe(9);
    expect(resources.metrics.geometryCount).toBe(9);
    expect(resources.metrics.materialCount).toBe(3);
    expect(resources.metrics.triangleCount).toBeGreaterThan(0);
    expect(countObjects(resources.group)).toBeLessThan(12);

    resources.dispose();
    expect(resources.group.children).toHaveLength(0);
  });

  it('disabling officials disposes visuals and repeated resets do not accumulate roots', () => {
    const gameplay = createGameplayModel({ playbookId: '11v11' });
    const snapshot = snapshotGameplayModel(gameplay);
    const controller = new OfficialsPresentationController({ enabled: true });

    for (let resetIndex = 0; resetIndex < 20; resetIndex += 1) {
      controller.reset(snapshot);
      controller.update(snapshot, 1 / 60, true);
      expect(controller.group.children).toHaveLength(1);
      expect(controller.getSnapshot().visibleOfficialCount).toBe(7);
    }

    controller.applySettings({ enabled: false });
    expect(controller.group.children).toHaveLength(0);
    expect(controller.getSnapshot().visibleOfficialCount).toBe(0);
    controller.dispose();
  });

  it('keeps officials out of gameplay rosters and camera focus authority', () => {
    const gameplay = createGameplayModel({ playbookId: '11v11' });
    startPlay(gameplay);
    const snapshot = snapshotGameplayModel(gameplay);
    const officialIds = new Set<string>(OFFICIAL_CREW.map((official) => official.id));
    const focus = resolveGameplayCameraFocus(snapshot);

    expect(snapshot.players.some((player) => officialIds.has(player.id))).toBe(false);
    expect(snapshot.players).toHaveLength(22);
    expect(focus.focusSource).toBe('ball');
    expect(focus.focusPosition.x).toBeCloseTo(snapshot.ball.position.x);
    expect(focus.focusPosition.z).toBeCloseTo(snapshot.ball.position.z);
  });
});

function makeInput({
  ballX = 0,
  ballZ = -15,
  deadBallX = null,
  deadBallZ = null,
  directionOfPlay = FIELD_DIRECTION.playDirectionZ as DirectionOfPlay,
  playResultType = null,
  playState,
}: {
  ballX?: number;
  ballZ?: number;
  deadBallX?: number | null;
  deadBallZ?: number | null;
  directionOfPlay?: DirectionOfPlay;
  playResultType?: OfficialFormationInput['playResultType'];
  playState: OfficialFormationInput['playState'];
}): OfficialFormationInput {
  return {
    ballPosition: { x: ballX, z: ballZ },
    deadBallSpot:
      deadBallX === null || deadBallZ === null
        ? null
        : { x: deadBallX, z: deadBallZ },
    directionOfPlay,
    lineOfScrimmage: { x: ballX, z: -15 },
    playResultType,
    playState,
  };
}

function getPreSnapReferenceZ(role: OfficialRole): number {
  if (role === 'referee') {
    return -15;
  }

  return -15;
}

function countObjects(root: THREE.Object3D): number {
  let count = 0;
  root.traverse(() => {
    count += 1;
  });
  return count;
}
