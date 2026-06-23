import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import {
  ANNOUNCER_IDENTITY,
  type AnnouncerEventCategory,
  type AnnouncerIntensity,
} from './announcerScriptCatalog';
import {
  readAudioDurationSeconds,
  resolveRepoPath,
  toRepoRelativePath,
  type AudioAssetPlan,
} from './schemas';

export interface AnnouncerCaptionEntry {
  assetId: string;
  caption: string;
  compressedBytes: number;
  durationSeconds: number | null;
  eventCategory: AnnouncerEventCategory;
  exists: boolean;
  intensity: AnnouncerIntensity;
  modelId: string;
  outputPath: string;
  script: string;
  scriptId: string;
  variant: number;
  voiceId: string;
}

export interface AnnouncerCaptionManifest {
  announcer: typeof ANNOUNCER_IDENTITY;
  generatedAt: string;
  scripts: AnnouncerCaptionEntry[];
}

export const ANNOUNCER_CAPTION_MANIFEST_PATH = 'public/audio/announcer/announcer-captions.json';
export const ANNOUNCER_AUDITION_PAGE_PATH = 'public/audio/announcer/announcer-audition.html';

export function createAnnouncerCaptionManifest(
  speechAssets: readonly AudioAssetPlan[],
  generatedAt = new Date().toISOString(),
): AnnouncerCaptionManifest {
  return {
    announcer: ANNOUNCER_IDENTITY,
    generatedAt,
    scripts: speechAssets
      .filter((asset) => asset.category === 'announcer' && asset.kind === 'speech')
      .map((asset) => {
        const absoluteOutputPath = resolveRepoPath(asset.outputPath);
        const exists = existsSync(absoluteOutputPath);

        return {
          assetId: asset.assetId,
          caption: asset.caption ?? asset.script ?? '',
          compressedBytes: exists ? statSync(absoluteOutputPath).size : 0,
          durationSeconds: exists ? readAudioDurationSeconds(asset.outputPath) : null,
          eventCategory: asset.eventCategory as AnnouncerEventCategory,
          exists,
          intensity: parseIntensity(asset.notes),
          modelId: asset.modelId,
          outputPath: asset.outputPath,
          script: asset.script ?? '',
          scriptId: asset.scriptId ?? asset.assetId,
          variant: parseVariant(asset.notes),
          voiceId: asset.voiceId ?? '',
        };
      }),
  };
}

export function writeAnnouncerArtifacts(
  speechAssets: readonly AudioAssetPlan[],
): { auditionPagePath: string; captionManifestPath: string } {
  const manifest = createAnnouncerCaptionManifest(speechAssets);
  writeJsonFile(ANNOUNCER_CAPTION_MANIFEST_PATH, manifest);
  writeTextFile(ANNOUNCER_AUDITION_PAGE_PATH, createAnnouncerAuditionHtml(manifest));

  return {
    auditionPagePath: toRepoRelativePath(resolveRepoPath(ANNOUNCER_AUDITION_PAGE_PATH)),
    captionManifestPath: toRepoRelativePath(resolveRepoPath(ANNOUNCER_CAPTION_MANIFEST_PATH)),
  };
}

function createAnnouncerAuditionHtml(manifest: AnnouncerCaptionManifest): string {
  const rows = manifest.scripts.map((entry) => {
    const duration = formatDuration(entry.durationSeconds);
    const source = entry.exists ? publicPathToRelativeUrl(entry.outputPath, ANNOUNCER_AUDITION_PAGE_PATH) : '';

    return [
      '<tr>',
      `<td>${escapeHtml(entry.eventCategory)}</td>`,
      `<td>${entry.variant}</td>`,
      `<td>${escapeHtml(entry.intensity)}</td>`,
      `<td>${escapeHtml(entry.scriptId)}</td>`,
      `<td>${escapeHtml(entry.caption)}</td>`,
      `<td>${duration}</td>`,
      `<td>${formatBytes(entry.compressedBytes)}</td>`,
      `<td>${entry.exists ? `<audio controls preload="metadata" src="${escapeHtml(source)}"></audio>` : 'missing'}</td>`,
      '</tr>',
    ].join('');
  }).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(manifest.announcer.displayName)} Audition</title>
  <style>
    body { background: #101920; color: #e8eef2; font: 14px/1.45 system-ui, sans-serif; margin: 24px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border-bottom: 1px solid #33424c; padding: 8px; text-align: left; vertical-align: top; }
    th { color: #9ec7db; }
    audio { width: 260px; }
    .meta { color: #b8c8d1; max-width: 900px; }
    .toolbar { align-items: center; display: flex; flex-wrap: wrap; gap: 10px; margin: 18px 0; }
    button { background: #20313c; border: 1px solid #527083; border-radius: 6px; color: #e8eef2; cursor: pointer; font: inherit; padding: 8px 12px; }
    button:hover, button:focus-visible { background: #2a4050; outline: 2px solid #9ec7db; outline-offset: 2px; }
    .count { color: #b8c8d1; }
  </style>
</head>
<body>
  <h1>${escapeHtml(manifest.announcer.displayName)} Audition</h1>
  <p class="meta">${escapeHtml(manifest.announcer.description)}</p>
  <div class="toolbar">
    <button type="button" data-play-all>Play all</button>
    <button type="button" data-stop-all>Stop</button>
    <span class="count">${manifest.scripts.filter((entry) => entry.exists).length} available clips</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>Event</th>
        <th>Variant</th>
        <th>Intensity</th>
        <th>Script ID</th>
        <th>Caption</th>
        <th>Duration</th>
        <th>Compressed</th>
        <th>Audition</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
  <script>
    const audios = Array.from(document.querySelectorAll('audio'));
    let playAllToken = 0;

    async function playAll() {
      const token = ++playAllToken;
      for (const audio of audios) {
        if (token !== playAllToken) {
          return;
        }
        audio.currentTime = 0;
        try {
          await audio.play();
          await new Promise((resolve) => {
            const done = () => {
              audio.removeEventListener('ended', done);
              audio.removeEventListener('error', done);
              resolve();
            };
            audio.addEventListener('ended', done);
            audio.addEventListener('error', done);
          });
        } catch {
          return;
        }
      }
    }

    function stopAll() {
      playAllToken += 1;
      for (const audio of audios) {
        audio.pause();
        audio.currentTime = 0;
      }
    }

    document.querySelector('[data-play-all]')?.addEventListener('click', playAll);
    document.querySelector('[data-stop-all]')?.addEventListener('click', stopAll);
  </script>
</body>
</html>
`;
}

function parseIntensity(notes: string | undefined): AnnouncerIntensity {
  if (notes?.includes('peak ')) {
    return 'peak';
  }
  if (notes?.includes('high ')) {
    return 'high';
  }
  if (notes?.includes('medium ')) {
    return 'medium';
  }
  return 'low';
}

function parseVariant(notes: string | undefined): number {
  const match = notes?.match(/variant (\d+)/);
  return match ? Number(match[1]) : 1;
}

function writeJsonFile(relativePath: string, value: unknown): void {
  writeTextFile(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeTextFile(relativePath: string, text: string): void {
  const absolutePath = resolveRepoPath(relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, text, 'utf8');
}

function publicPathToRelativeUrl(assetPath: string, pagePath: string): string {
  const pageDirectory = dirname(stripPublicPrefix(pagePath));
  const asset = stripPublicPrefix(assetPath);
  const relativePath = relative(pageDirectory, asset).replaceAll('\\', '/');

  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}

function stripPublicPrefix(path: string): string {
  return path.replaceAll('\\', '/').replace(/^public\//, '');
}

function formatDuration(durationSeconds: number | null): string {
  return durationSeconds === null ? 'missing' : `${durationSeconds.toFixed(2)}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
