import type { RuntimeAudioDebugSnapshot } from '../audio/AudioDebugOverlay';
import type { CinematicsSetting } from '../camera/PresentationCameraDirector';
import type { GameplayCameraDebugSnapshot } from '../camera/GameplayCameraController';
import type { RenderMetricsSnapshot } from '../debugOverlay';
import type { PlayResultType } from '../playState';
import type {
  CrowdPresentationSettings,
  CrowdPresentationSnapshot,
} from './CrowdPresentationController';
import type { PresentationHoldSnapshot } from './PresentationHoldDirector';

export interface PresentationHardeningAuditSnapshot {
  activeCameraShot: string | null;
  audio: {
    activeAudioNodes: number;
    announcerEnabled: boolean;
    captionsEnabled: boolean;
    compressedAudioBytes: number;
    decodedAudioBytes: number;
    enabled: boolean;
  };
  cameraMode: GameplayCameraDebugSnapshot['mode'];
  cinematics: CinematicsSetting;
  crowd: CrowdPresentationSnapshot | null;
  currentResultType: PlayResultType | null;
  duplicateEventSuppressions: number;
  hold: PresentationHoldSnapshot;
  matrix: {
    announcerEnabled: boolean;
    audioEnabled: boolean;
    cameraMode: GameplayCameraDebugSnapshot['mode'];
    captionsEnabled: boolean;
    cinematics: CinematicsSetting;
    crowdReactionsEnabled: boolean;
    crowdVisualsEnabled: boolean;
  };
  renderMetrics: RenderMetricsSnapshot | null;
  resultEventCounts: Record<AuditedResultType, number>;
}

export type AuditedResultType =
  | 'firstDown'
  | 'incomplete'
  | 'sack'
  | 'touchdown'
  | 'turnoverOnDowns';

export function createPresentationHardeningAuditSnapshot(options: {
  audio: RuntimeAudioDebugSnapshot;
  camera: GameplayCameraDebugSnapshot;
  cinematics: CinematicsSetting;
  crowd: CrowdPresentationSnapshot | null;
  crowdSettings: CrowdPresentationSettings;
  currentResultType: PlayResultType | null;
  hold: PresentationHoldSnapshot;
  renderMetrics: RenderMetricsSnapshot | null;
}): PresentationHardeningAuditSnapshot {
  return {
    activeCameraShot: options.camera.activeShotName ?? null,
    audio: {
      activeAudioNodes: options.audio.activeAudioNodeCount,
      announcerEnabled: options.audio.announcerEnabled,
      captionsEnabled: options.audio.captionsEnabled,
      compressedAudioBytes: options.audio.loadedCompressedBytes,
      decodedAudioBytes: options.audio.decodedBufferBytes,
      enabled: options.audio.enabled,
    },
    cameraMode: options.camera.mode,
    cinematics: options.cinematics,
    crowd: options.crowd,
    currentResultType: options.currentResultType,
    duplicateEventSuppressions: countDuplicateSuppressions(options.audio) +
      options.hold.duplicateSuppressionCount +
      countCrowdDuplicateSuppressions(options.crowd),
    hold: options.hold,
    matrix: {
      announcerEnabled: options.audio.announcerEnabled,
      audioEnabled: options.audio.enabled,
      cameraMode: options.camera.mode,
      captionsEnabled: options.audio.captionsEnabled,
      cinematics: options.cinematics,
      crowdReactionsEnabled: options.crowdSettings.crowdReactionsEnabled,
      crowdVisualsEnabled: options.crowdSettings.crowdVisualsEnabled,
    },
    renderMetrics: options.renderMetrics,
    resultEventCounts: countResultEvents(options.audio, options.crowd),
  };
}

export function createPresentationHardeningAuditOverlay(): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'presentation-hardening-audit-overlay';
  document.body.appendChild(element);
  return element;
}

export function syncPresentationHardeningAuditOverlay(
  element: HTMLElement,
  snapshot: PresentationHardeningAuditSnapshot,
): void {
  const lines = [
    'PRESENTATION MATRIX',
    `AUDIO ${snapshot.matrix.audioEnabled ? 'on' : 'off'} ANN ${snapshot.matrix.announcerEnabled ? 'on' : 'off'} CAP ${snapshot.matrix.captionsEnabled ? 'on' : 'off'}`,
    `CROWD ${snapshot.matrix.crowdVisualsEnabled ? 'on' : 'off'} REACT ${snapshot.matrix.crowdReactionsEnabled ? 'on' : 'off'} ${snapshot.crowd?.density ?? 'none'}`,
    `CIN ${snapshot.matrix.cinematics} CAM ${snapshot.matrix.cameraMode}`,
    `RESULT ${snapshot.currentResultType ?? 'none'} SHOT ${snapshot.activeCameraShot ?? 'none'}`,
    `HOLD ${snapshot.hold.active ? `${snapshot.hold.reason}:${snapshot.hold.remainingSeconds.toFixed(2)}` : 'none'}`,
    `EVENTS fd ${snapshot.resultEventCounts.firstDown} td ${snapshot.resultEventCounts.touchdown} inc ${snapshot.resultEventCounts.incomplete} sack ${snapshot.resultEventCounts.sack} tod ${snapshot.resultEventCounts.turnoverOnDowns}`,
    `DUP_SUPPRESS ${snapshot.duplicateEventSuppressions}`,
    `AUDIO_BYTES comp ${snapshot.audio.compressedAudioBytes} dec ${snapshot.audio.decodedAudioBytes} nodes ${snapshot.audio.activeAudioNodes}`,
  ];

  if (snapshot.renderMetrics) {
    lines.push(
      `FRAME_MS ${snapshot.renderMetrics.frameTimeMs.toFixed(1)}`,
      `CALLS ${snapshot.renderMetrics.calls}`,
      `TRIS ${snapshot.renderMetrics.triangles}`,
    );
  }

  if (snapshot.crowd) {
    lines.push(
      `CROWD_CALLS ${snapshot.crowd.crowdDrawCalls}`,
      `CROWD_UPDATES ${snapshot.crowd.reactionUpdateCount}`,
    );
  }

  element.textContent = lines.join('\n');
}

function countResultEvents(
  audio: RuntimeAudioDebugSnapshot,
  crowd: CrowdPresentationSnapshot | null,
): Record<AuditedResultType, number> {
  const counts: Record<AuditedResultType, number> = {
    firstDown: 0,
    incomplete: 0,
    sack: 0,
    touchdown: 0,
    turnoverOnDowns: 0,
  };

  for (const entry of audio.eventHistory) {
    if (isAuditedResultType(entry.eventType)) {
      counts[entry.eventType] += 1;
    }
  }

  for (const entry of crowd?.reactionHistory ?? []) {
    if (isAuditedResultType(entry.eventType)) {
      counts[entry.eventType] += 1;
    }
  }

  return counts;
}

function countDuplicateSuppressions(audio: RuntimeAudioDebugSnapshot): number {
  return audio.eventHistory.filter((entry) => entry.reason === 'duplicateEvent').length;
}

function countCrowdDuplicateSuppressions(crowd: CrowdPresentationSnapshot | null): number {
  return crowd?.reactionHistory.filter((entry) => entry.reason === 'duplicateEvent').length ?? 0;
}

function isAuditedResultType(value: string): value is AuditedResultType {
  return value === 'firstDown' ||
    value === 'incomplete' ||
    value === 'sack' ||
    value === 'touchdown' ||
    value === 'turnoverOnDowns';
}
