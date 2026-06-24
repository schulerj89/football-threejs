import { FIELD_BOUNDS, FIELD_DIMENSIONS } from '../fieldSpec';
import type { StadiumSpec } from './StadiumTypes';

const FIELD_CLEARANCE = 6;
const SIDELINE_APRON = 14;
const END_ZONE_APRON = 13;
const CORNER_RADIUS = 18;
const PROTECTED_HALF_WIDTH = FIELD_DIMENSIONS.fieldWidth / 2 + FIELD_CLEARANCE + SIDELINE_APRON;
const PROTECTED_HALF_DEPTH = FIELD_DIMENSIONS.fieldLength / 2 + FIELD_CLEARANCE + END_ZONE_APRON;
const SIDELINE_STRAIGHT_LENGTH = PROTECTED_HALF_DEPTH * 2;
const END_ZONE_STRAIGHT_LENGTH = PROTECTED_HALF_WIDTH * 2;

export const DEFAULT_STADIUM_SPEC: StadiumSpec = {
  aisleSpacing: 14,
  cameraClearance: 10,
  concourseHeight: 8,
  cornerRadius: CORNER_RADIUS,
  endZoneApron: END_ZONE_APRON,
  exteriorWallHeight: 26,
  fasciaHeight: 1.35,
  fieldClearance: FIELD_CLEARANCE,
  innerBowlDepth: FIELD_DIMENSIONS.fieldLength + 2 * (FIELD_CLEARANCE + END_ZONE_APRON + CORNER_RADIUS),
  innerBowlWidth: FIELD_DIMENSIONS.fieldWidth + 2 * (FIELD_CLEARANCE + SIDELINE_APRON + CORNER_RADIUS),
  protectedFieldBounds: {
    maxX: FIELD_BOUNDS.maxX + FIELD_CLEARANCE + SIDELINE_APRON,
    maxZ: FIELD_BOUNDS.maxZ + FIELD_CLEARANCE + END_ZONE_APRON,
    minX: FIELD_BOUNDS.minX - FIELD_CLEARANCE - SIDELINE_APRON,
    minZ: FIELD_BOUNDS.minZ - FIELD_CLEARANCE - END_ZONE_APRON,
  },
  rowDepth: 0.86,
  rowRise: 0.38,
  rowsPerTier: 16,
  scoreboardPosition: {
    x: 0,
    y: 21,
    z: FIELD_BOUNDS.maxZ + 49,
  },
  seatSpacing: 0.82,
  sidelineApron: SIDELINE_APRON,
  tierCount: 2,
  tierSeparation: 4.2,
  tiers: [
    {
      baseElevation: 0.28,
      baseOffset: 0.78,
      id: 'lower',
      rowCount: 16,
    },
    {
      baseElevation: 10.3,
      baseOffset: 20.4,
      id: 'upper',
      rowCount: 20,
    },
  ],
  tunnels: [
    {
      centerDistanceAlongSection: SIDELINE_STRAIGHT_LENGTH * 0.28,
      id: 'left-tunnel-near',
      sectionId: 'sidelineLeft',
      width: 6.5,
    },
    {
      centerDistanceAlongSection: SIDELINE_STRAIGHT_LENGTH * 0.72,
      id: 'left-tunnel-far',
      sectionId: 'sidelineLeft',
      width: 6.5,
    },
    {
      centerDistanceAlongSection: SIDELINE_STRAIGHT_LENGTH * 0.28,
      id: 'right-tunnel-near',
      sectionId: 'sidelineRight',
      width: 6.5,
    },
    {
      centerDistanceAlongSection: SIDELINE_STRAIGHT_LENGTH * 0.72,
      id: 'right-tunnel-far',
      sectionId: 'sidelineRight',
      width: 6.5,
    },
    {
      centerDistanceAlongSection: END_ZONE_STRAIGHT_LENGTH * 0.5,
      id: 'near-end-zone-tunnel',
      sectionId: 'endZoneNear',
      width: 7,
    },
    {
      centerDistanceAlongSection: END_ZONE_STRAIGHT_LENGTH * 0.5,
      id: 'far-end-zone-tunnel',
      sectionId: 'endZoneFar',
      width: 7,
    },
  ],
} as const;

export function getEnabledStadiumTiers(
  spec = DEFAULT_STADIUM_SPEC,
  upperTierEnabled = true,
) {
  return upperTierEnabled ? spec.tiers : spec.tiers.slice(0, 1);
}
