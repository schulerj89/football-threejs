import {
  FAR_GOAL_LINE_Z,
  FIELD_BOUNDS,
  FIELD_DIMENSIONS,
  FIELD_MARKING_WIDTHS,
  NEAR_GOAL_LINE_Z,
  type FieldBounds,
  type FieldLayout,
  type FieldMarkingLayout,
} from '../fieldSpec';
import type { FieldMaterialKey } from './FieldMaterialLibrary';
import { getFieldMarkingMaterialKey } from './FieldMaterialLibrary';
import type { BoxBatchItem } from './FieldTypes';

export const FIELD_Y = 0;
export const FIELD_SURFACE_HEIGHT = 0.08;
export const END_ZONE_HEIGHT = 0.1;
export const LINE_HEIGHT = 0.04;
export const LINE_Y = 0.08;
export const TURF_BAND_HEIGHT = 0.024;
export const TURF_BAND_Y = 0.052;
export const PRESENTATION_LINE_HEIGHT = 0.035;
export const PRESENTATION_LINE_Y = 0.075;
export const YARD_NUMBER_HEIGHT = 0.035;
export const YARD_NUMBER_Y = 0.118;
export const AUDIT_Y = 0.2;
export const AUDIT_LINE_HEIGHT = 0.05;
export const AUDIT_LINE_WIDTH = 0.18;
export const AUDIT_CORNER_SIZE = 0.8;
export const PYLON_HEIGHT = 1.35;
export const PYLON_WIDTH = 0.42;

export const PRESENTATION_CONFIG = {
  groundMargin: 28,
  goalpost: {
    crossbarHeight: 4.2,
    crossbarWidth: 7,
    postDepth: 0.28,
    postWidth: 0.28,
    supportHeight: 4.2,
    uprightHeight: 5.2,
    uprightSpacing: 3.5,
  },
  sidelineApronWidth: 11,
  teamBox: {
    depth: 50,
    innerOffset: 2.4,
    outerOffset: 7.2,
    paintWidth: 0.16,
  },
  turfBandDepth: 5,
  yardNumbers: {
    digitGap: 0.75,
    digitHeight: 3.25,
    digitWidth: 1.9,
    rowX: 17.3,
    segmentThickness: 0.28,
  },
} as const;

export function createTurfBandBoxBuckets(
  layout: FieldLayout,
): Record<'fieldBandA' | 'fieldBandB', BoxBatchItem[]> {
  const buckets: Record<'fieldBandA' | 'fieldBandB', BoxBatchItem[]> = {
    fieldBandA: [],
    fieldBandB: [],
  };
  const startZ = layout.playableBounds.minZ;
  const bandCount = Math.floor(
    (layout.playableBounds.maxZ - layout.playableBounds.minZ) /
      PRESENTATION_CONFIG.turfBandDepth,
  );

  for (let index = 0; index < bandCount; index += 1) {
    const z = startZ + index * PRESENTATION_CONFIG.turfBandDepth;
    const key = index % 2 === 0 ? 'fieldBandA' : 'fieldBandB';

    buckets[key].push({
      center: {
        x: 0,
        y: TURF_BAND_Y,
        z: z + PRESENTATION_CONFIG.turfBandDepth / 2,
      },
      id: `${key}-${index}`,
      size: {
        depth: PRESENTATION_CONFIG.turfBandDepth,
        height: TURF_BAND_HEIGHT,
        width: FIELD_DIMENSIONS.fieldWidth,
      },
    });
  }

  return buckets;
}

export function createStaticFieldMarkingBuckets(
  layout: FieldLayout,
  invalidMarkingIds: Set<string>,
): Map<FieldMaterialKey, FieldMarkingLayout[]> {
  const buckets = new Map<FieldMaterialKey, FieldMarkingLayout[]>();

  for (const marking of layout.markings) {
    if (isDynamicMarking(marking)) {
      continue;
    }

    const materialKey = invalidMarkingIds.has(marking.id)
      ? 'auditError'
      : getFieldMarkingMaterialKey(marking);
    const bucket = buckets.get(materialKey) ?? [];
    bucket.push(marking);
    buckets.set(materialKey, bucket);
  }

  return buckets;
}

export function fieldMarkingToBoxBatchItem(marking: FieldMarkingLayout): BoxBatchItem {
  return {
    center: {
      x: marking.center.x,
      y: LINE_Y,
      z: marking.center.z,
    },
    id: marking.id,
    size: {
      depth: marking.size.depth,
      height: LINE_HEIGHT,
      width: marking.size.width,
    },
  };
}

export function createYardNumberBoxes(): BoxBatchItem[] {
  const boxes: BoxBatchItem[] = [];

  for (let z = NEAR_GOAL_LINE_Z + 10; z <= FAR_GOAL_LINE_Z - 10; z += 10) {
    const label = getYardNumberLabel(z);
    boxes.push(
      ...createYardNumberDigitBoxes(label, -PRESENTATION_CONFIG.yardNumbers.rowX, z, -1, `left-${label}-${z}`),
      ...createYardNumberDigitBoxes(label, PRESENTATION_CONFIG.yardNumbers.rowX, z, 1, `right-${label}-${z}`),
    );
  }

  return boxes;
}

export function createTeamBoxBoundaryBoxes(): BoxBatchItem[] {
  const boxes: BoxBatchItem[] = [];
  const halfWidth = FIELD_DIMENSIONS.fieldWidth / 2;
  const { depth, innerOffset, outerOffset, paintWidth } = PRESENTATION_CONFIG.teamBox;
  const sideConfigs = [
    {
      name: 'left',
      outerX: -halfWidth - outerOffset,
      innerX: -halfWidth - innerOffset,
    },
    {
      name: 'right',
      outerX: halfWidth + outerOffset,
      innerX: halfWidth + innerOffset,
    },
  ] as const;

  for (const side of sideConfigs) {
    const centerX = (side.innerX + side.outerX) / 2;
    const width = Math.abs(side.outerX - side.innerX);

    boxes.push(
      createPresentationLineBox(`${side.name}-team-box-inner`, paintWidth, depth, side.innerX, 0),
      createPresentationLineBox(`${side.name}-team-box-outer`, paintWidth, depth, side.outerX, 0),
      createPresentationLineBox(`${side.name}-team-box-near`, width, paintWidth, centerX, -depth / 2),
      createPresentationLineBox(`${side.name}-team-box-far`, width, paintWidth, centerX, depth / 2),
    );
  }

  return boxes;
}

export function createGoalpostBoxes(endLineZ: number): BoxBatchItem[] {
  const {
    crossbarHeight,
    crossbarWidth,
    postDepth,
    postWidth,
    supportHeight,
    uprightHeight,
    uprightSpacing,
  } = PRESENTATION_CONFIG.goalpost;

  return [
    {
      center: { x: 0, y: supportHeight / 2, z: endLineZ },
      id: `goalpost-support-${endLineZ}`,
      size: { depth: postDepth, height: supportHeight, width: postWidth },
    },
    {
      center: { x: 0, y: crossbarHeight, z: endLineZ },
      id: `goalpost-crossbar-${endLineZ}`,
      size: { depth: postDepth, height: postWidth, width: crossbarWidth },
    },
    {
      center: { x: -uprightSpacing, y: crossbarHeight + uprightHeight / 2, z: endLineZ },
      id: `goalpost-left-upright-${endLineZ}`,
      size: { depth: postDepth, height: uprightHeight, width: postWidth },
    },
    {
      center: { x: uprightSpacing, y: crossbarHeight + uprightHeight / 2, z: endLineZ },
      id: `goalpost-right-upright-${endLineZ}`,
      size: { depth: postDepth, height: uprightHeight, width: postWidth },
    },
  ];
}

export function createEndZonePylonBoxes(layout: FieldLayout): BoxBatchItem[] {
  return layout.pylons.map((pylon) => ({
    center: {
      x: pylon.center.x,
      y: PYLON_HEIGHT / 2,
      z: pylon.center.z,
    },
    id: pylon.id,
    size: {
      depth: PYLON_WIDTH,
      height: PYLON_HEIGHT,
      width: PYLON_WIDTH,
    },
  }));
}

export function getFieldBoundsOutlineBoxes(name: string, bounds: FieldBounds): BoxBatchItem[] {
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;

  return [
    createAuditLineBox(`${name}-left`, AUDIT_LINE_WIDTH, depth, bounds.minX, centerZ),
    createAuditLineBox(`${name}-right`, AUDIT_LINE_WIDTH, depth, bounds.maxX, centerZ),
    createAuditLineBox(`${name}-near`, width, AUDIT_LINE_WIDTH, centerX, bounds.minZ),
    createAuditLineBox(`${name}-far`, width, AUDIT_LINE_WIDTH, centerX, bounds.maxZ),
  ];
}

export function getFieldCornerPoints(bounds: FieldBounds): Array<readonly [string, number, number]> {
  return [
    ['near-left', bounds.minX, bounds.minZ],
    ['near-right', bounds.maxX, bounds.minZ],
    ['far-left', bounds.minX, bounds.maxZ],
    ['far-right', bounds.maxX, bounds.maxZ],
  ];
}

export function isDynamicMarking(marking: FieldMarkingLayout): boolean {
  return marking.id === 'line-of-scrimmage' || marking.id === 'first-down-line';
}

function createYardNumberDigitBoxes(
  label: string,
  centerX: number,
  centerZ: number,
  sideSign: -1 | 1,
  idPrefix: string,
): BoxBatchItem[] {
  const { digitGap, digitWidth } = PRESENTATION_CONFIG.yardNumbers;
  const fieldOrderLabel = sideSign < 0 ? label : [...label].reverse().join('');
  const totalWidth = fieldOrderLabel.length * digitWidth + (fieldOrderLabel.length - 1) * digitGap;
  const boxes: BoxBatchItem[] = [];

  for (let index = 0; index < fieldOrderLabel.length; index += 1) {
    const digit = fieldOrderLabel[index];
    const digitCenterZ = centerZ - totalWidth / 2 + digitWidth / 2 + index * (digitWidth + digitGap);
    boxes.push(...createDigitSegmentBoxes(digit, centerX, digitCenterZ, sideSign, `${idPrefix}-${index}`));
  }

  return boxes;
}

function createDigitSegmentBoxes(
  digit: string,
  centerX: number,
  centerZ: number,
  sideSign: -1 | 1,
  idPrefix: string,
): BoxBatchItem[] {
  const activeSegments = DIGIT_SEGMENTS[digit] ?? DIGIT_SEGMENTS['0'];

  return activeSegments.map((segment) =>
    createDigitSegmentBox(segment, centerX, centerZ, sideSign, idPrefix),
  );
}

type DigitSegment = 'bottom' | 'lowerLeft' | 'lowerRight' | 'middle' | 'top' | 'upperLeft' | 'upperRight';

const DIGIT_SEGMENTS: Record<string, DigitSegment[]> = {
  '0': ['top', 'upperLeft', 'upperRight', 'lowerLeft', 'lowerRight', 'bottom'],
  '1': ['upperRight', 'lowerRight'],
  '2': ['top', 'upperRight', 'middle', 'lowerLeft', 'bottom'],
  '3': ['top', 'upperRight', 'middle', 'lowerRight', 'bottom'],
  '4': ['upperLeft', 'upperRight', 'middle', 'lowerRight'],
  '5': ['top', 'upperLeft', 'middle', 'lowerRight', 'bottom'],
};

function createDigitSegmentBox(
  segment: DigitSegment,
  centerX: number,
  centerZ: number,
  sideSign: -1 | 1,
  idPrefix: string,
): BoxBatchItem {
  const { digitHeight, digitWidth, segmentThickness } = PRESENTATION_CONFIG.yardNumbers;
  const horizontalSize = { depth: segmentThickness, height: YARD_NUMBER_HEIGHT, width: digitWidth };
  const verticalSize = { depth: digitHeight / 2, height: YARD_NUMBER_HEIGHT, width: segmentThickness };
  const halfX = digitWidth / 2 - segmentThickness / 2;
  const quarterZ = digitHeight / 4;
  const halfZ = digitHeight / 2 - segmentThickness / 2;
  const segmentPlacement: Record<DigitSegment, { x: number; z: number; size: BoxBatchItem['size'] }> = {
    bottom: { x: 0, z: -halfZ, size: horizontalSize },
    lowerLeft: { x: -halfX, z: -quarterZ, size: verticalSize },
    lowerRight: { x: halfX, z: -quarterZ, size: verticalSize },
    middle: { x: 0, z: 0, size: horizontalSize },
    top: { x: 0, z: halfZ, size: horizontalSize },
    upperLeft: { x: -halfX, z: quarterZ, size: verticalSize },
    upperRight: { x: halfX, z: quarterZ, size: verticalSize },
  };
  const placement = segmentPlacement[segment];

  return {
    center: {
      x: centerX - sideSign * placement.z,
      y: YARD_NUMBER_Y,
      z: centerZ - sideSign * placement.x,
    },
    id: `${idPrefix}-${segment}`,
    size: {
      depth: placement.size.width,
      height: placement.size.height,
      width: placement.size.depth,
    },
  };
}

function getYardNumberLabel(z: number): string {
  return String(50 - Math.abs(z));
}

function createPresentationLineBox(id: string, width: number, depth: number, x: number, z: number): BoxBatchItem {
  return {
    center: { x, y: PRESENTATION_LINE_Y, z },
    id,
    size: { depth, height: PRESENTATION_LINE_HEIGHT, width },
  };
}

function createAuditLineBox(name: string, width: number, depth: number, x: number, z: number): BoxBatchItem {
  return {
    center: { x, y: AUDIT_Y, z },
    id: name,
    size: { depth, height: AUDIT_LINE_HEIGHT, width },
  };
}
