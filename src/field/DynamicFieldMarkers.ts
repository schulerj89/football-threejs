import * as THREE from 'three';
import {
  FIELD_BOUNDS,
  LINE_OF_SCRIMMAGE_Z,
  createDriveLineLayout,
  isBoundsContained,
  type FieldMarkingLayout,
} from '../fieldSpec';
import { FieldMaterialLibrary } from './FieldMaterialLibrary';
import { LINE_HEIGHT, LINE_Y } from './FieldMarkingLayout';

export class DynamicFieldMarkers {
  readonly firstDownLineMarker: THREE.Mesh;
  readonly lineOfScrimmageMarker: THREE.Mesh;
  readonly playDirectionMarker: THREE.Group;

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
    this.playDirectionMarker = this.addPlayDirectionMarker(options.group);
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
    this.playDirectionMarker.position.z = lineOfScrimmage.z + 7;
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

  private addPlayDirectionMarker(group: THREE.Group): THREE.Group {
    const marker = new THREE.Group();
    marker.name = 'play-direction-marker';
    marker.position.set(0, 0.12, LINE_OF_SCRIMMAGE_Z + 7);

    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.1, 5), this.materials.direction);
    shaft.position.set(0, 0, 0);
    marker.add(shaft);

    const head = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.2, 4), this.materials.direction);
    head.rotation.x = Math.PI / 2;
    head.position.set(0, 0, 3.4);
    marker.add(head);

    group.add(marker);
    return marker;
  }
}
