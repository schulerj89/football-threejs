import * as THREE from 'three';
import {
  SKIN_TONE_PALETTE,
  resolvePlayerAppearance,
  type PlayerAppearance,
  type SkinToneId,
} from './playerAppearance';
import type { PlayerModel, PlayerRole, PlayerTeam } from './playerModel';
import {
  getUniformColorNumber,
} from './teams/TeamThemeApplier';
import {
  serializeUniformPalette,
  type UniformPalette,
} from './teams/UniformPalette';

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
  torsoCenterY: number;
  shoulderWidth: number;
  shoulderDepth: number;
  shoulderHeight: number;
  shoulderCenterY: number;
  jerseyPanelWidth: number;
  jerseyPanelHeight: number;
  jerseyPanelCenterY: number;
  jerseyPanelForwardOffset: number;
  armLength: number;
  armRadius: number;
  armPivotY: number;
  armInsetX: number;
  legLength: number;
  legRadius: number;
  legPivotY: number;
  legOffsetX: number;
  footLength: number;
  footWidth: number;
  footHeight: number;
  footForwardOffset: number;
  helmetOffsetY: number;
  helmetOffsetZ: number;
  helmetScale: number;
  headCenterY: number;
  headCenterZ: number;
  headRadius: number;
  neckCenterY: number;
  neckCenterZ: number;
  neckHeight: number;
  neckRadius: number;
  radialSegments: number;
  limbHeightSegments: number;
  torsoHeightSegments: number;
}

export interface PlayerVisualOptions {
  bodyStyle?: PlayerBodyVisualStyle;
  debugRoleColors?: boolean;
  teamUniforms?: PlayerTeamUniforms;
}

export interface PlayerVisualBoundsSnapshot {
  center: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
  min: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
}

export interface PlayerBodyVisualSnapshot {
  bodyBounds: PlayerVisualBoundsSnapshot;
  bodyStyle: PlayerBodyVisualStyle;
  bodyTriangleCount: number;
  combinedBounds: PlayerVisualBoundsSnapshot;
  headBounds: PlayerVisualBoundsSnapshot | null;
  headHelmetClearance: number | null;
  appearance: PlayerAppearance;
  helmetBounds: PlayerVisualBoundsSnapshot | null;
  helmetShoulderVerticalGap: number | null;
  meshesPerPlayer: number;
  minimumBodyY: number;
  neckBounds: PlayerVisualBoundsSnapshot | null;
  playerId: string;
  shoulderWidth: number;
  totalHeight: number;
  uniqueBodyGeometryCount: number;
  uniqueBodyMaterialCount: number;
}

export const PLAYER_BODY_DIMENSIONS: PlayerBodyDimensions = {
  totalHeight: 2,
  torsoHeight: 0.82,
  torsoTopRadius: 0.38,
  torsoBottomRadius: 0.3,
  torsoCenterY: -0.02,
  shoulderWidth: 1.28,
  shoulderDepth: 0.52,
  shoulderHeight: 0.24,
  shoulderCenterY: 0.36,
  jerseyPanelWidth: 0.52,
  jerseyPanelHeight: 0.58,
  jerseyPanelCenterY: 0.02,
  jerseyPanelForwardOffset: 0.392,
  armLength: 0.62,
  armRadius: 0.11,
  armPivotY: 0.32,
  armInsetX: 0.08,
  legLength: 0.78,
  legRadius: 0.13,
  legPivotY: -0.22,
  legOffsetX: 0.22,
  footLength: 0.38,
  footWidth: 0.22,
  footHeight: 0.12,
  footForwardOffset: 0.06,
  helmetOffsetY: 0.84,
  helmetOffsetZ: 0,
  helmetScale: 0.38,
  headCenterY: -0.12,
  headCenterZ: 0.06,
  headRadius: 0.16,
  neckCenterY: -0.225,
  neckCenterZ: 0.025,
  neckHeight: 0.14,
  neckRadius: 0.075,
  radialSegments: 8,
  limbHeightSegments: 3,
  torsoHeightSegments: 2,
};

const BODY_PART_NAMES = {
  head: 'head',
  headAnchor: PLAYER_HEAD_ANCHOR_NAME,
  jerseyTexturePanel: 'jerseyTexturePanel',
  leftArm: 'leftArm',
  leftArmPivot: 'leftArmPivot',
  leftFoot: 'leftFoot',
  leftLeg: 'leftLeg',
  leftLegPivot: 'leftLegPivot',
  neck: 'neck',
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

export type PlayerTeamUniforms = Record<PlayerTeam, UniformPalette>;

export const DEFAULT_PLAYER_TEAM_UNIFORMS: PlayerTeamUniforms = {
  defense: {
    faceguard: '#24282e',
    helmetShell: '#b83737',
    jersey: '#f2f4f6',
    number: '#24282e',
    pants: '#b83737',
    shoe: '#1c2228',
    shoulder: '#f2f4f6',
    socks: '#b83737',
    stripe: '#b83737',
  },
  offense: {
    faceguard: '#f3f5f8',
    helmetShell: '#2f66d8',
    jersey: '#2f66d8',
    number: '#f2f4f6',
    pants: '#f2f4f6',
    shoe: '#1c2228',
    shoulder: '#2f66d8',
    socks: '#2f66d8',
    stripe: '#dfe8f5',
  },
} as const;

type UniformClothPart = 'jersey' | 'pants' | 'shoes' | 'shoulder' | 'trim';
type UniformPart = UniformClothPart | 'skin' | 'jerseyTexture';
type UniformMeshReference = {
  mesh: THREE.Mesh;
  uniformPart: UniformPart;
};
type PlayerVisualMaterialState = {
  debugRoleColors: boolean;
  playerId: string;
  role: PlayerRole;
  team: PlayerTeam;
  uniformKey: string;
};
type PlayerVisualHierarchyReferences = {
  bodyRoot: THREE.Object3D;
  headAnchor: THREE.Object3D | null;
  materialState: PlayerVisualMaterialState | null;
  uniformMeshes: UniformMeshReference[];
};

const ARM_X = PLAYER_BODY_DIMENSIONS.shoulderWidth / 2 - PLAYER_BODY_DIMENSIONS.armInsetX;
const FOOT_DEPTH = PLAYER_BODY_DIMENSIONS.footLength;
const FOOT_BOTTOM_Y = -PLAYER_CENTER_Y;
const FOOT_CENTER_Y = FOOT_BOTTOM_Y + PLAYER_BODY_DIMENSIONS.footHeight / 2;
const LEG_CENTER_Y = -PLAYER_BODY_DIMENSIONS.legLength / 2;

const sharedGeometry = {
  arm: new THREE.CylinderGeometry(
    PLAYER_BODY_DIMENSIONS.armRadius * 0.82,
    PLAYER_BODY_DIMENSIONS.armRadius,
    PLAYER_BODY_DIMENSIONS.armLength,
    PLAYER_BODY_DIMENSIONS.radialSegments,
    PLAYER_BODY_DIMENSIONS.limbHeightSegments,
  ),
  boxBody: new THREE.BoxGeometry(1.4, 2.2, 1.4),
  boxDefenderBody: new THREE.BoxGeometry(1.5, 2.2, 1.4),
  boxFacingStripe: new THREE.BoxGeometry(0.72, 0.12, 0.08),
  boxScaleReference: new THREE.BoxGeometry(0.24, 0.08, 1.9),
  foot: new THREE.BoxGeometry(
    PLAYER_BODY_DIMENSIONS.footWidth,
    PLAYER_BODY_DIMENSIONS.footHeight,
    FOOT_DEPTH,
  ),
  head: new THREE.IcosahedronGeometry(PLAYER_BODY_DIMENSIONS.headRadius, 1),
  jerseyPanel: new THREE.PlaneGeometry(
    PLAYER_BODY_DIMENSIONS.jerseyPanelWidth,
    PLAYER_BODY_DIMENSIONS.jerseyPanelHeight,
  ),
  leg: new THREE.CylinderGeometry(
    PLAYER_BODY_DIMENSIONS.legRadius * 0.85,
    PLAYER_BODY_DIMENSIONS.legRadius,
    PLAYER_BODY_DIMENSIONS.legLength,
    PLAYER_BODY_DIMENSIONS.radialSegments,
    PLAYER_BODY_DIMENSIONS.limbHeightSegments,
  ),
  neck: new THREE.CylinderGeometry(
    PLAYER_BODY_DIMENSIONS.neckRadius * 0.9,
    PLAYER_BODY_DIMENSIONS.neckRadius,
    PLAYER_BODY_DIMENSIONS.neckHeight,
    PLAYER_BODY_DIMENSIONS.radialSegments,
    1,
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
    PLAYER_BODY_DIMENSIONS.radialSegments,
    PLAYER_BODY_DIMENSIONS.torsoHeightSegments,
  ),
};

const materialCache = new Map<string, THREE.MeshLambertMaterial | THREE.MeshBasicMaterial>();
const playerVisualReferences = new WeakMap<THREE.Object3D, PlayerVisualHierarchyReferences>();

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
  group.userData.sourcePlayerId = player?.id ?? 'placeholder-player';
  group.userData.playerBodyStyle = bodyStyle;
  group.userData.debugRoleColors = debugRoleColors;

  const bodyRoot =
    bodyStyle === 'box'
      ? createBoxBodyRoot(player, debugRoleColors)
      : createMannequinBodyRoot(player, debugRoleColors);
  group.add(bodyRoot);
  const references = cachePlayerVisualReferences(group, bodyRoot);

  if (player) {
    syncPlayerBodyMaterials(group, player, options);
  }

  return group;
}

export function syncPlayerVisual(
  playerVisual: THREE.Object3D,
  playerModel: PlayerModel,
  options: Pick<PlayerVisualOptions, 'debugRoleColors' | 'teamUniforms'> = {},
): void {
  if (playerVisual.userData.sourcePlayerId !== playerModel.id) {
    playerVisual.userData.sourcePlayerId = playerModel.id;
  }

  if (
    playerVisual.position.x !== playerModel.position.x ||
    playerVisual.position.y !== PLAYER_CENTER_Y ||
    playerVisual.position.z !== playerModel.position.z
  ) {
    playerVisual.position.set(playerModel.position.x, PLAYER_CENTER_Y, playerModel.position.z);
  }

  if (playerVisual.rotation.y !== playerModel.facingRadians) {
    playerVisual.rotation.y = playerModel.facingRadians;
  }

  syncPlayerBodyMaterials(playerVisual, playerModel, options);
}

export function getPlayerBodyVisualSnapshot(playerVisual: THREE.Object3D): PlayerBodyVisualSnapshot {
  const bodyRoot = playerVisual.getObjectByName(PLAYER_BODY_ROOT_NAME) ?? playerVisual;
  const bounds = new THREE.Box3();
  const geometryIds = new Set<string>();
  const materialIds = new Set<string>();
  let bodyTriangleCount = 0;
  let meshesPerPlayer = 0;
  let minimumBodyY = Number.POSITIVE_INFINITY;

  bodyRoot.updateWorldMatrix(true, true);
  bodyRoot.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || isHelmetDescendant(object)) {
      return;
    }

    meshesPerPlayer += 1;
    geometryIds.add(object.geometry.uuid);
    for (const material of getMaterials(object.material)) {
      materialIds.add(material.uuid);
    }
    bodyTriangleCount += countGeometryTriangles(object.geometry);
    unionMeshBounds(bounds, object);
    minimumBodyY = Math.min(minimumBodyY, new THREE.Box3().setFromObject(object).min.y);
  });

  if (bounds.isEmpty()) {
    bounds.set(new THREE.Vector3(), new THREE.Vector3());
  }

  if (!Number.isFinite(minimumBodyY)) {
    minimumBodyY = 0;
  }

  const combinedBounds = new THREE.Box3().setFromObject(playerVisual);
  const helmet = playerVisual.getObjectByName('low-poly-helmet');
  const helmetBounds = helmet ? new THREE.Box3().setFromObject(helmet) : null;
  const head = playerVisual.getObjectByName(BODY_PART_NAMES.head);
  const headBounds = head ? new THREE.Box3().setFromObject(head) : null;
  const neck = playerVisual.getObjectByName(BODY_PART_NAMES.neck);
  const neckBounds = neck ? new THREE.Box3().setFromObject(neck) : null;
  const shoulderPads = playerVisual.getObjectByName(BODY_PART_NAMES.shoulderPads);
  const shoulderBounds = shoulderPads ? new THREE.Box3().setFromObject(shoulderPads) : null;
  const playerId = String(playerVisual.userData.sourcePlayerId ?? playerVisual.userData.testId ?? playerVisual.name);

  return {
    appearance: resolvePlayerAppearance(playerId),
    bodyBounds: boundsToPlain(bounds),
    bodyStyle: readBodyStyle(playerVisual),
    bodyTriangleCount,
    combinedBounds: boundsToPlain(combinedBounds),
    headBounds: headBounds ? boundsToPlain(headBounds) : null,
    headHelmetClearance:
      headBounds && helmetBounds ? calculateContainedBoundsClearance(headBounds, helmetBounds) : null,
    helmetBounds: helmetBounds ? boundsToPlain(helmetBounds) : null,
    helmetShoulderVerticalGap:
      helmetBounds && shoulderBounds ? helmetBounds.min.y - shoulderBounds.max.y : null,
    meshesPerPlayer,
    minimumBodyY,
    neckBounds: neckBounds ? boundsToPlain(neckBounds) : null,
    playerId: String(playerVisual.userData.testId ?? playerVisual.name),
    shoulderWidth: PLAYER_BODY_DIMENSIONS.shoulderWidth,
    totalHeight: PLAYER_BODY_DIMENSIONS.totalHeight,
    uniqueBodyGeometryCount: geometryIds.size,
    uniqueBodyMaterialCount: materialIds.size,
  };
}

export function getPlayerVisualHeadAnchor(playerVisual: THREE.Object3D): THREE.Object3D | null {
  return getOrCreatePlayerVisualReferences(playerVisual).headAnchor;
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
  torso.position.set(0, PLAYER_BODY_DIMENSIONS.torsoCenterY, 0);
  bodyRoot.add(torso);

  const jerseyTexturePanel = createBodyMesh(
    BODY_PART_NAMES.jerseyTexturePanel,
    sharedGeometry.jerseyPanel,
    'jerseyTexture',
    player,
    debugRoleColors,
  );
  jerseyTexturePanel.position.set(
    0,
    PLAYER_BODY_DIMENSIONS.jerseyPanelCenterY,
    PLAYER_BODY_DIMENSIONS.jerseyPanelForwardOffset * PLAYER_FORWARD_Z,
  );
  bodyRoot.add(jerseyTexturePanel);

  const shoulderPads = createBodyMesh(
    BODY_PART_NAMES.shoulderPads,
    sharedGeometry.shoulderPads,
    'shoulder',
    player,
    debugRoleColors,
  );
  shoulderPads.position.set(0, PLAYER_BODY_DIMENSIONS.shoulderCenterY, 0);
  bodyRoot.add(shoulderPads);

  bodyRoot.add(
    createArmPivot(BODY_PART_NAMES.leftArmPivot, BODY_PART_NAMES.leftArm, -ARM_X, player, debugRoleColors),
    createArmPivot(BODY_PART_NAMES.rightArmPivot, BODY_PART_NAMES.rightArm, ARM_X, player, debugRoleColors),
    createLegPivot(
      BODY_PART_NAMES.leftLegPivot,
      BODY_PART_NAMES.leftLeg,
      BODY_PART_NAMES.leftFoot,
      -PLAYER_BODY_DIMENSIONS.legOffsetX,
      player,
      debugRoleColors,
    ),
    createLegPivot(
      BODY_PART_NAMES.rightLegPivot,
      BODY_PART_NAMES.rightLeg,
      BODY_PART_NAMES.rightFoot,
      PLAYER_BODY_DIMENSIONS.legOffsetX,
      player,
      debugRoleColors,
    ),
  );

  bodyRoot.add(createHeadAnchor(player, debugRoleColors));
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

  bodyRoot.add(createHeadAnchor(player, debugRoleColors));
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
  pivot.position.set(x, PLAYER_BODY_DIMENSIONS.armPivotY, 0);

  const arm = createBodyMesh(meshName, sharedGeometry.arm, 'skin', player, debugRoleColors);
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
  pivot.position.set(x, PLAYER_BODY_DIMENSIONS.legPivotY, 0);

  const leg = createBodyMesh(legName, sharedGeometry.leg, 'pants', player, debugRoleColors);
  leg.position.set(0, LEG_CENTER_Y, 0);
  pivot.add(leg);

  const foot = createBodyMesh(footName, sharedGeometry.foot, 'shoes', player, debugRoleColors);
  foot.position.set(
    0,
    FOOT_CENTER_Y - PLAYER_BODY_DIMENSIONS.legPivotY,
    PLAYER_BODY_DIMENSIONS.footForwardOffset * PLAYER_FORWARD_Z,
  );
  pivot.add(foot);
  return pivot;
}

function createHeadAnchor(
  player: PlayerModel | undefined,
  debugRoleColors: boolean,
): THREE.Group {
  const headAnchor = new THREE.Group();
  headAnchor.name = PLAYER_HEAD_ANCHOR_NAME;
  headAnchor.position.set(
    0,
    PLAYER_BODY_DIMENSIONS.helmetOffsetY,
    PLAYER_BODY_DIMENSIONS.helmetOffsetZ * PLAYER_FORWARD_Z,
  );

  const neck = createBodyMesh(BODY_PART_NAMES.neck, sharedGeometry.neck, 'skin', player, debugRoleColors);
  neck.position.set(
    0,
    PLAYER_BODY_DIMENSIONS.neckCenterY,
    PLAYER_BODY_DIMENSIONS.neckCenterZ * PLAYER_FORWARD_Z,
  );
  headAnchor.add(neck);

  const head = createBodyMesh(BODY_PART_NAMES.head, sharedGeometry.head, 'skin', player, debugRoleColors);
  head.position.set(
    0,
    PLAYER_BODY_DIMENSIONS.headCenterY,
    PLAYER_BODY_DIMENSIONS.headCenterZ * PLAYER_FORWARD_Z,
  );
  headAnchor.add(head);

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
    getUniformMaterial(
      uniformPart,
      player?.team ?? 'offense',
      player?.role ?? 'runner',
      player?.id ?? 'placeholder-player',
      debugRoleColors,
    ),
  );
  mesh.name = name;
  mesh.userData.uniformPart = uniformPart;
  if (uniformPart === 'skin') {
    mesh.userData.skinToneId = resolvePlayerAppearance(player?.id ?? 'placeholder-player').skinToneId;
  }
  return mesh;
}

function syncPlayerBodyMaterials(
  playerVisual: THREE.Object3D,
  playerModel: PlayerModel,
  options: Pick<PlayerVisualOptions, 'debugRoleColors' | 'teamUniforms'>,
): void {
  const debugRoleColors =
    options.debugRoleColors ?? Boolean(playerVisual.userData.debugRoleColors);
  const teamUniforms = options.teamUniforms ?? DEFAULT_PLAYER_TEAM_UNIFORMS;
  const uniformKey = createUniformThemeKey(teamUniforms);
  const references = getOrCreatePlayerVisualReferences(playerVisual);

  playerVisual.userData.debugRoleColors = debugRoleColors;
  playerVisual.userData.uniformKey = uniformKey;
  if (
    references.materialState?.debugRoleColors === debugRoleColors &&
    references.materialState.playerId === playerModel.id &&
    references.materialState.role === playerModel.role &&
    references.materialState.team === playerModel.team &&
    references.materialState.uniformKey === uniformKey
  ) {
    return;
  }

  const appearance = resolvePlayerAppearance(playerModel.id);
  for (const { mesh, uniformPart } of references.uniformMeshes) {
    mesh.material = uniformPart === 'skin'
      ? getSkinToneMaterial(appearance.skinToneId)
      : getUniformMaterial(
        uniformPart,
        playerModel.team,
        playerModel.role,
        playerModel.id,
        debugRoleColors,
        teamUniforms,
      );
    if (uniformPart === 'skin') {
      mesh.userData.skinToneId = appearance.skinToneId;
    }
  }

  references.materialState = {
    debugRoleColors,
    playerId: playerModel.id,
    role: playerModel.role,
    team: playerModel.team,
    uniformKey,
  };
}

function getUniformMaterial(
  uniformPart: UniformPart,
  team: PlayerTeam,
  role: PlayerRole,
  playerId: string,
  debugRoleColors: boolean,
  teamUniforms: PlayerTeamUniforms = DEFAULT_PLAYER_TEAM_UNIFORMS,
): THREE.Material {
  if (uniformPart === 'skin') {
    return getSkinToneMaterial(resolvePlayerAppearance(playerId).skinToneId);
  }

  if (uniformPart === 'jerseyTexture') {
    return getJerseyTextureMaterial(team, debugRoleColors, teamUniforms);
  }

  const palette = teamUniforms[team] ?? DEFAULT_PLAYER_TEAM_UNIFORMS[team];
  const uniformColor = getUniformPartColor(uniformPart, palette);
  const materialKey = debugRoleColors
    ? `debug:${uniformPart}:${role}`
    : `uniform:${uniformPart}:${team}:${uniformColor}`;
  const cached = materialCache.get(materialKey);

  if (cached instanceof THREE.MeshLambertMaterial) {
    return cached;
  }

  const color = debugRoleColors
    ? PLAYER_ROLE_COLORS[role]
    : getUniformColorNumber(uniformColor);
  const material = new THREE.MeshLambertMaterial({
    color,
    flatShading: true,
  });
  material.name = materialKey;
  materialCache.set(materialKey, material);
  return material;
}

function getJerseyTextureMaterial(
  team: PlayerTeam,
  debugRoleColors: boolean,
  teamUniforms: PlayerTeamUniforms,
): THREE.MeshBasicMaterial {
  const palette = teamUniforms[team] ?? DEFAULT_PLAYER_TEAM_UNIFORMS[team];
  const materialKey = debugRoleColors
    ? `jersey-texture:debug:${team}`
    : `jersey-texture:${team}:${palette.number}:${palette.stripe}`;
  const cached = materialCache.get(materialKey);

  if (cached instanceof THREE.MeshBasicMaterial) {
    return cached;
  }

  const material = new THREE.MeshBasicMaterial({
    alphaTest: 0.08,
    map: createJerseyTexture(team, debugRoleColors, teamUniforms),
    side: THREE.FrontSide,
    transparent: true,
  });
  material.name = materialKey;
  materialCache.set(materialKey, material);
  return material;
}

function createJerseyTexture(
  team: PlayerTeam,
  debugRoleColors: boolean,
  teamUniforms: PlayerTeamUniforms,
): THREE.DataTexture {
  const width = 64;
  const height = 64;
  const data = new Uint8Array(width * height * 4);
  const palette = teamUniforms[team] ?? DEFAULT_PLAYER_TEAM_UNIFORMS[team];
  const accent = debugRoleColors
    ? [246, 250, 255, 220]
    : hexToRgba(palette.number, 220);
  const trim = debugRoleColors
    ? [18, 45, 98, 180]
    : hexToRgba(palette.stripe, 190);

  paintRect(data, width, 7, 8, 50, 5, accent);
  paintRect(data, width, 7, 51, 50, 4, accent);
  paintRect(data, width, 7, 13, 5, 38, trim);
  paintRect(data, width, 52, 13, 5, 38, trim);
  paintRect(data, width, 25, 22, 5, 22, accent);
  paintRect(data, width, 36, 22, 5, 22, accent);
  paintRect(data, width, 23, 20, 8, 4, accent);
  paintRect(data, width, 34, 20, 8, 4, accent);

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.name = `jersey-panel-${debugRoleColors ? 'debug' : team}`;
  texture.needsUpdate = true;
  return texture;
}

function getUniformPartColor(uniformPart: UniformClothPart, palette: UniformPalette): string {
  if (uniformPart === 'shoes') {
    return palette.shoe;
  }

  if (uniformPart === 'trim') {
    return palette.stripe;
  }

  if (uniformPart === 'shoulder') {
    return palette.shoulder;
  }

  return palette[uniformPart];
}

function createUniformThemeKey(teamUniforms: PlayerTeamUniforms): string {
  return [
    serializeUniformPalette(teamUniforms.offense),
    serializeUniformPalette(teamUniforms.defense),
  ].join('::');
}

function hexToRgba(hex: string, alpha: number): readonly number[] {
  const value = getUniformColorNumber(hex);

  return [
    (value >> 16) & 0xff,
    (value >> 8) & 0xff,
    value & 0xff,
    alpha,
  ];
}

function paintRect(
  data: Uint8Array,
  textureWidth: number,
  x: number,
  y: number,
  width: number,
  height: number,
  rgba: readonly number[],
): void {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      const index = (row * textureWidth + column) * 4;
      data[index] = rgba[0];
      data[index + 1] = rgba[1];
      data[index + 2] = rgba[2];
      data[index + 3] = rgba[3];
    }
  }
}

function getSkinToneMaterial(skinToneId: SkinToneId): THREE.MeshLambertMaterial {
  const materialKey = `skin:${skinToneId}`;
  const cached = materialCache.get(materialKey);

  if (cached instanceof THREE.MeshLambertMaterial) {
    return cached;
  }

  const paletteAppearance = resolveSkinToneAppearance(skinToneId);
  const material = new THREE.MeshLambertMaterial({
    color: paletteAppearance.skinColor,
    flatShading: true,
  });
  material.name = materialKey;
  materialCache.set(materialKey, material);
  return material;
}

function resolveSkinToneAppearance(skinToneId: SkinToneId): PlayerAppearance {
  const appearance = SKIN_TONE_PALETTE.find((candidate) => candidate.skinToneId === skinToneId);

  if (!appearance) {
    throw new Error(`Unknown skin tone ${skinToneId}`);
  }

  return appearance;
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
  return (
    value === 'jersey' ||
    value === 'jerseyTexture' ||
    value === 'pants' ||
    value === 'shoes' ||
    value === 'shoulder' ||
    value === 'skin' ||
    value === 'trim'
  );
}

function getOrCreatePlayerVisualReferences(playerVisual: THREE.Object3D): PlayerVisualHierarchyReferences {
  const cachedReferences = playerVisualReferences.get(playerVisual);

  if (cachedReferences) {
    return cachedReferences;
  }

  return cachePlayerVisualReferences(playerVisual);
}

function cachePlayerVisualReferences(
  playerVisual: THREE.Object3D,
  knownBodyRoot?: THREE.Object3D,
): PlayerVisualHierarchyReferences {
  const bodyRoot = knownBodyRoot ?? playerVisual.getObjectByName(PLAYER_BODY_ROOT_NAME) ?? playerVisual;
  const references: PlayerVisualHierarchyReferences = {
    bodyRoot,
    headAnchor: null,
    materialState: null,
    uniformMeshes: [],
  };

  bodyRoot.traverse((object) => {
    if (object.name === BODY_PART_NAMES.headAnchor) {
      references.headAnchor = object;
    }

    if (!(object instanceof THREE.Mesh) || isHelmetDescendant(object)) {
      return;
    }

    const uniformPart = object.userData.uniformPart;
    if (isUniformPart(uniformPart)) {
      references.uniformMeshes.push({ mesh: object, uniformPart });
    }
  });

  playerVisualReferences.set(playerVisual, references);
  return references;
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

function getMaterials(material: THREE.Material | THREE.Material[]): THREE.Material[] {
  return Array.isArray(material) ? material : [material];
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

function calculateContainedBoundsClearance(inner: THREE.Box3, outer: THREE.Box3): number {
  return Math.min(
    inner.min.x - outer.min.x,
    outer.max.x - inner.max.x,
    inner.min.y - outer.min.y,
    outer.max.y - inner.max.y,
    inner.min.z - outer.min.z,
    outer.max.z - inner.max.z,
  );
}

function vectorToPlain(vector: THREE.Vector3): { x: number; y: number; z: number } {
  return {
    x: vector.x,
    y: vector.y,
    z: vector.z,
  };
}

function boundsToPlain(bounds: THREE.Box3): PlayerVisualBoundsSnapshot {
  return {
    center: vectorToPlain(bounds.getCenter(new THREE.Vector3())),
    max: vectorToPlain(bounds.max),
    min: vectorToPlain(bounds.min),
    size: vectorToPlain(bounds.getSize(new THREE.Vector3())),
  };
}
