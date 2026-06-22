import * as THREE from 'three';
import { FIELD_BOUNDS } from '../../fieldSpec';
import type {
  PregamePresentationContext,
  PregameSubjectBounds,
} from './PregamePresentationTypes';
import {
  resolveQuarterbackSpotlightSubject,
  type QuarterbackSpotlightSubject,
} from './SpotlightSubjectResolver';

export const QUARTERBACK_SPOTLIGHT_CONFIG = {
  cameraEndDistance: 4.7,
  cameraHeight: 2.55,
  cameraSideOffset: 1.85,
  cameraStartDistance: 6.4,
  fieldOfView: 27,
  minimumSeconds: 5,
  subjectDepth: 2.4,
  subjectHeight: 1.35,
  subjectWidth: 2,
} as const;

export interface QuarterbackSpotlightCameraVectors {
  fieldOfView: number;
  lookTarget: THREE.Vector3;
  position: THREE.Vector3;
}

export function resolveQuarterbackSpotlightBounds(
  context: PregamePresentationContext,
): PregameSubjectBounds {
  return quarterbackSubjectToBounds(resolveQuarterbackSpotlightSubject(context));
}

export function quarterbackSubjectToBounds(
  subject: QuarterbackSpotlightSubject,
): PregameSubjectBounds {
  const halfWidth = QUARTERBACK_SPOTLIGHT_CONFIG.subjectWidth / 2;
  const halfDepth = QUARTERBACK_SPOTLIGHT_CONFIG.subjectDepth / 2;

  return {
    center: {
      x: subject.playerPosition.x,
      y: QUARTERBACK_SPOTLIGHT_CONFIG.subjectHeight,
      z: subject.playerPosition.z,
    },
    max: {
      x: subject.playerPosition.x + halfWidth,
      z: subject.playerPosition.z + halfDepth,
    },
    min: {
      x: subject.playerPosition.x - halfWidth,
      z: subject.playerPosition.z - halfDepth,
    },
    size: {
      x: QUARTERBACK_SPOTLIGHT_CONFIG.subjectWidth,
      z: QUARTERBACK_SPOTLIGHT_CONFIG.subjectDepth,
    },
    source: 'quarterbackSpotlight',
  };
}

export function createQuarterbackSpotlightShotVectors(
  context: PregamePresentationContext,
  subject: PregameSubjectBounds,
  progress: number,
): QuarterbackSpotlightCameraVectors {
  const direction = resolveDirectionOfPlay(context);
  const side = new THREE.Vector3(direction.z, 0, -direction.x);
  const behind = new THREE.Vector3(-direction.x, 0, -direction.z);
  const aspectScale = context.aspectRatio < 0.8 ? 1.16 : 1;
  const distance = lerp(
    QUARTERBACK_SPOTLIGHT_CONFIG.cameraStartDistance,
    QUARTERBACK_SPOTLIGHT_CONFIG.cameraEndDistance,
    easeOut(progress),
  ) * aspectScale;
  const focus = new THREE.Vector3(subject.center.x, 0, subject.center.z);
  const sideSign = focus.x < 0 ? -1 : 1;
  const position = focus
    .clone()
    .add(behind.multiplyScalar(distance))
    .add(side.multiplyScalar(QUARTERBACK_SPOTLIGHT_CONFIG.cameraSideOffset * sideSign));
  position.y = QUARTERBACK_SPOTLIGHT_CONFIG.cameraHeight;

  return {
    fieldOfView: QUARTERBACK_SPOTLIGHT_CONFIG.fieldOfView,
    lookTarget: new THREE.Vector3(
      subject.center.x,
      QUARTERBACK_SPOTLIGHT_CONFIG.subjectHeight,
      subject.center.z + direction.z * 0.18,
    ),
    position: clampToPresentationBounds(position),
  };
}

function resolveDirectionOfPlay(context: PregamePresentationContext): { x: number; z: number } {
  const direction = context.gameplaySnapshot.selectedPlay.initialMovementDirection;
  const length = Math.hypot(direction.x, direction.z);

  if (length <= 0.0001) {
    return { x: 0, z: 1 };
  }

  return {
    x: direction.x / length,
    z: direction.z / length,
  };
}

function clampToPresentationBounds(position: THREE.Vector3): THREE.Vector3 {
  const padding = 24;
  position.x = clamp(position.x, FIELD_BOUNDS.minX - padding, FIELD_BOUNDS.maxX + padding);
  position.z = clamp(position.z, FIELD_BOUNDS.minZ - padding, FIELD_BOUNDS.maxZ + padding);
  position.y = Math.max(1.8, position.y);
  return position;
}

function easeOut(value: number): number {
  return 1 - (1 - value) * (1 - value);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
