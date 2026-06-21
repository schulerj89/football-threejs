import * as THREE from 'three';
import type { BallModel, Vector3 } from './ballModel';

export type BallVisualStyle = 'football' | 'sphere';

export interface BallVisualOptions {
  style?: BallVisualStyle;
}

export interface BallVisualBoundsSnapshot {
  center: Vector3;
  max: Vector3;
  min: Vector3;
  size: Vector3;
}

export interface BallVisualSnapshot {
  bounds: BallVisualBoundsSnapshot;
  diameter: number;
  length: number;
  longAxisWorld: Vector3;
  materialCount: number;
  meshCount: number;
  style: BallVisualStyle;
  triangleCount: number;
  visible: boolean;
}

export const FOOTBALL_VISUAL_CONFIG = {
  carryRotation: { x: -0.28, y: 0.42, z: 0.7 },
  diameter: 0.24,
  laceCount: 4,
  laceLength: 0.105,
  laceSpacing: 0.044,
  laceThickness: 0.012,
  length: 0.42,
  lengthSegments: 8,
  pointExponent: 1.25,
  radialSegments: 12,
  seamLength: 0.23,
  seamThickness: 0.014,
  seamWidth: 0.026,
  shellColor: 0x7a3f20,
  spiralRadiansPerSecond: 18,
} as const;

const BALL_VISIBLE_STATES = ['caught', 'inFlight', 'possessed'] as const;
const LONG_AXIS_LOCAL = new THREE.Vector3(0, 0, 1);

const sharedFootballGeometry = createFootballGeometry();
const sharedSphereGeometry = new THREE.SphereGeometry(0.34, 12, 8);
const sharedSeamGeometry = new THREE.BoxGeometry(
  FOOTBALL_VISUAL_CONFIG.seamWidth,
  FOOTBALL_VISUAL_CONFIG.seamThickness,
  FOOTBALL_VISUAL_CONFIG.seamLength,
);
const sharedLaceGeometry = new THREE.BoxGeometry(
  FOOTBALL_VISUAL_CONFIG.laceLength,
  FOOTBALL_VISUAL_CONFIG.laceThickness,
  FOOTBALL_VISUAL_CONFIG.laceThickness,
);
const sharedShellMaterial = new THREE.MeshLambertMaterial({
  color: FOOTBALL_VISUAL_CONFIG.shellColor,
  flatShading: true,
});
const sharedSeamMaterial = new THREE.MeshLambertMaterial({
  color: 0xcaa16f,
  flatShading: true,
});

export function resolveBallVisualStyle(value: string | null): BallVisualStyle {
  return value === 'sphere' ? 'sphere' : 'football';
}

export function createBallVisual(options: BallVisualOptions = {}): THREE.Group {
  const style = options.style ?? 'football';
  const ball = new THREE.Group();
  ball.name = 'football-ball';
  ball.visible = false;
  ball.userData.ballVisualStyle = style;
  ball.userData.previousPresentationPosition = null;

  if (style === 'sphere') {
    const sphere = new THREE.Mesh(sharedSphereGeometry, sharedShellMaterial);
    sphere.name = 'football-ball-sphere';
    ball.add(sphere);
    return ball;
  }

  const spiralRoot = new THREE.Group();
  spiralRoot.name = 'football-spiral-root';

  const shell = new THREE.Mesh(sharedFootballGeometry, sharedShellMaterial);
  shell.name = 'football-shell';
  spiralRoot.add(shell);

  const seam = new THREE.Mesh(sharedSeamGeometry, sharedSeamMaterial);
  seam.name = 'football-seam';
  seam.position.set(0, FOOTBALL_VISUAL_CONFIG.diameter * 0.43, 0);
  spiralRoot.add(seam);

  const laceGroup = new THREE.Group();
  laceGroup.name = 'football-laces';
  const laceStart =
    -((FOOTBALL_VISUAL_CONFIG.laceCount - 1) * FOOTBALL_VISUAL_CONFIG.laceSpacing) / 2;
  for (let index = 0; index < FOOTBALL_VISUAL_CONFIG.laceCount; index += 1) {
    const lace = new THREE.Mesh(sharedLaceGeometry, sharedSeamMaterial);
    lace.name = `football-lace-${index}`;
    lace.position.set(
      0,
      FOOTBALL_VISUAL_CONFIG.diameter * 0.48,
      laceStart + index * FOOTBALL_VISUAL_CONFIG.laceSpacing,
    );
    laceGroup.add(lace);
  }
  spiralRoot.add(laceGroup);

  ball.add(spiralRoot);
  return ball;
}

export function syncBallVisual(ballVisual: THREE.Object3D, ballModel: BallModel): void {
  const visible = BALL_VISIBLE_STATES.includes(ballModel.state.kind as typeof BALL_VISIBLE_STATES[number]);
  const currentPosition = { ...ballModel.position };
  ballVisual.visible = visible;
  ballVisual.position.set(currentPosition.x, currentPosition.y, currentPosition.z);

  if (readBallVisualStyle(ballVisual) === 'football') {
    syncFootballOrientation(ballVisual, ballModel, currentPosition, visible);
  }

  ballVisual.userData.previousPresentationPosition = currentPosition;
}

export function getBallVisualSnapshot(ballVisual: THREE.Object3D): BallVisualSnapshot {
  ballVisual.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(ballVisual);
  const materials = new Set<string>();
  let meshCount = 0;
  let triangleCount = 0;

  ballVisual.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    meshCount += 1;
    triangleCount += countGeometryTriangles(object.geometry);
    for (const material of getMaterials(object.material)) {
      materials.add(material.uuid);
    }
  });

  const longAxisWorld = LONG_AXIS_LOCAL
    .clone()
    .applyQuaternion(ballVisual.getWorldQuaternion(new THREE.Quaternion()))
    .normalize();

  return {
    bounds: boundsToPlain(bounds),
    diameter: FOOTBALL_VISUAL_CONFIG.diameter,
    length: FOOTBALL_VISUAL_CONFIG.length,
    longAxisWorld: vectorToPlain(longAxisWorld),
    materialCount: materials.size,
    meshCount,
    style: readBallVisualStyle(ballVisual),
    triangleCount,
    visible: ballVisual.visible,
  };
}

function syncFootballOrientation(
  ballVisual: THREE.Object3D,
  ballModel: BallModel,
  currentPosition: Vector3,
  visible: boolean,
): void {
  const spiralRoot = ballVisual.getObjectByName('football-spiral-root');

  if (!visible) {
    ballVisual.rotation.set(0, 0, 0);
    if (spiralRoot) {
      spiralRoot.rotation.z = 0;
    }
    return;
  }

  if (ballModel.state.kind === 'inFlight') {
    const direction = getPresentationTravelDirection(ballVisual, ballModel, currentPosition);
    ballVisual.rotation.set(0, Math.atan2(direction.x, direction.z), 0);
    if (spiralRoot) {
      spiralRoot.rotation.z =
        ballModel.state.elapsedSeconds * FOOTBALL_VISUAL_CONFIG.spiralRadiansPerSecond;
    }
    return;
  }

  ballVisual.rotation.set(
    FOOTBALL_VISUAL_CONFIG.carryRotation.x,
    FOOTBALL_VISUAL_CONFIG.carryRotation.y,
    FOOTBALL_VISUAL_CONFIG.carryRotation.z,
  );
  if (spiralRoot) {
    spiralRoot.rotation.z = 0;
  }
}

function getPresentationTravelDirection(
  ballVisual: THREE.Object3D,
  ballModel: BallModel,
  currentPosition: Vector3,
): { x: number; z: number } {
  const previous = readPreviousPresentationPosition(ballVisual);
  const delta = previous
    ? {
        x: currentPosition.x - previous.x,
        z: currentPosition.z - previous.z,
      }
    : { x: 0, z: 0 };
  const deltaLength = Math.hypot(delta.x, delta.z);

  if (deltaLength > 0.000001) {
    return {
      x: delta.x / deltaLength,
      z: delta.z / deltaLength,
    };
  }

  if (ballModel.state.kind === 'inFlight') {
    const flightDelta = {
      x: ballModel.state.target.x - ballModel.state.start.x,
      z: ballModel.state.target.z - ballModel.state.start.z,
    };
    const flightLength = Math.hypot(flightDelta.x, flightDelta.z);

    if (flightLength > 0.000001) {
      return {
        x: flightDelta.x / flightLength,
        z: flightDelta.z / flightLength,
      };
    }
  }

  return { x: 0, z: 1 };
}

function createFootballGeometry(): THREE.BufferGeometry {
  const {
    diameter,
    length,
    lengthSegments,
    pointExponent,
    radialSegments,
  } = FOOTBALL_VISUAL_CONFIG;
  const vertices: number[] = [];
  const indices: number[] = [];

  for (let zIndex = 0; zIndex <= lengthSegments; zIndex += 1) {
    const t = zIndex / lengthSegments;
    const z = (t - 0.5) * length;
    const ringRadius = Math.pow(Math.sin(Math.PI * t), pointExponent) * diameter * 0.5;

    for (let radialIndex = 0; radialIndex < radialSegments; radialIndex += 1) {
      const angle = (radialIndex / radialSegments) * Math.PI * 2;
      vertices.push(
        Math.cos(angle) * ringRadius,
        Math.sin(angle) * ringRadius,
        z,
      );
    }
  }

  for (let zIndex = 0; zIndex < lengthSegments; zIndex += 1) {
    const ringStart = zIndex * radialSegments;
    const nextRingStart = (zIndex + 1) * radialSegments;

    for (let radialIndex = 0; radialIndex < radialSegments; radialIndex += 1) {
      const nextRadialIndex = (radialIndex + 1) % radialSegments;
      indices.push(
        ringStart + radialIndex,
        nextRingStart + radialIndex,
        nextRingStart + nextRadialIndex,
        ringStart + radialIndex,
        nextRingStart + nextRadialIndex,
        ringStart + nextRadialIndex,
      );
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.name = 'low-poly-football-prolate';
  return geometry;
}

function readPreviousPresentationPosition(ballVisual: THREE.Object3D): Vector3 | null {
  const value = ballVisual.userData.previousPresentationPosition;

  if (
    value &&
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    typeof value.z === 'number'
  ) {
    return value;
  }

  return null;
}

function readBallVisualStyle(ballVisual: THREE.Object3D): BallVisualStyle {
  return ballVisual.userData.ballVisualStyle === 'sphere' ? 'sphere' : 'football';
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

function boundsToPlain(bounds: THREE.Box3): BallVisualBoundsSnapshot {
  return {
    center: vectorToPlain(bounds.getCenter(new THREE.Vector3())),
    max: vectorToPlain(bounds.max),
    min: vectorToPlain(bounds.min),
    size: vectorToPlain(bounds.getSize(new THREE.Vector3())),
  };
}

function vectorToPlain(vector: THREE.Vector3): Vector3 {
  return {
    x: vector.x,
    y: vector.y,
    z: vector.z,
  };
}
