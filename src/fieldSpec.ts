export interface FieldBounds {
  maxX: number;
  maxZ: number;
  minX: number;
  minZ: number;
}

export type PlayableFieldBounds = FieldBounds;

export interface FieldPoint {
  x: number;
  z: number;
}

export interface FieldSize {
  depth: number;
  width: number;
}

export type FieldRectKind = 'endZone' | 'surface';
export type FieldMarkingKind =
  | 'endLine'
  | 'firstDown'
  | 'goalLine'
  | 'hash'
  | 'lineOfScrimmage'
  | 'sideline'
  | 'yardLine';

export interface FieldRectLayout {
  bounds: FieldBounds;
  center: FieldPoint;
  id: string;
  kind: FieldRectKind;
  size: FieldSize;
}

export interface FieldMarkingLayout {
  bounds: FieldBounds;
  center: FieldPoint;
  id: string;
  kind: FieldMarkingKind;
  size: FieldSize;
}

export interface FieldLayout {
  endZones: FieldRectLayout[];
  fieldBounds: FieldBounds;
  firstDownLine: FieldMarkingLayout;
  innerMarkingBounds: FieldBounds;
  lineOfScrimmage: FieldMarkingLayout;
  markings: FieldMarkingLayout[];
  playableBounds: FieldBounds;
  surface: FieldRectLayout;
}

export interface FieldLayoutValidationIssue {
  bounds: FieldBounds;
  fieldBounds: FieldBounds;
  id: string;
}

export const WORLD_SCALE = {
  axes: 'X runs sideline to sideline, Z runs end zone to end zone, Y is up',
  endZoneDepth: 10,
  fieldLength: 120,
  fieldWidth: 160 / 3,
  playableLength: 100,
  units: '1 Three.js world unit = 1 yard',
  worldUnitsPerYard: 1,
} as const;

export const FIELD_DIMENSIONS = {
  endZoneDepth: WORLD_SCALE.endZoneDepth,
  fieldLength: WORLD_SCALE.fieldLength,
  fieldWidth: WORLD_SCALE.fieldWidth,
  playableLength: WORLD_SCALE.playableLength,
} as const;

export const HASH_DISTANCE_FROM_SIDELINE_YARDS = (70 + 9 / 12) / 3;
export const PROFESSIONAL_HASH_X =
  FIELD_DIMENSIONS.fieldWidth / 2 - HASH_DISTANCE_FROM_SIDELINE_YARDS;
export const ARCADE_HASH_SPACING_MULTIPLIER = 2;
export const HASH_X = PROFESSIONAL_HASH_X * ARCADE_HASH_SPACING_MULTIPLIER;

export const FIELD_MARKING_WIDTHS = {
  endLine: 0.32,
  firstDown: 0.22,
  goalLine: 0.22,
  hash: 0.1,
  lineOfScrimmage: 0.32,
  sideline: 0.32,
  tenYardLine: 0.18,
  yardLine: 0.14,
} as const;

export const FIELD_MARKING_DIMENSIONS = {
  hashLength: 1.2,
  hashX: HASH_X,
} as const;

export const FIELD_DIRECTION = {
  playDirectionZ: 1,
} as const;

export const FIELD_BOUNDS: FieldBounds = {
  maxX: FIELD_DIMENSIONS.fieldWidth / 2,
  maxZ: FIELD_DIMENSIONS.fieldLength / 2,
  minX: -FIELD_DIMENSIONS.fieldWidth / 2,
  minZ: -FIELD_DIMENSIONS.fieldLength / 2,
} as const;

export const PLAYABLE_FIELD_BOUNDS: FieldBounds = {
  maxX: FIELD_BOUNDS.maxX,
  maxZ: FIELD_DIMENSIONS.playableLength / 2,
  minX: FIELD_BOUNDS.minX,
  minZ: -FIELD_DIMENSIONS.playableLength / 2,
} as const;

export const INNER_MARKING_BOUNDS: FieldBounds = {
  maxX: FIELD_BOUNDS.maxX - FIELD_MARKING_WIDTHS.sideline,
  maxZ: FIELD_BOUNDS.maxZ,
  minX: FIELD_BOUNDS.minX + FIELD_MARKING_WIDTHS.sideline,
  minZ: FIELD_BOUNDS.minZ,
} as const;

export const LINE_OF_SCRIMMAGE_Z = -15;
export const INITIAL_BALL_SPOT = { x: 0, z: LINE_OF_SCRIMMAGE_Z } as const;
export const OPPOSING_GOAL_LINE_Z = PLAYABLE_FIELD_BOUNDS.maxZ;
export const NEAR_GOAL_LINE_Z = PLAYABLE_FIELD_BOUNDS.minZ;
export const FAR_GOAL_LINE_Z = PLAYABLE_FIELD_BOUNDS.maxZ;

export function createFieldLayout(): FieldLayout {
  const lineOfScrimmage = createTransverseMarking(
    'line-of-scrimmage',
    'lineOfScrimmage',
    LINE_OF_SCRIMMAGE_Z,
    FIELD_MARKING_WIDTHS.lineOfScrimmage,
  );
  const firstDownLine = createTransverseMarking(
    'first-down-line',
    'firstDown',
    LINE_OF_SCRIMMAGE_Z + 10,
    FIELD_MARKING_WIDTHS.firstDown,
  );
  const markings = [
    ...createBoundaryMarkings(),
    ...createGoalLineMarkings(),
    ...createYardLineMarkings(),
    ...createHashMarkings(),
    lineOfScrimmage,
    firstDownLine,
  ];

  return {
    endZones: createEndZoneLayouts(),
    fieldBounds: FIELD_BOUNDS,
    firstDownLine,
    innerMarkingBounds: INNER_MARKING_BOUNDS,
    lineOfScrimmage,
    markings,
    playableBounds: PLAYABLE_FIELD_BOUNDS,
    surface: createRectLayout('playable-field-surface', 'surface', 0, 0, {
      depth: FIELD_DIMENSIONS.fieldLength,
      width: FIELD_DIMENSIONS.fieldWidth,
    }),
  };
}

export function createDriveLineLayout(
  id: 'first-down-line' | 'line-of-scrimmage',
  z: number,
): FieldMarkingLayout {
  return createTransverseMarking(
    id,
    id === 'first-down-line' ? 'firstDown' : 'lineOfScrimmage',
    z,
    id === 'first-down-line'
      ? FIELD_MARKING_WIDTHS.firstDown
      : FIELD_MARKING_WIDTHS.lineOfScrimmage,
  );
}

export function validateFieldLayout(layout: FieldLayout): FieldLayoutValidationIssue[] {
  return layout.markings
    .filter((marking) => !isBoundsContained(marking.bounds, layout.fieldBounds))
    .map((marking) => ({
      bounds: marking.bounds,
      fieldBounds: layout.fieldBounds,
      id: marking.id,
    }));
}

export function isBoundsContained(bounds: FieldBounds, container: FieldBounds): boolean {
  return (
    bounds.minX >= container.minX &&
    bounds.maxX <= container.maxX &&
    bounds.minZ >= container.minZ &&
    bounds.maxZ <= container.maxZ
  );
}

function createEndZoneLayouts(): FieldRectLayout[] {
  return [
    createRectLayout('near-end-zone', 'endZone', 0, FIELD_BOUNDS.minZ + FIELD_DIMENSIONS.endZoneDepth / 2, {
      depth: FIELD_DIMENSIONS.endZoneDepth,
      width: FIELD_DIMENSIONS.fieldWidth,
    }),
    createRectLayout('far-end-zone', 'endZone', 0, FIELD_BOUNDS.maxZ - FIELD_DIMENSIONS.endZoneDepth / 2, {
      depth: FIELD_DIMENSIONS.endZoneDepth,
      width: FIELD_DIMENSIONS.fieldWidth,
    }),
  ];
}

function createBoundaryMarkings(): FieldMarkingLayout[] {
  return [
    createMarkingLayout(
      'left-sideline',
      'sideline',
      FIELD_BOUNDS.minX + FIELD_MARKING_WIDTHS.sideline / 2,
      0,
      {
        depth: FIELD_DIMENSIONS.fieldLength,
        width: FIELD_MARKING_WIDTHS.sideline,
      },
    ),
    createMarkingLayout(
      'right-sideline',
      'sideline',
      FIELD_BOUNDS.maxX - FIELD_MARKING_WIDTHS.sideline / 2,
      0,
      {
        depth: FIELD_DIMENSIONS.fieldLength,
        width: FIELD_MARKING_WIDTHS.sideline,
      },
    ),
    createMarkingLayout(
      'near-end-line',
      'endLine',
      0,
      FIELD_BOUNDS.minZ + FIELD_MARKING_WIDTHS.endLine / 2,
      {
        depth: FIELD_MARKING_WIDTHS.endLine,
        width: FIELD_DIMENSIONS.fieldWidth,
      },
    ),
    createMarkingLayout(
      'far-end-line',
      'endLine',
      0,
      FIELD_BOUNDS.maxZ - FIELD_MARKING_WIDTHS.endLine / 2,
      {
        depth: FIELD_MARKING_WIDTHS.endLine,
        width: FIELD_DIMENSIONS.fieldWidth,
      },
    ),
  ];
}

function createGoalLineMarkings(): FieldMarkingLayout[] {
  return [
    createTransverseMarking(
      'near-goal-line',
      'goalLine',
      NEAR_GOAL_LINE_Z,
      FIELD_MARKING_WIDTHS.goalLine,
    ),
    createTransverseMarking(
      'far-goal-line',
      'goalLine',
      FAR_GOAL_LINE_Z,
      FIELD_MARKING_WIDTHS.goalLine,
    ),
  ];
}

function createYardLineMarkings(): FieldMarkingLayout[] {
  const yardLines: FieldMarkingLayout[] = [];

  for (let z = PLAYABLE_FIELD_BOUNDS.minZ + 5; z <= PLAYABLE_FIELD_BOUNDS.maxZ - 5; z += 5) {
    const isTenYardLine = z % 10 === 0;
    yardLines.push(
      createTransverseMarking(
        `yard-line-${z}`,
        'yardLine',
        z,
        isTenYardLine ? FIELD_MARKING_WIDTHS.tenYardLine : FIELD_MARKING_WIDTHS.yardLine,
      ),
    );
  }

  return yardLines;
}

function createHashMarkings(): FieldMarkingLayout[] {
  const hashMarkings: FieldMarkingLayout[] = [];

  for (let z = PLAYABLE_FIELD_BOUNDS.minZ + 1; z <= PLAYABLE_FIELD_BOUNDS.maxZ - 1; z += 1) {
    hashMarkings.push(
      createMarkingLayout(
        `left-hash-${z}`,
        'hash',
        -FIELD_MARKING_DIMENSIONS.hashX,
        z,
        {
          depth: FIELD_MARKING_WIDTHS.hash,
          width: FIELD_MARKING_DIMENSIONS.hashLength,
        },
      ),
      createMarkingLayout(
        `right-hash-${z}`,
        'hash',
        FIELD_MARKING_DIMENSIONS.hashX,
        z,
        {
          depth: FIELD_MARKING_WIDTHS.hash,
          width: FIELD_MARKING_DIMENSIONS.hashLength,
        },
      ),
    );
  }

  return hashMarkings;
}

function createTransverseMarking(
  id: string,
  kind: FieldMarkingKind,
  z: number,
  depth: number,
): FieldMarkingLayout {
  return createMarkingLayout(id, kind, 0, z, {
    depth,
    width: INNER_MARKING_BOUNDS.maxX - INNER_MARKING_BOUNDS.minX,
  });
}

function createRectLayout(
  id: string,
  kind: FieldRectKind,
  x: number,
  z: number,
  size: FieldSize,
): FieldRectLayout {
  return {
    bounds: boundsFromCenterAndSize(x, z, size),
    center: { x, z },
    id,
    kind,
    size,
  };
}

function createMarkingLayout(
  id: string,
  kind: FieldMarkingKind,
  x: number,
  z: number,
  size: FieldSize,
): FieldMarkingLayout {
  return {
    bounds: boundsFromCenterAndSize(x, z, size),
    center: { x, z },
    id,
    kind,
    size,
  };
}

function boundsFromCenterAndSize(x: number, z: number, size: FieldSize): FieldBounds {
  return {
    maxX: x + size.width / 2,
    maxZ: z + size.depth / 2,
    minX: x - size.width / 2,
    minZ: z - size.depth / 2,
  };
}
