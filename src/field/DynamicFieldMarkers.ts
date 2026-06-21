import * as THREE from 'three';
import {
  FIELD_BOUNDS,
  createDriveLineLayout,
  isBoundsContained,
  type FieldMarkingLayout,
} from '../fieldSpec';
import { FieldMaterialLibrary } from './FieldMaterialLibrary';
import { LINE_HEIGHT, LINE_Y } from './FieldMarkingLayout';

export class DynamicFieldMarkers {
  readonly firstDownLineMarker: THREE.Mesh;
  readonly lineOfScrimmageMarker: THREE.Mesh;

  constructor(
    private readonly materials: FieldMaterialLibrary,
    options: {
      firstDownLine: FieldMarkingLayout;
      firstDownLineInvalid: boolean;
      group: THREE.Group;
      lineOfScrimmage: FieldMarkingLayout;
      lineOfScrimmageInvalid: boolean;
    },
  ) {
    this.lineOfScrimmageMarker = this.createFieldMarkingMesh(options.lineOfScrimmage, {
      auditInvalid: options.lineOfScrimmageInvalid,
    });
    this.firstDownLineMarker = this.createFieldMarkingMesh(options.firstDownLine, {
      auditInvalid: options.firstDownLineInvalid,
    });
    options.group.add(this.lineOfScrimmageMarker, this.firstDownLineMarker);
  }

  sync(
    lineOfScrimmage: { z: number },
    firstDownMarker: { z: number },
    auditEnabled: boolean,
  ): void {
    const lineOfScrimmageLayout = createDriveLineLayout('line-of-scrimmage', lineOfScrimmage.z);
    const firstDownLayout = createDriveLineLayout('first-down-line', firstDownMarker.z);

    this.applyMarkingLayout(this.lineOfScrimmageMarker, lineOfScrimmageLayout, auditEnabled);
    this.applyMarkingLayout(this.firstDownLineMarker, firstDownLayout, auditEnabled);
  }

  private createFieldMarkingMesh(
    layout: FieldMarkingLayout,
    options: { auditInvalid: boolean },
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(layout.size.width, LINE_HEIGHT, layout.size.depth),
      options.auditInvalid ? this.materials.auditError : this.materials.getFieldMarkingMaterial(layout),
    );
    mesh.name = layout.id;
    mesh.userData.isPaintedFieldMarking = true;
    this.setMarkingMetadata(mesh, layout);
    mesh.position.set(layout.center.x, LINE_Y, layout.center.z);
    return mesh;
  }

  private applyMarkingLayout(
    mesh: THREE.Mesh,
    layout: FieldMarkingLayout,
    auditEnabled: boolean,
  ): void {
    const currentSize = mesh.userData.fieldMarkingLayout?.size as FieldMarkingLayout['size'] | undefined;

    if (
      !currentSize ||
      currentSize.width !== layout.size.width ||
      currentSize.depth !== layout.size.depth
    ) {
      mesh.geometry.dispose();
      mesh.geometry = new THREE.BoxGeometry(layout.size.width, LINE_HEIGHT, layout.size.depth);
    }

    mesh.position.set(layout.center.x, LINE_Y, layout.center.z);
    this.setMarkingMetadata(mesh, layout);
    mesh.material = auditEnabled && !isBoundsContained(layout.bounds, FIELD_BOUNDS)
      ? this.materials.auditError
      : this.materials.getFieldMarkingMaterial(layout);
  }

  private setMarkingMetadata(mesh: THREE.Mesh, layout: FieldMarkingLayout): void {
    mesh.userData.fieldMarkingLayout = layout;
    mesh.userData.fieldMarkingId = layout.id;
    mesh.userData.fieldMarkingKind = layout.kind;
  }
}
