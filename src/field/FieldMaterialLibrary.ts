import * as THREE from 'three';
import { FIELD_MARKING_WIDTHS, type FieldMarkingLayout } from '../fieldSpec';

const FIELD_MATERIAL_KEYS = [
  'auditCorner',
  'auditError',
  'auditFieldBounds',
  'auditInnerBounds',
  'endZoneA',
  'endZoneB',
  'fieldBandA',
  'fieldBandB',
  'firstDown',
  'goalpost',
  'ground',
  'hash',
  'line',
  'number',
  'playableField',
  'scrimmage',
  'sidelineApron',
  'teamBox',
  'tenYardLine',
  'yardLine',
] as const;

export type FieldMaterialKey = (typeof FIELD_MATERIAL_KEYS)[number];

export class FieldMaterialLibrary {
  readonly auditCorner = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
  readonly auditError = new THREE.MeshBasicMaterial({ color: 0xff2b2b });
  readonly auditFieldBounds = new THREE.MeshBasicMaterial({ color: 0x42d6ff });
  readonly auditInnerBounds = new THREE.MeshBasicMaterial({ color: 0xf2d94b });
  readonly endZoneA = new THREE.MeshLambertMaterial({ color: 0x39444a });
  readonly endZoneB = new THREE.MeshLambertMaterial({ color: 0x4b443d });
  readonly fieldBandA = new THREE.MeshLambertMaterial({ color: 0x435145 });
  readonly fieldBandB = new THREE.MeshLambertMaterial({ color: 0x4b5a4d });
  readonly firstDown = new THREE.MeshBasicMaterial({ color: 0xf2d94b });
  readonly goalpost = new THREE.MeshBasicMaterial({ color: 0xf4d54c });
  readonly ground = new THREE.MeshLambertMaterial({ color: 0x273035 });
  readonly hash = new THREE.MeshBasicMaterial({ color: 0xc8d0c9 });
  readonly line = new THREE.MeshBasicMaterial({ color: 0xf0f2ef });
  readonly number = new THREE.MeshBasicMaterial({ color: 0xf4f6f2 });
  readonly playableField = new THREE.MeshLambertMaterial({ color: 0x47544a });
  readonly scrimmage = new THREE.MeshBasicMaterial({ color: 0x38a3ff });
  readonly sidelineApron = new THREE.MeshLambertMaterial({ color: 0x30383d });
  readonly teamBox = new THREE.MeshBasicMaterial({ color: 0xd8ded8 });
  readonly tenYardLine = new THREE.MeshBasicMaterial({ color: 0xffffff });
  readonly yardLine = new THREE.MeshBasicMaterial({ color: 0xd7ddd7 });

  get(key: FieldMaterialKey): THREE.Material {
    return this[key];
  }

  getFieldMarkingMaterial(layout: FieldMarkingLayout): THREE.Material {
    return this.get(getFieldMarkingMaterialKey(layout));
  }

  dispose(): void {
    for (const key of FIELD_MATERIAL_KEYS) {
      this[key].dispose();
    }
  }
}

export function getFieldMarkingMaterialKey(layout: FieldMarkingLayout): FieldMaterialKey {
  if (layout.kind === 'firstDown') {
    return 'firstDown';
  }

  if (layout.kind === 'hash') {
    return 'hash';
  }

  if (layout.kind === 'lineOfScrimmage') {
    return 'scrimmage';
  }

  if (layout.kind === 'yardLine') {
    return layout.size.depth > FIELD_MARKING_WIDTHS.yardLine
      ? 'tenYardLine'
      : 'yardLine';
  }

  return 'line';
}
