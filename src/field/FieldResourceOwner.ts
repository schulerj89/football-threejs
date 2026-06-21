import * as THREE from 'three';
import { FieldGeometryBuilder } from './FieldGeometryBuilder';
import { FieldMaterialLibrary } from './FieldMaterialLibrary';

export class FieldResourceOwner {
  readonly geometryBuilder: FieldGeometryBuilder;
  readonly materials = new FieldMaterialLibrary();

  private disposed = false;

  constructor() {
    this.geometryBuilder = new FieldGeometryBuilder(this.materials);
  }

  disposeObject(object: THREE.Object3D): void {
    if (this.disposed) {
      return;
    }

    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    });
    this.materials.dispose();
    this.disposed = true;
  }
}
