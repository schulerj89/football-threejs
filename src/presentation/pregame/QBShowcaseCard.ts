import * as THREE from 'three';
import {
  getReadableTextColor,
  type TeamPresentationTheme,
} from '../../teams/TeamThemeApplier';
import type { PregamePresentationSnapshot } from './PregamePresentationTypes';
import type { PregameWarmupSnapshot } from './PregameWarmupTypes';

export interface QBShowcaseCardUpdateOptions {
  camera: THREE.Camera;
  pregameSnapshot: PregamePresentationSnapshot;
  teamTheme: TeamPresentationTheme;
  viewportHeight: number;
  viewportWidth: number;
  warmupSnapshot: PregameWarmupSnapshot;
}

export interface QBShowcaseCardSnapshot {
  position: { x: number; y: number } | null;
  rosterPlayerId: string | null;
  visibilityReason: string;
  visible: boolean;
}

const CARD_CONFIG = {
  bottomReservedPixels: 120,
  cardHeight: 196,
  cardWidth: 256,
  horizontalOffsetPixels: 46,
  marginPixels: 14,
  subjectHeightOffset: 0.9,
} as const;

const scratchVector = new THREE.Vector3();

export class QBShowcaseCard {
  readonly element: HTMLDivElement;

  private snapshot: QBShowcaseCardSnapshot = {
    position: null,
    rosterPlayerId: null,
    visibilityReason: 'notInitialized',
    visible: false,
  };

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'qb-showcase-card';
    this.element.hidden = true;
    this.element.setAttribute('aria-live', 'polite');
    document.body.append(this.element);
  }

  update(options: QBShowcaseCardUpdateOptions): void {
    const quarterback = options.warmupSnapshot.quarterback;
    if (
      options.pregameSnapshot.phase !== 'running' ||
      options.pregameSnapshot.currentShot !== 'quarterbackSpotlight'
    ) {
      this.hide('inactiveShot');
      return;
    }

    if (!quarterback) {
      this.hide('missingQuarterback');
      return;
    }

    const screen = projectBoundsCenter(
      quarterback.bounds.center,
      options.camera,
      options.viewportWidth,
      options.viewportHeight,
    );
    if (!screen.visible) {
      this.hide('subjectOutsideViewport');
      return;
    }

    const accent = options.teamTheme.offense.profile.colors.accent ||
      options.teamTheme.offense.uniform.stripe ||
      options.teamTheme.offense.uniform.jersey;
    const textColor = getReadableTextColor(accent);
    const left = clamp(
      screen.x + CARD_CONFIG.horizontalOffsetPixels,
      CARD_CONFIG.marginPixels,
      Math.max(
        CARD_CONFIG.marginPixels,
        options.viewportWidth - CARD_CONFIG.cardWidth - CARD_CONFIG.marginPixels,
      ),
    );
    const top = clamp(
      screen.y - CARD_CONFIG.cardHeight * 0.46,
      CARD_CONFIG.marginPixels,
      Math.max(
        CARD_CONFIG.marginPixels,
        options.viewportHeight -
          CARD_CONFIG.cardHeight -
          CARD_CONFIG.bottomReservedPixels,
      ),
    );

    this.element.style.setProperty('--qb-showcase-accent', accent);
    this.element.style.setProperty('--qb-showcase-accent-text', textColor);
    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;
    this.element.innerHTML = renderCardMarkup(quarterback);
    this.element.hidden = false;
    this.snapshot = {
      position: { x: left, y: top },
      rosterPlayerId: quarterback.rosterPlayerId,
      visibilityReason: 'visible',
      visible: true,
    };
  }

  hide(reason = 'hidden'): void {
    this.element.hidden = true;
    this.snapshot = {
      position: null,
      rosterPlayerId: this.snapshot.rosterPlayerId,
      visibilityReason: reason,
      visible: false,
    };
  }

  getSnapshot(): QBShowcaseCardSnapshot {
    return {
      position: this.snapshot.position ? { ...this.snapshot.position } : null,
      rosterPlayerId: this.snapshot.rosterPlayerId,
      visibilityReason: this.snapshot.visibilityReason,
      visible: this.snapshot.visible,
    };
  }

  dispose(): void {
    this.element.remove();
  }
}

function renderCardMarkup(
  quarterback: NonNullable<PregameWarmupSnapshot['quarterback']>,
): string {
  return [
    '<div class="qb-showcase-kicker">Spotlight</div>',
    `<div class="qb-showcase-name">#${quarterback.jerseyNumber} ${escapeHtml(quarterback.formattedName)}</div>`,
    `<div class="qb-showcase-archetype">${escapeHtml(quarterback.archetype.toUpperCase())} QB</div>`,
    '<div class="qb-showcase-bars">',
    renderRating('Throw Power', quarterback.ratings.throwPower),
    renderRating('Accuracy', quarterback.ratings.accuracy),
    renderRating('Mobility', quarterback.ratings.mobility),
    '</div>',
  ].join('');
}

function renderRating(label: string, value: number): string {
  const clamped = clamp(value, 0, 99);
  return [
    '<div class="qb-showcase-rating">',
    `<span>${escapeHtml(label)}</span>`,
    `<strong>${clamped}</strong>`,
    `<i style="--rating-width:${clamped}%"></i>`,
    '</div>',
  ].join('');
}

function projectBoundsCenter(
  center: { x: number; y: number; z: number },
  camera: THREE.Camera,
  viewportWidth: number,
  viewportHeight: number,
): { visible: boolean; x: number; y: number } {
  camera.updateMatrixWorld();
  scratchVector.set(
    center.x,
    center.y + CARD_CONFIG.subjectHeightOffset,
    center.z,
  );
  scratchVector.project(camera);

  const visible =
    Number.isFinite(scratchVector.x) &&
    Number.isFinite(scratchVector.y) &&
    Number.isFinite(scratchVector.z) &&
    scratchVector.z >= -1 &&
    scratchVector.z <= 1 &&
    scratchVector.x >= -1.08 &&
    scratchVector.x <= 1.08 &&
    scratchVector.y >= -1.08 &&
    scratchVector.y <= 1.08;

  return {
    visible,
    x: (scratchVector.x * 0.5 + 0.5) * viewportWidth,
    y: (-scratchVector.y * 0.5 + 0.5) * viewportHeight,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
