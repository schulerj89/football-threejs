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
    `MUTED ${snapshot.muted}`,
    `BUSES ${snapshot.activeBuses.join(',') || 'none'}`,
    `GAINS ${formatBusGains(snapshot.busGains)}`,
    `LOOPS ${snapshot.activeLoops.join(',') || 'none'}`,
    `ONE_SHOTS ${snapshot.activeOneShots}`,
    `COMPRESSED_BYTES ${snapshot.loadedCompressedBytes}`,
    `DECODED_BYTES ${snapshot.decodedBufferBytes}`,
    `LOADED ${snapshot.loadedAssetIds.join(',') || 'none'}`,
    `STREAMED ${snapshot.streamedAssetIds.join(',') || 'none'}`,
    `MISSING ${snapshot.missingOptionalAssetIds.join(',') || 'none'}`,
    `EVENTS ${snapshot.recentEvents.map((event) => event.type).join(',') || 'none'}`,
    `UNLOCK_ERROR ${snapshot.lastUnlockError ?? 'none'}`,
  ].join('\n');
}

function formatBusGains(busGains: GameAudioDirectorSnapshot['busGains']): string {
  return Object.entries(busGains)
    .map(([busName, gain]) => `${busName}:${gain.toFixed(2)}`)
    .join(' ');
}
