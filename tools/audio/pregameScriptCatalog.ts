import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import {
  PREGAME_COMMENTARY_CATALOG,
  validatePregameCommentaryCatalog,
  type PregameCommentaryCategory,
  type PregameCommentaryClip,
} from '../../src/audio/PregameCommentaryCatalog';
import {
  ANNOUNCER_IDENTITY,
  ANNOUNCER_OUTPUT_FORMAT,
  ANNOUNCER_TTS_MODEL_ID,
  ANNOUNCER_VOICE_ID_PLACEHOLDER,
} from './announcerScriptCatalog';
import {
  readAudioDurationSeconds,
  resolveRepoPath,
  toRepoRelativePath,
  validateAudioPlan,
  type AudioAssetPlan,
  type AudioProvenance,
} from './schemas';

export interface PregameCaptionEntry {
  assetId: string;
  awayTeamId: string | null;
  caption: string;
  category: PregameCommentaryCategory;
  coinTossOutcome: string | null;
  compressedBytes: number;
  durationSeconds: number | null;
  exists: boolean;
  homeTeamId: string | null;
  jerseyNumber: number | null;
  kickoffResultType: string | null;
  matchPhaseEligibility: string | null;
  modelId: string;
  outputPath: string;
  pronunciation: string | null;
  priority: number | null;
  qbArchetype: string | null;
  rosterPlayerId: string | null;
  script: string;
  scriptId: string;
  teamId: string | null;
  variant: number;
  voiceId: string;
  weatherCondition: string | null;
}

export interface PregameCaptionManifest {
  announcer: typeof ANNOUNCER_IDENTITY;
  generatedAt: string;
  scripts: PregameCaptionEntry[];
}

export const PREGAME_SCRIPT_CATALOG = PREGAME_COMMENTARY_CATALOG;
export const PREGAME_AUDIO_DIRECTORY_PATH = 'public/audio/announcer/pregame';
export const PREGAME_CAPTION_MANIFEST_PATH = 'public/audio/announcer/pregame-captions.json';
export const PREGAME_AUDITION_PAGE_PATH = 'public/audio/announcer/pregame-audition.html';

export function createPregameSpeechPlan(
  voiceId = ANNOUNCER_VOICE_ID_PLACEHOLDER,
): readonly AudioAssetPlan[] {
  return PREGAME_SCRIPT_CATALOG.map((script) => ({
    assetId: script.assetId,
    caption: script.caption,
    category: 'announcer',
    eventCategory: `pregame:${script.category}`,
    generationStatus: 'planned',
    kind: 'speech',
    loop: false,
    maxBytes: 160_000,
    metadata: createPregameMetadata(script),
    modelId: ANNOUNCER_TTS_MODEL_ID,
    notes: `${ANNOUNCER_IDENTITY.displayName}; pregame ${script.category} variant ${script.variant}.`,
    outputFormat: ANNOUNCER_OUTPUT_FORMAT,
    outputPath: `public/audio/announcer/pregame/${script.assetId}.mp3`,
    requestedDurationSeconds: script.durationSeconds,
    runtimeLoadingStrategy: 'buffer',
    script: script.script,
    scriptId: script.scriptId,
    voiceId,
    voiceSettings: {
      similarityBoost: 0.72,
      stability: 0.58,
      style: getPregameStyle(script.category),
      useSpeakerBoost: true,
    },
  }));
}

export function validatePregameScriptCatalog(): string[] {
  return [
    ...validatePregameCommentaryCatalog(PREGAME_SCRIPT_CATALOG),
    ...validateAudioPlan(createPregameSpeechPlan()),
  ];
}

export function createPregameCaptionManifest(
  speechAssets: readonly AudioAssetPlan[],
  generatedAt = new Date().toISOString(),
): PregameCaptionManifest {
  return {
    announcer: ANNOUNCER_IDENTITY,
    generatedAt,
    scripts: speechAssets
      .filter((asset) => asset.category === 'announcer' && asset.kind === 'speech')
      .map((asset) => {
        const outputPath = resolveRepoPath(asset.outputPath);
        const exists = existsSync(outputPath);
        const metadata = asset.metadata ?? {};

        return {
          assetId: asset.assetId,
          awayTeamId: readNullableString(metadata.awayTeamId),
          caption: asset.caption ?? asset.script ?? '',
          category: readPregameCategory(metadata.pregameCategory),
          coinTossOutcome: readNullableString(metadata.coinTossOutcome),
          compressedBytes: exists ? statSync(outputPath).size : 0,
          durationSeconds: exists ? readAudioDurationSeconds(asset.outputPath) : null,
          exists,
          homeTeamId: readNullableString(metadata.homeTeamId),
          jerseyNumber: readNullableNumber(metadata.jerseyNumber),
          kickoffResultType: readNullableString(metadata.kickoffResultType),
          matchPhaseEligibility: readNullableString(metadata.matchPhaseEligibility),
          modelId: asset.modelId,
          outputPath: asset.outputPath,
          pronunciation: readNullableString(metadata.pronunciation),
          priority: readNullableNumber(metadata.priority),
          qbArchetype: readNullableString(metadata.qbArchetype),
          rosterPlayerId: readNullableString(metadata.rosterPlayerId),
          script: asset.script ?? '',
          scriptId: asset.scriptId ?? asset.assetId,
          teamId: readNullableString(metadata.teamId),
          variant: readVariant(metadata.variant),
          voiceId: asset.voiceId ?? '',
          weatherCondition: readNullableString(metadata.weatherCondition),
        };
      }),
  };
}

export function writePregameArtifacts(
  speechAssets: readonly AudioAssetPlan[],
): { auditionPagePath: string; captionManifestPath: string } {
  const manifest = createPregameCaptionManifest(speechAssets);
  writeJsonFile(PREGAME_CAPTION_MANIFEST_PATH, manifest);
  writeTextFile(PREGAME_AUDITION_PAGE_PATH, createPregameAuditionHtml(manifest));

  return {
    auditionPagePath: toRepoRelativePath(resolveRepoPath(PREGAME_AUDITION_PAGE_PATH)),
    captionManifestPath: toRepoRelativePath(resolveRepoPath(PREGAME_CAPTION_MANIFEST_PATH)),
  };
}

function createPregameMetadata(
  clip: PregameCommentaryClip,
): Record<string, boolean | null | number | string> {
  const metadata: Record<string, boolean | null | number | string> = {
    announcerName: ANNOUNCER_IDENTITY.displayName,
    awayTeamId: clip.awayTeamId ?? null,
    homeTeamId: clip.homeTeamId ?? null,
    jerseyNumber: clip.jerseyNumber ?? null,
    pregameCategory: clip.category,
    pronunciation: clip.pronunciation ?? null,
    rosterPlayerId: clip.rosterPlayerId ?? null,
    teamId: clip.teamId ?? null,
    variant: clip.variant,
    weatherCondition: clip.weatherCondition ?? null,
  };

  if (clip.coinTossOutcome) {
    metadata.coinTossOutcome = clip.coinTossOutcome;
  }
  if (clip.kickoffResultType) {
    metadata.kickoffResultType = clip.kickoffResultType;
  }
  if (clip.matchPhaseEligibility) {
    metadata.matchPhaseEligibility = clip.matchPhaseEligibility;
  }
  if (clip.priority !== undefined) {
    metadata.priority = clip.priority;
  }
  if (clip.qbArchetype) {
    metadata.qbArchetype = clip.qbArchetype;
  }

  return metadata;
}

function createPregameAuditionHtml(manifest: PregameCaptionManifest): string {
  const auditionEntries = collectPregameAuditionEntries(manifest);
  const sections = [
    {
      categories: ['welcome', 'warmupTransition', 'matchup', 'weather'] as const,
      label: 'Warmup',
    },
    {
      categories: ['quarterback', 'quarterbackArchetype'] as const,
      label: 'QB Scouting',
    },
    {
      categories: ['coinTossSetup', 'coinTossResult'] as const,
      label: 'Coin Toss',
    },
    {
      categories: ['kickoffReady', 'kickoffInFlight', 'kickoffResult'] as const,
      label: 'Kickoff',
    },
  ]
    .map((section) =>
      createCategorySection(
        section.label,
        auditionEntries.filter((entry) => section.categories.includes(entry.category as never)),
      ),
    )
    .join('\n');
  const availableCount = auditionEntries.filter((entry) => entry.exists).length;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(manifest.announcer.displayName)} Pregame Audition</title>
  <style>
    body { background: #101920; color: #e8eef2; font: 14px/1.45 system-ui, sans-serif; margin: 24px; }
    h2 { color: #9ec7db; margin-top: 32px; text-transform: capitalize; }
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
  <h1>${escapeHtml(manifest.announcer.displayName)} Pregame Audition</h1>
  <p class="meta">${escapeHtml(manifest.announcer.description)}</p>
  <div class="toolbar">
    <button type="button" data-play-all>Play all</button>
    <button type="button" data-stop-all>Stop</button>
    <span class="count">${availableCount} available pregame clips</span>
  </div>
${sections}
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

function collectPregameAuditionEntries(
  manifest: PregameCaptionManifest,
): readonly PregameCaptionEntry[] {
  const entriesById = new Map<string, PregameCaptionEntry>();

  for (const entry of manifest.scripts) {
    if (entry.exists) {
      entriesById.set(entry.assetId, entry);
    }
  }

  for (const entry of scanPregameAudioDirectory()) {
    entriesById.set(entry.assetId, entry);
  }

  const availableEntries = sortPregameEntries([...entriesById.values()].filter((entry) => entry.exists));
  return availableEntries.length > 0 ? availableEntries : sortPregameEntries(manifest.scripts);
}

function scanPregameAudioDirectory(): PregameCaptionEntry[] {
  const directoryPath = resolveRepoPath(PREGAME_AUDIO_DIRECTORY_PATH);
  if (!existsSync(directoryPath)) {
    return [];
  }

  return readdirSync(directoryPath)
    .filter((fileName) => fileName.endsWith('.mp3'))
    .sort((left, right) => left.localeCompare(right))
    .map((fileName) => createPregameEntryFromAudioFile(`${PREGAME_AUDIO_DIRECTORY_PATH}/${fileName}`));
}

function createPregameEntryFromAudioFile(outputPath: string): PregameCaptionEntry {
  const provenance = readAudioProvenance(outputPath);
  const metadata = provenance?.metadata ?? {};
  const assetId = provenance?.assetId ?? outputPath.replace(/^.*\//, '').replace(/\.mp3$/, '');
  const outputAbsolutePath = resolveRepoPath(outputPath);
  const eventCategory = provenance?.eventCategory?.startsWith('pregame:')
    ? provenance.eventCategory.slice('pregame:'.length)
    : undefined;

  return {
    assetId,
    awayTeamId: readNullableString(metadata.awayTeamId),
    caption: provenance?.caption ?? provenance?.script ?? assetId,
    category: readPregameCategory(metadata.pregameCategory ?? eventCategory),
    coinTossOutcome: readNullableString(metadata.coinTossOutcome),
    compressedBytes: statSync(outputAbsolutePath).size,
    durationSeconds: readAudioDurationSeconds(outputPath) ?? provenance?.durationSeconds ?? null,
    exists: true,
    homeTeamId: readNullableString(metadata.homeTeamId),
    jerseyNumber: readNullableNumber(metadata.jerseyNumber),
    kickoffResultType: readNullableString(metadata.kickoffResultType),
    matchPhaseEligibility: readNullableString(metadata.matchPhaseEligibility),
    modelId: provenance?.modelId ?? '',
    outputPath,
    pronunciation: readNullableString(metadata.pronunciation),
    priority: readNullableNumber(metadata.priority),
    qbArchetype: readNullableString(metadata.qbArchetype),
    rosterPlayerId: readNullableString(metadata.rosterPlayerId),
    script: provenance?.script ?? '',
    scriptId: provenance?.scriptId ?? assetId,
    teamId: readNullableString(metadata.teamId),
    variant: readVariant(metadata.variant) || inferVariant(assetId),
    voiceId: provenance?.voiceId ?? '',
    weatherCondition: readNullableString(metadata.weatherCondition),
  };
}

function readAudioProvenance(outputPath: string): AudioProvenance | null {
  const sidecarPath = `${resolveRepoPath(outputPath)}.json`;
  if (!existsSync(sidecarPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(sidecarPath, 'utf8')) as AudioProvenance;
  } catch {
    return null;
  }
}

function sortPregameEntries(entries: readonly PregameCaptionEntry[]): PregameCaptionEntry[] {
  const categoryOrder = new Map<PregameCommentaryCategory, number>([
    ['welcome', 0],
    ['warmupTransition', 1],
    ['matchup', 2],
    ['weather', 3],
    ['quarterback', 4],
    ['quarterbackArchetype', 5],
    ['coinTossSetup', 6],
    ['coinTossResult', 7],
    ['kickoffReady', 8],
    ['kickoffInFlight', 9],
    ['kickoffResult', 10],
  ]);

  return [...entries].sort((left, right) =>
    (categoryOrder.get(left.category) ?? 99) - (categoryOrder.get(right.category) ?? 99) ||
    left.scriptId.localeCompare(right.scriptId) ||
    left.assetId.localeCompare(right.assetId)
  );
}

function createCategorySection(
  label: string,
  entries: readonly PregameCaptionEntry[],
): string {
  const rows = entries.map((entry) => {
    const duration = formatDuration(entry.durationSeconds);
    const source = entry.exists ? publicPathToRelativeUrl(entry.outputPath, PREGAME_AUDITION_PAGE_PATH) : '';
    const context = [
      entry.awayTeamId && entry.homeTeamId ? `${entry.awayTeamId} at ${entry.homeTeamId}` : '',
      entry.weatherCondition ? `weather ${entry.weatherCondition}` : '',
      entry.rosterPlayerId ? `${entry.rosterPlayerId} #${entry.jerseyNumber ?? '?'}` : '',
      entry.qbArchetype ? `QB ${entry.qbArchetype}` : '',
      entry.coinTossOutcome ? `coin toss ${entry.coinTossOutcome}` : '',
      entry.kickoffResultType ? `kickoff ${entry.kickoffResultType}` : '',
      entry.teamId && !entry.rosterPlayerId ? `team ${entry.teamId}` : '',
    ].filter(Boolean).join('; ');

    return [
      '<tr>',
      `<td>${entry.variant}</td>`,
      `<td>${escapeHtml(entry.category)}</td>`,
      `<td>${escapeHtml(entry.scriptId)}</td>`,
      `<td>${escapeHtml(context)}</td>`,
      `<td>${escapeHtml(entry.caption)}</td>`,
      `<td>${duration}</td>`,
      `<td>${formatBytes(entry.compressedBytes)}</td>`,
      `<td>${entry.exists ? `<audio controls preload="metadata" src="${escapeHtml(source)}"></audio>` : 'missing'}</td>`,
      '</tr>',
    ].join('');
  }).join('\n');

  return `<section>
  <h2>${escapeHtml(label)}</h2>
  <table>
    <thead>
      <tr>
        <th>Variant</th>
        <th>Category</th>
        <th>Script ID</th>
        <th>Context</th>
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
</section>`;
}

function getPregameStyle(category: PregameCommentaryCategory): number {
  switch (category) {
    case 'coinTossResult':
    case 'kickoffInFlight':
    case 'kickoffResult':
      return 0.38;
    case 'quarterbackArchetype':
      return 0.36;
    case 'quarterback':
      return 0.34;
    case 'coinTossSetup':
    case 'kickoffReady':
    case 'warmupTransition':
      return 0.32;
    case 'welcome':
    case 'matchup':
      return 0.3;
    case 'weather':
      return 0.22;
  }
}

function readPregameCategory(value: unknown): PregameCommentaryCategory {
  return value === 'coinTossResult' ||
    value === 'coinTossSetup' ||
    value === 'kickoffInFlight' ||
    value === 'kickoffReady' ||
    value === 'kickoffResult' ||
    value === 'matchup' ||
    value === 'quarterback' ||
    value === 'quarterbackArchetype' ||
    value === 'warmupTransition' ||
    value === 'weather' ||
    value === 'welcome'
    ? value
    : 'welcome';
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readVariant(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 1;
}

function inferVariant(assetId: string): number {
  const match = assetId.match(/_(\d+)$/);
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
