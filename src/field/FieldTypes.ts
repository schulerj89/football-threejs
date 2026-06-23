import type * as THREE from 'three';
import type { FieldLayout } from '../fieldSpec';
import type { HomeFieldBranding } from './FieldBrandingController';

export interface BoxBatchItem {
  center: {
    x: number;
    y: number;
    z: number;
  };
  id: string;
  size: {
    depth: number;
    height: number;
    width: number;
  };
}

export interface FootballField {
  auditEnabled: boolean;
  dispose: () => void;
  firstDownLineMarker: THREE.Mesh;
  group: THREE.Group;
  layout: FieldLayout;
  lineOfScrimmageMarker: THREE.Mesh;
  lineOfScrimmageZ: number;
  playDirection: THREE.Vector3;
}

export interface CreateFootballFieldOptions {
  endZoneColors?: {
    far: string;
    near: string;
  };
  fieldAudit?: boolean;
  homeFieldBranding?: HomeFieldBranding;
}
