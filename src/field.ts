import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  FAR_GOAL_LINE_Z,
  FIELD_BOUNDS,
  FIELD_DIMENSIONS,
  FIELD_MARKING_WIDTHS,
  LINE_OF_SCRIMMAGE_Z,
  NEAR_GOAL_LINE_Z,
  createDriveLineLayout,
  createFieldLayout,
  isBoundsContained,
  validateFieldLayout,
  type FieldBounds,
  type FieldLayout,
  type FieldMarkingLayout,
  type FieldRectLayout,
} from './fieldSpec';

export {
  FIELD_BOUNDS,
  FIELD_DIMENSIONS,
  FIELD_DIRECTION,
  FIELD_MARKING_DIMENSIONS,
  FIELD_MARKING_WIDTHS,
  FAR_GOAL_LINE_Z,
  INITIAL_BALL_SPOT,
  INNER_MARKING_BOUNDS,
  LINE_OF_SCRIMMAGE_Z,
  NEAR_GOAL_LINE_Z,
  OPPOSING_GOAL_LINE_Z,
  PLAYABLE_FIELD_BOUNDS,
  WORLD_SCALE,
  createFieldLayout,
  type FieldBounds,
  type PlayableFieldBounds,
} from './fieldSpec';

interface BoxBatchItem {
  center: {
    x: number;
    y: number;
    z: number;
  };
  id: string;
  size: {
    depth: number;
    height: number;
    width: number;
  };
}

const FIELD_Y = 0;
const FIELD_SURFACE_HEIGHT = 0.08;
const END_ZONE_HEIGHT = 0.1;
const LINE_HEIGHT = 0.04;
const LINE_Y = 0.08;
const TURF_BAND_HEIGHT = 0.024;
const TURF_BAND_Y = 0.052;
const PRESENTATION_LINE_HEIGHT = 0.035;
const PRESENTATION_LINE_Y = 0.075;
const YARD_NUMBER_HEIGHT = 0.035;
const YARD_NUMBER_Y = 0.118;
const AUDIT_Y = 0.2;
const AUDIT_LINE_HEIGHT = 0.05;
const AUDIT_LINE_WIDTH = 0.18;
const AUDIT_CORNER_SIZE = 0.8;

const PRESENTATION_CONFIG = {
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

const materials = {
  auditCorner: new THREE.MeshBasicMaterial({ color: 0xff3b30 }),
  auditError: new THREE.MeshBasicMaterial({ color: 0xff2b2b }),
  auditFieldBounds: new THREE.MeshBasicMaterial({ color: 0x42d6ff }),
  auditInnerBounds: new THREE.MeshBasicMaterial({ color: 0xf2d94b }),
  direction: new THREE.MeshBasicMaterial({ color: 0xf2b84b }),
  endZoneA: new THREE.MeshLambertMaterial({ color: 0x39444a }),
  endZoneB: new THREE.MeshLambertMaterial({ color: 0x4b443d }),
  fieldBandA: new THREE.MeshLambertMaterial({ color: 0x435145 }),
  fieldBandB: new THREE.MeshLambertMaterial({ color: 0x4b5a4d }),
  firstDown: new THREE.MeshBasicMaterial({ color: 0xf2d94b }),
  goalpost: new THREE.MeshBasicMaterial({ color: 0xf4d54c }),
  ground: new THREE.MeshLambertMaterial({ color: 0x273035 }),
  hash: new THREE.MeshBasicMaterial({ color: 0xc8d0c9 }),
  line: new THREE.MeshBasicMaterial({ color: 0xf0f2ef }),
  number: new THREE.MeshBasicMaterial({ color: 0xf4f6f2 }),
  playableField: new THREE.MeshLambertMaterial({ color: 0x47544a }),
  scrimmage: new THREE.MeshBasicMaterial({ color: 0x38a3ff }),
  sidelineApron: new THREE.MeshLambertMaterial({ color: 0x30383d }),
  teamBox: new THREE.MeshBasicMaterial({ color: 0xd8ded8 }),
  tenYardLine: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  yardLine: new THREE.MeshBasicMaterial({ color: 0xd7ddd7 }),
} as const;

type MaterialKey = keyof typeof materials;

export interface FootballField {
  auditEnabled: boolean;
  firstDownLineMarker: THREE.Mesh;
  group: THREE.Group;
  layout: FieldLayout;
  lineOfScrimmageMarker: THREE.Mesh;
  lineOfScrimmageZ: number;
  playDirection: THREE.Vector3;
  playDirectionMarker: THREE.Group;
}

export interface CreateFootballFieldOptions {
  fieldAudit?: boolean;
}

export function createFootballField(options: CreateFootballFieldOptions = {}): FootballField {
  const layout = createFieldLayout();
  const invalidMarkingIds = new Set(
    options.fieldAudit ? validateFieldLayout(layout).map((issue) => issue.id) : [],
  );
  const group = new THREE.Group();
  group.name = 'football-field';

  group.add(createSurroundingGroundMesh());
  group.add(createSidelineApronMesh());
  group.add(createSurfaceMesh(layout.surface));

  for (const turfBandMesh of createTurfBandMeshes(layout)) {
    group.add(turfBandMesh);
  }

  for (const endZone of layout.endZones) {
    group.add(createEndZoneMesh(endZone));
  }

  for (const markingBatch of createStaticFieldMarkingBatches(layout, invalidMarkingIds)) {
    group.add(markingBatch);
  }

  group.add(createYardNumbersMesh());
  group.add(createTeamBoxBoundaryMesh());
  group.add(createGoalpostsMesh());

  const lineOfScrimmageMarker = createFieldMarkingMesh(layout.lineOfScrimmage, {
    auditInvalid: invalidMarkingIds.has(layout.lineOfScrimmage.id),
  });
  const firstDownLineMarker = createFieldMarkingMesh(layout.firstDownLine, {
    auditInvalid: invalidMarkingIds.has(layout.firstDownLine.id),
  });
  group.add(lineOfScrimmageMarker, firstDownLineMarker);

  const playDirectionMarker = addPlayDirectionMarker(group);

  if (options.fieldAudit) {
    group.add(createFieldAuditOverlay(layout));
  }

  return {
    auditEnabled: !!options.fieldAudit,
    firstDownLineMarker,
    group,
    layout,
    lineOfScrimmageMarker,
    lineOfScrimmageZ: LINE_OF_SCRIMMAGE_Z,
    playDirection: new THREE.Vector3(0, 0, 1),
    playDirectionMarker,
  };
}

export function syncFootballFieldDriveLines(
  field: FootballField,
  lineOfScrimmage: { z: number },
  firstDownMarker: { z: number },
): void {
  const lineOfScrimmageLayout = createDriveLineLayout('line-of-scrimmage', lineOfScrimmage.z);
  const firstDownLayout = createDriveLineLayout('first-down-line', firstDownMarker.z);

  field.lineOfScrimmageZ = lineOfScrimmage.z;
  applyMarkingLayout(field.lineOfScrimmageMarker, lineOfScrimmageLayout, field.auditEnabled);
  applyMarkingLayout(field.firstDownLineMarker, firstDownLayout, field.auditEnabled);
  field.playDirectionMarker.position.z = lineOfScrimmage.z + 7;
}

function createSurroundingGroundMesh(): THREE.Mesh {
  const width = FIELD_DIMENSIONS.fieldWidth + PRESENTATION_CONFIG.groundMargin * 2;
  const depth = FIELD_DIMENSIONS.fieldLength + PRESENTATION_CONFIG.groundMargin * 2;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.04, depth),
    materials.ground,
  );
  mesh.name = 'surrounding-ground-plane';
  mesh.position.set(0, -0.04, 0);
  mesh.userData.presentationOnly = true;
  return mesh;
}

function createSidelineApronMesh(): THREE.Mesh {
  const width = FIELD_DIMENSIONS.fieldWidth + PRESENTATION_CONFIG.sidelineApronWidth * 2;
  const depth = FIELD_DIMENSIONS.fieldLength;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.04, depth),
    materials.sidelineApron,
  );
  mesh.name = 'sideline-apron';
  mesh.position.set(0, -0.005, 0);
  mesh.userData.presentationOnly = true;
  return mesh;
}

function createSurfaceMesh(layout: FieldRectLayout): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(layout.size.width, FIELD_SURFACE_HEIGHT, layout.size.depth),
    materials.playableField,
  );
  mesh.position.set(layout.center.x, FIELD_Y, layout.center.z);
  mesh.name = layout.id;
  mesh.userData.fieldRect = layout;
  return mesh;
}

function createTurfBandMeshes(layout: FieldLayout): THREE.Mesh[] {
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

  return Object.entries(buckets)
    .filter(([, boxes]) => boxes.length > 0)
    .map(([key, boxes]) => {
      const mesh = createBatchedBoxMesh(`turf-bands-${key}`, boxes, materials[key as 'fieldBandA' | 'fieldBandB']);
      mesh.userData.presentationOnly = true;
      return mesh;
    });
}

function createEndZoneMesh(layout: FieldRectLayout): THREE.Mesh {
  const material = layout.id === 'near-end-zone' ? materials.endZoneA : materials.endZoneB;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(layout.size.width, END_ZONE_HEIGHT, layout.size.depth),
    material,
  );
  mesh.position.set(layout.center.x, LINE_Y / 2, layout.center.z);
  mesh.name = layout.id;
  mesh.userData.fieldRect = layout;
  return mesh;
}

function createStaticFieldMarkingBatches(
  layout: FieldLayout,
  invalidMarkingIds: Set<string>,
): THREE.Mesh[] {
  const buckets = new Map<MaterialKey, FieldMarkingLayout[]>();

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

  return [...buckets.entries()].map(([materialKey, markings]) => {
    const mesh = createBatchedBoxMesh(
      `static-field-markings-${materialKey}`,
      markings.map(fieldMarkingToBoxBatchItem),
      materials[materialKey],
    );
    mesh.userData.isPaintedFieldMarking = true;
    mesh.userData.staticFieldMarkingBatch = true;
    mesh.userData.fieldMarkingIds = markings.map((marking) => marking.id);
    mesh.userData.fieldMarkingKinds = [...new Set(markings.map((marking) => marking.kind))];
    return mesh;
  });
}

function createFieldMarkingMesh(
  layout: FieldMarkingLayout,
  options: { auditInvalid: boolean },
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(layout.size.width, LINE_HEIGHT, layout.size.depth),
    options.auditInvalid ? materials.auditError : getFieldMarkingMaterial(layout),
  );
  mesh.name = layout.id;
  mesh.userData.isPaintedFieldMarking = true;
  setMarkingMetadata(mesh, layout);
  mesh.position.set(layout.center.x, LINE_Y, layout.center.z);
  return mesh;
}

function applyMarkingLayout(
  mesh: THREE.Mesh,
  layout: FieldMarkingLayout,
  auditEnabled: boolean,
): void {
  const currentSize = mesh.userData.fieldMarkingLayout?.size as FieldMarkingLayout['size'] | undefined;

  if (
    !currentSize ||
    currentSize.width !== layout.size.width ||
    currentSize.depth !== layout.size.depth
  ) {
    mesh.geometry.dispose();
    mesh.geometry = new THREE.BoxGeometry(layout.size.width, LINE_HEIGHT, layout.size.depth);
  }

  mesh.position.set(layout.center.x, LINE_Y, layout.center.z);
  setMarkingMetadata(mesh, layout);
  mesh.material = auditEnabled && !isBoundsContained(layout.bounds, FIELD_BOUNDS)
    ? materials.auditError
    : getFieldMarkingMaterial(layout);
}

function setMarkingMetadata(mesh: THREE.Mesh, layout: FieldMarkingLayout): void {
  mesh.userData.fieldMarkingLayout = layout;
  mesh.userData.fieldMarkingId = layout.id;
  mesh.userData.fieldMarkingKind = layout.kind;
}

function fieldMarkingToBoxBatchItem(marking: FieldMarkingLayout): BoxBatchItem {
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

function getFieldMarkingMaterial(layout: FieldMarkingLayout): THREE.Material {
  return materials[getFieldMarkingMaterialKey(layout)];
}

function getFieldMarkingMaterialKey(layout: FieldMarkingLayout): MaterialKey {
  if (layout.kind === 'firstDown') {
    return 'firstDown';
  }

  if (layout.kind === 'hash') {
    return 'hash';
  }

  if (layout.kind === 'lineOfScrimmage') {
    return 'scrimmage';
  }

  if (layout.kind === 'yardLine') {
    return layout.size.depth > FIELD_MARKING_WIDTHS.yardLine
      ? 'tenYardLine'
      : 'yardLine';
  }

  return 'line';
}

function createYardNumbersMesh(): THREE.Mesh {
  const boxes: BoxBatchItem[] = [];

  for (let z = NEAR_GOAL_LINE_Z + 10; z <= FAR_GOAL_LINE_Z - 10; z += 10) {
    const label = getYardNumberLabel(z);
    boxes.push(
      ...createYardNumberBoxes(label, -PRESENTATION_CONFIG.yardNumbers.rowX, z, -1, `left-${label}-${z}`),
      ...createYardNumberBoxes(label, PRESENTATION_CONFIG.yardNumbers.rowX, z, 1, `right-${label}-${z}`),
    );
  }

  const mesh = createBatchedBoxMesh('yard-numbers', boxes, materials.number);
  mesh.userData.presentationOnly = true;
  return mesh;
}

function createYardNumberBoxes(
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
  const horizontalSize = {
    depth: segmentThickness,
    height: YARD_NUMBER_HEIGHT,
    width: digitWidth,
  };
  const verticalSize = {
    depth: digitHeight / 2,
    height: YARD_NUMBER_HEIGHT,
    width: segmentThickness,
  };
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

function createTeamBoxBoundaryMesh(): THREE.Mesh {
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

  const mesh = createBatchedBoxMesh('team-box-boundaries', boxes, materials.teamBox);
  mesh.userData.presentationOnly = true;
  return mesh;
}

function createPresentationLineBox(
  id: string,
  width: number,
  depth: number,
  x: number,
  z: number,
): BoxBatchItem {
  return {
    center: {
      x,
      y: PRESENTATION_LINE_Y,
      z,
    },
    id,
    size: {
      depth,
      height: PRESENTATION_LINE_HEIGHT,
      width,
    },
  };
}

function createGoalpostsMesh(): THREE.Mesh {
  const boxes: BoxBatchItem[] = [];

  for (const z of [FIELD_BOUNDS.minZ, FIELD_BOUNDS.maxZ]) {
    boxes.push(...createGoalpostBoxes(z));
  }

  const mesh = createBatchedBoxMesh('goalposts', boxes, materials.goalpost);
  mesh.userData.presentationOnly = true;
  mesh.userData.endLineZs = [FIELD_BOUNDS.minZ, FIELD_BOUNDS.maxZ];
  return mesh;
}

function createGoalpostBoxes(endLineZ: number): BoxBatchItem[] {
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

function addPlayDirectionMarker(group: THREE.Group): THREE.Group {
  const marker = new THREE.Group();
  marker.name = 'play-direction-marker';
  marker.position.set(0, 0.12, LINE_OF_SCRIMMAGE_Z + 7);

  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.1, 5), materials.direction);
  shaft.position.set(0, 0, 0);
  marker.add(shaft);

  const head = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.2, 4), materials.direction);
  head.rotation.x = Math.PI / 2;
  head.position.set(0, 0, 3.4);
  marker.add(head);

  group.add(marker);
  return marker;
}

function createFieldAuditOverlay(layout: FieldLayout): THREE.Group {
  const group = new THREE.Group();
  group.name = 'field-audit-overlay';
  group.userData.fieldAudit = true;

  addBoundsOutline(group, 'audit-field-bounds', layout.fieldBounds, materials.auditFieldBounds);
  addBoundsOutline(group, 'audit-inner-marking-bounds', layout.innerMarkingBounds, materials.auditInnerBounds);
  addCornerMarkers(group, layout.fieldBounds);

  for (const issue of validateFieldLayout(layout)) {
    addBoundsOutline(group, `audit-out-of-bounds-${issue.id}`, issue.bounds, materials.auditError);
  }

  return group;
}

function addBoundsOutline(
  group: THREE.Group,
  name: string,
  bounds: FieldBounds,
  material: THREE.Material,
): void {
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;

  group.add(createAuditLine(`${name}-left`, AUDIT_LINE_WIDTH, depth, bounds.minX, centerZ, material));
  group.add(createAuditLine(`${name}-right`, AUDIT_LINE_WIDTH, depth, bounds.maxX, centerZ, material));
  group.add(createAuditLine(`${name}-near`, width, AUDIT_LINE_WIDTH, centerX, bounds.minZ, material));
  group.add(createAuditLine(`${name}-far`, width, AUDIT_LINE_WIDTH, centerX, bounds.maxZ, material));
}

function addCornerMarkers(group: THREE.Group, bounds: FieldBounds): void {
  const corners = [
    ['near-left', bounds.minX, bounds.minZ],
    ['near-right', bounds.maxX, bounds.minZ],
    ['far-left', bounds.minX, bounds.maxZ],
    ['far-right', bounds.maxX, bounds.maxZ],
  ] as const;

  for (const [name, x, z] of corners) {
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(AUDIT_CORNER_SIZE, AUDIT_CORNER_SIZE, AUDIT_CORNER_SIZE),
      materials.auditCorner,
    );
    marker.name = `field-corner-marker-${name}`;
    marker.position.set(x, AUDIT_Y + AUDIT_CORNER_SIZE / 2, z);
    group.add(marker);
  }
}

function createAuditLine(
  name: string,
  width: number,
  depth: number,
  x: number,
  z: number,
  material: THREE.Material,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, AUDIT_LINE_HEIGHT, depth),
    material,
  );
  mesh.name = name;
  mesh.position.set(x, AUDIT_Y, z);
  return mesh;
}

function createBatchedBoxMesh(
  name: string,
  boxes: BoxBatchItem[],
  material: THREE.Material,
): THREE.Mesh {
  const geometry = createBatchedBoxGeometry(name, boxes);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.userData.boxIds = boxes.map((box) => box.id);
  return mesh;
}

function createBatchedBoxGeometry(name: string, boxes: BoxBatchItem[]): THREE.BufferGeometry {
  const geometries = boxes.map((box) => {
    const geometry = new THREE.BoxGeometry(box.size.width, box.size.height, box.size.depth);
    geometry.translate(box.center.x, box.center.y, box.center.z);
    return geometry;
  });
  const mergedGeometry = mergeGeometries(geometries, false);

  for (const geometry of geometries) {
    geometry.dispose();
  }

  if (!mergedGeometry) {
    throw new Error(`Unable to batch field geometry ${name}`);
  }

  return mergedGeometry;
}

function isDynamicMarking(marking: FieldMarkingLayout): boolean {
  return marking.id === 'line-of-scrimmage' || marking.id === 'first-down-line';
}
