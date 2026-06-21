import type { GameAudioDirectorSnapshot } from './GameAudioDirector';

export function createAudioDebugOverlay(): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'audio-debug-overlay';
  document.body.appendChild(element);
  return element;
}

export function syncAudioDebugOverlay(
  element: HTMLElement,
  snapshot: GameAudioDirectorSnapshot,
): void {
  element.textContent = [
    'AUDIO',
    `CTX ${snapshot.contextState}`,
    `ENABLED ${snapshot.enabled}`,
    `UNLOCKED ${snapshot.userGestureUnlocked}`,
    `MUTED ${snapshot.muted}`,
    `BUSES ${snapshot.activeBuses.join(',') || 'none'}`,
    `GAINS ${formatBusGains(snapshot.busGains)}`,
    `LOOPS ${snapshot.activeLoops.join(',') || 'none'}`,
    `ONE_SHOTS ${snapshot.activeOneShots}`,
    `PAGE_ACTIVE ${snapshot.pageActive}`,
    `AUDIO_NODES ${snapshot.activeAudioNodeCount}`,
    `SOURCES ${snapshot.activeSourceCount}`,
    `MEDIA_SOURCES ${snapshot.preparedMediaElementSourceCount}`,
    `COMPRESSED_BYTES ${snapshot.loadedCompressedBytes}`,
    `DECODED_BYTES ${snapshot.decodedBufferBytes}`,
    `LONGEST_CLIP ${snapshot.longestLoadedClipSeconds?.toFixed(2) ?? 'none'}`,
    `LOADED ${snapshot.loadedAssetIds.join(',') || 'none'}`,
    `DECODED ${snapshot.decodedAssetIds.join(',') || 'none'}`,
    `STREAMED ${snapshot.streamedAssetIds.join(',') || 'none'}`,
    `MISSING ${snapshot.missingOptionalAssetIds.join(',') || 'none'}`,
    `EVENTS ${snapshot.recentEvents.map((event) => event.type).join(',') || 'none'}`,
    `EVENT_HISTORY ${formatEventHistory(snapshot.eventHistory)}`,
    `UNLOCK_ERROR ${snapshot.lastUnlockError ?? 'none'}`,
  ].join('\n');
}

function formatBusGains(busGains: GameAudioDirectorSnapshot['busGains']): string {
  return Object.entries(busGains)
    .map(([busName, gain]) => `${busName}:${gain.toFixed(2)}`)
    .join(' ');
}

function formatEventHistory(eventHistory: GameAudioDirectorSnapshot['eventHistory']): string {
  if (eventHistory.length === 0) {
    return 'none';
  }

  return eventHistory
    .slice(0, 6)
    .map((entry) => {
      const asset = entry.assetId ?? 'none';
      const reason = entry.reason ?? 'ok';
      return `${entry.eventType}:${entry.eventId}:${asset}:${entry.triggerTimeSeconds.toFixed(2)}:${entry.status}:${reason}`;
    })
    .join(' | ');
}
