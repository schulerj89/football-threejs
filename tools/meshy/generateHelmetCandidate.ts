import { existsSync, readFileSync } from 'node:fs';
import { MeshyClient } from './MeshyClient';
import {
  FOOTBALL_HELMET_CANDIDATE_PLAN,
  FOOTBALL_HELMET_REFERENCE_PLAN,
  assertValidFootballHelmetGenerationPlan,
} from './helmetGenerationPlan';
import {
  HELMET_METADATA_DIR,
  assertCanWriteHelmetPath,
  getFileHash,
  isDirectCli,
  parseHelmetGenerateOptions,
  referenceOutputExists,
  requireMeshyApiKey,
  resolveRepoPath,
  selectHelmetCandidates,
  toDataUri,
  withSingleRetry,
  writeBinaryFile,
  writeHelmetReferenceProvenance,
  writeJsonFile,
  type HelmetCandidatePlan,
  type HelmetGenerateOptions,
  type HelmetGenerateSummary,
  type HelmetReferenceImagePlan,
  type MeshyMultiImageTo3DRequest,
  type MeshyTaskMetadata,
} from './schemas';
import { requireOpenAIApiKey } from '../branding/schemas';

interface OpenAIImageGenerationResponse {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
    url?: string;
  }>;
}

export interface HelmetReferenceGenerationResult {
  readonly content: Uint8Array;
  readonly revisedPrompt: string | null;
}

export interface HelmetCandidateGenerationDependencies {
  readonly createMeshyTask?: (
    request: MeshyMultiImageTo3DRequest,
    apiKey: string,
  ) => Promise<{ creditCost: number | null; taskId: string }>;
  readonly requestReferenceImage?: (
    asset: HelmetReferenceImagePlan,
    apiKey: string,
    referenceImage?: Uint8Array,
  ) => Promise<HelmetReferenceGenerationResult>;
}

export async function generateHelmetCandidates(
  options: HelmetGenerateOptions,
  dependencies: HelmetCandidateGenerationDependencies = {},
): Promise<HelmetGenerateSummary> {
  assertValidFootballHelmetGenerationPlan();
  const selectedCandidates = selectHelmetCandidates(FOOTBALL_HELMET_CANDIDATE_PLAN, options);
  const selectedReferences = FOOTBALL_HELMET_REFERENCE_PLAN.filter((reference) =>
    selectedCandidates.some((candidate) => candidate.assetId === reference.candidateId),
  );

  if (!options.execute) {
    return {
      dryRun: true,
      generatedReferences: [],
      skippedCandidates: selectedCandidates.map((candidate) => candidate.assetId),
      skippedReferences: selectedReferences.map((reference) => reference.assetId),
      submittedCandidates: [],
    };
  }

  const openAiApiKey = requireOpenAIApiKey();
  const meshyApiKey = requireMeshyApiKey();
  const requestReferenceImage = dependencies.requestReferenceImage ?? requestOpenAIHelmetReferenceImage;
  const createMeshyTask = dependencies.createMeshyTask ?? createMeshyTaskFromRequest;
  const generatedReferences: string[] = [];
  const skippedReferences: string[] = [];
  const submittedCandidates: string[] = [];
  const skippedCandidates: string[] = [];

  for (const candidate of selectedCandidates) {
    const candidateReferences = selectedReferences.filter((reference) => reference.candidateId === candidate.assetId);
    const frontReference = candidateReferences.find((reference) => reference.view === 'front');
    for (const reference of candidateReferences) {
      if (!options.force && referenceOutputExists(reference)) {
        skippedReferences.push(reference.assetId);
        continue;
      }
      assertCanWriteHelmetPath(reference.outputPath, options.force);
      assertCanWriteHelmetPath(`${reference.outputPath}.json`, options.force);
      const referenceImage = reference.view !== 'front' && frontReference
        ? readReferenceImage(frontReference)
        : undefined;
      const result = await withSingleRetry(
        options.retryCount,
        () => requestReferenceImage(reference, openAiApiKey, referenceImage),
      );
      writeBinaryFile(reference.outputPath, result.content);
      writeHelmetReferenceProvenance(reference, result.content, {
        revisedPrompt: result.revisedPrompt,
      });
      generatedReferences.push(reference.assetId);
    }

    const taskMetadataPath = getCandidateTaskMetadataPath(candidate);
    if (!options.force && existsSync(resolveRepoPath(taskMetadataPath))) {
      skippedCandidates.push(candidate.assetId);
      continue;
    }
    assertCanWriteHelmetPath(taskMetadataPath, options.force);

    const request = createMeshyRequest(candidate, candidateReferences);
    const task = await withSingleRetry(
      options.retryCount,
      () => createMeshyTask(request, meshyApiKey),
    );
    writeJsonFile(resolveRepoPath(taskMetadataPath), {
      candidateId: candidate.assetId,
      createdAt: new Date().toISOString(),
      creditCost: task.creditCost,
      generationRequest: {
        ...request,
        image_urls: candidateReferences.map((reference) => reference.outputPath),
      },
      referenceImageHashes: createReferenceRecord(
        candidateReferences,
        (reference) => getFileHash(reference.outputPath),
      ),
      referenceImagePaths: createReferenceRecord(
        candidateReferences,
        (reference) => reference.outputPath,
      ),
      taskId: task.taskId,
    } satisfies MeshyTaskMetadata);
    submittedCandidates.push(candidate.assetId);
  }

  return {
    dryRun: false,
    generatedReferences,
    skippedCandidates,
    skippedReferences,
    submittedCandidates,
  };
}

export function createMeshyRequest(
  candidate: HelmetCandidatePlan,
  references: readonly HelmetReferenceImagePlan[],
): MeshyMultiImageTo3DRequest {
  const orderedReferences = ['front', 'right', 'back', 'left']
    .map((view) => references.find((reference) => reference.view === view))
    .filter((reference): reference is HelmetReferenceImagePlan => Boolean(reference));

  if (orderedReferences.length !== 4) {
    throw new Error(`${candidate.assetId}: all four reference views must exist before Meshy submission`);
  }

  for (const reference of orderedReferences) {
    if (!existsSync(resolveRepoPath(reference.outputPath))) {
      throw new Error(`${candidate.assetId}: missing generated reference ${reference.outputPath}`);
    }
  }

  return {
    ai_model: candidate.aiModel,
    enable_pbr: candidate.enablePbr,
    image_enhancement: candidate.imageEnhancement,
    image_urls: orderedReferences.map((reference) => toDataUri(reference.outputPath, 'image/webp')),
    remove_lighting: candidate.removeLighting,
    save_pre_remeshed_model: candidate.savePreRemeshedModel,
    should_remesh: candidate.shouldRemesh,
    should_texture: candidate.shouldTexture,
    target_formats: candidate.targetFormats,
    target_polycount: candidate.targetPolycount,
    topology: candidate.topology,
  };
}

function getCandidateTaskMetadataPath(candidate: HelmetCandidatePlan): string {
  return `${HELMET_METADATA_DIR}/${candidate.assetId}-meshy-task.json`;
}

function createReferenceRecord(
  references: readonly HelmetReferenceImagePlan[],
  getValue: (reference: HelmetReferenceImagePlan) => string,
): Record<HelmetReferenceImagePlan['view'], string> {
  const record = {} as Record<HelmetReferenceImagePlan['view'], string>;

  for (const view of ['front', 'right', 'back', 'left'] as const) {
    const reference = references.find((candidate) => candidate.view === view);
    if (!reference) {
      throw new Error(`Missing ${view} reference`);
    }
    record[view] = getValue(reference);
  }

  return record;
}

function readReferenceImage(reference: HelmetReferenceImagePlan): Uint8Array | undefined {
  const absolutePath = resolveRepoPath(reference.outputPath);
  return existsSync(absolutePath) ? readFileSync(absolutePath) : undefined;
}

async function createMeshyTaskFromRequest(
  request: MeshyMultiImageTo3DRequest,
  apiKey: string,
): Promise<{ creditCost: number | null; taskId: string }> {
  const client = new MeshyClient(apiKey);
  return client.createMultiImageTo3DTask(request);
}

async function requestOpenAIHelmetReferenceImage(
  asset: HelmetReferenceImagePlan,
  apiKey: string,
  referenceImage?: Uint8Array,
): Promise<HelmetReferenceGenerationResult> {
  if (referenceImage) {
    try {
      return await requestOpenAIImageEdit(asset, apiKey, referenceImage);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/unsupported|not supported|400|404/i.test(message)) {
        throw error;
      }
    }
  }
  return requestOpenAIImageGeneration(asset, apiKey);
}

async function requestOpenAIImageGeneration(
  asset: HelmetReferenceImagePlan,
  apiKey: string,
): Promise<HelmetReferenceGenerationResult> {
  const body = {
    background: 'opaque',
    model: asset.model,
    n: 1,
    output_compression: 92,
    output_format: asset.outputFormat,
    prompt: asset.prompt,
    quality: asset.quality,
    size: asset.requestedSize,
  };
  const payload = await postOpenAIImageRequest(
    'https://api.openai.com/v1/images/generations',
    apiKey,
    body,
    asset.assetId,
  );
  return payload;
}

async function requestOpenAIImageEdit(
  asset: HelmetReferenceImagePlan,
  apiKey: string,
  referenceImage: Uint8Array,
): Promise<HelmetReferenceGenerationResult> {
  const form = new FormData();
  form.set('background', 'opaque');
  form.set('model', asset.model);
  form.set('n', '1');
  form.set('output_compression', '92');
  form.set('output_format', asset.outputFormat);
  form.set('prompt', asset.prompt);
  form.set('quality', asset.quality);
  form.set('size', asset.requestedSize);
  form.set(
    'image',
    new Blob([new Uint8Array(referenceImage)], { type: 'image/webp' }),
    `${asset.candidateId}-front-reference.webp`,
  );

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    body: form,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    method: 'POST',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI image edit failed for ${asset.assetId}: ${response.status} ${errorBody}`);
  }

  return readOpenAIImageResponse(response, asset.assetId);
}

async function postOpenAIImageRequest(
  url: string,
  apiKey: string,
  body: unknown,
  assetId: string,
): Promise<HelmetReferenceGenerationResult> {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI image generation failed for ${assetId}: ${response.status} ${errorBody}`);
  }

  return readOpenAIImageResponse(response, assetId);
}

async function readOpenAIImageResponse(
  response: Response,
  assetId: string,
): Promise<HelmetReferenceGenerationResult> {
  const payload = await response.json() as OpenAIImageGenerationResponse;
  const image = payload.data?.[0];

  if (image?.b64_json) {
    return {
      content: Buffer.from(image.b64_json, 'base64'),
      revisedPrompt: image.revised_prompt ?? null,
    };
  }
  if (image?.url) {
    const imageResponse = await fetch(image.url);
    if (!imageResponse.ok) {
      throw new Error(`OpenAI image download failed for ${assetId}: ${imageResponse.status}`);
    }
    return {
      content: new Uint8Array(await imageResponse.arrayBuffer()),
      revisedPrompt: image.revised_prompt ?? null,
    };
  }

  throw new Error(`OpenAI image generation returned no image data for ${assetId}`);
}

if (isDirectCli(import.meta.url)) {
  const options = parseHelmetGenerateOptions(process.argv.slice(2));
  generateHelmetCandidates(options)
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
