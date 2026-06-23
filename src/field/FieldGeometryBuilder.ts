import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  FIELD_BOUNDS,
  FIELD_DIMENSIONS,
  validateFieldLayout,
  type FieldBounds,
  type FieldLayout,
  type FieldRectLayout,
} from '../fieldSpec';
import { FieldMaterialLibrary, type FieldMaterialKey } from './FieldMaterialLibrary';
import {
  AUDIT_CORNER_SIZE,
  AUDIT_Y,
  END_ZONE_HEIGHT,
  FIELD_SURFACE_HEIGHT,
  FIELD_Y,
  LINE_Y,
  PRESENTATION_CONFIG,
  createGoalpostBoxes,
  createEndZonePylonBoxes,
  createStaticFieldMarkingBuckets,
  createTeamBoxBoundaryBoxes,
  createTurfBandBoxBuckets,
  createYardNumberBoxes,
  fieldMarkingToBoxBatchItem,
  getFieldBoundsOutlineBoxes,
  getFieldCornerPoints,
} from './FieldMarkingLayout';
import type { BoxBatchItem } from './FieldTypes';

export class FieldGeometryBuilder {
  constructor(private readonly materials: FieldMaterialLibrary) {}

  createSurroundingGroundMesh(): THREE.Mesh {
    const width = FIELD_DIMENSIONS.fieldWidth + PRESENTATION_CONFIG.groundMargin * 2;
    const depth = FIELD_DIMENSIONS.fieldLength + PRESENTATION_CONFIG.groundMargin * 2;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.04, depth),
      this.materials.ground,
    );
    mesh.name = 'surrounding-ground-plane';
    mesh.position.set(0, -0.04, 0);
    mesh.userData.presentationOnly = true;
    return mesh;
  }

  createSidelineApronMesh(): THREE.Mesh {
    const width = FIELD_DIMENSIONS.fieldWidth + PRESENTATION_CONFIG.sidelineApronWidth * 2;
    const depth = FIELD_DIMENSIONS.fieldLength;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.04, depth),
      this.materials.sidelineApron,
    );
    mesh.name = 'sideline-apron';
    mesh.position.set(0, -0.005, 0);
    mesh.userData.presentationOnly = true;
    return mesh;
  }

  createSurfaceMesh(layout: FieldRectLayout): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(layout.size.width, FIELD_SURFACE_HEIGHT, layout.size.depth),
      this.materials.playableField,
    );
    mesh.position.set(layout.center.x, FIELD_Y, layout.center.z);
    mesh.name = layout.id;
    mesh.userData.fieldRect = layout;
    return mesh;
  }

  createTurfBandMeshes(layout: FieldLayout): THREE.Mesh[] {
    return Object.entries(createTurfBandBoxBuckets(layout))
      .filter(([, boxes]) => boxes.length > 0)
      .map(([key, boxes]) => {
        const materialKey = key as 'fieldBandA' | 'fieldBandB';
        const mesh = this.createBatchedBoxMesh(
          `turf-bands-${materialKey}`,
          boxes,
          this.materials.get(materialKey),
        );
        mesh.userData.presentationOnly = true;
        return mesh;
      });
  }

  createEndZoneMesh(layout: FieldRectLayout): THREE.Mesh {
    const material = layout.id === 'near-end-zone'
      ? this.materials.endZoneA
      : this.materials.endZoneB;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(layout.size.width, END_ZONE_HEIGHT, layout.size.depth),
      material,
    );
    mesh.position.set(layout.center.x, LINE_Y / 2, layout.center.z);
    mesh.name = layout.id;
    mesh.userData.fieldRect = layout;
    return mesh;
  }

  createStaticFieldMarkingBatches(
    layout: FieldLayout,
    invalidMarkingIds: Set<string>,
  ): THREE.Mesh[] {
    return [...createStaticFieldMarkingBuckets(layout, invalidMarkingIds).entries()]
      .map(([materialKey, markings]) => {
        const mesh = this.createBatchedBoxMesh(
          `static-field-markings-${materialKey}`,
          markings.map(fieldMarkingToBoxBatchItem),
          this.materials.get(materialKey),
        );
        mesh.userData.isPaintedFieldMarking = true;
        mesh.userData.staticFieldMarkingBatch = true;
        mesh.userData.fieldMarkingIds = markings.map((marking) => marking.id);
        mesh.userData.fieldMarkingKinds = [...new Set(markings.map((marking) => marking.kind))];
        return mesh;
      });
  }

  createYardNumbersMesh(): THREE.Mesh {
    const mesh = this.createBatchedBoxMesh('yard-numbers', createYardNumberBoxes(), this.materials.number);
    mesh.userData.presentationOnly = true;
    return mesh;
  }

  createTeamBoxBoundaryMesh(): THREE.Mesh {
    const mesh = this.createBatchedBoxMesh(
      'team-box-boundaries',
      createTeamBoxBoundaryBoxes(),
      this.materials.teamBox,
    );
    mesh.userData.presentationOnly = true;
    return mesh;
  }

  createGoalpostsMesh(): THREE.Mesh {
    const boxes: BoxBatchItem[] = [];

    for (const z of [FIELD_BOUNDS.minZ, FIELD_BOUNDS.maxZ]) {
      boxes.push(...createGoalpostBoxes(z));
    }

    const mesh = this.createBatchedBoxMesh('goalposts', boxes, this.materials.goalpost);
    mesh.userData.presentationOnly = true;
    mesh.userData.endLineZs = [FIELD_BOUNDS.minZ, FIELD_BOUNDS.maxZ];
    return mesh;
  }

  createEndZonePylonsMesh(layout: FieldLayout): THREE.Mesh {
    const boxes = createEndZonePylonBoxes(layout);
    const mesh = this.createBatchedBoxMesh('end-zone-pylons', boxes, this.materials.pylon);
    mesh.userData.presentationOnly = true;
    mesh.userData.endZonePylons = true;
    mesh.userData.pylonIds = boxes.map((box) => box.id);
    mesh.userData.pylonCenters = boxes.map((box) => ({ ...box.center }));
    return mesh;
  }

  createFieldAuditOverlay(layout: FieldLayout): THREE.Group {
    const group = new THREE.Group();
    group.name = 'field-audit-overlay';
    group.userData.fieldAudit = true;

    this.addBoundsOutline(group, 'audit-field-bounds', layout.fieldBounds, 'auditFieldBounds');
    this.addBoundsOutline(group, 'audit-inner-marking-bounds', layout.innerMarkingBounds, 'auditInnerBounds');
    this.addCornerMarkers(group, layout.fieldBounds);

    for (const issue of validateFieldLayout(layout)) {
      this.addBoundsOutline(group, `audit-out-of-bounds-${issue.id}`, issue.bounds, 'auditError');
    }

    return group;
  }

  createBatchedBoxMesh(
    name: string,
    boxes: BoxBatchItem[],
    material: THREE.Material,
  ): THREE.Mesh {
    const geometry = this.createBatchedBoxGeometry(name, boxes);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.userData.boxIds = boxes.map((box) => box.id);
    return mesh;
  }

  private addBoundsOutline(
    group: THREE.Group,
    name: string,
    bounds: FieldBounds,
    materialKey: FieldMaterialKey,
  ): void {
    const material = this.materials.get(materialKey);

    for (const box of getFieldBoundsOutlineBoxes(name, bounds)) {
      group.add(this.createAuditLine(box, material));
    }
  }

  private addCornerMarkers(group: THREE.Group, bounds: FieldBounds): void {
    for (const [name, x, z] of getFieldCornerPoints(bounds)) {
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(AUDIT_CORNER_SIZE, AUDIT_CORNER_SIZE, AUDIT_CORNER_SIZE),
        this.materials.auditCorner,
      );
      marker.name = `field-corner-marker-${name}`;
      marker.position.set(x, AUDIT_Y + AUDIT_CORNER_SIZE / 2, z);
      group.add(marker);
    }
  }

  private createAuditLine(box: BoxBatchItem, material: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(box.size.width, box.size.height, box.size.depth),
      material,
    );
    mesh.name = box.id;
    mesh.position.set(box.center.x, box.center.y, box.center.z);
    return mesh;
  }

  private createBatchedBoxGeometry(name: string, boxes: BoxBatchItem[]): THREE.BufferGeometry {
    const geometries = boxes.map((box) => {
      const geometry = new THREE.BoxGeometry(box.size.width, box.size.height, box.size.depth);
      geometry.translate(box.center.x, box.center.y, box.center.z);
      return geometry;
    });
    const mergedGeometry = mergeGeometries(geometries, false);

    for (const geometry of geometries) {
      geometry.dispose();
    }

    if (!mergedGeometry) {
      throw new Error(`Unable to batch field geometry ${name}`);
    }

    return mergedGeometry;
  }
}
