import * as THREE from 'three';
import type { Vector2 } from '../playerModel';
import type { FieldPlaneBounds } from './CameraTypes';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function calculateSmoothingAlpha(smoothing: number, deltaSeconds: number): number {
  return 1 - Math.exp(-smoothing * Math.max(0, deltaSeconds));
}

export function smoothNumber(
  current: number,
  target: number,
  smoothing: number,
  deltaSeconds: number,
): number {
  return current + (target - current) * calculateSmoothingAlpha(smoothing, deltaSeconds);
}

export function smoothVectorWithSpeedLimit(
  current: THREE.Vector3,
  target: THREE.Vector3,
  smoothing: number,
  deltaSeconds: number,
  maxSpeed: number,
): THREE.Vector3 {
  const alpha = calculateSmoothingAlpha(smoothing, deltaSeconds);
  const smoothed = current.clone().lerp(target, alpha);
  const delta = smoothed.clone().sub(current);
  const distance = delta.length();
  const maxDistance = Math.max(0, maxSpeed * Math.max(0, deltaSeconds));

  if (distance <= maxDistance || maxDistance === 0) {
    return smoothed;
  }

  return current.clone().add(delta.multiplyScalar(maxDistance / distance));
}

export function calculateLookDirectionAngle(
  previousPosition: THREE.Vector3,
  previousLookTarget: THREE.Vector3,
  nextPosition: THREE.Vector3,
  nextLookTarget: THREE.Vector3,
): number {
  const previousDirection = previousLookTarget.clone().sub(previousPosition);
  const nextDirection = nextLookTarget.clone().sub(nextPosition);

  if (previousDirection.lengthSq() === 0 || nextDirection.lengthSq() === 0) {
    return 0;
  }

  return previousDirection.normalize().angleTo(nextDirection.normalize());
}

export function limitLookTargetAngularChange(
  previousPosition: THREE.Vector3,
  previousLookTarget: THREE.Vector3,
  nextPosition: THREE.Vector3,
  desiredLookTarget: THREE.Vector3,
  maxRadians: number,
): THREE.Vector3 {
  if (maxRadians <= 0) {
    return previousLookTarget.clone();
  }

  const previousDirection = previousLookTarget.clone().sub(previousPosition);
  const desiredDirection = desiredLookTarget.clone().sub(nextPosition);

  if (previousDirection.lengthSq() === 0 || desiredDirection.lengthSq() === 0) {
    return desiredLookTarget.clone();
  }

  const angle = previousDirection.clone().normalize().angleTo(desiredDirection.clone().normalize());
  if (angle <= maxRadians) {
    return desiredLookTarget.clone();
  }

  const distance = desiredLookTarget.distanceTo(nextPosition);
  const blend = clamp(maxRadians / angle, 0, 1);
  const limitedDirection = previousDirection
    .normalize()
    .lerp(desiredDirection.normalize(), blend)
    .normalize();

  return nextPosition.clone().add(limitedDirection.multiplyScalar(distance));
}

export function easeInOutCubic(value: number): number {
  const t = clamp(value, 0, 1);

  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function normalizeDirection(direction: Vector2): Vector2 {
  const length = Math.hypot(direction.x, direction.z);

  if (length === 0) {
    return { x: 0, z: 1 };
  }

  return {
    x: direction.x / length,
    z: direction.z / length,
  };
}

export function toPlainVector(vector: THREE.Vector3): { x: number; y: number; z: number } {
  return {
    x: vector.x,
    y: vector.y,
    z: vector.z,
  };
}

export function toVector3(vector: { x: number; y: number; z: number }): THREE.Vector3 {
  return new THREE.Vector3(vector.x, vector.y, vector.z);
}

export function cloneFieldPlaneBounds(bounds: FieldPlaneBounds): FieldPlaneBounds {
  return {
    center: { ...bounds.center },
    max: { ...bounds.max },
    min: { ...bounds.min },
    playerIds: [...bounds.playerIds],
    size: { ...bounds.size },
  };
}
