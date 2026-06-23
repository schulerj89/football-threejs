import * as THREE from 'three';
import { FIELD_DIMENSIONS } from '../fieldSpec';
import { PRESENTATION_CONFIG } from '../field/FieldMarkingLayout';
import { DEFAULT_STADIUM_SPEC } from './StadiumSpec';
import { createStadiumRows } from './StadiumLayout';
import {
  createStadiumPath,
  offsetPathSample,
  samplePathAtDistance,
} from './StadiumPath';
import { isInsideTunnel } from './SeatLayout';
import type { StadiumMaterialLibrary } from './StadiumMaterialLibrary';
import type {
  StadiumGeometryMetrics,
  StadiumSpec,
  StadiumTunnelSpec,
} from './StadiumTypes';

export interface BuildStadiumGeometryOptions {
  materials: StadiumMaterialLibrary;
  spec?: StadiumSpec;
  upperTierEnabled?: boolean;
}

export interface StadiumGeometryBuildResult {
  geometries: THREE.BufferGeometry[];
  group: THREE.Group;
  metrics: StadiumGeometryMetrics;
}

const PATH_SAMPLE_SPACING = 3.4;
const GROUND_SEAM_OVERLAP = 0.08;
const STADIUM_GROUND_Y = -0.026;

export function buildStadiumGeometry({
  materials,
  spec = DEFAULT_STADIUM_SPEC,
  upperTierEnabled = true,
}: BuildStadiumGeometryOptions): StadiumGeometryBuildResult {
  const group = new THREE.Group();
  group.name = 'stadium-root';
  group.userData.stadium = true;
  const geometries: THREE.BufferGeometry[] = [];

  const lowerRows = createStadiumRows(spec, false);
  const lowerSeating = createSeatingBowlGeometry(spec, lowerRows);
  lowerSeating.name = 'stadium-lower-seating-geometry';
  geometries.push(lowerSeating);
  group.add(createMesh('stadium-lower-seating', lowerSeating, materials.seating));

  const lowerBowlClosure = createLowerBowlClosureGeometry(spec);
  lowerBowlClosure.name = 'stadium-lower-bowl-closure-geometry';
  geometries.push(lowerBowlClosure);
  group.add(createMesh('stadium-lower-bowl-closure', lowerBowlClosure, materials.concrete));

  if (upperTierEnabled) {
    const upperRows = createStadiumRows(spec, true).filter((row) => row.tier > 0);
    const upperSeating = createSeatingBowlGeometry(spec, upperRows);
    upperSeating.name = 'stadium-upper-seating-geometry';
    geometries.push(upperSeating);
    group.add(createMesh('stadium-upper-seating', upperSeating, materials.seating));
  }

  const outerOffset = calculateOuterOffset(spec, upperTierEnabled);
  const concourseWall = createVerticalPathRibbonGeometry(
    spec,
    outerOffset + 2.2,
    0,
    spec.concourseHeight,
    true,
  );
  concourseWall.name = 'stadium-concourse-wall-geometry';
  geometries.push(concourseWall);
  group.add(createMesh('stadium-concourse-wall', concourseWall, materials.concourseWall));

  const exteriorWall = createVerticalPathRibbonGeometry(
    spec,
    outerOffset + 8,
    0,
    spec.exteriorWallHeight,
    false,
  );
  exteriorWall.name = 'stadium-exterior-wall-geometry';
  geometries.push(exteriorWall);
  group.add(createMesh('stadium-exterior-wall', exteriorWall, materials.exteriorWall));

  const fascia = createVerticalPathRibbonGeometry(
    spec,
    Math.max(0, spec.tiers[0].baseOffset + spec.rowsPerTier * spec.rowDepth + 1.4),
    spec.tiers[0].baseElevation + spec.rowsPerTier * spec.rowRise + 1.2,
    spec.tiers[0].baseElevation + spec.rowsPerTier * spec.rowRise + 1.2 + spec.fasciaHeight,
    false,
  );
  fascia.name = 'stadium-fascia-ribbon-geometry';
  geometries.push(fascia);
  group.add(createMesh('stadium-fascia-ribbon', fascia, materials.fascia));

  const tunnelGroup = createTunnelMeshes(spec, materials);
  group.add(tunnelGroup);
  tunnelGroup.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      geometries.push(object.geometry);
    }
  });

  const scoreboardGroup = createScoreboard(spec, materials);
  group.add(scoreboardGroup);
  scoreboardGroup.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      geometries.push(object.geometry);
    }
  });

  const metrics = createStadiumGeometryMetrics(group, geometries, materials.allMaterials.length);
  return {
    geometries,
    group,
    metrics,
  };
}

export function createStadiumGeometryMetrics(
  group: THREE.Object3D,
  geometries: readonly THREE.BufferGeometry[],
  materialCount: number,
): StadiumGeometryMetrics {
  let drawCalls = 0;
  let triangles = 0;
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !object.visible) {
      return;
    }
    drawCalls += Array.isArray(object.material) ? object.material.length : 1;
    triangles += getGeometryTriangleCount(object.geometry);
  });
  return {
    drawCalls,
    geometryCount: new Set(geometries.map((geometry) => geometry.uuid)).size,
    materialCount,
    seatCount: 0,
    textureCount: 0,
    triangles,
  };
}

function createLowerBowlClosureGeometry(spec: StadiumSpec): THREE.BufferGeometry {
  const halfWidth = spec.innerBowlWidth / 2;
  const halfDepth = spec.innerBowlDepth / 2;
  const fieldGroundHalfWidth =
    FIELD_DIMENSIONS.fieldWidth / 2 + PRESENTATION_CONFIG.groundMargin - GROUND_SEAM_OVERLAP;
  const fieldGroundHalfDepth =
    FIELD_DIMENSIONS.fieldLength / 2 + PRESENTATION_CONFIG.groundMargin - GROUND_SEAM_OVERLAP;
  const lowerTier = spec.tiers[0];
  const path = createStadiumPath(spec);
  const builder = new GeometryBuilder();

  builder.addQuad(
    { x: fieldGroundHalfWidth, y: STADIUM_GROUND_Y, z: -halfDepth },
    { x: halfWidth, y: STADIUM_GROUND_Y, z: -halfDepth },
    { x: halfWidth, y: STADIUM_GROUND_Y, z: halfDepth },
    { x: fieldGroundHalfWidth, y: STADIUM_GROUND_Y, z: halfDepth },
  );
  builder.addQuad(
    { x: -halfWidth, y: STADIUM_GROUND_Y, z: -halfDepth },
    { x: -fieldGroundHalfWidth, y: STADIUM_GROUND_Y, z: -halfDepth },
    { x: -fieldGroundHalfWidth, y: STADIUM_GROUND_Y, z: halfDepth },
    { x: -halfWidth, y: STADIUM_GROUND_Y, z: halfDepth },
  );
  builder.addQuad(
    { x: -fieldGroundHalfWidth, y: STADIUM_GROUND_Y, z: fieldGroundHalfDepth },
    { x: fieldGroundHalfWidth, y: STADIUM_GROUND_Y, z: fieldGroundHalfDepth },
    { x: fieldGroundHalfWidth, y: STADIUM_GROUND_Y, z: halfDepth },
    { x: -fieldGroundHalfWidth, y: STADIUM_GROUND_Y, z: halfDepth },
  );
  builder.addQuad(
    { x: -fieldGroundHalfWidth, y: STADIUM_GROUND_Y, z: -halfDepth },
    { x: fieldGroundHalfWidth, y: STADIUM_GROUND_Y, z: -halfDepth },
    { x: fieldGroundHalfWidth, y: STADIUM_GROUND_Y, z: -fieldGroundHalfDepth },
    { x: -fieldGroundHalfWidth, y: STADIUM_GROUND_Y, z: -fieldGroundHalfDepth },
  );

  for (const segment of path.segments) {
    const steps = Math.max(2, Math.ceil(segment.length / PATH_SAMPLE_SPACING));
    for (let step = 0; step < steps; step += 1) {
      const d0 = (step / steps) * segment.length;
      const d1 = ((step + 1) / steps) * segment.length;
      const sampleA = samplePathAtDistance(path, segment.startDistance + d0, spec);
      const sampleB = samplePathAtDistance(path, segment.startDistance + d1, spec);
      const innerA = offsetPathSample(sampleA, 0);
      const innerB = offsetPathSample(sampleB, 0);
      const frontA = offsetPathSample(sampleA, lowerTier.baseOffset);
      const frontB = offsetPathSample(sampleB, lowerTier.baseOffset);
      builder.addQuad(
        { x: innerA.x, y: STADIUM_GROUND_Y, z: innerA.z },
        { x: innerB.x, y: STADIUM_GROUND_Y, z: innerB.z },
        { x: frontB.x, y: lowerTier.baseElevation, z: frontB.z },
        { x: frontA.x, y: lowerTier.baseElevation, z: frontA.z },
      );
    }
  }

  return builder.toGeometry();
}

function createSeatingBowlGeometry(
  spec: StadiumSpec,
  rows: ReturnType<typeof createStadiumRows>,
): THREE.BufferGeometry {
  const path = createStadiumPath(spec);
  const builder = new GeometryBuilder();
  const rowsByTierAndIndex = new Map(rows.map((row) => [`${row.tierId}:${row.row}`, row]));

  for (const row of rows) {
    for (const segment of path.segments) {
      const steps = Math.max(2, Math.ceil(segment.length / PATH_SAMPLE_SPACING));
      for (let step = 0; step < steps; step += 1) {
        const d0 = (step / steps) * segment.length;
        const d1 = ((step + 1) / steps) * segment.length;
        const mid = (d0 + d1) / 2;
        if (shouldSkipRowSegment(spec, row, segment.id, mid)) {
          continue;
        }
        const sampleA = samplePathAtDistance(path, segment.startDistance + d0, spec);
        const sampleB = samplePathAtDistance(path, segment.startDistance + d1, spec);
        const frontA = offsetPathSample(sampleA, row.offset);
        const frontB = offsetPathSample(sampleB, row.offset);
        const backA = offsetPathSample(sampleA, row.offset + spec.rowDepth * 0.92);
        const backB = offsetPathSample(sampleB, row.offset + spec.rowDepth * 0.92);
        builder.addQuad(
          { x: frontA.x, y: row.elevation, z: frontA.z },
          { x: frontB.x, y: row.elevation, z: frontB.z },
          { x: backB.x, y: row.elevation + spec.rowRise * 0.42, z: backB.z },
          { x: backA.x, y: row.elevation + spec.rowRise * 0.42, z: backA.z },
        );
        const nextRow = rowsByTierAndIndex.get(`${row.tierId}:${row.row + 1}`);
        if (nextRow && !shouldSkipRowSegment(spec, nextRow, segment.id, mid)) {
          const nextFrontA = offsetPathSample(sampleA, nextRow.offset);
          const nextFrontB = offsetPathSample(sampleB, nextRow.offset);
          builder.addQuad(
            { x: backA.x, y: row.elevation + spec.rowRise * 0.42, z: backA.z },
            { x: backB.x, y: row.elevation + spec.rowRise * 0.42, z: backB.z },
            { x: nextFrontB.x, y: nextRow.elevation, z: nextFrontB.z },
            { x: nextFrontA.x, y: nextRow.elevation, z: nextFrontA.z },
          );
        }
      }
    }
  }

  return builder.toGeometry();
}

function shouldSkipRowSegment(
  spec: StadiumSpec,
  row: ReturnType<typeof createStadiumRows>[number],
  sectionId: StadiumTunnelSpec['sectionId'],
  distanceAlongSection: number,
): boolean {
  return isInsideTunnel(spec, sectionId, distanceAlongSection) && row.tier === 0 && row.row < 9;
}

function createVerticalPathRibbonGeometry(
  spec: StadiumSpec,
  offset: number,
  y0: number,
  y1: number,
  skipTunnels: boolean,
): THREE.BufferGeometry {
  const path = createStadiumPath(spec);
  const builder = new GeometryBuilder();

  for (const segment of path.segments) {
    const steps = Math.max(2, Math.ceil(segment.length / PATH_SAMPLE_SPACING));
    for (let step = 0; step < steps; step += 1) {
      const d0 = (step / steps) * segment.length;
      const d1 = ((step + 1) / steps) * segment.length;
      const mid = (d0 + d1) / 2;
      if (skipTunnels && isInsideTunnel(spec, segment.id, mid)) {
        continue;
      }
      const sampleA = samplePathAtDistance(path, segment.startDistance + d0, spec);
      const sampleB = samplePathAtDistance(path, segment.startDistance + d1, spec);
      const a = offsetPathSample(sampleA, offset);
      const b = offsetPathSample(sampleB, offset);
      builder.addQuad(
        { x: a.x, y: y0, z: a.z },
        { x: b.x, y: y0, z: b.z },
        { x: b.x, y: y1, z: b.z },
        { x: a.x, y: y1, z: a.z },
      );
    }
  }

  return builder.toGeometry();
}

function createTunnelMeshes(
  spec: StadiumSpec,
  materials: StadiumMaterialLibrary,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'stadium-entry-tunnels';
  const path = createStadiumPath(spec);
  const tunnelGeometry = new THREE.BoxGeometry(1, 1, 1);
  tunnelGeometry.name = 'stadium-entry-tunnel-shared-geometry';

  for (const tunnel of spec.tunnels) {
    const segment = path.segments.find((candidate) => candidate.id === tunnel.sectionId);
    if (!segment) {
      continue;
    }
    const sample = samplePathAtDistance(
      path,
      segment.startDistance + tunnel.centerDistanceAlongSection,
      spec,
    );
    const center = offsetPathSample(sample, spec.tiers[0].baseOffset + spec.rowDepth * 4.5);
    const mesh = new THREE.Mesh(tunnelGeometry, materials.tunnel);
    mesh.name = `stadium-entry-tunnel-${tunnel.id}`;
    mesh.position.set(center.x, 1.55, center.z);
    mesh.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
    mesh.scale.set(tunnel.width, 3.1, 4.4);
    mesh.userData.stadium = true;
    group.add(mesh);
  }

  return group;
}

function createScoreboard(
  spec: StadiumSpec,
  materials: StadiumMaterialLibrary,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'stadium-scoreboard';
  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(22, 8, 0.7),
    materials.scoreboardScreen,
  );
  screen.name = 'stadium-scoreboard-screen';
  screen.position.set(
    spec.scoreboardPosition.x,
    spec.scoreboardPosition.y,
    spec.scoreboardPosition.z,
  );
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(26, 2, 2.2),
    materials.exteriorWall,
  );
  base.name = 'stadium-scoreboard-base';
  base.position.set(
    spec.scoreboardPosition.x,
    spec.scoreboardPosition.y - 5.2,
    spec.scoreboardPosition.z + 0.5,
  );
  const postGeometry = new THREE.BoxGeometry(1.1, 13, 1.1);
  const leftPost = new THREE.Mesh(postGeometry, materials.exteriorWall);
  leftPost.name = 'stadium-scoreboard-post-left';
  leftPost.position.set(-9.8, spec.scoreboardPosition.y - 8.1, spec.scoreboardPosition.z + 0.6);
  const rightPost = new THREE.Mesh(postGeometry, materials.exteriorWall);
  rightPost.name = 'stadium-scoreboard-post-right';
  rightPost.position.set(9.8, spec.scoreboardPosition.y - 8.1, spec.scoreboardPosition.z + 0.6);
  group.add(screen, base, leftPost, rightPost);
  group.userData.stadium = true;
  return group;
}

function createMesh(
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.userData.stadium = true;
  return mesh;
}

function calculateOuterOffset(spec: StadiumSpec, upperTierEnabled: boolean): number {
  const rows = createStadiumRows(spec, upperTierEnabled);
  return Math.max(...rows.map((row) => row.offset + spec.rowDepth), 0);
}

function getGeometryTriangleCount(geometry: THREE.BufferGeometry): number {
  if (geometry.index) {
    return geometry.index.count / 3;
  }

  const position = geometry.getAttribute('position');
  return position ? position.count / 3 : 0;
}

class GeometryBuilder {
  private readonly indices: number[] = [];
  private readonly positions: number[] = [];
  private readonly uvs: number[] = [];

  addQuad(
    a: { x: number; y: number; z: number },
    b: { x: number; y: number; z: number },
    c: { x: number; y: number; z: number },
    d: { x: number; y: number; z: number },
  ): void {
    const index = this.positions.length / 3;
    this.positions.push(
      a.x, a.y, a.z,
      b.x, b.y, b.z,
      c.x, c.y, c.z,
      d.x, d.y, d.z,
    );
    this.uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    this.indices.push(index, index + 1, index + 2, index, index + 2, index + 3);
  }

  toGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.setIndex(this.indices);
    geometry.computeVertexNormals();
    return geometry;
  }
}
