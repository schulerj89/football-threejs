import * as THREE from 'three';
import {
  FIELD_BOUNDS,
  LINE_OF_SCRIMMAGE_Z,
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
  INITIAL_BALL_SPOT,
  INNER_MARKING_BOUNDS,
  LINE_OF_SCRIMMAGE_Z,
  OPPOSING_GOAL_LINE_Z,
  PLAYABLE_FIELD_BOUNDS,
  WORLD_SCALE,
  createFieldLayout,
  type FieldBounds,
  type PlayableFieldBounds,
} from './fieldSpec';

const FIELD_Y = 0;
const FIELD_SURFACE_HEIGHT = 0.08;
const END_ZONE_HEIGHT = 0.1;
const LINE_HEIGHT = 0.04;
const LINE_Y = 0.08;
const AUDIT_Y = 0.2;
const AUDIT_LINE_HEIGHT = 0.05;
const AUDIT_LINE_WIDTH = 0.18;
const AUDIT_CORNER_SIZE = 0.8;

const materials = {
  auditCorner: new THREE.MeshBasicMaterial({ color: 0xff3b30 }),
  auditError: new THREE.MeshBasicMaterial({ color: 0xff2b2b }),
  auditFieldBounds: new THREE.MeshBasicMaterial({ color: 0x42d6ff }),
  auditInnerBounds: new THREE.MeshBasicMaterial({ color: 0xf2d94b }),
  direction: new THREE.MeshBasicMaterial({ color: 0xf2b84b }),
  endZoneA: new THREE.MeshLambertMaterial({ color: 0x3d464c }),
  endZoneB: new THREE.MeshLambertMaterial({ color: 0x4f463f }),
  firstDown: new THREE.MeshBasicMaterial({ color: 0xf2d94b }),
  hash: new THREE.MeshBasicMaterial({ color: 0xbcc6bd }),
  line: new THREE.MeshBasicMaterial({ color: 0xf0f2ef }),
  playableField: new THREE.MeshLambertMaterial({ color: 0x47544a }),
  scrimmage: new THREE.MeshBasicMaterial({ color: 0x38a3ff }),
  tenYardLine: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  yardLine: new THREE.MeshBasicMaterial({ color: 0xd7ddd7 }),
} as const;

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

  group.add(createSurfaceMesh(layout.surface));

  for (const endZone of layout.endZones) {
    group.add(createEndZoneMesh(endZone));
  }

  let lineOfScrimmageMarker: THREE.Mesh | null = null;
  let firstDownLineMarker: THREE.Mesh | null = null;

  for (const marking of layout.markings) {
    const mesh = createFieldMarkingMesh(marking, {
      auditInvalid: invalidMarkingIds.has(marking.id),
    });
    group.add(mesh);

    if (marking.id === 'line-of-scrimmage') {
      lineOfScrimmageMarker = mesh;
    } else if (marking.id === 'first-down-line') {
      firstDownLineMarker = mesh;
    }
  }

  const playDirectionMarker = addPlayDirectionMarker(group);

  if (options.fieldAudit) {
    group.add(createFieldAuditOverlay(layout));
  }

  if (!lineOfScrimmageMarker || !firstDownLineMarker) {
    throw new Error('Missing dynamic drive line markers');
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

function getFieldMarkingMaterial(layout: FieldMarkingLayout): THREE.Material {
  if (layout.kind === 'firstDown') {
    return materials.firstDown;
  }

  if (layout.kind === 'hash') {
    return materials.hash;
  }

  if (layout.kind === 'lineOfScrimmage') {
    return materials.scrimmage;
  }

  if (layout.kind === 'yardLine') {
    return layout.size.depth > 0.14 ? materials.tenYardLine : materials.yardLine;
  }

  return materials.line;
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
