import * as THREE from 'three';
import type { PresentationAudioEvent } from '../audio/PresentationEventBridge';
import { FIELD_BOUNDS, FIELD_DIMENSIONS } from '../fieldSpec';
import type { GameplaySnapshot } from '../playState';
import type { Vector2 } from '../playerModel';
import {
  createFieldFocus,
  createForwardTarget,
  getBallCarrier,
} from './CameraFocusResolver';
import type {
  CinematicsSetting,
  FieldPlaneBounds,
  PresentationCameraConfig,
  PresentationCameraPhase,
  PresentationOrbitShotName,
} from './CameraTypes';
import { clamp, easeInOutCubic, toVector3 } from './CameraMath';
import { createPresentationPhaseShot } from './PresentationStaticShotDefinitions';

export interface PresentationCameraShot {
  activeShotName: PresentationOrbitShotName | null;
  fieldOfView: number;
  focus: THREE.Vector3;
  lookTarget: THREE.Vector3;
  orbitCenter: THREE.Vector3 | null;
  orbitRadius: number | null;
  phase: PresentationCameraPhase;
  position: THREE.Vector3;
  restoreCamera: string | null;
  shotProgress: number | null;
}

export interface ActiveOrbitShot {
  elapsedSeconds: number;
  key: string;
  lockedCenter?: THREE.Vector3;
  name: PresentationOrbitShotName;
  preview: boolean;
  resultCenter?: THREE.Vector3;
  resultId?: number;
}

export class PresentationShotFactory {
  constructor(
    private readonly config: PresentationCameraConfig,
    private readonly cinematics: CinematicsSetting,
    private readonly playDirection: Vector2,
    private readonly sidelineDirection: Vector2,
  ) {}

  createShot(
    snapshot: GameplaySnapshot,
    formationBounds: FieldPlaneBounds,
    phase: PresentationCameraPhase,
  ): PresentationCameraShot {
    return createPresentationPhaseShot({
      config: this.config,
      formationBounds,
      phase,
      playDirection: this.playDirection,
      sidelineDirection: this.sidelineDirection,
      snapshot,
    });
  }

  createOrbitShot(
    snapshot: GameplaySnapshot,
    formationBounds: FieldPlaneBounds,
    activeShot: ActiveOrbitShot,
    aspectRatio: number,
    restoreCameraMode: string | null,
  ): PresentationCameraShot {
    if (
      activeShot.name === 'firstDownCrowdCutaway' ||
      activeShot.name === 'touchdownCrowdCutaway'
    ) {
      return this.createCrowdCutawayShot(activeShot, aspectRatio, restoreCameraMode);
    }

    const config = this.config.cinematics[activeShot.name];
    const rawProgress = this.calculateShotProgress(activeShot, config.briefDuration, config.fullDuration);
    const progress = easeInOutCubic(rawProgress);
    const sweepRadians = THREE.MathUtils.degToRad(
      this.cinematics === 'full' ? config.fullSweepDegrees : config.briefSweepDegrees,
    );
    const center = activeShot.lockedCenter
      ? activeShot.lockedCenter.clone()
      : activeShot.name === 'prePlayOrbit180'
        ? this.createPrePlayOrbitCenter(snapshot)
        : this.createTouchdownOrbitCenter(snapshot);
    const phase: PresentationCameraPhase = activeShot.name === 'prePlayOrbit180'
      ? 'preSnapEstablish'
      : 'touchdownResult';
    const focus = this.createFieldFocus(center.x, center.z, center.y);
    const radius = this.calculateOrbitRadius(activeShot.name, formationBounds, aspectRatio);
    const startAngle = activeShot.name === 'prePlayOrbit180' ? -sweepRadians : 0;
    const angle = startAngle + sweepRadians * progress;
    const position = this.createOrbitPosition(center, radius, angle, config.height);
    const lookTarget = activeShot.name === 'prePlayOrbit180'
      ? this.createForwardTarget(focus, config.lookAhead * (1 - progress))
      : this.createForwardTarget(focus, config.lookAhead);

    return {
      activeShotName: activeShot.name,
      fieldOfView: config.fieldOfView,
      focus,
      lookTarget,
      orbitCenter: center.clone(),
      orbitRadius: radius,
      phase,
      position: this.preventCameraClipping(position),
      restoreCamera: restoreCameraMode,
      shotProgress: rawProgress,
    };
  }

  createCrowdCutawayCenter(event: PresentationAudioEvent, snapshot: GameplaySnapshot): THREE.Vector3 {
    const spot = event.playResult?.endingBallSpot ??
      snapshot.lastPlayResult?.endingBallSpot ??
      snapshot.nextSnapSpot;
    const sideSign = spot.x >= 0 ? 1 : -1;
    const sidelineDistance = FIELD_DIMENSIONS.fieldWidth / 2 + 22;
    const downfield = clamp(spot.z, FIELD_BOUNDS.minZ + 12, FIELD_BOUNDS.maxZ - 12);

    return new THREE.Vector3(
      this.sidelineDirection.x * sideSign * sidelineDistance + this.playDirection.x * downfield,
      5.25,
      this.sidelineDirection.z * sideSign * sidelineDistance + this.playDirection.z * downfield,
    );
  }

  createResultSpotCenter(event: PresentationAudioEvent, snapshot: GameplaySnapshot): THREE.Vector3 {
    const spot = event.playResult?.endingBallSpot ??
      snapshot.lastPlayResult?.endingBallSpot ??
      snapshot.player.position;

    return new THREE.Vector3(spot.x, 1.55, spot.z);
  }

  createTouchdownOrbitCenter(snapshot: GameplaySnapshot): THREE.Vector3 {
    const spot = snapshot.lastPlayResult?.endingBallSpot ?? snapshot.player.position;
    const scorer = getBallCarrier(snapshot) ?? snapshot.player;
    const x = snapshot.lastPlayResult?.type === 'touchdown' ? spot.x : scorer.position.x;
    const z = snapshot.lastPlayResult?.type === 'touchdown' ? spot.z : scorer.position.z;

    return new THREE.Vector3(x, 1.55, z);
  }

  private createCrowdCutawayShot(
    activeShot: ActiveOrbitShot,
    aspectRatio: number,
    restoreCameraMode: string | null,
  ): PresentationCameraShot {
    const config = this.config.cinematics[activeShot.name];
    const rawProgress = this.calculateShotProgress(activeShot, config.briefDuration, config.fullDuration);
    const progress = easeInOutCubic(rawProgress);
    const center = activeShot.lockedCenter ?? new THREE.Vector3(0, 5.2, 0);
    const sideSign = this.getSidelineSign(center);
    const radius = clamp(
      config.distance * (aspectRatio < 0.75 ? 1.18 : 1),
      config.minimumRadius,
      config.maximumRadius,
    );
    const sweepRadians = THREE.MathUtils.degToRad(
      this.cinematics === 'full' ? config.fullSweepDegrees : config.briefSweepDegrees,
    );
    const lateralDrift = Math.sin(-sweepRadians / 2 + sweepRadians * progress) * 3.5;
    const position = new THREE.Vector3(
      center.x - this.sidelineDirection.x * sideSign * radius + this.playDirection.x * lateralDrift,
      config.height,
      center.z - this.sidelineDirection.z * sideSign * radius + this.playDirection.z * lateralDrift,
    );
    const phase: PresentationCameraPhase = activeShot.name === 'touchdownCrowdCutaway'
      ? 'touchdownResult'
      : 'deadBallResult';

    return {
      activeShotName: activeShot.name,
      fieldOfView: config.fieldOfView,
      focus: center.clone(),
      lookTarget: new THREE.Vector3(center.x, center.y + 0.5, center.z),
      orbitCenter: center.clone(),
      orbitRadius: radius,
      phase,
      position: this.preventCameraClipping(position),
      restoreCamera: restoreCameraMode,
      shotProgress: rawProgress,
    };
  }

  private createPrePlayOrbitCenter(snapshot: GameplaySnapshot): THREE.Vector3 {
    const snap = snapshot.nextSnapSpot ?? snapshot.currentBallSpot;

    return new THREE.Vector3(snap.x, 1.45, snap.z);
  }

  private calculateOrbitRadius(
    shotName: PresentationOrbitShotName,
    formationBounds: FieldPlaneBounds,
    aspectRatio: number,
  ): number {
    const config = this.config.cinematics[shotName];
    const aspectScale = aspectRatio < 0.75 ? 1.22 : 1;
    const boundsRadius = shotName === 'prePlayOrbit180'
      ? Math.max(formationBounds.size.x * 0.62, formationBounds.size.z * 0.92)
      : 0;

    return clamp(
      Math.max(config.minimumRadius, config.distance, boundsRadius) * aspectScale,
      config.minimumRadius,
      config.maximumRadius,
    );
  }

  private createOrbitPosition(
    center: THREE.Vector3,
    radius: number,
    angleRadians: number,
    height: number,
  ): THREE.Vector3 {
    const sidelineWeight = Math.sin(angleRadians) * radius;
    const playDirectionWeight = -Math.cos(angleRadians) * radius;

    return new THREE.Vector3(
      center.x + this.sidelineDirection.x * sidelineWeight + this.playDirection.x * playDirectionWeight,
      height,
      center.z + this.sidelineDirection.z * sidelineWeight + this.playDirection.z * playDirectionWeight,
    );
  }

  private offsetFromFocus(
    focus: THREE.Vector3,
    options: { distanceBehind: number; height: number; sidelineOffset?: number },
  ): THREE.Vector3 {
    return new THREE.Vector3(
      focus.x - this.playDirection.x * options.distanceBehind +
        this.sidelineDirection.x * (options.sidelineOffset ?? 0),
      options.height,
      focus.z - this.playDirection.z * options.distanceBehind +
        this.sidelineDirection.z * (options.sidelineOffset ?? 0),
    );
  }

  private createForwardTarget(focus: THREE.Vector3, lookAhead: number): THREE.Vector3 {
    return toVector3(createForwardTarget(focus, this.playDirection, lookAhead, this.config));
  }

  private createFieldFocus(x: number, z: number, y: number): THREE.Vector3 {
    return toVector3(createFieldFocus(x, z, y, this.config));
  }

  private preventCameraClipping(position: THREE.Vector3): THREE.Vector3 {
    const padding = this.config.cinematics.fieldPadding;

    return new THREE.Vector3(
      clamp(position.x, FIELD_BOUNDS.minX - padding, FIELD_BOUNDS.maxX + padding),
      Math.max(this.config.cinematics.minimumCameraHeight, position.y),
      clamp(position.z, FIELD_BOUNDS.minZ - padding, FIELD_BOUNDS.maxZ + padding),
    );
  }

  private getSidelineSign(point: THREE.Vector3): -1 | 1 {
    const sidelineProjection =
      point.x * this.sidelineDirection.x +
      point.z * this.sidelineDirection.z;

    return sidelineProjection >= 0 ? 1 : -1;
  }

  private calculateShotProgress(
    activeShot: ActiveOrbitShot,
    briefDuration: number,
    fullDuration: number,
  ): number {
    const duration = this.cinematics === 'full' ? fullDuration : briefDuration;

    return clamp(activeShot.elapsedSeconds / Math.max(0.001, duration), 0, 1);
  }
}
