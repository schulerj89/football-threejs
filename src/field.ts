import * as THREE from 'three';
import { DynamicFieldMarkers } from './field/DynamicFieldMarkers';
import { FieldResourceOwner } from './field/FieldResourceOwner';
import type { CreateFootballFieldOptions, FootballField } from './field/FieldTypes';
import {
  LINE_OF_SCRIMMAGE_Z,
  createFieldLayout,
  validateFieldLayout,
} from './fieldSpec';

export {
  FIELD_BOUNDS,
  FIELD_DIMENSIONS,
  FIELD_DIRECTION,
  FIELD_MARKING_DIMENSIONS,
  FIELD_MARKING_WIDTHS,
  FIELD_OF_PLAY_BOUNDS,
  FAR_GOAL_LINE_Z,
  FULL_FIELD_BOUNDS,
  INITIAL_BALL_SPOT,
  INNER_MARKING_BOUNDS,
  LINE_OF_SCRIMMAGE_Z,
  NEAR_GOAL_LINE_Z,
  OPPOSING_GOAL_LINE_Z,
  PLAYABLE_FIELD_BOUNDS,
  PLAYER_MOVEMENT_BOUNDS,
  WORLD_SCALE,
  createFieldLayout,
  type FieldBounds,
  type PlayableFieldBounds,
} from './fieldSpec';
export type { CreateFootballFieldOptions, FootballField } from './field/FieldTypes';

const dynamicMarkerControllers = new WeakMap<FootballField, DynamicFieldMarkers>();
const fieldResourceOwners = new WeakMap<FootballField, FieldResourceOwner>();

export function createFootballField(options: CreateFootballFieldOptions = {}): FootballField {
  const layout = createFieldLayout();
  const invalidMarkingIds = new Set(
    options.fieldAudit ? validateFieldLayout(layout).map((issue) => issue.id) : [],
  );
  const resourceOwner = new FieldResourceOwner();
  if (options.endZoneColors) {
    resourceOwner.materials.setEndZoneColors(options.endZoneColors);
  }
  const geometryBuilder = resourceOwner.geometryBuilder;
  const group = new THREE.Group();
  group.name = 'football-field';

  group.add(geometryBuilder.createSurroundingGroundMesh());
  group.add(geometryBuilder.createSidelineApronMesh());
  group.add(geometryBuilder.createSurfaceMesh(layout.surface));

  for (const turfBandMesh of geometryBuilder.createTurfBandMeshes(layout)) {
    group.add(turfBandMesh);
  }

  for (const endZone of layout.endZones) {
    group.add(geometryBuilder.createEndZoneMesh(endZone));
  }

  for (const markingBatch of geometryBuilder.createStaticFieldMarkingBatches(layout, invalidMarkingIds)) {
    group.add(markingBatch);
  }

  group.add(geometryBuilder.createYardNumbersMesh());
  group.add(geometryBuilder.createTeamBoxBoundaryMesh());
  group.add(geometryBuilder.createGoalpostsMesh());

  const dynamicMarkers = new DynamicFieldMarkers(resourceOwner.materials, {
    firstDownLine: layout.firstDownLine,
    firstDownLineInvalid: invalidMarkingIds.has(layout.firstDownLine.id),
    group,
    lineOfScrimmage: layout.lineOfScrimmage,
    lineOfScrimmageInvalid: invalidMarkingIds.has(layout.lineOfScrimmage.id),
  });

  if (options.fieldAudit) {
    group.add(geometryBuilder.createFieldAuditOverlay(layout));
  }

  const field: FootballField = {
    auditEnabled: !!options.fieldAudit,
    dispose: () => {
      dynamicMarkerControllers.delete(field);
      fieldResourceOwners.delete(field);
      resourceOwner.disposeObject(group);
    },
    firstDownLineMarker: dynamicMarkers.firstDownLineMarker,
    group,
    layout,
    lineOfScrimmageMarker: dynamicMarkers.lineOfScrimmageMarker,
    lineOfScrimmageZ: LINE_OF_SCRIMMAGE_Z,
    playDirection: new THREE.Vector3(0, 0, 1),
  };

  dynamicMarkerControllers.set(field, dynamicMarkers);
  fieldResourceOwners.set(field, resourceOwner);
  return field;
}

export function syncFootballFieldDriveLines(
  field: FootballField,
  lineOfScrimmage: { z: number },
  firstDownMarker: { z: number },
): void {
  field.lineOfScrimmageZ = lineOfScrimmage.z;
  dynamicMarkerControllers.get(field)?.sync(
    lineOfScrimmage,
    firstDownMarker,
    field.auditEnabled,
  );
}

export function syncFootballFieldTeamColors(
  field: FootballField,
  colors: { farEndZone: string; nearEndZone: string },
): void {
  fieldResourceOwners.get(field)?.materials.setEndZoneColors({
    far: colors.farEndZone,
    near: colors.nearEndZone,
  });
}
