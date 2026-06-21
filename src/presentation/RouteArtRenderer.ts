import * as THREE from 'three';
import type { SnapPlacement } from '../ballSpotting';
import type { FootballSpot } from '../fieldScale';
import type { GameplaySnapshot } from '../playState';
import type { PlayDefinition } from '../playbook';
import {
  RECEIVER_ROUTE_AUDIT_CONFIG,
  createReceiverRouteAuditSnapshot,
  resolveEligibleReceiverRoutes,
  type ReceiverRouteAuditSnapshot,
  type ReceiverRouteState,
  type ResolvedReceiverRoute,
} from '../receiverRoutes';

export interface RouteArtRendererOptions {
  auditEnabled?: boolean;
  enabled?: boolean;
  toleranceYards?: number;
}

export interface RouteArtRouteSnapshot {
  audit: ReceiverRouteAuditSnapshot | null;
  points: FootballSpot[];
  receiverId: string;
  routeId: string;
  selected: boolean;
}

export interface RouteArtRendererSnapshot {
  auditEnabled: boolean;
  enabled: boolean;
  rebuildKey: string;
  routeCount: number;
  routes: RouteArtRouteSnapshot[];
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

export const ROUTE_ART_CONFIG = {
  arrowLength: 0.9,
  arrowRadius: 0.32,
  heightY: 0.09,
  receiverMarkerRadius: 0.34,
  routeOpacity: 0.82,
  selectedRouteOpacity: 0.98,
  startMarkerRadius: 0.3,
  waypointRadius: 0.22,
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
  private readonly receiverMarkerGeometry = new THREE.CircleGeometry(
    ROUTE_ART_CONFIG.receiverMarkerRadius,
    16,
  );
  private readonly startMarkerGeometry = new THREE.CircleGeometry(ROUTE_ART_CONFIG.startMarkerRadius, 16);

  private readonly routeVisuals = new Map<string, RouteVisual>();
  private lastRebuildKey = '';
  private snapshot: RouteArtRendererSnapshot;

  constructor(private readonly options: RouteArtRendererOptions = {}) {
    this.group.name = 'route-art-root';
    this.group.visible = false;
    this.snapshot = this.createSnapshot(false);
  }

  update(gameplay: GameplaySnapshot, play: PlayDefinition): void {
    const enabled = this.options.enabled !== false || this.options.auditEnabled === true;
    const auditEnabled = this.options.auditEnabled === true;
    const shouldShow = enabled &&
      play.kind === 'pass' &&
      (gameplay.playState === 'preSnap' || (auditEnabled && gameplay.playState === 'live'));

    this.group.visible = shouldShow;

    if (!enabled || play.kind !== 'pass') {
      this.snapshot = this.createSnapshot(false);
      return;
    }

    const snapPlacement: SnapPlacement = {
      lane: gameplay.drive.snapLane,
      spot: gameplay.drive.lineOfScrimmage,
    };
    const routes = resolveEligibleReceiverRoutes(play, snapPlacement);
    const rebuildKey = createRouteRebuildKey(play, snapPlacement, routes);

    if (rebuildKey !== this.lastRebuildKey) {
      this.rebuild(routes, rebuildKey);
    }

    this.syncRouteVisualStates(gameplay, auditEnabled);
    this.snapshot = this.createSnapshot(shouldShow);
  }

  getSnapshot(): RouteArtRendererSnapshot {
    return {
      ...this.snapshot,
      routes: this.snapshot.routes.map((route) => ({
        ...route,
        audit: route.audit ? cloneAuditSnapshot(route.audit) : null,
        points: route.points.map((point) => ({ ...point })),
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
    ]) {
      material.dispose();
    }
  }

  private rebuild(routes: ResolvedReceiverRoute[], rebuildKey: string): void {
    this.clearRouteVisuals();
    this.lastRebuildKey = rebuildKey;

    for (const route of routes) {
      const visual = this.createRouteVisual(route);
      this.routeVisuals.set(route.receiverId, visual);
      this.group.add(visual.group);
    }
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
    return {
      auditEnabled: this.options.auditEnabled === true,
      enabled: this.options.enabled !== false || this.options.auditEnabled === true,
      rebuildKey: this.lastRebuildKey,
      routeCount: this.routeVisuals.size,
      routes: [...this.routeVisuals.values()].map((visual) => ({
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

function cloneAuditSnapshot(snapshot: ReceiverRouteAuditSnapshot): ReceiverRouteAuditSnapshot {
  return {
    ...snapshot,
    activeSegmentEnd: { ...snapshot.activeSegmentEnd },
    activeSegmentStart: { ...snapshot.activeSegmentStart },
    nearestPoint: { ...snapshot.nearestPoint },
  };
}
