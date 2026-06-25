import * as THREE from 'three';
import { FIELD_BOUNDS } from '../fieldSpec';
import type { MountainBowlBackdropSnapshot } from './StadiumTypes';

interface RidgeSpec {
  color: number;
  facetColor: number;
  name: string;
  opacity: number;
  peaks: readonly number[];
  snowLine: number;
  width: number;
  xOffset: number;
  yBase: number;
  yScale: number;
  z: number;
}

export interface MountainBowlBackdropBuild {
  geometries: THREE.BufferGeometry[];
  group: THREE.Group;
  materials: THREE.Material[];
  snapshot: MountainBowlBackdropSnapshot;
}

const RIDGES: readonly RidgeSpec[] = [
  {
    color: 0x52606a,
    facetColor: 0x2f3d46,
    name: 'mountain-bowl-far-ridge',
    opacity: 0.92,
    peaks: [0.08, 0.39, 0.57, 0.49, 0.88, 0.58, 0.72, 0.54, 0.35, 0.1],
    snowLine: 0.72,
    width: 470,
    xOffset: -6,
    yBase: -12,
    yScale: 90,
    z: FIELD_BOUNDS.maxZ + 210,
  },
  {
    color: 0x6c655e,
    facetColor: 0x3f403c,
    name: 'mountain-bowl-mid-ridge',
    opacity: 0.96,
    peaks: [0.06, 0.28, 0.48, 0.37, 0.68, 0.44, 0.6, 0.39, 0.52, 0.25, 0.08],
    snowLine: 0.83,
    width: 430,
    xOffset: 12,
    yBase: -9,
    yScale: 66,
    z: FIELD_BOUNDS.maxZ + 178,
  },
  {
    color: 0x384838,
    facetColor: 0x263326,
    name: 'mountain-bowl-foothill-ridge',
    opacity: 1,
    peaks: [0.04, 0.18, 0.29, 0.24, 0.37, 0.26, 0.34, 0.22, 0.31, 0.2, 0.15, 0.05],
    snowLine: 1,
    width: 390,
    xOffset: -2,
    yBase: 1,
    yScale: 36,
    z: FIELD_BOUNDS.maxZ + 145,
  },
] as const;

const TREE_LINE_COUNT = 24;

export function createMountainBowlBackdrop(): MountainBowlBackdropBuild {
  const group = new THREE.Group();
  group.name = 'mountain-bowl-backdrop';
  group.userData.stadium = true;
  group.userData.mountainBowl = true;

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const ridgeNames: string[] = [];
  let rockFacetCount = 0;
  let snowCapCount = 0;

  for (const ridge of RIDGES) {
    const geometry = createRidgeGeometry(ridge);
    geometry.name = `${ridge.name}-geometry`;
    const material = new THREE.MeshLambertMaterial({
      color: ridge.color,
      opacity: ridge.opacity,
      side: THREE.DoubleSide,
      transparent: ridge.opacity < 1,
    });
    material.name = ridge.name;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = ridge.name;
    mesh.userData.stadium = true;
    mesh.userData.mountainBowl = true;
    group.add(mesh);
    geometries.push(geometry);
    materials.push(material);
    ridgeNames.push(ridge.name);

    const facets = createRockFacetMesh(ridge);
    group.add(facets.mesh);
    geometries.push(facets.geometry);
    materials.push(facets.material);
    rockFacetCount += facets.facetCount;

    for (const cap of createSnowCapMeshes(ridge)) {
      group.add(cap.mesh);
      geometries.push(cap.geometry);
      materials.push(cap.material);
      snowCapCount += 1;
    }
  }

  const treeLine = createTreeLine();
  group.add(treeLine.group);
  geometries.push(...treeLine.geometries);
  materials.push(...treeLine.materials);

  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group);
  const triangleCount = geometries.reduce((sum, geometry) => sum + countTriangles(geometry), 0);

  return {
    geometries,
    group,
    materials,
    snapshot: {
      bounds: {
        maxX: bounds.max.x,
        maxY: bounds.max.y,
        maxZ: bounds.max.z,
        minX: bounds.min.x,
        minY: bounds.min.y,
        minZ: bounds.min.z,
      },
      edgeFeathered: true,
      layerCount: RIDGES.length + 1,
      materialCount: materials.length,
      peakCount: RIDGES.reduce((sum, ridge) => sum + ridge.peaks.length, 0),
      rockFacetCount,
      ridgeCount: RIDGES.length,
      ridgeNames,
      snowCapCount,
      treeLineCount: TREE_LINE_COUNT,
      triangleCount,
    },
  };
}

function createRidgeGeometry(ridge: RidgeSpec): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const segmentWidth = ridge.width / (ridge.peaks.length - 1);
  const left = -ridge.width / 2 + ridge.xOffset;
  const baseY = ridge.yBase;

  for (let index = 0; index < ridge.peaks.length; index += 1) {
    const x = left + index * segmentWidth;
    const baseWave = Math.sin(index * 1.73) * 1.6;
    const edgeDrop = Math.min(index, ridge.peaks.length - 1 - index) <= 1 ? -3.4 : 0;
    const peakY = baseY + ridge.peaks[index] * ridge.yScale;
    positions.push(x, baseY + baseWave + edgeDrop, ridge.z, x, peakY, ridge.z);
  }

  for (let index = 0; index < ridge.peaks.length - 1; index += 1) {
    const base = index * 2;
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createRockFacetMesh(ridge: RidgeSpec): {
  facetCount: number;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  mesh: THREE.Mesh;
} {
  const positions: number[] = [];
  const segmentWidth = ridge.width / (ridge.peaks.length - 1);
  const left = -ridge.width / 2 + ridge.xOffset;

  for (let index = 1; index < ridge.peaks.length - 1; index += 1) {
    if (index % 2 === 0 && ridge.peaks[index] < 0.35) {
      continue;
    }
    const x = left + index * segmentWidth;
    const peakY = ridge.yBase + ridge.peaks[index] * ridge.yScale - 0.35;
    const baseY = ridge.yBase + ridge.peaks[index] * ridge.yScale * 0.32;
    const leftFoot = x - segmentWidth * (0.28 + (index % 3) * 0.05);
    const rightFoot = x + segmentWidth * (0.2 + (index % 2) * 0.07);
    positions.push(
      x, peakY, ridge.z - 0.18,
      leftFoot, baseY, ridge.z - 0.18,
      rightFoot, baseY + 2.2, ridge.z - 0.18,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.name = `${ridge.name}-rock-facets-geometry`;
  const material = new THREE.MeshLambertMaterial({
    color: ridge.facetColor,
    opacity: 0.34,
    side: THREE.DoubleSide,
    transparent: true,
  });
  material.name = `${ridge.name}-rock-facets`;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `${ridge.name}-rock-facets`;
  mesh.userData.stadium = true;
  mesh.userData.mountainBowl = true;

  return {
    facetCount: positions.length / 9,
    geometry,
    material,
    mesh,
  };
}

function createSnowCapMeshes(ridge: RidgeSpec): Array<{
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  mesh: THREE.Mesh;
}> {
  const caps: Array<{ geometry: THREE.BufferGeometry; material: THREE.Material; mesh: THREE.Mesh }> = [];
  const segmentWidth = ridge.width / (ridge.peaks.length - 1);
  const left = -ridge.width / 2 + ridge.xOffset;

  ridge.peaks.forEach((heightRatio, index) => {
    if (heightRatio < ridge.snowLine) {
      return;
    }
    const peakY = ridge.yBase + heightRatio * ridge.yScale;
    const x = left + index * segmentWidth;
    const capWidth = segmentWidth * 0.24;
    const capHeight = Math.max(4.1, ridge.yScale * 0.095);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      x, peakY + 0.12, ridge.z - 0.08,
      x - capWidth, peakY - capHeight, ridge.z - 0.08,
      x + capWidth * 0.82, peakY - capHeight * 0.92, ridge.z - 0.08,
    ], 3));
    geometry.setIndex([0, 1, 2]);
    geometry.computeVertexNormals();
    geometry.name = `${ridge.name}-snow-cap-${index}-geometry`;
    const material = new THREE.MeshLambertMaterial({
      color: 0xd9e3e6,
      opacity: 0.96,
      side: THREE.DoubleSide,
      transparent: true,
    });
    material.name = `${ridge.name}-snow-cap-${index}`;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `${ridge.name}-snow-cap-${index}`;
    mesh.userData.stadium = true;
    mesh.userData.mountainBowl = true;
    caps.push({ geometry, material, mesh });
  });

  return caps;
}

function createTreeLine(): {
  geometries: THREE.BufferGeometry[];
  group: THREE.Group;
  materials: THREE.Material[];
} {
  const group = new THREE.Group();
  group.name = 'mountain-bowl-tree-line';
  group.userData.stadium = true;
  group.userData.mountainBowl = true;
  const material = new THREE.MeshLambertMaterial({ color: 0x273a2c, side: THREE.DoubleSide });
  material.name = 'mountain-bowl-tree-line-material';
  const geometries: THREE.BufferGeometry[] = [];

  for (let index = 0; index < TREE_LINE_COUNT; index += 1) {
    const t = index / Math.max(1, TREE_LINE_COUNT - 1);
    const x = -142 + t * 284;
    const height = 5.2 + ((index * 13) % 7) * 0.38;
    const width = 3.2 + ((index * 5) % 4) * 0.24;
    const z = FIELD_BOUNDS.maxZ + 136 + (index % 3) * 1.2;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      x, 2, z,
      x - width, 2, z,
      x, 2 + height, z,
      x + width, 2, z,
    ], 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.computeVertexNormals();
    geometry.name = `mountain-bowl-tree-${index}-geometry`;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `mountain-bowl-tree-${index}`;
    mesh.userData.stadium = true;
    mesh.userData.mountainBowl = true;
    group.add(mesh);
    geometries.push(geometry);
  }

  return { geometries, group, materials: [material] };
}

function countTriangles(geometry: THREE.BufferGeometry): number {
  if (geometry.index) {
    return geometry.index.count / 3;
  }
  const position = geometry.getAttribute('position');
  return position ? position.count / 3 : 0;
}
