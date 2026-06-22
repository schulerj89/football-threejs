import type { GameAudioDirectorSnapshot } from './GameAudioDirector';
import type { BroadcastCommentarySnapshot } from './BroadcastCommentaryDirector';
import type { GameMusicDirectorSnapshot } from './GameMusicDirector';
import type { MenuMusicPlaylistSnapshot } from './MenuMusicPlaylistController';
import type { StadiumChantDirectorSnapshot } from './StadiumChantDirector';
import type { PregameAudioCoordinatorSnapshot } from '../presentation/pregame/PregamePresentationTypes';

export type RuntimeAudioDebugSnapshot = GameAudioDirectorSnapshot & {
  commentary?: BroadcastCommentarySnapshot;
  gameMusic?: GameMusicDirectorSnapshot;
  stadiumChants?: StadiumChantDirectorSnapshot;
  pregame?: PregameAudioCoordinatorSnapshot;
  titleMusic?: MenuMusicPlaylistSnapshot;
};

export function createAudioDebugOverlay(): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'audio-debug-overlay';
  document.body.appendChild(element);
  return element;
}

export function syncAudioDebugOverlay(
  element: HTMLElement,
  snapshot: RuntimeAudioDebugSnapshot,
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
    `COMMENTARY ${formatCommentary(snapshot.commentary)}`,
    `GAME_MUSIC ${formatGameMusic(snapshot.gameMusic)}`,
    `CHANTS ${formatStadiumChants(snapshot.stadiumChants)}`,
    `PREGAME ${formatPregame(snapshot.pregame)}`,
    `TITLE_MUSIC ${formatTitleMusic(snapshot.titleMusic)}`,
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

function formatCommentary(snapshot: BroadcastCommentarySnapshot | undefined): string {
  if (!snapshot) {
    return 'none';
  }

  const current = snapshot.currentClip
    ? `${snapshot.currentClip.category}:${snapshot.currentClip.assetId}`
    : 'none';
  const queue = snapshot.queue
    .map((entry) => `${entry.category}:${entry.assetId}`)
    .join(',') || 'none';
  const cooldown = snapshot.remainingCooldowns
    .map((entry) => `${entry.category}:${entry.remainingSeconds.toFixed(1)}`)
    .join(',') || 'none';
  const duck = snapshot.crowdDuckState.ducked
    ? `ducked:${snapshot.crowdDuckState.duckingGain.toFixed(2)}`
    : 'restored';

  return [
    `enabled:${snapshot.enabled}`,
    `captions:${snapshot.captionsEnabled}`,
    `current:${current}`,
    `source:${snapshot.lastEventSource ?? 'none'}`,
    `priority:${snapshot.lastPriority ?? 'none'}`,
    `cooldown:${cooldown}`,
    `queue:${queue}`,
    `crowd:${duck}`,
  ].join(' ');
}

function formatTitleMusic(snapshot: MenuMusicPlaylistSnapshot | undefined): string {
  if (!snapshot) {
    return 'none';
  }

  return [
    `asset:${snapshot.assetId || 'none'}`,
    `title:${snapshot.trackTitle ?? 'none'}`,
    `state:${snapshot.state}`,
    `order:${snapshot.playlistOrder}`,
    `loop:${snapshot.loopActive}`,
    `handoff:${snapshot.handoffRequested}`,
    `gain:${snapshot.loopGain.toFixed(2)}`,
  ].join(' ');
}

function formatGameMusic(snapshot: GameMusicDirectorSnapshot | undefined): string {
  if (!snapshot) {
    return 'none';
  }

  return [
    `stinger:${snapshot.activeStinger?.assetId ?? 'none'}`,
    `purpose:${snapshot.activeStinger?.purpose ?? 'none'}`,
    `reason:${snapshot.suppressionReason ?? 'none'}`,
  ].join(' ');
}

function formatStadiumChants(snapshot: StadiumChantDirectorSnapshot | undefined): string {
  if (!snapshot) {
    return 'none';
  }

  return [
    `active:${snapshot.activeChantAssetId ?? 'none'}`,
    `cooldown:${snapshot.cooldownRemainingSeconds.toFixed(1)}`,
    `reason:${snapshot.lastSuppressionReason ?? 'none'}`,
  ].join(' ');
}

function formatPregame(snapshot: PregameAudioCoordinatorSnapshot | undefined): string {
  if (!snapshot) {
    return 'none';
  }

  return [
    `active:${snapshot.activeLine?.lineId ?? 'none'}`,
    `queued:${snapshot.queuedLine?.lineId ?? 'none'}`,
    `state:${snapshot.playbackState}`,
    `ended:${snapshot.activeLine?.actualEndedAtSeconds?.toFixed(2) ?? 'none'}`,
    `completed:${snapshot.completedLineIds.join(',') || 'none'}`,
    `failed:${snapshot.failedLineIds.join(',') || 'none'}`,
    `music:${snapshot.musicGain.toFixed(2)}`,
    `crowd:${snapshot.crowdGain.toFixed(2)}`,
  ].join(' ');
}
