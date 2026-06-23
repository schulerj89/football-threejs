import * as THREE from 'three';
import {
  FIELD_DIMENSIONS,
  type FieldLayout,
  type FieldRectLayout,
} from '../fieldSpec';

export interface HomeFieldBranding {
  abbreviation: string;
  accentColor: string;
  displayName: string;
  endZoneColor: string;
  id: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
}

interface EndZoneWordmark {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  side: 'far' | 'near';
}

const BRANDING_Y = 0.145;
const MIDFIELD_LOGO_SIZE = 17.5;
const END_ZONE_WORDMARK_WIDTH = FIELD_DIMENSIONS.fieldWidth - 7;
const END_ZONE_WORDMARK_DEPTH = 7.2;

export class FieldBrandingController {
  readonly group = new THREE.Group();

  private readonly midfieldLogo: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly wordmarks: readonly EndZoneWordmark[];
  private disposed = false;
  private logoRequestId = 0;
  private syncedKey = '';

  constructor(private readonly layout: FieldLayout) {
    this.group.name = 'home-field-branding';
    this.group.userData.presentationOnly = true;
    this.group.userData.homeFieldBranding = true;

    this.midfieldLogo = new THREE.Mesh(
      new THREE.PlaneGeometry(MIDFIELD_LOGO_SIZE, MIDFIELD_LOGO_SIZE),
      createInvisibleMaterial(),
    );
    this.midfieldLogo.name = 'home-midfield-logo';
    this.midfieldLogo.position.set(0, BRANDING_Y, 0);
    this.midfieldLogo.rotation.x = -Math.PI / 2;
    this.midfieldLogo.renderOrder = 6;
    this.midfieldLogo.userData.presentationOnly = true;
    this.midfieldLogo.userData.homeMidfieldLogo = true;
    this.group.add(this.midfieldLogo);

    this.wordmarks = [
      this.createWordmark('near'),
      this.createWordmark('far'),
    ];
    for (const wordmark of this.wordmarks) {
      this.group.add(wordmark.mesh);
    }
  }

  sync(branding: HomeFieldBranding | null): void {
    if (this.disposed) {
      return;
    }

    if (!branding) {
      this.group.visible = false;
      this.group.userData.homeTeamId = null;
      return;
    }

    const endZoneWords = splitTeamNameForEndZones(branding.displayName);
    const key = [
      branding.id,
      branding.displayName,
      branding.logoUrl,
      branding.endZoneColor,
      branding.primaryColor,
      branding.secondaryColor,
      branding.accentColor,
      branding.textColor,
      endZoneWords.near,
      endZoneWords.far,
    ].join('::');

    this.group.visible = true;
    this.group.userData.homeTeamId = branding.id;
    this.group.userData.homeTeamName = branding.displayName;
    this.group.userData.endZoneWords = endZoneWords;
    this.midfieldLogo.userData.logoUrl = branding.logoUrl;

    for (const wordmark of this.wordmarks) {
      const text = wordmark.side === 'near' ? endZoneWords.near : endZoneWords.far;
      wordmark.mesh.userData.text = text;
      wordmark.mesh.userData.teamId = branding.id;
      wordmark.mesh.userData.textColor = branding.textColor;
      wordmark.mesh.userData.accentColor = branding.accentColor;
    }

    if (key === this.syncedKey) {
      return;
    }
    this.syncedKey = key;

    this.updateEndZoneWordmarks(branding, endZoneWords);
    this.updateMidfieldLogo(branding);
  }

  dispose(): void {
    this.disposed = true;
    this.logoRequestId += 1;
    disposeMaterial(this.midfieldLogo.material);
    for (const wordmark of this.wordmarks) {
      disposeMaterial(wordmark.mesh.material);
    }
  }

  private createWordmark(side: 'far' | 'near'): EndZoneWordmark {
    const endZone = getEndZone(this.layout, side);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(END_ZONE_WORDMARK_WIDTH, END_ZONE_WORDMARK_DEPTH),
      createInvisibleMaterial(),
    );
    mesh.name = `${side}-end-zone-home-wordmark`;
    mesh.position.set(endZone.center.x, BRANDING_Y + 0.004, endZone.center.z);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 7;
    mesh.userData.presentationOnly = true;
    mesh.userData.homeEndZoneWordmark = true;
    mesh.userData.side = side;
    return { mesh, side };
  }

  private updateEndZoneWordmarks(
    branding: HomeFieldBranding,
    endZoneWords: { far: string; near: string },
  ): void {
    for (const wordmark of this.wordmarks) {
      const text = wordmark.side === 'near' ? endZoneWords.near : endZoneWords.far;
      const nextMaterial = createWordmarkMaterial(text, branding);
      const previous = wordmark.mesh.material;
      wordmark.mesh.material = nextMaterial;
      wordmark.mesh.visible = text.length > 0;
      disposeMaterial(previous);
    }
  }

  private updateMidfieldLogo(branding: HomeFieldBranding): void {
    const requestId = this.logoRequestId + 1;
    this.logoRequestId = requestId;

    const previous = this.midfieldLogo.material;
    this.midfieldLogo.material = createInvisibleMaterial();
    this.midfieldLogo.visible = false;
    disposeMaterial(previous);

    if (!branding.logoUrl || typeof document === 'undefined') {
      return;
    }

    createMidfieldLogoTexture(branding.logoUrl)
      .then((texture) => {
        if (this.disposed || requestId !== this.logoRequestId) {
          texture.dispose();
          return;
        }

        const material = new THREE.MeshBasicMaterial({
          depthWrite: false,
          map: texture,
          transparent: true,
        });
        const stale = this.midfieldLogo.material;
        this.midfieldLogo.material = material;
        this.midfieldLogo.visible = true;
        this.midfieldLogo.userData.maskedLogo = true;
        disposeMaterial(stale);
      })
      .catch(() => {
        if (requestId === this.logoRequestId) {
          this.midfieldLogo.visible = false;
        }
      });
  }
}

export function splitTeamNameForEndZones(displayName: string): { far: string; near: string } {
  const words = displayName
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words.length === 0) {
    return { far: '', near: '' };
  }

  if (words.length === 1) {
    return { far: words[0].toUpperCase(), near: words[0].toUpperCase() };
  }

  const nearWords = words.length <= 2
    ? [words[0]]
    : words.slice(0, words.length - 1);
  const farWords = words.length <= 2
    ? words.slice(1)
    : [words[words.length - 1]];

  return {
    far: farWords.join(' ').toUpperCase(),
    near: nearWords.join(' ').toUpperCase(),
  };
}

function getEndZone(layout: FieldLayout, side: 'far' | 'near'): FieldRectLayout {
  const id = side === 'near' ? 'near-end-zone' : 'far-end-zone';
  const endZone = layout.endZones.find((zone) => zone.id === id);
  if (!endZone) {
    throw new Error(`Missing ${id} layout`);
  }
  return endZone;
}

function createWordmarkMaterial(
  text: string,
  branding: HomeFieldBranding,
): THREE.MeshBasicMaterial {
  const texture = createWordmarkTexture(text, branding);
  if (!texture) {
    return createInvisibleMaterial();
  }

  return new THREE.MeshBasicMaterial({
    depthWrite: false,
    map: texture,
    transparent: true,
  });
}

function createWordmarkTexture(
  text: string,
  branding: HomeFieldBranding,
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  canvas.width = 1024;
  canvas.height = 256;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineJoin = 'round';

  const maxTextWidth = canvas.width * 0.9;
  let fontSize = 178;
  do {
    context.font = `900 ${fontSize}px Arial Black, Impact, sans-serif`;
    fontSize -= 4;
  } while (fontSize > 72 && context.measureText(text).width > maxTextWidth);

  context.lineWidth = Math.max(12, fontSize * 0.12);
  context.strokeStyle = branding.primaryColor;
  context.fillStyle = branding.textColor;
  context.shadowColor = 'rgba(0, 0, 0, 0.34)';
  context.shadowBlur = 12;
  context.shadowOffsetY = 6;
  context.strokeText(text, canvas.width / 2, canvas.height / 2);
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  context.shadowColor = 'transparent';
  context.lineWidth = 5;
  context.strokeStyle = branding.accentColor;
  context.strokeText(text, canvas.width / 2, canvas.height / 2);
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createMidfieldLogoTexture(logoUrl: string): Promise<THREE.CanvasTexture> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      reject(new Error('Canvas logo rendering is unavailable'));
      return;
    }

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Canvas logo rendering is unavailable'));
        return;
      }

      canvas.width = 1024;
      canvas.height = 1024;
      const center = canvas.width / 2;
      const radius = canvas.width * 0.45;
      const sourceSize = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height);
      const sourceX = ((image.naturalWidth || image.width) - sourceSize) / 2;
      const sourceY = ((image.naturalHeight || image.height) - sourceSize) / 2;

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.save();
      context.beginPath();
      context.arc(center, center, radius, 0, Math.PI * 2);
      context.clip();
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        center - radius,
        center - radius,
        radius * 2,
        radius * 2,
      );
      context.restore();

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      texture.needsUpdate = true;
      resolve(texture);
    };
    image.onerror = () => reject(new Error(`Unable to load midfield logo ${logoUrl}`));
    image.src = logoUrl;
  });
}

function createInvisibleMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    opacity: 0,
    transparent: true,
  });
}

function disposeMaterial(material: THREE.MeshBasicMaterial): void {
  material.map?.dispose();
  material.dispose();
}
