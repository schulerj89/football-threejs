import * as THREE from 'three';
import type { SnapPlacement } from '../ballSpotting';
import {
  type CoverageZone,
  type CoverageZoneAnchor,
} from '../coverageShell';
import type { FootballSpot } from '../fieldScale';
import type { GameplaySnapshot } from '../playState';
import { createPlayerPlayArtModel } from '../playerPlayArt';
import type { PlayDefinition } from '../playbook';
import {
  RECEIVER_ROUTE_AUDIT_CONFIG,
  createReceiverRouteAuditSnapshot,
  type ReceiverRouteAuditSnapshot,
  type ReceiverRouteAnchor,
  type ReceiverRouteState,
  type ResolvedReceiverRoute,
} from '../receiverRoutes';

export interface RouteArtRendererOptions {
  auditEnabled?: boolean;
  coverageShellEnabled?: boolean;
  enabled?: boolean;
  toleranceYards?: number;
}

export interface RouteArtRouteSnapshot {
  anchor: ReceiverRouteAnchor;
  audit: ReceiverRouteAuditSnapshot | null;
  points: FootballSpot[];
  receiverId: string;
  routeId: string;
  selected: boolean;
}

export interface RouteArtRendererSnapshot {
  auditEnabled: boolean;
  coverageShellEnabled: boolean;
  coverageZones: RouteArtCoverageZoneSnapshot[];
  enabled: boolean;
  rebuildKey: string;
  routeCount: number;
  routes: RouteArtRouteSnapshot[];
  visible: boolean;
}

export interface RouteArtCoverageZoneSnapshot {
  anchor: CoverageZoneAnchor;
  defenderId: string;
  kind: CoverageZone['kind'];
  label: string;
  landmark: FootballSpot;
  points: FootballSpot[];
  visible: boolean;
}

interface RouteVisual {
  activeSegmentLine: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  audit: ReceiverRouteAuditSnapshot | null;
  arrow: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
  group: THREE.Group;
  path: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  projectionLine: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  receiverId: string;
  receiverMarker: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  route: ResolvedReceiverRoute;
  routeId: string;
  selected: boolean;
  startMarker: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  waypointMarkers: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>[];
}

interface CoverageZoneVisual {
  landmark: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  outline: THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  shell: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  zone: CoverageZone;
}

export const ROUTE_ART_CONFIG = {
  arrowLength: 0.9,
  arrowRadius: 0.32,
  heightY: 0.09,
  receiverMarkerRadius: 0.34,
  routeOpacity: 0.82,
  selectedRouteOpacity: 0.98,
  startMarkerRadius: 0.3,
  waypointRadius: 0.22,
  coverageLandmarkRadius: 0.28,
  coverageZoneSegments: 40,
  coverageZoneOpacity: 0.2,
  coverageZoneOutlineOpacity: 0.78,
} as const;

export class RouteArtRenderer {
  readonly group = new THREE.Group();

  private readonly activeSegmentMaterial = new THREE.LineBasicMaterial({
    color: 0x54d6ff,
    depthTest: true,
    transparent: true,
    opacity: 0.95,
  });
  private readonly arrowGeometry = new THREE.ConeGeometry(
    ROUTE_ART_CONFIG.arrowRadius,
    ROUTE_ART_CONFIG.arrowLength,
    3,
  );
  private readonly errorLineMaterial = new THREE.LineBasicMaterial({
    color: 0xff4d4d,
    depthTest: true,
    transparent: true,
    opacity: 0.98,
  });
  private readonly errorMarkerMaterial = new THREE.MeshBasicMaterial({
    color: 0xff4d4d,
    depthTest: true,
    transparent: true,
    opacity: 0.96,
  });
  private readonly projectionMaterial = new THREE.LineBasicMaterial({
    color: 0xffc44d,
    depthTest: true,
    transparent: true,
    opacity: 0.9,
  });
  private readonly routeLineMaterial = new THREE.LineBasicMaterial({
    color: 0xf3f5f6,
    depthTest: true,
    transparent: true,
    opacity: ROUTE_ART_CONFIG.routeOpacity,
  });
  private readonly routeMarkerMaterial = new THREE.MeshBasicMaterial({
    color: 0xf3f5f6,
    depthTest: true,
    transparent: true,
    opacity: 0.92,
  });
  private readonly selectedLineMaterial = new THREE.LineBasicMaterial({
    color: 0xf2d94b,
    depthTest: true,
    transparent: true,
    opacity: ROUTE_ART_CONFIG.selectedRouteOpacity,
  });
  private readonly selectedMarkerMaterial = new THREE.MeshBasicMaterial({
    color: 0xf2d94b,
    depthTest: true,
    transparent: true,
    opacity: 0.98,
  });
  private readonly markerGeometry = new THREE.CircleGeometry(ROUTE_ART_CONFIG.waypointRadius, 16);
  private readonly coverageLandmarkGeometry = new THREE.CircleGeometry(
    ROUTE_ART_CONFIG.coverageLandmarkRadius,
    16,
  );
  private readonly coverageFlatMaterial = new THREE.MeshBasicMaterial({
    color: 0x54d6ff,
    depthTest: true,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: ROUTE_ART_CONFIG.coverageZoneOpacity,
  });
  private readonly coverageFlatOutlineMaterial = new THREE.LineBasicMaterial({
    color: 0x54d6ff,
    depthTest: true,
    transparent: true,
    opacity: ROUTE_ART_CONFIG.coverageZoneOutlineOpacity,
  });
  private readonly coverageDeepMaterial = new THREE.MeshBasicMaterial({
    color: 0xf2d94b,
    depthTest: true,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: ROUTE_ART_CONFIG.coverageZoneOpacity,
  });
  private readonly coverageDeepOutlineMaterial = new THREE.LineBasicMaterial({
    color: 0xf2d94b,
    depthTest: true,
    transparent: true,
    opacity: ROUTE_ART_CONFIG.coverageZoneOutlineOpacity,
  });
  private readonly coverageFlatLandmarkMaterial = new THREE.MeshBasicMaterial({
    color: 0x54d6ff,
    depthTest: true,
    transparent: true,
    opacity: 0.92,
  });
  private readonly coverageDeepLandmarkMaterial = new THREE.MeshBasicMaterial({
    color: 0xf2d94b,
    depthTest: true,
    transparent: true,
    opacity: 0.92,
  });
  private readonly receiverMarkerGeometry = new THREE.CircleGeometry(
    ROUTE_ART_CONFIG.receiverMarkerRadius,
    16,
  );
  private readonly startMarkerGeometry = new THREE.CircleGeometry(ROUTE_ART_CONFIG.startMarkerRadius, 16);

  private readonly routeVisuals = new Map<string, RouteVisual>();
  private readonly coverageZoneVisuals: CoverageZoneVisual[] = [];
  private lastRebuildKey = '';
  private snapshot: RouteArtRendererSnapshot;

  private enabled: boolean;

  constructor(private readonly options: RouteArtRendererOptions = {}) {
    this.enabled = options.enabled !== false;
    this.group.name = 'route-art-root';
    this.group.visible = false;
    this.snapshot = this.createSnapshot(false);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!this.enabled && !this.options.auditEnabled) {
      this.group.visible = false;
    }
  }

  update(gameplay: GameplaySnapshot, play: PlayDefinition): void {
    const enabled = this.enabled || this.options.auditEnabled === true;
    const auditEnabled = this.options.auditEnabled === true;
    const coverageShellEnabled = this.options.coverageShellEnabled === true;
    const shouldShow = enabled &&
      play.kind === 'pass' &&
      (gameplay.playState === 'preSnap' || (auditEnabled && gameplay.playState === 'live'));
    const shouldShowCoverage = shouldShow && coverageShellEnabled && gameplay.playState === 'preSnap';

    this.group.visible = shouldShow;

    if (!enabled || play.kind !== 'pass') {
      this.snapshot = this.createSnapshot(false);
      return;
    }

    const snapPlacement: SnapPlacement = {
      lane: gameplay.drive.snapLane,
      spot: gameplay.drive.lineOfScrimmage,
    };
    const playArt = createPlayerPlayArtModel(play, snapPlacement, {
      playerPositions: gameplay.players.map((player) => ({
        id: player.id,
        position: player.position,
      })),
    });
    const routes = playArt.receiverRoutes;
    const coverageZones = coverageShellEnabled
      ? playArt.coverageZones
      : [];
    const rebuildKey = createRouteRebuildKey(play, snapPlacement, routes, coverageZones);

    if (rebuildKey !== this.lastRebuildKey) {
      this.rebuild(routes, coverageZones, rebuildKey);
    }

    this.syncCoverageZoneVisualStates(shouldShowCoverage);
    this.syncRouteVisualStates(gameplay, auditEnabled);
    this.snapshot = this.createSnapshot(shouldShow);
  }

  getSnapshot(): RouteArtRendererSnapshot {
    return {
      ...this.snapshot,
      routes: this.snapshot.routes.map((route) => ({
        ...route,
        anchor: {
          formationPosition: { ...route.anchor.formationPosition },
          playerId: route.anchor.playerId,
          position: { ...route.anchor.position },
          source: route.anchor.source,
        },
        audit: route.audit ? cloneAuditSnapshot(route.audit) : null,
        points: route.points.map((point) => ({ ...point })),
      })),
      coverageZones: this.snapshot.coverageZones.map((zone) => ({
        ...zone,
        anchor: {
          formationPosition: { ...zone.anchor.formationPosition },
          playerId: zone.anchor.playerId,
          position: { ...zone.anchor.position },
          source: zone.anchor.source,
        },
        landmark: { ...zone.landmark },
        points: zone.points.map((point) => ({ ...point })),
      })),
    };
  }

  dispose(): void {
    this.clearRouteVisuals();
    this.arrowGeometry.dispose();
    this.markerGeometry.dispose();
    this.receiverMarkerGeometry.dispose();
    this.startMarkerGeometry.dispose();
    for (const material of [
      this.activeSegmentMaterial,
      this.errorLineMaterial,
      this.errorMarkerMaterial,
      this.projectionMaterial,
      this.routeLineMaterial,
      this.routeMarkerMaterial,
      this.selectedLineMaterial,
      this.selectedMarkerMaterial,
      this.coverageFlatMaterial,
      this.coverageFlatOutlineMaterial,
      this.coverageDeepMaterial,
      this.coverageDeepOutlineMaterial,
      this.coverageFlatLandmarkMaterial,
      this.coverageDeepLandmarkMaterial,
    ]) {
      material.dispose();
    }
    this.coverageLandmarkGeometry.dispose();
  }

  private rebuild(
    routes: ResolvedReceiverRoute[],
    coverageZones: CoverageZone[],
    rebuildKey: string,
  ): void {
    this.clearRouteVisuals();
    this.lastRebuildKey = rebuildKey;

    for (const route of routes) {
      const visual = this.createRouteVisual(route);
      this.routeVisuals.set(route.receiverId, visual);
      this.group.add(visual.group);
    }

    for (const zone of coverageZones) {
      const visual = this.createCoverageZoneVisual(zone);
      this.coverageZoneVisuals.push(visual);
      this.group.add(visual.shell, visual.outline, visual.landmark);
    }
  }

  private createCoverageZoneVisual(zone: CoverageZone): CoverageZoneVisual {
    const material = isDeepCoverageZone(zone)
      ? this.coverageDeepMaterial
      : this.coverageFlatMaterial;
    const outlineMaterial = isDeepCoverageZone(zone)
      ? this.coverageDeepOutlineMaterial
      : this.coverageFlatOutlineMaterial;
    const landmarkMaterial = isDeepCoverageZone(zone)
      ? this.coverageDeepLandmarkMaterial
      : this.coverageFlatLandmarkMaterial;
    const shell = new THREE.Mesh(createCoverageZoneGeometry(zone), material);
    shell.name = `route-art-coverage-zone-${zone.defenderId}`;
    shell.renderOrder = 4;
    shell.userData.coverageZone = true;
    shell.userData.coverageZoneKind = zone.kind;

    const outline = new THREE.LineLoop(createCoverageZoneOutlineGeometry(zone), outlineMaterial);
    outline.name = `route-art-coverage-zone-outline-${zone.defenderId}`;
    outline.renderOrder = 5;
    outline.userData.coverageZoneOutline = true;
    outline.userData.coverageZoneKind = zone.kind;

    const landmark = new THREE.Mesh(this.coverageLandmarkGeometry, landmarkMaterial);
    landmark.name = `route-art-coverage-landmark-${zone.defenderId}`;
    landmark.position.set(zone.landmark.x, ROUTE_ART_CONFIG.heightY + 0.035, zone.landmark.z);
    landmark.rotation.x = -Math.PI / 2;
    landmark.renderOrder = 8;
    landmark.userData.coverageZoneLandmark = true;

    return {
      landmark,
      outline,
      shell,
      zone,
    };
  }

  private createRouteVisual(route: ResolvedReceiverRoute): RouteVisual {
    const group = new THREE.Group();
    group.name = `route-art-${route.receiverId}`;

    const path = new THREE.Line(
      createRouteGeometry(route.points),
      this.routeLineMaterial,
    );
    path.name = `route-art-path-${route.receiverId}`;
    path.renderOrder = 6;
    group.add(path);

    const startMarker = this.createMarker(
      this.startMarkerGeometry,
      this.routeMarkerMaterial,
      route.points[0],
      `route-art-start-${route.receiverId}`,
    );
    group.add(startMarker);

    const waypointMarkers = route.points
      .slice(1, -1)
      .map((point, index) => {
        const marker = this.createMarker(
          this.markerGeometry,
          this.routeMarkerMaterial,
          point,
          `route-art-break-${route.receiverId}-${index}`,
        );
        group.add(marker);
        return marker;
      });

    const arrow = new THREE.Mesh(this.arrowGeometry, this.routeMarkerMaterial);
    arrow.name = `route-art-arrow-${route.receiverId}`;
    arrow.renderOrder = 7;
    positionArrow(arrow, route);
    group.add(arrow);

    const activeSegmentLine = new THREE.Line(
      createDynamicLineGeometry(),
      this.activeSegmentMaterial,
    );
    activeSegmentLine.name = `route-art-active-segment-${route.receiverId}`;
    activeSegmentLine.renderOrder = 8;
    activeSegmentLine.visible = false;
    group.add(activeSegmentLine);

    const projectionLine = new THREE.Line(
      createDynamicLineGeometry(),
      this.projectionMaterial,
    );
    projectionLine.name = `route-art-projection-${route.receiverId}`;
    projectionLine.renderOrder = 8;
    projectionLine.visible = false;
    group.add(projectionLine);

    const receiverMarker = this.createMarker(
      this.receiverMarkerGeometry,
      this.errorMarkerMaterial,
      route.points[0],
      `route-art-error-marker-${route.receiverId}`,
    );
    receiverMarker.visible = false;
    group.add(receiverMarker);

    return {
      activeSegmentLine,
      audit: null,
      arrow,
      group,
      path,
      projectionLine,
      receiverId: route.receiverId,
      receiverMarker,
      route,
      routeId: route.id,
      selected: false,
      startMarker,
      waypointMarkers,
    };
  }

  private createMarker(
    geometry: THREE.CircleGeometry,
    material: THREE.MeshBasicMaterial,
    point: FootballSpot,
    name: string,
  ): THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial> {
    const marker = new THREE.Mesh(geometry, material);
    marker.name = name;
    marker.position.set(point.x, ROUTE_ART_CONFIG.heightY + 0.01, point.z);
    marker.rotation.x = -Math.PI / 2;
    marker.renderOrder = 7;

    return marker;
  }

  private syncRouteVisualStates(gameplay: GameplaySnapshot, auditEnabled: boolean): void {
    const routeStates = new Map(gameplay.receiverRouteStates.map((state) => [state.receiverId, state]));
    const players = new Map(gameplay.players.map((player) => [player.id, player]));

    for (const visual of this.routeVisuals.values()) {
      const selected = gameplay.selectedReceiver?.id === visual.receiverId;
      const player = players.get(visual.receiverId);
      const routeState = routeStates.get(visual.receiverId);
      const audit = auditEnabled && player
        ? createReceiverRouteAuditSnapshot(
            visual.route,
            player.position,
            routeState,
            this.options.toleranceYards ?? RECEIVER_ROUTE_AUDIT_CONFIG.corridorToleranceYards,
          )
        : null;

      visual.audit = audit ? cloneAuditSnapshot(audit) : null;
      visual.selected = selected;
      this.applyMaterials(visual, selected, audit?.exceedsTolerance ?? false);
      this.syncAuditVisuals(visual, player?.position ?? null, routeState, audit);
    }
  }

  private syncCoverageZoneVisualStates(visible: boolean): void {
    for (const visual of this.coverageZoneVisuals) {
      visual.shell.visible = visible;
      visual.outline.visible = visible;
      visual.landmark.visible = visible;
    }
  }

  private applyMaterials(visual: RouteVisual, selected: boolean, hasError: boolean): void {
    const lineMaterial = hasError
      ? this.errorLineMaterial
      : selected
        ? this.selectedLineMaterial
        : this.routeLineMaterial;
    const markerMaterial = hasError
      ? this.errorMarkerMaterial
      : selected
        ? this.selectedMarkerMaterial
        : this.routeMarkerMaterial;

    visual.path.material = lineMaterial;
    visual.arrow.material = markerMaterial;
    visual.startMarker.material = markerMaterial;
    for (const waypointMarker of visual.waypointMarkers) {
      waypointMarker.material = markerMaterial;
    }
  }

  private syncAuditVisuals(
    visual: RouteVisual,
    receiverPosition: FootballSpot | null,
    routeState: ReceiverRouteState | undefined,
    audit: ReceiverRouteAuditSnapshot | null,
  ): void {
    if (!audit || !receiverPosition) {
      visual.activeSegmentLine.visible = false;
      visual.projectionLine.visible = false;
      visual.receiverMarker.visible = false;
      return;
    }

    writeLineGeometry(
      visual.activeSegmentLine.geometry,
      audit.activeSegmentStart,
      audit.activeSegmentEnd,
    );
    visual.activeSegmentLine.visible = true;

    writeLineGeometry(
      visual.projectionLine.geometry,
      receiverPosition,
      audit.nearestPoint,
    );
    visual.projectionLine.material = audit.exceedsTolerance
      ? this.errorLineMaterial
      : this.projectionMaterial;
    visual.projectionLine.visible = true;

    visual.receiverMarker.position.set(
      receiverPosition.x,
      ROUTE_ART_CONFIG.heightY + 0.025,
      receiverPosition.z,
    );
    visual.receiverMarker.visible = audit.exceedsTolerance;

    if (routeState?.completed) {
      visual.activeSegmentLine.visible = false;
    }
  }

  private createSnapshot(visible: boolean): RouteArtRendererSnapshot {
    const coverageShellEnabled = this.options.coverageShellEnabled === true;
    return {
      auditEnabled: this.options.auditEnabled === true,
      coverageShellEnabled,
      coverageZones: this.coverageZoneVisuals.map((visual) => ({
        anchor: {
          formationPosition: { ...visual.zone.anchor.formationPosition },
          playerId: visual.zone.anchor.playerId,
          position: { ...visual.zone.anchor.position },
          source: visual.zone.anchor.source,
        },
        defenderId: visual.zone.defenderId,
        kind: visual.zone.kind,
        label: visual.zone.label,
        landmark: { ...visual.zone.landmark },
        points: visual.zone.footballPoints.map((point) => ({ ...point })),
        visible: visible && visual.shell.visible && coverageShellEnabled,
      })),
      enabled: this.enabled || this.options.auditEnabled === true,
      rebuildKey: this.lastRebuildKey,
      routeCount: this.routeVisuals.size,
      routes: [...this.routeVisuals.values()].map((visual) => ({
        anchor: {
          formationPosition: { ...visual.route.anchor.formationPosition },
          playerId: visual.route.anchor.playerId,
          position: { ...visual.route.anchor.position },
          source: visual.route.anchor.source,
        },
        audit: visual.audit ? cloneAuditSnapshot(visual.audit) : null,
        points: visual.route.points.map((point) => ({ ...point })),
        receiverId: visual.receiverId,
        routeId: visual.routeId,
        selected: visual.selected,
      })),
      visible,
    };
  }

  private clearRouteVisuals(): void {
    for (const visual of this.routeVisuals.values()) {
      visual.path.geometry.dispose();
      visual.activeSegmentLine.geometry.dispose();
      visual.projectionLine.geometry.dispose();
      visual.group.clear();
    }

    for (const visual of this.coverageZoneVisuals) {
      visual.shell.geometry.dispose();
      visual.outline.geometry.dispose();
    }
    this.coverageZoneVisuals.length = 0;
    this.routeVisuals.clear();
    this.group.clear();
  }
}

export function createRouteAuditOverlay(): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'route-audit-overlay';
  document.body.appendChild(element);
  return element;
}

export function syncRouteAuditOverlay(
  element: HTMLElement,
  snapshot: RouteArtRendererSnapshot,
): void {
  const lines = [
    'ROUTE AUDIT',
    `VISIBLE ${snapshot.visible ? 'yes' : 'no'}`,
    `ROUTES ${snapshot.routeCount}`,
  ];

  for (const route of snapshot.routes) {
    const audit = route.audit;
    lines.push(
      audit
        ? [
            `${audit.routeId} ${audit.receiverId}${route.selected ? ' selected' : ''}`,
            `  SEG ${audit.segmentIndex}`,
            `  DIST ${audit.distanceAlongRoute.toFixed(2)} / ${audit.totalLength.toFixed(2)} yd`,
            `  PCT ${(audit.completionPercentage * 100).toFixed(1)}%`,
            `  NEAR ${audit.nearestPoint.x.toFixed(2)}, ${audit.nearestPoint.z.toFixed(2)}`,
            `  XTE ${audit.crossTrackErrorYards.toFixed(2)} yd ${audit.exceedsTolerance ? 'FAIL' : 'ok'}`,
          ].join('\n')
        : `${route.routeId} ${route.receiverId}${route.selected ? ' selected' : ''}`,
    );
  }

  element.textContent = lines.join('\n');
}

function createRouteRebuildKey(
  play: PlayDefinition,
  snapPlacement: SnapPlacement,
  routes: ResolvedReceiverRoute[],
  coverageZones: CoverageZone[] = [],
): string {
  return [
    play.id,
    snapPlacement.lane,
    snapPlacement.spot.x.toFixed(3),
    snapPlacement.spot.z.toFixed(3),
    ...routes.map((route) =>
      [
        route.receiverId,
        route.id,
        ...route.points.map((point) => `${point.x.toFixed(3)},${point.z.toFixed(3)}`),
      ].join(':'),
    ),
    ...coverageZones.map((zone) =>
      [
        zone.defenderId,
        zone.kind,
        ...zone.footballPoints.map((point) => `${point.x.toFixed(3)},${point.z.toFixed(3)}`),
      ].join(':'),
    ),
  ].join('|');
}

function createRouteGeometry(points: readonly FootballSpot[]): THREE.BufferGeometry {
  return new THREE.BufferGeometry().setFromPoints(
    points.map((point) => new THREE.Vector3(point.x, ROUTE_ART_CONFIG.heightY, point.z)),
  );
}

function createDynamicLineGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  return geometry;
}

function createCoverageZoneGeometry(zone: CoverageZone): THREE.BufferGeometry {
  const center = getCoverageZoneCenter(zone);
  const outlinePoints = createCoverageZoneOvalPoints(zone, ROUTE_ART_CONFIG.heightY - 0.015);
  const vertices = new Float32Array(outlinePoints.length * 9);

  outlinePoints.forEach((point, index) => {
    const next = outlinePoints[(index + 1) % outlinePoints.length];
    const vertexOffset = index * 9;

    vertices.set([
      center.x,
      ROUTE_ART_CONFIG.heightY - 0.015,
      center.z,
      point.x,
      point.y,
      point.z,
      next.x,
      next.y,
      next.z,
    ], vertexOffset);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

function createCoverageZoneOutlineGeometry(zone: CoverageZone): THREE.BufferGeometry {
  return new THREE.BufferGeometry().setFromPoints(
    createCoverageZoneOvalPoints(zone, ROUTE_ART_CONFIG.heightY + 0.01),
  );
}

function createCoverageZoneOvalPoints(zone: CoverageZone, y: number): THREE.Vector3[] {
  const { centerX, centerZ, radiusX, radiusZ } = getCoverageZoneOvalMetrics(zone);
  const points: THREE.Vector3[] = [];

  for (let index = 0; index < ROUTE_ART_CONFIG.coverageZoneSegments; index += 1) {
    const angle = (index / ROUTE_ART_CONFIG.coverageZoneSegments) * Math.PI * 2;
    points.push(new THREE.Vector3(
      centerX + Math.cos(angle) * radiusX,
      y,
      centerZ + Math.sin(angle) * radiusZ,
    ));
  }

  return points;
}

function getCoverageZoneCenter(zone: CoverageZone): FootballSpot {
  const { centerX, centerZ } = getCoverageZoneOvalMetrics(zone);

  return {
    x: centerX,
    z: centerZ,
  };
}

function getCoverageZoneOvalMetrics(zone: CoverageZone): {
  centerX: number;
  centerZ: number;
  radiusX: number;
  radiusZ: number;
} {
  const xs = zone.footballPoints.map((point) => point.x);
  const zs = zone.footballPoints.map((point) => point.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);

  return {
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    radiusX: (maxX - minX) / 2,
    radiusZ: (maxZ - minZ) / 2,
  };
}

function writeLineGeometry(
  geometry: THREE.BufferGeometry,
  start: FootballSpot,
  end: FootballSpot,
): void {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  position.setXYZ(0, start.x, ROUTE_ART_CONFIG.heightY + 0.02, start.z);
  position.setXYZ(1, end.x, ROUTE_ART_CONFIG.heightY + 0.02, end.z);
  position.needsUpdate = true;
  geometry.computeBoundingSphere();
}

function positionArrow(arrow: THREE.Mesh, route: ResolvedReceiverRoute): void {
  const end = route.points[route.points.length - 1];
  const previous = route.points[route.points.length - 2] ?? end;
  const tangent = new THREE.Vector3(end.x - previous.x, 0, end.z - previous.z);

  if (tangent.lengthSq() === 0) {
    tangent.set(0, 0, 1);
  }

  tangent.normalize();
  arrow.position.set(
    end.x - tangent.x * ROUTE_ART_CONFIG.arrowLength * 0.5,
    ROUTE_ART_CONFIG.heightY + 0.04,
    end.z - tangent.z * ROUTE_ART_CONFIG.arrowLength * 0.5,
  );
  arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
}

function isDeepCoverageZone(zone: CoverageZone): boolean {
  return zone.kind === 'deepHalf' || zone.kind === 'deepMiddle';
}

function cloneAuditSnapshot(snapshot: ReceiverRouteAuditSnapshot): ReceiverRouteAuditSnapshot {
  return {
    ...snapshot,
    activeSegmentEnd: { ...snapshot.activeSegmentEnd },
    activeSegmentStart: { ...snapshot.activeSegmentStart },
    nearestPoint: { ...snapshot.nearestPoint },
  };
}
