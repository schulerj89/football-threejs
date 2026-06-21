import { describe, expect, it } from 'vitest';
import { SNAP_LANE_X, type SnapLane } from '../src/ballSpotting';
import { PLAYABLE_FIELD_BOUNDS } from '../src/field';
import { FORMATION_MEASUREMENTS, resolveFormation } from '../src/formationLayout';
import {
  SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS,
  SEVEN_ON_SEVEN_PLAYER_IDS,
  SEVEN_ON_SEVEN_PREVIEW_FORMATION,
  createFormationPreviewModel,
  createSnapPlacementForLane,
  setFormationPreviewSnapLane,
  snapshotFormationPreviewModel,
} from '../src/formationPreview';
import type { ResolvedFormation, ResolvedFormationSlot } from '../src/formationLayout';

describe('7v7 formation preview', () => {
  it('resolves all three snap lanes into valid seven-on-seven formations', () => {
    for (const lane of ['leftHash', 'middle', 'rightHash'] satisfies SnapLane[]) {
      const preview = createFormationPreviewModel('7v7', lane);
      const snapshot = snapshotFormationPreviewModel(preview);

      expect(snapshot.issues).toEqual([]);
      expect(snapshot.snapLane).toBe(lane);
      expect(snapshot.snapPlacement.spot.x).toBe(SNAP_LANE_X[lane]);
      expect(snapshot.players).toHaveLength(14);
      expect(snapshot.players.filter((player) => player.team === 'offense')).toHaveLength(7);
      expect(snapshot.players.filter((player) => player.team === 'defense')).toHaveLength(7);
      expect(snapshot.players.map((player) => player.id).sort()).toEqual(
        [...SEVEN_ON_SEVEN_PLAYER_IDS].sort(),
      );
      expect(new Set(snapshot.players.map((player) => player.id)).size).toBe(14);
      expect(snapshot.players.every((player) => player.currentState === 'idle')).toBe(true);
      expect(snapshot.players.every((player) => insidePlayableBounds(player.position))).toBe(true);
    }
  });

  it('mirrors hash-dependent backfield and line positions across left and right hash', () => {
    const leftHash = createFormationPreviewModel('7v7', 'leftHash').formation;
    const rightHash = createFormationPreviewModel('7v7', 'rightHash').formation;

    expect(leftHash.fieldSide).toBe('right');
    expect(rightHash.fieldSide).toBe('left');
    expect(getSlot(leftHash, 'offense-rb').position.x).toBeCloseTo(
      -getSlot(rightHash, 'offense-rb').position.x,
    );
    expect(getSlot(leftHash, 'offense-line-left').position.x).toBeCloseTo(
      -getSlot(rightHash, 'offense-line-right').position.x,
    );
    expect(getSlot(leftHash, 'offense-line-right').position.x).toBeCloseTo(
      -getSlot(rightHash, 'offense-line-left').position.x,
    );
  });

  it('keeps offensive line spacing consistent around the center', () => {
    const formation = createFormationPreviewModel('7v7', 'middle').formation;
    const left = getSlot(formation, 'offense-line-left');
    const center = getSlot(formation, 'offense-center');
    const right = getSlot(formation, 'offense-line-right');

    expect(center.position.x).toBeCloseTo(formation.snapPlacement.spot.x);
    expect(left.position.z).toBeCloseTo(center.position.z);
    expect(right.position.z).toBeCloseTo(center.position.z);
    expect(center.position.x - left.position.x).toBeCloseTo(
      SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.offensiveLineSpacing,
    );
    expect(right.position.x - center.position.x).toBeCloseTo(
      SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.offensiveLineSpacing,
    );
  });

  it('preserves receiver sideline insets', () => {
    const formation = createFormationPreviewModel('7v7', 'middle').formation;

    expect(sidelineInset(getSlot(formation, 'offense-wr-left'))).toBeCloseTo(
      SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.receiverSidelineInset,
    );
    expect(sidelineInset(getSlot(formation, 'offense-wr-right'))).toBeCloseTo(
      SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.receiverSidelineInset,
    );
  });

  it('aligns defenders to declared gaps and offensive references', () => {
    const formation = createFormationPreviewModel('7v7', 'middle').formation;
    const receiverMidpoint =
      (getSlot(formation, 'offense-wr-left').position.x +
        getSlot(formation, 'offense-wr-right').position.x) /
      2;

    expect(getSlot(formation, 'defense-line-left').lateralDistanceFromSnap).toBeCloseTo(
      -SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.defensiveLineGap,
    );
    expect(getSlot(formation, 'defense-line-middle').lateralDistanceFromSnap).toBeCloseTo(0);
    expect(getSlot(formation, 'defense-line-right').lateralDistanceFromSnap).toBeCloseTo(
      SEVEN_ON_SEVEN_FORMATION_MEASUREMENTS.defensiveLineGap,
    );
    expect(getSlot(formation, 'defense-corner-left').position.x).toBeCloseTo(
      getSlot(formation, 'offense-wr-left').position.x,
    );
    expect(getSlot(formation, 'defense-corner-right').position.x).toBeCloseTo(
      getSlot(formation, 'offense-wr-right').position.x,
    );
    expect(getSlot(formation, 'defense-linebacker').position.x).toBeCloseTo(
      getSlot(formation, 'offense-center').position.x,
    );
    expect(getSlot(formation, 'defense-safety').position.x).toBeCloseTo(receiverMidpoint);
  });

  it('has no duplicate or overlapping positions', () => {
    const formation = createFormationPreviewModel('7v7', 'middle').formation;

    for (let outer = 0; outer < formation.slots.length; outer += 1) {
      for (let inner = outer + 1; inner < formation.slots.length; inner += 1) {
        const first = formation.slots[outer];
        const second = formation.slots[inner];

        expect(distance(first, second)).toBeGreaterThanOrEqual(
          FORMATION_MEASUREMENTS.minimumPlayerClearance,
        );
      }
    }
  });

  it('resets preview players in place when switching snap lanes', () => {
    const preview = createFormationPreviewModel('7v7', 'middle');
    const playersBefore = preview.players;

    setFormationPreviewSnapLane(preview, 'rightHash');

    expect(preview.players).toBe(playersBefore);
    expect(preview.snapPlacement.lane).toBe('rightHash');
    expect(preview.players.every((player) => player.currentState === 'idle')).toBe(true);
    expect(getPreviewPlayer(preview, 'offense-center').position.x).toBeCloseTo(SNAP_LANE_X.rightHash);
  });

  it('reports clear validation errors for invalid preview geometry', () => {
    const invalidFormation = resolveFormation(
      {
        ...SEVEN_ON_SEVEN_PREVIEW_FORMATION,
        formation: SEVEN_ON_SEVEN_PREVIEW_FORMATION.formation.map((slot) =>
          slot.id === 'offense-wr-left'
            ? {
                ...slot,
                lateral: {
                  kind: 'snap',
                  offsetYards: 0,
                },
              }
            : slot,
        ),
      },
      createSnapPlacementForLane('middle'),
    );

    expect(invalidFormation.issues.map((issue) => issue.message)).toContain(
      'offense-wr-left does not preserve receiver sideline inset',
    );
  });
});

function getSlot(formation: ResolvedFormation, playerId: string): ResolvedFormationSlot {
  const slot = formation.slots.find((candidate) => candidate.id === playerId);

  if (!slot) {
    throw new Error(`Missing slot ${playerId}`);
  }

  return slot;
}

function getPreviewPlayer(
  preview: ReturnType<typeof createFormationPreviewModel>,
  playerId: string,
) {
  const player = preview.players.find((candidate) => candidate.id === playerId);

  if (!player) {
    throw new Error(`Missing preview player ${playerId}`);
  }

  return player;
}

function insidePlayableBounds(position: { x: number; z: number }): boolean {
  return (
    position.x >= PLAYABLE_FIELD_BOUNDS.minX &&
    position.x <= PLAYABLE_FIELD_BOUNDS.maxX &&
    position.z >= PLAYABLE_FIELD_BOUNDS.minZ &&
    position.z <= PLAYABLE_FIELD_BOUNDS.maxZ
  );
}

function sidelineInset(slot: ResolvedFormationSlot): number {
  return Math.min(
    Math.abs(slot.position.x - PLAYABLE_FIELD_BOUNDS.minX),
    Math.abs(PLAYABLE_FIELD_BOUNDS.maxX - slot.position.x),
  );
}

function distance(first: ResolvedFormationSlot, second: ResolvedFormationSlot): number {
  return Math.hypot(first.position.x - second.position.x, first.position.z - second.position.z);
}
