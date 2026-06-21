import * as THREE from 'three';
import type { PlayerModel, PlayerRole, PlayerTeam } from './playerModel';

const PLAYER_CENTER_Y = 1.1;
const PLAYER_FORWARD_Z = 1;

export const PLAYER_HEAD_ANCHOR_NAME = 'placeholder-player-head-anchor';
export const PLAYER_BODY_ROOT_NAME = 'bodyRoot';

export type PlayerBodyVisualStyle = 'box' | 'mannequin';

export interface PlayerBodyDimensions {
  totalHeight: number;
  torsoHeight: number;
  torsoTopRadius: number;
  torsoBottomRadius: number;
  shoulderWidth: number;
  shoulderDepth: number;
  shoulderHeight: number;
  armLength: number;
  armRadius: number;
  legLength: number;
  legRadius: number;
  footLength: number;
  helmetOffsetY: number;
}

export interface PlayerVisualOptions {
  bodyStyle?: PlayerBodyVisualStyle;
  debugRoleColors?: boolean;
}

export interface PlayerBodyVisualSnapshot {
  bodyBounds: {
    max: { x: number; y: number; z: number };
    min: { x: number; y: number; z: number };
    size: { x: number; y: number; z: number };
  };
  bodyStyle: PlayerBodyVisualStyle;
  bodyTriangleCount: number;
  meshesPerPlayer: number;
  playerId: string;
  shoulderWidth: number;
  totalHeight: number;
}

export const PLAYER_BODY_DIMENSIONS: PlayerBodyDimensions = {
  totalHeight: 2,
  torsoHeight: 0.92,
  torsoTopRadius: 0.42,
  torsoBottomRadius: 0.32,
  shoulderWidth: 1.38,
  shoulderDepth: 0.58,
  shoulderHeight: 0.28,
  armLength: 0.72,
  armRadius: 0.12,
  legLength: 0.74,
  legRadius: 0.14,
  footLength: 0.42,
  helmetOffsetY: 0.9,
};

const BODY_PART_NAMES = {
  headAnchor: PLAYER_HEAD_ANCHOR_NAME,
  leftArm: 'leftArm',
  leftArmPivot: 'leftArmPivot',
  leftFoot: 'leftFoot',
  leftLeg: 'leftLeg',
  leftLegPivot: 'leftLegPivot',
  rightArm: 'rightArm',
  rightArmPivot: 'rightArmPivot',
  rightFoot: 'rightFoot',
  rightLeg: 'rightLeg',
  rightLegPivot: 'rightLegPivot',
  shoulderPads: 'shoulderPads',
  torso: 'torso',
} as const;

const PLAYER_ROLE_COLORS: Record<PlayerRole, number> = {
  blocker: 0x285fb8,
  coverageDefender: 0xc95a42,
  defender: 0xb83737,
  quarterback: 0x5b7ee5,
  receiver: 0x35a6d8,
  runner: 0x2f66d8,
};

const PLAYER_UNIFORM_COLORS = {
  defense: {
    jersey: 0xf2f4f6,
    limbs: 0x9a6f55,
    pants: 0xb83737,
    shoes: 0x1c2228,
    trim: 0x24282e,
  },
  offense: {
    jersey: 0x2f66d8,
    limbs: 0x9a6f55,
    pants: 0xf2f4f6,
    shoes: 0x1c2228,
    trim: 0xdfe8f5,
  },
} as const;

type UniformPart = 'jersey' | 'limbs' | 'pants' | 'shoes' | 'trim';

const ARM_X = PLAYER_BODY_DIMENSIONS.shoulderWidth / 2 - PLAYER_BODY_DIMENSIONS.armRadius * 0.65;
const ARM_PIVOT_Y = 0.48;
const LEG_X = 0.23;
const LEG_PIVOT_Y = -0.28;
const FOOT_HEIGHT = 0.12;
const FOOT_WIDTH = 0.24;
const FOOT_DEPTH = PLAYER_BODY_DIMENSIONS.footLength;
const FOOT_BOTTOM_Y = -PLAYER_CENTER_Y;
const FOOT_CENTER_Y = FOOT_BOTTOM_Y + FOOT_HEIGHT / 2;
const LEG_CENTER_Y = -PLAYER_BODY_DIMENSIONS.legLength / 2;
const TORSO_CENTER_Y = 0.19;
const SHOULDER_CENTER_Y = 0.68;

const sharedGeometry = {
  arm: new THREE.CylinderGeometry(
    PLAYER_BODY_DIMENSIONS.armRadius * 0.82,
    PLAYER_BODY_DIMENSIONS.armRadius,
    PLAYER_BODY_DIMENSIONS.armLength,
    8,
    3,
  ),
  boxBody: new THREE.BoxGeometry(1.4, 2.2, 1.4),
  boxDefenderBody: new THREE.BoxGeometry(1.5, 2.2, 1.4),
  boxFacingStripe: new THREE.BoxGeometry(0.72, 0.12, 0.08),
  boxScaleReference: new THREE.BoxGeometry(0.24, 0.08, 1.9),
  foot: new THREE.BoxGeometry(FOOT_WIDTH, FOOT_HEIGHT, FOOT_DEPTH),
  leg: new THREE.CylinderGeometry(
    PLAYER_BODY_DIMENSIONS.legRadius * 0.85,
    PLAYER_BODY_DIMENSIONS.legRadius,
    PLAYER_BODY_DIMENSIONS.legLength,
    8,
    3,
  ),
  shoulderPads: new THREE.BoxGeometry(
    PLAYER_BODY_DIMENSIONS.shoulderWidth,
    PLAYER_BODY_DIMENSIONS.shoulderHeight,
    PLAYER_BODY_DIMENSIONS.shoulderDepth,
  ),
  torso: new THREE.CylinderGeometry(
    PLAYER_BODY_DIMENSIONS.torsoTopRadius,
    PLAYER_BODY_DIMENSIONS.torsoBottomRadius,
    PLAYER_BODY_DIMENSIONS.torsoHeight,
    8,
    2,
  ),
};

const materialCache = new Map<string, THREE.MeshLambertMaterial | THREE.MeshBasicMaterial>();

export function resolvePlayerBodyVisualStyle(value: string | null): PlayerBodyVisualStyle {
  return value === 'box' ? 'box' : 'mannequin';
}

export function createPlaceholderPlayerVisual(
  player?: PlayerModel,
  options: PlayerVisualOptions = {},
): THREE.Group {
  const bodyStyle = options.bodyStyle ?? 'mannequin';
  const debugRoleColors = options.debugRoleColors ?? false;
  const group = new THREE.Group();
  group.name = player ? `player-${player.id}` : 'placeholder-player';
  group.userData.testId = player ? `player-${player.id}` : 'placeholder-player';
  group.userData.playerBodyStyle = bodyStyle;
  group.userData.debugRoleColors = debugRoleColors;

  const bodyRoot =
    bodyStyle === 'box'
      ? createBoxBodyRoot(player, debugRoleColors)
      : createMannequinBodyRoot(player, debugRoleColors);
  group.add(bodyRoot);

  return group;
}

export function syncPlayerVisual(
  playerVisual: THREE.Object3D,
  playerModel: PlayerModel,
  options: Pick<PlayerVisualOptions, 'debugRoleColors'> = {},
): void {
  playerVisual.position.set(playerModel.position.x, PLAYER_CENTER_Y, playerModel.position.z);
  playerVisual.rotation.y = playerModel.facingRadians;
  syncPlayerBodyMaterials(playerVisual, playerModel, options);
}

export function getPlayerBodyVisualSnapshot(playerVisual: THREE.Object3D): PlayerBodyVisualSnapshot {
  const bodyRoot = playerVisual.getObjectByName(PLAYER_BODY_ROOT_NAME) ?? playerVisual;
  const bounds = new THREE.Box3();
  let bodyTriangleCount = 0;
  let meshesPerPlayer = 0;

  bodyRoot.updateWorldMatrix(true, true);
  bodyRoot.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || isHelmetDescendant(object)) {
      return;
    }

    meshesPerPlayer += 1;
    bodyTriangleCount += countGeometryTriangles(object.geometry);
    unionMeshBounds(bounds, object);
  });

  if (bounds.isEmpty()) {
    bounds.set(new THREE.Vector3(), new THREE.Vector3());
  }

  const size = bounds.getSize(new THREE.Vector3());

  return {
    bodyBounds: {
      max: vectorToPlain(bounds.max),
      min: vectorToPlain(bounds.min),
      size: vectorToPlain(size),
    },
    bodyStyle: readBodyStyle(playerVisual),
    bodyTriangleCount,
    meshesPerPlayer,
    playerId: String(playerVisual.userData.testId ?? playerVisual.name),
    shoulderWidth: PLAYER_BODY_DIMENSIONS.shoulderWidth,
    totalHeight: PLAYER_BODY_DIMENSIONS.totalHeight,
  };
}

function createMannequinBodyRoot(
  player: PlayerModel | undefined,
  debugRoleColors: boolean,
): THREE.Group {
  const bodyRoot = createBodyRoot();

  const torso = createBodyMesh(
    BODY_PART_NAMES.torso,
    sharedGeometry.torso,
    'jersey',
    player,
    debugRoleColors,
  );
  torso.position.set(0, TORSO_CENTER_Y, 0);
  bodyRoot.add(torso);

  const shoulderPads = createBodyMesh(
    BODY_PART_NAMES.shoulderPads,
    sharedGeometry.shoulderPads,
    'jersey',
    player,
    debugRoleColors,
  );
  shoulderPads.position.set(0, SHOULDER_CENTER_Y, 0);
  bodyRoot.add(shoulderPads);

  bodyRoot.add(
    createArmPivot(BODY_PART_NAMES.leftArmPivot, BODY_PART_NAMES.leftArm, -ARM_X, player, debugRoleColors),
    createArmPivot(BODY_PART_NAMES.rightArmPivot, BODY_PART_NAMES.rightArm, ARM_X, player, debugRoleColors),
    createLegPivot(
      BODY_PART_NAMES.leftLegPivot,
      BODY_PART_NAMES.leftLeg,
      BODY_PART_NAMES.leftFoot,
      -LEG_X,
      player,
      debugRoleColors,
    ),
    createLegPivot(
      BODY_PART_NAMES.rightLegPivot,
      BODY_PART_NAMES.rightLeg,
      BODY_PART_NAMES.rightFoot,
      LEG_X,
      player,
      debugRoleColors,
    ),
  );

  bodyRoot.add(createHeadAnchor());
  return bodyRoot;
}

function createBoxBodyRoot(player: PlayerModel | undefined, debugRoleColors: boolean): THREE.Group {
  const bodyRoot = createBodyRoot();
  const geometry = player?.role === 'defender' ? sharedGeometry.boxDefenderBody : sharedGeometry.boxBody;
  const body = createBodyMesh('placeholder-player-body', geometry, 'jersey', player, debugRoleColors);
  bodyRoot.add(body);

  const facingStripe = new THREE.Mesh(sharedGeometry.boxFacingStripe, getBasicMaterial('box-facing', 0xf3f5f8));
  facingStripe.position.set(0, 0.35, 0.74 * PLAYER_FORWARD_Z);
  facingStripe.name = 'placeholder-player-facing-stripe';
  bodyRoot.add(facingStripe);

  const scaleReference = new THREE.Mesh(sharedGeometry.boxScaleReference, getBasicMaterial('box-scale', 0xf3f5f8));
  scaleReference.position.set(0, -1.14, 0);
  scaleReference.name = 'placeholder-player-scale-reference';
  bodyRoot.add(scaleReference);

  bodyRoot.add(createHeadAnchor());
  return bodyRoot;
}

function createBodyRoot(): THREE.Group {
  const bodyRoot = new THREE.Group();
  bodyRoot.name = PLAYER_BODY_ROOT_NAME;
  return bodyRoot;
}

function createArmPivot(
  pivotName: string,
  meshName: string,
  x: number,
  player: PlayerModel | undefined,
  debugRoleColors: boolean,
): THREE.Group {
  const pivot = new THREE.Group();
  pivot.name = pivotName;
  pivot.position.set(x, ARM_PIVOT_Y, 0);

  const arm = createBodyMesh(meshName, sharedGeometry.arm, 'limbs', player, debugRoleColors);
  arm.position.set(0, -PLAYER_BODY_DIMENSIONS.armLength / 2, 0);
  pivot.add(arm);
  return pivot;
}

function createLegPivot(
  pivotName: string,
  legName: string,
  footName: string,
  x: number,
  player: PlayerModel | undefined,
  debugRoleColors: boolean,
): THREE.Group {
  const pivot = new THREE.Group();
  pivot.name = pivotName;
  pivot.position.set(x, LEG_PIVOT_Y, 0);

  const leg = createBodyMesh(legName, sharedGeometry.leg, 'pants', player, debugRoleColors);
  leg.position.set(0, LEG_CENTER_Y, 0);
  pivot.add(leg);

  const foot = createBodyMesh(footName, sharedGeometry.foot, 'shoes', player, debugRoleColors);
  foot.position.set(0, FOOT_CENTER_Y - LEG_PIVOT_Y, FOOT_DEPTH * 0.16 * PLAYER_FORWARD_Z);
  pivot.add(foot);
  return pivot;
}

function createHeadAnchor(): THREE.Group {
  const headAnchor = new THREE.Group();
  headAnchor.name = PLAYER_HEAD_ANCHOR_NAME;
  headAnchor.position.set(0, PLAYER_BODY_DIMENSIONS.helmetOffsetY, 0.08 * PLAYER_FORWARD_Z);
  return headAnchor;
}

function createBodyMesh(
  name: string,
  geometry: THREE.BufferGeometry,
  uniformPart: UniformPart,
  player: PlayerModel | undefined,
  debugRoleColors: boolean,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    geometry,
    getUniformMaterial(uniformPart, player?.team ?? 'offense', player?.role ?? 'runner', debugRoleColors),
  );
  mesh.name = name;
  mesh.userData.uniformPart = uniformPart;
  return mesh;
}

function syncPlayerBodyMaterials(
  playerVisual: THREE.Object3D,
  playerModel: PlayerModel,
  options: Pick<PlayerVisualOptions, 'debugRoleColors'>,
): void {
  const debugRoleColors =
    options.debugRoleColors ?? Boolean(playerVisual.userData.debugRoleColors);

  playerVisual.userData.debugRoleColors = debugRoleColors;
  playerVisual.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || isHelmetDescendant(object)) {
      return;
    }

    const uniformPart = object.userData.uniformPart;
    if (!isUniformPart(uniformPart)) {
      return;
    }

    object.material = getUniformMaterial(
      uniformPart,
      playerModel.team,
      playerModel.role,
      debugRoleColors,
    );
  });
}

function getUniformMaterial(
  uniformPart: UniformPart,
  team: PlayerTeam,
  role: PlayerRole,
  debugRoleColors: boolean,
): THREE.MeshLambertMaterial {
  const materialKey = debugRoleColors
    ? `debug:${uniformPart}:${role}`
    : `uniform:${uniformPart}:${team}`;
  const cached = materialCache.get(materialKey);

  if (cached instanceof THREE.MeshLambertMaterial) {
    return cached;
  }

  const color = debugRoleColors
    ? PLAYER_ROLE_COLORS[role]
    : PLAYER_UNIFORM_COLORS[team][uniformPart];
  const material = new THREE.MeshLambertMaterial({
    color,
    flatShading: true,
  });
  material.name = materialKey;
  materialCache.set(materialKey, material);
  return material;
}

function getBasicMaterial(name: string, color: number): THREE.MeshBasicMaterial {
  const cached = materialCache.get(name);

  if (cached instanceof THREE.MeshBasicMaterial) {
    return cached;
  }

  const material = new THREE.MeshBasicMaterial({ color });
  material.name = name;
  materialCache.set(name, material);
  return material;
}

function isUniformPart(value: unknown): value is UniformPart {
  return value === 'jersey' || value === 'limbs' || value === 'pants' || value === 'shoes' || value === 'trim';
}

function isHelmetDescendant(object: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object;

  while (current) {
    if (current.name === 'low-poly-helmet') {
      return true;
    }

    current = current.parent;
  }

  return false;
}

function readBodyStyle(playerVisual: THREE.Object3D): PlayerBodyVisualStyle {
  return playerVisual.userData.playerBodyStyle === 'box' ? 'box' : 'mannequin';
}

function countGeometryTriangles(geometry: THREE.BufferGeometry): number {
  if (geometry.index) {
    return geometry.index.count / 3;
  }

  const position = geometry.getAttribute('position');
  return position ? position.count / 3 : 0;
}

function unionMeshBounds(bounds: THREE.Box3, mesh: THREE.Mesh): void {
  if (!mesh.geometry.boundingBox) {
    mesh.geometry.computeBoundingBox();
  }

  if (!mesh.geometry.boundingBox) {
    return;
  }

  const meshBounds = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
  bounds.union(meshBounds);
}

function vectorToPlain(vector: THREE.Vector3): { x: number; y: number; z: number } {
  return {
    x: vector.x,
    y: vector.y,
    z: vector.z,
  };
}
