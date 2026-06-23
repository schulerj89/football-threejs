import * as THREE from 'three';
import { DynamicFieldMarkers } from './field/DynamicFieldMarkers';
import {
  FieldBrandingController,
  type HomeFieldBranding,
} from './field/FieldBrandingController';
import { createEndZonePylonBoxes } from './field/FieldMarkingLayout';
import { FieldResourceOwner } from './field/FieldResourceOwner';
import type { CreateFootballFieldOptions, FootballField } from './field/FieldTypes';
import {
  LINE_OF_SCRIMMAGE_Z,
  createFieldLayout,
  validateFieldLayout,
  type FieldLayout,
} from './fieldSpec';
import type { FieldGeometryBuilder } from './field/FieldGeometryBuilder';
import type { FieldMaterialLibrary } from './field/FieldMaterialLibrary';

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
  type FieldPylonLayout,
} from './fieldSpec';
export type { CreateFootballFieldOptions, FootballField } from './field/FieldTypes';

const dynamicMarkerControllers = new WeakMap<FootballField, DynamicFieldMarkers>();
const fieldBrandingControllers = new WeakMap<FootballField, FieldBrandingController>();
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
  group.add(createEndZonePylonsMesh(geometryBuilder, resourceOwner.materials, layout));
  group.add(geometryBuilder.createGoalpostsMesh());
  const brandingController = new FieldBrandingController(layout);
  group.add(brandingController.group);
  if (options.homeFieldBranding) {
    brandingController.sync(options.homeFieldBranding);
  }

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
      fieldBrandingControllers.get(field)?.dispose();
      fieldBrandingControllers.delete(field);
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
  fieldBrandingControllers.set(field, brandingController);
  fieldResourceOwners.set(field, resourceOwner);
  return field;
}

function createEndZonePylonsMesh(
  geometryBuilder: FieldGeometryBuilder,
  materials: FieldMaterialLibrary,
  layout: FieldLayout,
): THREE.Mesh {
  const boxes = createEndZonePylonBoxes(layout);
  const mesh = geometryBuilder.createBatchedBoxMesh('end-zone-pylons', boxes, materials.pylon);
  mesh.userData.presentationOnly = true;
  mesh.userData.endZonePylons = true;
  mesh.userData.pylonIds = boxes.map((box) => box.id);
  mesh.userData.pylonCenters = boxes.map((box) => ({ ...box.center }));
  return mesh;
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
  colors: {
    farEndZone: string;
    homeFieldBranding?: HomeFieldBranding;
    nearEndZone: string;
  },
): void {
  fieldResourceOwners.get(field)?.materials.setEndZoneColors({
    far: colors.farEndZone,
    near: colors.nearEndZone,
  });
  fieldBrandingControllers.get(field)?.sync(colors.homeFieldBranding ?? null);
}

export type { HomeFieldBranding } from './field/FieldBrandingController';
export { splitTeamNameForEndZones } from './field/FieldBrandingController';
