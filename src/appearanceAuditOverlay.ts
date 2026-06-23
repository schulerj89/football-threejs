import * as THREE from 'three';
import {
  getPlayerBodyVisualSnapshot,
  type PlayerBodyVisualSnapshot,
  type PlayerVisualBoundsSnapshot,
} from './playerVisual';
import {
  readJerseyNumberVisualSnapshot,
  type JerseyNumberVisualSnapshot,
} from './presentation/players/JerseyNumberVisual';

export interface PlayerAppearanceAuditEntry {
  headBounds: PlayerVisualBoundsSnapshot | null;
  headHelmetClearance: number | null;
  helmetBounds: PlayerVisualBoundsSnapshot | null;
  jerseyNumber: JerseyNumberVisualSnapshot | null;
  playerId: string;
  skinToneId: string;
}

export interface AppearanceAuditSnapshot {
  entries: PlayerAppearanceAuditEntry[];
  playerCount: number;
  skinToneCount: number;
}

export function createAppearanceAuditSnapshot(
  playerVisuals: Map<string, THREE.Object3D>,
): AppearanceAuditSnapshot {
  const entries = [...playerVisuals.entries()]
    .map(([playerId, visual]) => createAppearanceAuditEntry(
      playerId,
      getPlayerBodyVisualSnapshot(visual),
      visual,
    ))
    .sort((a, b) => a.playerId.localeCompare(b.playerId));
  const skinToneIds = new Set(entries.map((entry) => entry.skinToneId));

  return {
    entries,
    playerCount: entries.length,
    skinToneCount: skinToneIds.size,
  };
}

export function createAppearanceAuditOverlay(): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'appearance-audit-overlay';
  document.body.appendChild(element);
  return element;
}

export function syncAppearanceAuditOverlay(
  element: HTMLElement,
  snapshot: AppearanceAuditSnapshot,
): void {
  const lines = [
    'APPEARANCE AUDIT',
    `PLAYERS ${snapshot.playerCount}`,
    `SKIN_TONES ${snapshot.skinToneCount}`,
  ];

  for (const entry of snapshot.entries) {
    lines.push(
      [
        `${entry.playerId} ${entry.skinToneId}`,
        `  HEAD ${formatBounds(entry.headBounds)}`,
        `  HELMET ${formatBounds(entry.helmetBounds)}`,
        `  CLEARANCE ${formatNumber(entry.headHelmetClearance)}`,
        `  NUMBER ${formatJerseyNumber(entry.jerseyNumber)}`,
      ].join('\n'),
    );
  }

  element.textContent = lines.join('\n');
}

function createAppearanceAuditEntry(
  playerId: string,
  bodySnapshot: PlayerBodyVisualSnapshot,
  visual: THREE.Object3D,
): PlayerAppearanceAuditEntry {
  return {
    headBounds: bodySnapshot.headBounds,
    headHelmetClearance: bodySnapshot.headHelmetClearance,
    helmetBounds: bodySnapshot.helmetBounds,
    jerseyNumber: readJerseyNumberVisualSnapshot(visual),
    playerId,
    skinToneId: bodySnapshot.appearance.skinToneId,
  };
}

function formatBounds(bounds: PlayerVisualBoundsSnapshot | null): string {
  if (!bounds) {
    return 'none';
  }

  return [
    `min ${bounds.min.x.toFixed(2)},${bounds.min.y.toFixed(2)},${bounds.min.z.toFixed(2)}`,
    `max ${bounds.max.x.toFixed(2)},${bounds.max.y.toFixed(2)},${bounds.max.z.toFixed(2)}`,
  ].join(' ');
}

function formatNumber(value: number | null): string {
  return value === null ? 'none' : value.toFixed(3);
}

function formatJerseyNumber(snapshot: JerseyNumberVisualSnapshot | null): string {
  if (!snapshot) {
    return 'none';
  }

  const cell = snapshot.atlasCell
    ? `${snapshot.atlasCell.row},${snapshot.atlasCell.column}`
    : 'none';
  const anchor = snapshot.anchorPosition
    ? `${snapshot.anchorPosition.x.toFixed(2)},${snapshot.anchorPosition.y.toFixed(2)},${snapshot.anchorPosition.z.toFixed(2)}`
    : 'none';
  const number = snapshot.jerseyNumber === null ? 'none' : `#${snapshot.jerseyNumber}`;
  const missing = snapshot.missingBindingReason ? ` missing=${snapshot.missingBindingReason}` : '';
  return [
    `${number}`,
    `roster=${snapshot.rosterPlayerId ?? 'none'}`,
    `cell=${cell}`,
    `material=${snapshot.materialId ?? 'none'}`,
    `anchor=${anchor}`,
    `visible=${snapshot.visible ? 'yes' : 'no'}${missing}`,
  ].join(' ');
}
