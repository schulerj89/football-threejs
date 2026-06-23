import { existsSync } from 'node:fs';
import { MeshyClient } from './MeshyClient';
import {
  FOOTBALL_HELMET_CANDIDATE_PLAN,
  assertValidFootballHelmetGenerationPlan,
} from './helmetGenerationPlan';
import {
  HELMET_METADATA_DIR,
  assertCanWriteHelmetPath,
  getFileHash,
  getFileSize,
  isDirectCli,
  parseHelmetGenerateOptions,
  readJsonFile,
  requireMeshyApiKey,
  resolveRepoPath,
  selectHelmetCandidates,
  writeBinaryFile,
  writeJsonFile,
  type HelmetGenerateOptions,
  type MeshyDownloadMetadata,
  type MeshyTaskMetadata,
} from './schemas';

export interface HelmetDownloadSummary {
  readonly downloaded: readonly string[];
  readonly dryRun: boolean;
  readonly missingTasks: readonly string[];
  readonly skipped: readonly string[];
}

export async function downloadHelmetCandidates(
  options: HelmetGenerateOptions,
): Promise<HelmetDownloadSummary> {
  assertValidFootballHelmetGenerationPlan();
  const candidates = selectHelmetCandidates(FOOTBALL_HELMET_CANDIDATE_PLAN, options);
  const downloaded: string[] = [];
  const missingTasks: string[] = [];
  const skipped: string[] = [];

  if (!options.execute) {
    return {
      downloaded,
      dryRun: true,
      missingTasks: [],
      skipped: candidates.map((candidate) => candidate.assetId),
    };
  }

  const client = new MeshyClient(requireMeshyApiKey());

  for (const candidate of candidates) {
    const taskMetadataPath = `${HELMET_METADATA_DIR}/${candidate.assetId}-meshy-task.json`;
    if (!existsSync(resolveRepoPath(taskMetadataPath))) {
      missingTasks.push(candidate.assetId);
      continue;
    }
    if (!options.force && existsSync(resolveRepoPath(candidate.outputPath))) {
      skipped.push(candidate.assetId);
      continue;
    }

    assertCanWriteHelmetPath(candidate.outputPath, options.force);
    const taskMetadata = readJsonFile<MeshyTaskMetadata>(taskMetadataPath);
    const taskResult = await client.waitForTask(taskMetadata.taskId);
    if (!taskResult.modelUrl) {
      throw new Error(`Meshy task ${taskMetadata.taskId} succeeded but did not expose a GLB URL`);
    }

    const model = await client.downloadModel(taskResult.modelUrl);
    writeBinaryFile(candidate.outputPath, model);
    const outputHash = getFileHash(candidate.outputPath);
    writeJsonFile(resolveRepoPath(`${HELMET_METADATA_DIR}/${candidate.assetId}-download.json`), {
      ...taskMetadata,
      downloadedAt: new Date().toISOString(),
      outputBytes: getFileSize(candidate.outputPath),
      outputHash,
      outputPath: candidate.outputPath,
      taskPayload: sanitizeMeshyTaskPayload(taskResult.raw),
    } satisfies MeshyDownloadMetadata);
    downloaded.push(candidate.assetId);
  }

  return {
    downloaded,
    dryRun: false,
    missingTasks,
    skipped,
  };
}

export function sanitizeMeshyTaskPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMeshyTaskPayload(item));
  }
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' && isSignedAssetUrl(value) ? '[redacted signed asset URL]' : value;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === 'string' && (isUrlKey(key) || isSignedAssetUrl(child))) {
      sanitized[key] = child ? '[redacted signed asset URL]' : child;
    } else {
      sanitized[key] = sanitizeMeshyTaskPayload(child);
    }
  }
  return sanitized;
}

function isUrlKey(key: string): boolean {
  return /(^|_)urls?$/.test(key);
}

function isSignedAssetUrl(value: string): boolean {
  return /^https:\/\/assets\.meshy\.ai\//.test(value) || /[?&]Signature=/.test(value);
}

if (isDirectCli(import.meta.url)) {
  const options = parseHelmetGenerateOptions(process.argv.slice(2));
  downloadHelmetCandidates(options)
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
