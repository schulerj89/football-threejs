import * as THREE from 'three';
import { SNAP_LANE_X } from './ballSpotting';
import type { GameplayCameraDebugSnapshot } from './camera/GameplayCameraController';
import type { FootballSpot } from './fieldScale';
import type { GameplaySnapshot } from './playState';
import type { PlayerBodyVisualSnapshot } from './playerVisual';
import type { PlayerModel } from './playerModel';

interface DebugOverlayOptions {
  initialVisible?: boolean;
  renderer: THREE.WebGLRenderer;
  player: PlayerModel;
}

export interface RenderMetricsSnapshot {
  calls: number;
  crowdInstanceCount: number;
  frameTimeMs: number;
  footballMeshCount: number;
  geometries: number;
  officialMeshCount: number;
  playerBodyMeshCount: number;
  playerCount: number;
  sceneMaterialCount: number;
  sceneMeshCount: number;
  shadowCastingObjectCount: number;
  stadiumDrawCallEstimate: number;
  stadiumMeshCount: number;
  textures: number;
  triangles: number;
  visibleMeshCount: number;
}

export class DebugOverlay {
  private readonly element: HTMLDivElement;
  private frameCount = 0;
  private elapsed = 0;
  private fps = 0;

  constructor({ initialVisible, renderer, player }: DebugOverlayOptions) {
    this.element = document.createElement('div');
    this.element.className = 'debug-overlay';
    this.element.hidden = !initialVisible;
    document.body.appendChild(this.element);

    this.update(0, renderer, player);
  }

  isVisible(): boolean {
    return !this.element.hidden;
  }

  setVisible(visible: boolean): void {
    this.element.hidden = !visible;
  }

  dispose(): void {
    this.element.remove();
  }

  update(
    deltaSeconds: number,
    renderer: THREE.WebGLRenderer,
    player: PlayerModel,
    camera?: GameplayCameraDebugSnapshot,
    gameplay?: GameplaySnapshot,
    playerBody?: PlayerBodyVisualSnapshot,
    renderMetrics?: RenderMetricsSnapshot,
  ): void {
    this.frameCount += 1;
    this.elapsed += deltaSeconds;

    if (this.elapsed >= 0.25) {
      this.fps = this.frameCount / this.elapsed;
      this.frameCount = 0;
      this.elapsed = 0;
    }

    const { x, z } = player.position;
    const lines = [
      `FPS ${this.fps.toFixed(0)}`,
      `POS ${x.toFixed(1)}, ${z.toFixed(1)}`,
      `CALLS ${renderer.info.render.calls}`,
      `TRIS ${renderer.info.render.triangles}`,
    ];

    if (camera) {
      lines.push(
        `CAM ${camera.mode}`,
        `CAM_STATE ${camera.state}`,
        `FOCUS ${formatVector(camera.focusPosition)}`,
        `CAM_POS ${formatVector(camera.cameraPosition)}`,
      );

      if (camera.presentationPhase) {
        lines.push(
          `PRESENT ${camera.presentationPhase}`,
          `LOOK ${formatVector(camera.lookTargetPosition ?? camera.targetPosition)}`,
          `FORM_BOUNDS ${formatPlaneBounds(camera.formationBounds)}`,
        );
      }

      if (camera.activeShotName) {
        lines.push(
          `SHOT ${camera.activeShotName}`,
          `SHOT_PROGRESS ${((camera.shotProgress ?? 0) * 100).toFixed(0)}%`,
          `ORBIT_CENTER ${formatNullableVector(camera.orbitCenter)}`,
          `ORBIT_RADIUS ${camera.orbitRadius?.toFixed(1) ?? 'none'}`,
          `RESTORE_CAM ${camera.restoreCamera ?? 'none'}`,
        );
      }
    }

    if (gameplay) {
      lines.push(
        `DEAD ${formatSpot(gameplay.exactDeadBallSpot)}`,
        `SNAP ${formatSpot(gameplay.nextSnapSpot)}`,
        `LANE ${gameplay.snapLane}`,
        `HASH_X ${SNAP_LANE_X.leftHash.toFixed(2)}, ${SNAP_LANE_X.rightHash.toFixed(2)}`,
        `FORM ${formatSpot(gameplay.formationOrigin)}`,
      );
    }

    if (playerBody) {
      lines.push(
        `BODY ${playerBody.bodyStyle}`,
        `BODY_H ${playerBody.totalHeight.toFixed(2)}`,
        `SHOULDER_W ${playerBody.shoulderWidth.toFixed(2)}`,
        `BODY_BOUNDS ${formatVector(playerBody.bodyBounds.size)}`,
        `PLAYER_BOUNDS ${formatVector(playerBody.combinedBounds.size)}`,
        `BODY_TRIS ${playerBody.bodyTriangleCount}`,
        `BODY_MESHES ${playerBody.meshesPerPlayer}`,
        `BODY_MATS ${playerBody.uniqueBodyMaterialCount}`,
      );
    }

    if (renderMetrics) {
      lines.push(
        `FRAME_MS ${renderMetrics.frameTimeMs.toFixed(1)}`,
        `GEOMS ${renderMetrics.geometries}`,
        `TEX ${renderMetrics.textures}`,
        `PLAYERS ${renderMetrics.playerCount}`,
        `FOOTBALL_MESHES ${renderMetrics.footballMeshCount}`,
        `PLAYER_MESHES ${renderMetrics.playerBodyMeshCount}`,
        `OFFICIAL_MESHES ${renderMetrics.officialMeshCount}`,
        `CROWD_INSTANCES ${renderMetrics.crowdInstanceCount}`,
        `SCENE_MESHES ${renderMetrics.sceneMeshCount}`,
        `MATERIALS ${renderMetrics.sceneMaterialCount}`,
        `SHADOW_CASTERS ${renderMetrics.shadowCastingObjectCount}`,
        `STADIUM_CALLS ${renderMetrics.stadiumDrawCallEstimate}`,
      );
    }

    this.element.textContent = lines.join('\n');
  }
}

function formatVector(vector: { x: number; y: number; z: number }): string {
  return `${vector.x.toFixed(1)}, ${vector.y.toFixed(1)}, ${vector.z.toFixed(1)}`;
}

function formatNullableVector(vector: { x: number; y: number; z: number } | null | undefined): string {
  if (!vector) {
    return 'none';
  }

  return formatVector(vector);
}

function formatSpot(spot: FootballSpot | null): string {
  if (!spot) {
    return 'none';
  }

  return `${spot.x.toFixed(1)}, ${spot.z.toFixed(1)}`;
}

function formatPlaneBounds(
  bounds:
    | {
        center: { x: number; z: number };
        size: { x: number; z: number };
      }
    | undefined,
): string {
  if (!bounds) {
    return 'none';
  }

  return `center ${bounds.center.x.toFixed(1)}, ${bounds.center.z.toFixed(1)} size ${bounds.size.x.toFixed(1)}, ${bounds.size.z.toFixed(1)}`;
}
