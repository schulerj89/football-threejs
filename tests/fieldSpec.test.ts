import { describe, expect, it } from 'vitest';
import {
  FAR_GOAL_LINE_Z,
  ARCADE_HASH_SPACING_MULTIPLIER,
  FIELD_BOUNDS,
  FIELD_DIMENSIONS,
  FIELD_OF_PLAY_BOUNDS,
  FIELD_MARKING_DIMENSIONS,
  FIELD_MARKING_WIDTHS,
  FULL_FIELD_BOUNDS,
  HASH_DISTANCE_FROM_SIDELINE_YARDS,
  PROFESSIONAL_HASH_X,
  INITIAL_BALL_SPOT,
  NEAR_GOAL_LINE_Z,
  PLAYABLE_FIELD_BOUNDS,
  PLAYER_MOVEMENT_BOUNDS,
  createFieldLayout,
  isBoundsContained,
} from '../src/fieldSpec';
import {
  calculateYardsGained,
  footballYardsToWorldUnits,
  worldUnitsToFootballYards,
} from '../src/fieldScale';

describe('field specification', () => {
  it('keeps every marking inside the authoritative field bounds', () => {
    const layout = createFieldLayout();

    for (const marking of layout.markings) {
      expect(isBoundsContained(marking.bounds, FIELD_BOUNDS), marking.id).toBe(true);
    }
  });

  it('keeps parallel boundary line dimensions equal', () => {
    const layout = createFieldLayout();
    const leftSideline = getMarking(layout, 'left-sideline');
    const rightSideline = getMarking(layout, 'right-sideline');
    const nearEndLine = getMarking(layout, 'near-end-line');
    const farEndLine = getMarking(layout, 'far-end-line');

    expect(leftSideline.size).toEqual(rightSideline.size);
    expect(nearEndLine.size).toEqual(farEndLine.size);
  });

  it('places opposite boundaries symmetrically', () => {
    const layout = createFieldLayout();
    const leftSideline = getMarking(layout, 'left-sideline');
    const rightSideline = getMarking(layout, 'right-sideline');
    const nearEndLine = getMarking(layout, 'near-end-line');
    const farEndLine = getMarking(layout, 'far-end-line');

    expect(leftSideline.center.x).toBeCloseTo(-rightSideline.center.x);
    expect(leftSideline.center.z).toBeCloseTo(rightSideline.center.z);
    expect(nearEndLine.center.z).toBeCloseTo(-farEndLine.center.z);
    expect(nearEndLine.center.x).toBeCloseTo(farEndLine.center.x);
  });

  it('aligns boundary outer paint edges with the field outer edges', () => {
    const layout = createFieldLayout();
    const leftSideline = getMarking(layout, 'left-sideline');
    const rightSideline = getMarking(layout, 'right-sideline');
    const nearEndLine = getMarking(layout, 'near-end-line');
    const farEndLine = getMarking(layout, 'far-end-line');

    expect(leftSideline.bounds.minX).toBeCloseTo(FIELD_BOUNDS.minX);
    expect(rightSideline.bounds.maxX).toBeCloseTo(FIELD_BOUNDS.maxX);
    expect(nearEndLine.bounds.minZ).toBeCloseTo(FIELD_BOUNDS.minZ);
    expect(farEndLine.bounds.maxZ).toBeCloseTo(FIELD_BOUNDS.maxZ);
  });

  it('defines the football field dimensions from the authoritative spec', () => {
    expect(FIELD_DIMENSIONS.fieldLength).toBe(120);
    expect(FIELD_BOUNDS.maxZ - FIELD_BOUNDS.minZ).toBe(120);
    expect(FULL_FIELD_BOUNDS.maxZ - FULL_FIELD_BOUNDS.minZ).toBe(120);
    expect(FAR_GOAL_LINE_Z - NEAR_GOAL_LINE_Z).toBe(100);
    expect(FIELD_OF_PLAY_BOUNDS.maxZ - FIELD_OF_PLAY_BOUNDS.minZ).toBe(100);
    expect(PLAYABLE_FIELD_BOUNDS.maxZ - PLAYABLE_FIELD_BOUNDS.minZ).toBe(100);
    expect(PLAYER_MOVEMENT_BOUNDS.maxZ - PLAYER_MOVEMENT_BOUNDS.minZ).toBe(120);
    expect(NEAR_GOAL_LINE_Z - FIELD_BOUNDS.minZ).toBe(10);
    expect(FIELD_BOUNDS.maxZ - FAR_GOAL_LINE_Z).toBe(10);
    expect(FIELD_DIMENSIONS.fieldWidth).toBe(160 / 3);
    expect(FIELD_BOUNDS.maxX - FIELD_BOUNDS.minX).toBe(160 / 3);
  });

  it('places rectangular end-zone pylons on each mathematical end-zone corner', () => {
    const layout = createFieldLayout();

    expect(layout.pylons).toHaveLength(8);
    expect(layout.pylons.map((pylon) => pylon.id)).toEqual([
      'near-end-zone-endLine-left-pylon',
      'near-end-zone-endLine-right-pylon',
      'near-end-zone-goalLine-left-pylon',
      'near-end-zone-goalLine-right-pylon',
      'far-end-zone-goalLine-left-pylon',
      'far-end-zone-goalLine-right-pylon',
      'far-end-zone-endLine-left-pylon',
      'far-end-zone-endLine-right-pylon',
    ]);

    const expectedCorners = new Set([
      `${FIELD_BOUNDS.minX}:${FIELD_BOUNDS.minZ}`,
      `${FIELD_BOUNDS.maxX}:${FIELD_BOUNDS.minZ}`,
      `${FIELD_BOUNDS.minX}:${NEAR_GOAL_LINE_Z}`,
      `${FIELD_BOUNDS.maxX}:${NEAR_GOAL_LINE_Z}`,
      `${FIELD_BOUNDS.minX}:${FAR_GOAL_LINE_Z}`,
      `${FIELD_BOUNDS.maxX}:${FAR_GOAL_LINE_Z}`,
      `${FIELD_BOUNDS.minX}:${FIELD_BOUNDS.maxZ}`,
      `${FIELD_BOUNDS.maxX}:${FIELD_BOUNDS.maxZ}`,
    ]);
    const actualCorners = new Set(layout.pylons.map((pylon) => `${pylon.center.x}:${pylon.center.z}`));

    expect(actualCorners).toEqual(expectedCorners);
  });

  it('spaces yard lines exactly five yards apart', () => {
    const yardLineZ = createFieldLayout()
      .markings
      .filter((marking) => marking.kind === 'yardLine')
      .map((marking) => marking.center.z)
      .sort((a, b) => a - b);

    for (let index = 1; index < yardLineZ.length; index += 1) {
      expect(yardLineZ[index] - yardLineZ[index - 1]).toBe(5);
    }
  });

  it('spaces hashes exactly one yard apart on each hash row', () => {
    const leftHashZ = createFieldLayout()
      .markings
      .filter((marking) => marking.kind === 'hash' && marking.center.x < 0)
      .map((marking) => marking.center.z)
      .sort((a, b) => a - b);
    const rightHashZ = createFieldLayout()
      .markings
      .filter((marking) => marking.kind === 'hash' && marking.center.x > 0)
      .map((marking) => marking.center.z)
      .sort((a, b) => a - b);

    expect(leftHashZ).toEqual(rightHashZ);

    for (let index = 1; index < leftHashZ.length; index += 1) {
      expect(leftHashZ[index] - leftHashZ[index - 1]).toBe(1);
    }
  });

  it('derives widened arcade hash lanes from professional field measurements', () => {
    const expectedProfessionalHashX =
      FIELD_DIMENSIONS.fieldWidth / 2 - HASH_DISTANCE_FROM_SIDELINE_YARDS;

    expect(PROFESSIONAL_HASH_X).toBeCloseTo(expectedProfessionalHashX);
    expect(FIELD_MARKING_DIMENSIONS.hashX).toBeCloseTo(
      PROFESSIONAL_HASH_X * ARCADE_HASH_SPACING_MULTIPLIER,
    );
  });

  it('stops internal transverse markings at the inner sideline edges', () => {
    const layout = createFieldLayout();
    const transverseKinds = new Set(['firstDown', 'goalLine', 'lineOfScrimmage', 'yardLine']);

    for (const marking of layout.markings) {
      if (!transverseKinds.has(marking.kind)) {
        continue;
      }

      expect(marking.bounds.minX, marking.id).toBeCloseTo(
        FIELD_BOUNDS.minX + FIELD_MARKING_WIDTHS.sideline,
      );
      expect(marking.bounds.maxX, marking.id).toBeCloseTo(
        FIELD_BOUNDS.maxX - FIELD_MARKING_WIDTHS.sideline,
      );
    }
  });

  it('round-trips world units and football yards', () => {
    const yards = 17.5;

    expect(worldUnitsToFootballYards(footballYardsToWorldUnits(yards))).toBeCloseTo(yards);
  });

  it('calculates a 10-world-unit forward gain as 10 football yards', () => {
    expect(
      calculateYardsGained(INITIAL_BALL_SPOT, {
        x: INITIAL_BALL_SPOT.x,
        z: INITIAL_BALL_SPOT.z + 10,
      }),
    ).toBeCloseTo(10);
  });
});

function getMarking(
  layout: ReturnType<typeof createFieldLayout>,
  id: string,
) {
  const marking = layout.markings.find((candidate) => candidate.id === id);

  if (!marking) {
    throw new Error(`Missing field marking ${id}`);
  }

  return marking;
}
