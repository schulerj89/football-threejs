import * as THREE from 'three';

export const WORLD_SCALE = {
  units: '1 Three.js world unit = 1 yard',
  worldUnitsPerYard: 1,
  fieldLength: 120,
  playableLength: 100,
  endZoneDepth: 10,
  fieldWidth: 160 / 3,
  axes: 'X runs sideline to sideline, Z runs end zone to end zone, Y is up',
} as const;

export const LINE_OF_SCRIMMAGE_Z = -15;
export const INITIAL_BALL_SPOT = { x: 0, z: LINE_OF_SCRIMMAGE_Z } as const;
export const OPPOSING_GOAL_LINE_Z = WORLD_SCALE.playableLength / 2;

export interface PlayableFieldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const PLAYABLE_FIELD_BOUNDS: PlayableFieldBounds = {
  minX: -WORLD_SCALE.fieldWidth / 2,
  maxX: WORLD_SCALE.fieldWidth / 2,
  minZ: -WORLD_SCALE.playableLength / 2,
  maxZ: WORLD_SCALE.playableLength / 2,
};

const FIELD_Y = 0;
const LINE_Y = 0.08;
const SIDELINE_WIDTH = 0.32;
const YARD_LINE_WIDTH = 0.14;
const HASH_LINE_WIDTH = 0.1;
const HASH_LENGTH = 1.2;
const HASH_X = 9.0;

const materials = {
  playableField: new THREE.MeshLambertMaterial({ color: 0x47544a }),
  endZoneA: new THREE.MeshLambertMaterial({ color: 0x3d464c }),
  endZoneB: new THREE.MeshLambertMaterial({ color: 0x4f463f }),
  line: new THREE.MeshBasicMaterial({ color: 0xf0f2ef }),
  hash: new THREE.MeshBasicMaterial({ color: 0xbcc6bd }),
  scrimmage: new THREE.MeshBasicMaterial({ color: 0x38a3ff }),
  direction: new THREE.MeshBasicMaterial({ color: 0xf2b84b }),
} as const;

export interface FootballField {
  group: THREE.Group;
  lineOfScrimmageMarker: THREE.Mesh;
  lineOfScrimmageZ: number;
  playDirection: THREE.Vector3;
  playDirectionMarker: THREE.Group;
}

export function createFootballField(): FootballField {
  const group = new THREE.Group();
  group.name = 'football-field';

  const field = new THREE.Mesh(
    new THREE.BoxGeometry(WORLD_SCALE.fieldWidth, 0.08, WORLD_SCALE.fieldLength),
    materials.playableField,
  );
  field.position.set(0, FIELD_Y, 0);
  field.name = 'playable-field-surface';
  group.add(field);

  addEndZones(group);
  addBoundaryLines(group);
  addYardLines(group);
  addHashMarks(group);
  const lineOfScrimmageMarker = addLineOfScrimmage(group);
  const playDirectionMarker = addPlayDirectionMarker(group);

  return {
    group,
    lineOfScrimmageMarker,
    lineOfScrimmageZ: LINE_OF_SCRIMMAGE_Z,
    playDirection: new THREE.Vector3(0, 0, 1),
    playDirectionMarker,
  };
}

export function syncFootballFieldLineOfScrimmage(
  field: FootballField,
  ballSpot: { z: number },
): void {
  field.lineOfScrimmageZ = ballSpot.z;
  field.lineOfScrimmageMarker.position.z = ballSpot.z;
  field.playDirectionMarker.position.z = ballSpot.z + 7;
}

function addEndZones(group: THREE.Group): void {
  const endZoneGeometry = new THREE.BoxGeometry(
    WORLD_SCALE.fieldWidth,
    0.1,
    WORLD_SCALE.endZoneDepth,
  );

  const nearEndZone = new THREE.Mesh(endZoneGeometry, materials.endZoneA);
  nearEndZone.position.set(0, LINE_Y / 2, -55);
  nearEndZone.name = 'near-end-zone';
  group.add(nearEndZone);

  const farEndZone = new THREE.Mesh(endZoneGeometry.clone(), materials.endZoneB);
  farEndZone.position.set(0, LINE_Y / 2, 55);
  farEndZone.name = 'far-end-zone';
  group.add(farEndZone);
}

function addBoundaryLines(group: THREE.Group): void {
  const halfWidth = WORLD_SCALE.fieldWidth / 2;
  const halfLength = WORLD_SCALE.fieldLength / 2;

  addLine(group, 'left-sideline', SIDELINE_WIDTH, WORLD_SCALE.fieldLength, -halfWidth, 0);
  addLine(group, 'right-sideline', SIDELINE_WIDTH, WORLD_SCALE.fieldLength, halfWidth, 0);
  addLine(group, 'near-end-line', WORLD_SCALE.fieldWidth, SIDELINE_WIDTH, 0, -halfLength);
  addLine(group, 'far-end-line', WORLD_SCALE.fieldWidth, SIDELINE_WIDTH, 0, halfLength);
  addLine(group, 'near-goal-line', WORLD_SCALE.fieldWidth, 0.22, 0, -50);
  addLine(group, 'far-goal-line', WORLD_SCALE.fieldWidth, 0.22, 0, 50);
}

function addYardLines(group: THREE.Group): void {
  for (let z = -45; z <= 45; z += 5) {
    const isTenYardLine = z % 10 === 0;
    addLine(
      group,
      `yard-line-${z}`,
      WORLD_SCALE.fieldWidth,
      isTenYardLine ? 0.18 : YARD_LINE_WIDTH,
      0,
      z,
      isTenYardLine ? 0xffffff : 0xd7ddd7,
    );
  }
}

function addHashMarks(group: THREE.Group): void {
  for (let z = -49; z <= 49; z += 1) {
    if (z % 5 === 0) {
      continue;
    }

    addLine(group, `left-hash-${z}`, HASH_LENGTH, HASH_LINE_WIDTH, -HASH_X, z, undefined, materials.hash);
    addLine(group, `right-hash-${z}`, HASH_LENGTH, HASH_LINE_WIDTH, HASH_X, z, undefined, materials.hash);
  }
}

function addLineOfScrimmage(group: THREE.Group): THREE.Mesh {
  return addLine(
    group,
    'line-of-scrimmage',
    WORLD_SCALE.fieldWidth + 1.5,
    0.32,
    0,
    LINE_OF_SCRIMMAGE_Z,
    undefined,
    materials.scrimmage,
  );
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

function addLine(
  group: THREE.Group,
  name: string,
  width: number,
  depth: number,
  x: number,
  z: number,
  color?: number,
  material?: THREE.Material,
): THREE.Mesh {
  const lineMaterial = material ?? (color ? new THREE.MeshBasicMaterial({ color }) : materials.line);
  const line = new THREE.Mesh(new THREE.BoxGeometry(width, 0.04, depth), lineMaterial);
  line.position.set(x, LINE_Y, z);
  line.name = name;
  group.add(line);
  return line;
}
