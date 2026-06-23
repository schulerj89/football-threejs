import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  COMPACT_BROADCAST_SCRIPT_CATALOG,
  createVoicePackManifest,
  validateCompactBroadcastScriptCatalog,
} from './compactBroadcastScriptCatalog';
import {
  isDirectCli,
  resolveRepoPath,
} from './schemas';
import {
  REQUIRED_VOICE_PACK_SCRIPT_IDS,
  VOICE_PACKS,
} from '../../src/audio/voicePacks/VoicePackRegistry';
import type {
  VoicePackId,
  VoicePackManifest,
} from '../../src/audio/voicePacks/VoicePackTypes';

export const VOICE_PACK_GALLERY_PATH = 'public/audio/voice-packs/voice-pack-gallery.html';

export interface VoicePackManifestReport {
  readonly existingClipCount: number;
  readonly id: VoicePackId;
  readonly missingScriptIds: readonly string[];
  readonly targetCompressedBytes: number;
  readonly totalCompressedBytes: number;
  readonly underTarget: boolean;
}

export interface VoicePackReport {
  readonly generatedAt: string;
  readonly packs: readonly VoicePackManifestReport[];
  readonly requiredScriptCount: number;
  readonly scriptCount: number;
  readonly validationErrors: readonly string[];
}

export function createVoicePackReport(
  manifests = createAllVoicePackManifests(),
  generatedAt = new Date().toISOString(),
): VoicePackReport {
  const validationErrors = [
    ...validateCompactBroadcastScriptCatalog(COMPACT_BROADCAST_SCRIPT_CATALOG),
    ...validateVoicePackManifests(manifests),
  ];

  return {
    generatedAt,
    packs: manifests.map((manifest) => {
      const clips = Object.values(manifest.clips);
      const missingScriptIds = REQUIRED_VOICE_PACK_SCRIPT_IDS.filter((scriptId) =>
        !manifest.clips[scriptId] ||
        (manifest.clips[scriptId].compressedBytes ?? 0) <= 0);
      const totalCompressedBytes = clips.reduce(
        (sum, clip) => sum + Math.max(0, clip.compressedBytes ?? 0),
        0,
      );
      const targetCompressedBytes = manifest.targetCompressedBytes ?? 4 * 1024 * 1024;

      return {
        existingClipCount: clips.filter((clip) => (clip.compressedBytes ?? 0) > 0).length,
        id: manifest.id,
        missingScriptIds,
        targetCompressedBytes,
        totalCompressedBytes,
        underTarget: totalCompressedBytes <= targetCompressedBytes,
      };
    }),
    requiredScriptCount: REQUIRED_VOICE_PACK_SCRIPT_IDS.length,
    scriptCount: COMPACT_BROADCAST_SCRIPT_CATALOG.length,
    validationErrors,
  };
}

export function writeVoicePackArtifacts(
  generatedAt = new Date().toISOString(),
): {
  galleryPath: string;
  manifestPaths: readonly string[];
  report: VoicePackReport;
} {
  const manifests = createAllVoicePackManifests(generatedAt);
  const manifestPaths = manifests.map((manifest) =>
    `public/audio/voice-packs/${manifest.id}/voice-pack-manifest.json`);

  for (let index = 0; index < manifests.length; index += 1) {
    const path = manifestPaths[index];
    writeJson(path, manifests[index]);
  }

  writeText(VOICE_PACK_GALLERY_PATH, createVoicePackGalleryHtml(manifests));

  return {
    galleryPath: VOICE_PACK_GALLERY_PATH,
    manifestPaths,
    report: createVoicePackReport(manifests, generatedAt),
  };
}

function createAllVoicePackManifests(
  generatedAt = new Date().toISOString(),
): VoicePackManifest[] {
  return VOICE_PACKS.map((pack) => createVoicePackManifest(pack.id, generatedAt));
}

function validateVoicePackManifests(
  manifests: readonly VoicePackManifest[],
): string[] {
  const errors: string[] = [];
  const packIds = new Set<string>();

  for (const manifest of manifests) {
    if (packIds.has(manifest.id)) {
      errors.push(`${manifest.id}: duplicate voice-pack manifest`);
    }
    packIds.add(manifest.id);

    const missingRequired = REQUIRED_VOICE_PACK_SCRIPT_IDS.filter(
      (scriptId) => !manifest.clips[scriptId],
    );
    if (missingRequired.length > 0) {
      errors.push(`${manifest.id}: missing required scripts ${missingRequired.join(', ')}`);
    }

    const duplicateAssetIds = findDuplicates(
      Object.values(manifest.clips).map((clip) => clip.assetId),
    );
    if (duplicateAssetIds.length > 0) {
      errors.push(`${manifest.id}: duplicate asset IDs ${duplicateAssetIds.join(', ')}`);
    }
  }

  return errors;
}

function createVoicePackGalleryHtml(
  manifests: readonly VoicePackManifest[],
): string {
  const packSections = manifests.map((manifest) => {
    const rows = Object.values(manifest.clips)
      .sort((a, b) =>
        `${a.domain}:${a.category}:${a.scriptId}`.localeCompare(`${b.domain}:${b.category}:${b.scriptId}`))
      .map((clip) => {
        const available = (clip.compressedBytes ?? 0) > 0;
        const audio = available
          ? `<audio controls preload="none" src="${escapeHtml(clip.url)}"></audio>`
          : '<span class="missing">missing</span>';

        return `<tr>
          <td>${escapeHtml(clip.domain)}</td>
          <td>${escapeHtml(String(clip.category ?? 'uncategorized'))}</td>
          <td><code>${escapeHtml(clip.scriptId)}</code></td>
          <td>${escapeHtml(clip.caption)}</td>
          <td>${formatSeconds(clip.durationSeconds)}</td>
          <td>${formatBytes(clip.compressedBytes ?? 0)}</td>
          <td>${audio}</td>
        </tr>`;
      })
      .join('\n');

    return `<section>
      <h2>${escapeHtml(manifest.displayName)}</h2>
      <p>${escapeHtml(manifest.announcerName)}. ${Object.values(manifest.clips).length} required script slots.</p>
      <table>
        <thead>
          <tr>
            <th>Domain</th>
            <th>Category</th>
            <th>Script ID</th>
            <th>Caption</th>
            <th>Duration</th>
            <th>Size</th>
            <th>Audition</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Football JS Voice Pack Gallery</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, Segoe UI, Arial, sans-serif; background: #07100d; color: #edf4ed; }
    body { margin: 0; padding: 32px; }
    h1, h2 { margin: 0 0 12px; }
    section { margin: 28px 0; padding: 20px; border: 1px solid #33433d; border-radius: 8px; background: #0d1713; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { padding: 10px; border-bottom: 1px solid #263630; vertical-align: top; text-align: left; }
    th { color: #a8b9b0; font-size: 12px; text-transform: uppercase; }
    code { color: #c4f0d7; }
    audio { width: 220px; }
    .missing { color: #e7b1a5; font-weight: 700; }
  </style>
</head>
<body>
  <h1>Football JS Voice Pack Gallery</h1>
  <p>Compact multi-announcer audition page. Missing entries are expected until paid offline generation is run.</p>
  ${packSections}
</body>
</html>
`;
}

function writeJson(path: string, value: unknown): void {
  writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(path: string, value: string): void {
  const absolutePath = resolveRepoPath(path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, value, 'utf8');
}

function findDuplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }

  return [...duplicates];
}

function formatSeconds(value: number): string {
  return `${value.toFixed(1)}s`;
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KiB`;
  }
  return `${(value / (1024 * 1024)).toFixed(2)} MiB`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

if (isDirectCli(import.meta.url)) {
  try {
    const result = writeVoicePackArtifacts();
    console.log(JSON.stringify(result.report, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
