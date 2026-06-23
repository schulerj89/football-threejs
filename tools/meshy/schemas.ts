import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, isAbsolute, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type HelmetReferenceView = 'front' | 'right' | 'back' | 'left';
export type HelmetCandidateId = 'candidate-a' | 'candidate-b';
export type HelmetGenerationStatus = 'planned' | 'submitted' | 'downloaded' | 'prepared' | 'validated';

export interface HelmetReferenceImagePlan {
  readonly assetId: string;
  readonly candidateId: HelmetCandidateId;
  readonly model: 'gpt-image-2';
  readonly outputFormat: 'webp';
  readonly outputPath: string;
  readonly prompt: string;
  readonly quality: 'high';
  readonly requestedSize: '1024x1024';
  readonly view: HelmetReferenceView;
}

export interface HelmetCandidatePlan {
  readonly aiModel: 'latest';
  readonly assetId: HelmetCandidateId;
  readonly enablePbr: boolean;
  readonly generationStatus: HelmetGenerationStatus;
  readonly imageEnhancement: boolean;
  readonly notes: string;
  readonly outputPath: string;
  readonly removeLighting: boolean;
  readonly savePreRemeshedModel: boolean;
  readonly shouldRemesh: boolean;
  readonly shouldTexture: boolean;
  readonly targetFormats: readonly ['glb'];
  readonly targetPolycount: number;
  readonly topology: 'triangle';
}

export interface HelmetGenerateOptions {
  readonly candidateId?: HelmetCandidateId;
  readonly execute: boolean;
  readonly force: boolean;
  readonly maxCandidates: number;
  readonly retryCount: number;
}

export interface HelmetGenerateSummary {
  readonly dryRun: boolean;
  readonly generatedReferences: readonly string[];
  readonly skippedReferences: readonly string[];
  readonly submittedCandidates: readonly string[];
  readonly skippedCandidates: readonly string[];
}

export interface HelmetReferenceProvenance {
  readonly assetId: string;
  readonly candidateId: HelmetCandidateId;
  readonly contentHash: string;
  readonly generatedAt: string;
  readonly model: string;
  readonly outputFormat: string;
  readonly prompt: string;
  readonly quality: string;
  readonly requestedSize: string;
  readonly revisedPrompt: string | null;
  readonly view: HelmetReferenceView;
}

export interface MeshyTaskMetadata {
  readonly candidateId: HelmetCandidateId;
  readonly createdAt: string;
  readonly creditCost: number | null;
  readonly generationRequest: MeshyMultiImageTo3DRequest;
  readonly referenceImageHashes: Record<HelmetReferenceView, string>;
  readonly referenceImagePaths: Record<HelmetReferenceView, string>;
  readonly taskId: string;
}

export interface MeshyDownloadMetadata extends MeshyTaskMetadata {
  readonly downloadedAt: string;
  readonly outputHash: string;
  readonly outputPath: string;
  readonly outputBytes: number;
  readonly taskPayload: unknown;
}

export interface MeshyMultiImageTo3DRequest {
  readonly ai_model: 'latest';
  readonly auto_size?: boolean;
  readonly enable_pbr: boolean;
  readonly hd_texture?: boolean;
  readonly image_enhancement: boolean;
  readonly image_urls: readonly string[];
  readonly multi_view_thumbnails?: boolean;
  readonly origin_at?: 'bottom' | 'center';
  readonly pose_mode?: 'a-pose' | 't-pose';
  readonly remove_lighting: boolean;
  readonly save_pre_remeshed_model: boolean;
  readonly should_remesh: boolean;
  readonly should_texture: boolean;
  readonly target_formats: readonly ['glb'];
  readonly target_polycount: number;
  readonly topology: 'triangle';
  readonly texture_prompt?: string;
}

export interface MeshyRiggingRequest {
  readonly height_meters: number;
  readonly input_task_id?: string;
  readonly model_url?: string;
}

export interface GlbAuditPrimitive {
  readonly material: string | null;
  readonly meshName: string;
  readonly triangleCount: number;
  readonly vertexCount: number;
}

export interface GlbAuditReport {
  readonly connectedComponentCount: number;
  readonly materialCount: number;
  readonly materialNames: readonly string[];
  readonly meshCount: number;
  readonly meshNames: readonly string[];
  readonly nodeNames: readonly string[];
  readonly path: string;
  readonly primitives: readonly GlbAuditPrimitive[];
  readonly shellFaceguardSeparable: boolean;
  readonly shellFaceguardSeparationReason: string;
  readonly triangleCount: number;
}

export const HELMET_SOURCE_ROOT = 'art-source/meshy/football-helmet';
export const HELMET_REFERENCE_DIR = `${HELMET_SOURCE_ROOT}/references`;
export const HELMET_GENERATED_DIR = `${HELMET_SOURCE_ROOT}/generated`;
export const HELMET_PREPARED_DIR = `${HELMET_SOURCE_ROOT}/prepared`;
export const HELMET_METADATA_DIR = `${HELMET_SOURCE_ROOT}/metadata`;
export const HELMET_PUBLIC_DIR = 'public/models/helmet';
export const HELMET_COMBINED_RUNTIME_PATH = `${HELMET_PUBLIC_DIR}/football-helmet-kit.glb`;
export const HELMET_SHELL_RUNTIME_PATH = `${HELMET_PUBLIC_DIR}/helmet-shell.glb`;
export const HELMET_FACEGUARD_RUNTIME_PATH = `${HELMET_PUBLIC_DIR}/faceguard-standard.glb`;
export const HELMET_MANIFEST_RUNTIME_PATH = `${HELMET_PUBLIC_DIR}/helmet-kit-manifest.json`;
export const HELMET_PREVIEW_PATH = `${HELMET_PUBLIC_DIR}/helmet-preview.html`;
export const HELMET_AUDIT_REPORT_PATH = `${HELMET_METADATA_DIR}/helmet-asset-report.json`;
export const MAX_HELMET_CANDIDATES_PER_EXECUTION = 2;
export const MAX_HELMET_AUTOMATIC_RETRIES = 1;

export type PlayerReferenceView = 'front' | 'right' | 'back' | 'left';
export type PlayerCandidateId = 'candidate-a' | 'candidate-b';
export type PlayerGenerationStatus = 'planned' | 'submitted' | 'downloaded' | 'rigged' | 'validated';

export interface PlayerReferenceImagePlan {
  readonly assetId: string;
  readonly candidateId: PlayerCandidateId;
  readonly model: 'gpt-image-2';
  readonly outputFormat: 'png';
  readonly outputPath: string;
  readonly prompt: string;
  readonly quality: 'high';
  readonly requestedSize: '1024x1024';
  readonly view: PlayerReferenceView;
}

export interface PlayerCandidatePlan {
  readonly aiModel: 'latest';
  readonly assetId: PlayerCandidateId;
  readonly autoSize: boolean;
  readonly enablePbr: boolean;
  readonly generationStatus: PlayerGenerationStatus;
  readonly hdTexture: boolean;
  readonly imageEnhancement: boolean;
  readonly multiViewThumbnails: boolean;
  readonly notes: string;
  readonly originAt: 'bottom';
  readonly outputPath: string;
  readonly poseMode: 'a-pose';
  readonly removeLighting: boolean;
  readonly riggedFbxOutputPath: string;
  readonly riggedGlbOutputPath: string;
  readonly shouldRemesh: boolean;
  readonly shouldTexture: boolean;
  readonly targetFormats: readonly ['glb'];
  readonly targetPolycount: number;
  readonly texturePrompt: string;
  readonly topology: 'triangle';
}

export interface PlayerGenerateOptions {
  readonly candidateId?: PlayerCandidateId;
  readonly execute: boolean;
  readonly force: boolean;
  readonly maxCandidates: number;
  readonly retryCount: number;
}

export interface PlayerGenerateSummary {
  readonly dryRun: boolean;
  readonly generatedReferences: readonly string[];
  readonly skippedCandidates: readonly string[];
  readonly skippedReferences: readonly string[];
  readonly submittedCandidates: readonly string[];
}

export interface PlayerDownloadSummary {
  readonly downloaded: readonly string[];
  readonly downloadedThumbnails: readonly string[];
  readonly dryRun: boolean;
  readonly missingTasks: readonly string[];
  readonly skipped: readonly string[];
}

export interface PlayerRigSummary {
  readonly dryRun: boolean;
  readonly missingCandidates: readonly string[];
  readonly rigged: readonly string[];
  readonly skipped: readonly string[];
  readonly submitted: readonly string[];
}

export interface PlayerReferenceProvenance {
  readonly assetId: string;
  readonly candidateId: PlayerCandidateId;
  readonly contentHash: string;
  readonly generatedAt: string;
  readonly model: string;
  readonly outputFormat: string;
  readonly prompt: string;
  readonly quality: string;
  readonly requestedSize: string;
  readonly revisedPrompt: string | null;
  readonly view: PlayerReferenceView;
}

export interface PlayerMeshyTaskMetadata {
  readonly candidateId: PlayerCandidateId;
  readonly createdAt: string;
  readonly creditCost: number | null;
  readonly generationRequest: MeshyMultiImageTo3DRequest;
  readonly referenceImageHashes: Record<PlayerReferenceView, string>;
  readonly referenceImagePaths: Record<PlayerReferenceView, string>;
  readonly taskId: string;
}

export interface PlayerMeshyDownloadMetadata extends PlayerMeshyTaskMetadata {
  readonly downloadedAt: string;
  readonly outputBytes: number;
  readonly outputHash: string;
  readonly outputPath: string;
  readonly taskPayload: unknown;
  readonly thumbnailPaths: readonly string[];
}

export interface PlayerRiggingTaskMetadata {
  readonly candidateId: PlayerCandidateId;
  readonly createdAt: string;
  readonly creditCost: number | null;
  readonly generatedGlbHash: string;
  readonly generatedGlbPath: string;
  readonly riggingRequest: MeshyRiggingRequest;
  readonly taskId: string;
}

export interface PlayerRiggingDownloadMetadata extends PlayerRiggingTaskMetadata {
  readonly animationPaths: readonly string[];
  readonly downloadedAt: string;
  readonly fbxOutputBytes: number | null;
  readonly fbxOutputHash: string | null;
  readonly fbxOutputPath: string | null;
  readonly glbOutputBytes: number;
  readonly glbOutputHash: string;
  readonly glbOutputPath: string;
  readonly taskPayload: unknown;
}

export const PLAYER_SOURCE_ROOT = 'art-source/meshy/player-base';
export const PLAYER_REFERENCE_DIR = `${PLAYER_SOURCE_ROOT}/references`;
export const PLAYER_GENERATED_DIR = `${PLAYER_SOURCE_ROOT}/generated`;
export const PLAYER_RIGGED_DIR = `${PLAYER_SOURCE_ROOT}/rigged`;
export const PLAYER_METADATA_DIR = `${PLAYER_SOURCE_ROOT}/metadata`;
export const PLAYER_ASSET_REPORT_PATH = `${PLAYER_METADATA_DIR}/player-asset-report.json`;
export const PLAYER_VIEWER_PATH = `${PLAYER_METADATA_DIR}/player-candidate-viewer.html`;
export const MAX_PLAYER_CANDIDATES_PER_EXECUTION = 2;
export const DEFAULT_PLAYER_CANDIDATES_PER_EXECUTION = 1;
export const MAX_PLAYER_AUTOMATIC_RETRIES = 1;

const REQUIRED_REFERENCE_VIEWS: readonly HelmetReferenceView[] = ['front', 'right', 'back', 'left'];

export function assertValidHelmetPlan(
  references: readonly HelmetReferenceImagePlan[],
  candidates: readonly HelmetCandidatePlan[],
): void {
  const errors = validateHelmetPlan(references, candidates);

  if (errors.length > 0) {
    throw new Error(`Invalid helmet generation plan:\n${errors.join('\n')}`);
  }
}

export function validateHelmetPlan(
  references: readonly HelmetReferenceImagePlan[],
  candidates: readonly HelmetCandidatePlan[],
): string[] {
  const errors: string[] = [];
  const referenceIds = new Set<string>();
  const candidateIds = new Set<HelmetCandidateId>();

  if (candidates.length !== 2) {
    errors.push(`Expected exactly 2 helmet candidates, found ${candidates.length}`);
  }

  for (const candidate of candidates) {
    candidateIds.add(candidate.assetId);
    if (candidate.targetPolycount < 7000 || candidate.targetPolycount > 8000) {
      errors.push(`${candidate.assetId}: targetPolycount should be in the 7000-8000 preferred budget`);
    }
    if (candidate.outputPath !== `${HELMET_GENERATED_DIR}/${candidate.assetId}.glb`) {
      errors.push(`${candidate.assetId}: outputPath must use ${HELMET_GENERATED_DIR}/${candidate.assetId}.glb`);
    }
    if (candidate.shouldTexture || candidate.enablePbr) {
      errors.push(`${candidate.assetId}: shouldTexture and enablePbr must be false`);
    }
    if (!candidate.shouldRemesh || candidate.topology !== 'triangle') {
      errors.push(`${candidate.assetId}: must request triangle remesh`);
    }
    if (candidate.targetFormats.length !== 1 || candidate.targetFormats[0] !== 'glb') {
      errors.push(`${candidate.assetId}: targetFormats must be ['glb']`);
    }
  }

  for (const reference of references) {
    if (referenceIds.has(reference.assetId)) {
      errors.push(`${reference.assetId}: duplicate reference asset ID`);
    }
    referenceIds.add(reference.assetId);
    if (!candidateIds.has(reference.candidateId)) {
      errors.push(`${reference.assetId}: unknown candidate ID ${reference.candidateId}`);
    }
    if (reference.model !== 'gpt-image-2') {
      errors.push(`${reference.assetId}: model must be gpt-image-2`);
    }
    if (reference.outputFormat !== 'webp') {
      errors.push(`${reference.assetId}: outputFormat must be webp`);
    }
    if (reference.quality !== 'high') {
      errors.push(`${reference.assetId}: quality must be high`);
    }
    if (reference.requestedSize !== '1024x1024') {
      errors.push(`${reference.assetId}: requestedSize must be 1024x1024`);
    }
    if (!REQUIRED_REFERENCE_VIEWS.includes(reference.view)) {
      errors.push(`${reference.assetId}: invalid view ${reference.view}`);
    }
    if (!reference.prompt.trim()) {
      errors.push(`${reference.assetId}: prompt is required`);
    }
    if (!/\b(no|do not include)\b.*\b(logo|letter|number|text|word|watermark)/i.test(reference.prompt)) {
      errors.push(`${reference.assetId}: prompt must explicitly prohibit text/logos/watermarks`);
    }
    errors.push(...validateHelmetReferenceOutputPath(reference));
  }

  for (const candidate of candidates) {
    const views = new Set(
      references
        .filter((reference) => reference.candidateId === candidate.assetId)
        .map((reference) => reference.view),
    );
    for (const view of REQUIRED_REFERENCE_VIEWS) {
      if (!views.has(view)) {
        errors.push(`${candidate.assetId}: missing ${view} reference`);
      }
    }
  }

  return errors;
}

export function validateHelmetReferenceOutputPath(asset: HelmetReferenceImagePlan): string[] {
  const errors: string[] = [];
  const normalizedPath = normalizePathForManifest(asset.outputPath);
  const expectedPrefix = `${HELMET_REFERENCE_DIR}/${asset.candidateId}-`;

  if (isAbsolute(asset.outputPath)) {
    errors.push(`${asset.assetId}: outputPath must be repository-relative`);
  }
  if (normalizedPath.includes('..')) {
    errors.push(`${asset.assetId}: outputPath must not contain parent traversal`);
  }
  if (!normalizedPath.startsWith(expectedPrefix)) {
    errors.push(`${asset.assetId}: outputPath must stay under ${HELMET_REFERENCE_DIR}`);
  }
  if (extname(normalizedPath) !== '.webp') {
    errors.push(`${asset.assetId}: outputPath must use .webp`);
  }

  return errors;
}

export function assertValidPlayerPlan(
  references: readonly PlayerReferenceImagePlan[],
  candidates: readonly PlayerCandidatePlan[],
): void {
  const errors = validatePlayerPlan(references, candidates);

  if (errors.length > 0) {
    throw new Error(`Invalid player generation plan:\n${errors.join('\n')}`);
  }
}

export function validatePlayerPlan(
  references: readonly PlayerReferenceImagePlan[],
  candidates: readonly PlayerCandidatePlan[],
): string[] {
  const errors: string[] = [];
  const referenceIds = new Set<string>();
  const candidateIds = new Set<PlayerCandidateId>();

  if (candidates.length < 1 || candidates.length > MAX_PLAYER_CANDIDATES_PER_EXECUTION) {
    errors.push(`Expected 1-${MAX_PLAYER_CANDIDATES_PER_EXECUTION} player candidates, found ${candidates.length}`);
  }

  for (const candidate of candidates) {
    candidateIds.add(candidate.assetId);
    if (candidate.targetPolycount !== 7000) {
      errors.push(`${candidate.assetId}: targetPolycount must be the requested 7000`);
    }
    if (candidate.outputPath !== `${PLAYER_GENERATED_DIR}/${candidate.assetId}.glb`) {
      errors.push(`${candidate.assetId}: outputPath must use ${PLAYER_GENERATED_DIR}/${candidate.assetId}.glb`);
    }
    if (candidate.riggedGlbOutputPath !== `${PLAYER_RIGGED_DIR}/${candidate.assetId}.glb`) {
      errors.push(`${candidate.assetId}: rigged GLB path must use ${PLAYER_RIGGED_DIR}/${candidate.assetId}.glb`);
    }
    if (candidate.riggedFbxOutputPath !== `${PLAYER_RIGGED_DIR}/${candidate.assetId}.fbx`) {
      errors.push(`${candidate.assetId}: rigged FBX path must use ${PLAYER_RIGGED_DIR}/${candidate.assetId}.fbx`);
    }
    if (!candidate.shouldTexture || candidate.enablePbr || candidate.hdTexture) {
      errors.push(`${candidate.assetId}: player request must use texture, disable PBR, and disable HD textures`);
    }
    if (!candidate.shouldRemesh || candidate.topology !== 'triangle') {
      errors.push(`${candidate.assetId}: must request triangle remesh`);
    }
    if (!candidate.autoSize || candidate.originAt !== 'bottom' || candidate.poseMode !== 'a-pose') {
      errors.push(`${candidate.assetId}: must request auto_size, bottom origin, and a-pose`);
    }
    if (candidate.targetFormats.length !== 1 || candidate.targetFormats[0] !== 'glb') {
      errors.push(`${candidate.assetId}: targetFormats must be ['glb']`);
    }
    if (!candidate.texturePrompt.trim()) {
      errors.push(`${candidate.assetId}: texturePrompt is required`);
    }
  }

  for (const reference of references) {
    if (referenceIds.has(reference.assetId)) {
      errors.push(`${reference.assetId}: duplicate reference asset ID`);
    }
    referenceIds.add(reference.assetId);
    if (!candidateIds.has(reference.candidateId)) {
      errors.push(`${reference.assetId}: unknown candidate ID ${reference.candidateId}`);
    }
    if (reference.model !== 'gpt-image-2') {
      errors.push(`${reference.assetId}: model must be gpt-image-2`);
    }
    if (reference.outputFormat !== 'png') {
      errors.push(`${reference.assetId}: outputFormat must be png for Meshy multi-image input`);
    }
    if (reference.quality !== 'high') {
      errors.push(`${reference.assetId}: quality must be high`);
    }
    if (reference.requestedSize !== '1024x1024') {
      errors.push(`${reference.assetId}: requestedSize must be 1024x1024`);
    }
    if (!REQUIRED_REFERENCE_VIEWS.includes(reference.view)) {
      errors.push(`${reference.assetId}: invalid view ${reference.view}`);
    }
    if (!reference.prompt.trim()) {
      errors.push(`${reference.assetId}: prompt is required`);
    }
    if (!/\b(no|do not include)\b.*\b(logo|letter|number|text|word|watermark)/i.test(reference.prompt)) {
      errors.push(`${reference.assetId}: prompt must explicitly prohibit text/logos/watermarks`);
    }
    errors.push(...validatePlayerReferenceOutputPath(reference));
  }

  for (const candidate of candidates) {
    const views = new Set(
      references
        .filter((reference) => reference.candidateId === candidate.assetId)
        .map((reference) => reference.view),
    );
    for (const view of REQUIRED_REFERENCE_VIEWS) {
      if (!views.has(view)) {
        errors.push(`${candidate.assetId}: missing ${view} reference`);
      }
    }
  }

  return errors;
}

export function validatePlayerReferenceOutputPath(asset: PlayerReferenceImagePlan): string[] {
  const errors: string[] = [];
  const normalizedPath = normalizePathForManifest(asset.outputPath);
  const expectedPrefix = `${PLAYER_REFERENCE_DIR}/${asset.candidateId}-`;

  if (isAbsolute(asset.outputPath)) {
    errors.push(`${asset.assetId}: outputPath must be repository-relative`);
  }
  if (normalizedPath.includes('..')) {
    errors.push(`${asset.assetId}: outputPath must not contain parent traversal`);
  }
  if (!normalizedPath.startsWith(expectedPrefix)) {
    errors.push(`${asset.assetId}: outputPath must stay under ${PLAYER_REFERENCE_DIR}`);
  }
  if (extname(normalizedPath) !== '.png') {
    errors.push(`${asset.assetId}: outputPath must use .png`);
  }

  return errors;
}

export function parseHelmetGenerateOptions(args: readonly string[]): HelmetGenerateOptions {
  let candidateId: HelmetCandidateId | undefined;
  let maxCandidates = readPositiveInteger(process.env.npm_config_max_candidates, MAX_HELMET_CANDIDATES_PER_EXECUTION);

  for (const arg of args) {
    if (arg.startsWith('--candidate=')) {
      candidateId = parseHelmetCandidateId(arg.slice('--candidate='.length));
    } else if (arg.startsWith('--max-candidates=')) {
      maxCandidates = readPositiveInteger(arg.slice('--max-candidates='.length), MAX_HELMET_CANDIDATES_PER_EXECUTION);
    }
  }

  if (process.env.npm_config_candidate) {
    candidateId = parseHelmetCandidateId(process.env.npm_config_candidate);
  }

  if (maxCandidates > MAX_HELMET_CANDIDATES_PER_EXECUTION) {
    throw new Error(`Helmet generation is capped at ${MAX_HELMET_CANDIDATES_PER_EXECUTION} candidates per execution.`);
  }

  return {
    candidateId,
    execute: args.includes('--execute') || readCliBoolean(process.env.npm_config_execute),
    force: args.includes('--force') || readCliBoolean(process.env.npm_config_force),
    maxCandidates,
    retryCount: MAX_HELMET_AUTOMATIC_RETRIES,
  };
}

export function parsePlayerGenerateOptions(args: readonly string[]): PlayerGenerateOptions {
  let candidateId: PlayerCandidateId | undefined;
  let maxCandidates = readPositiveInteger(
    process.env.npm_config_max_candidates,
    DEFAULT_PLAYER_CANDIDATES_PER_EXECUTION,
  );

  for (const arg of args) {
    if (arg.startsWith('--candidate=')) {
      candidateId = parsePlayerCandidateId(arg.slice('--candidate='.length));
    } else if (arg.startsWith('--max-candidates=')) {
      maxCandidates = readPositiveInteger(arg.slice('--max-candidates='.length), DEFAULT_PLAYER_CANDIDATES_PER_EXECUTION);
    }
  }

  if (process.env.npm_config_candidate) {
    candidateId = parsePlayerCandidateId(process.env.npm_config_candidate);
  }

  if (maxCandidates > MAX_PLAYER_CANDIDATES_PER_EXECUTION) {
    throw new Error(`Player generation is capped at ${MAX_PLAYER_CANDIDATES_PER_EXECUTION} candidates per execution.`);
  }

  return {
    candidateId,
    execute: args.includes('--execute') || readCliBoolean(process.env.npm_config_execute),
    force: args.includes('--force') || readCliBoolean(process.env.npm_config_force),
    maxCandidates,
    retryCount: MAX_PLAYER_AUTOMATIC_RETRIES,
  };
}

export function parseHelmetCandidateId(value: string): HelmetCandidateId {
  if (value === 'candidate-a' || value === 'candidate-b') {
    return value;
  }
  throw new Error(`Unknown helmet candidate ${value}`);
}

export function parsePlayerCandidateId(value: string): PlayerCandidateId {
  if (value === 'candidate-a' || value === 'candidate-b') {
    return value;
  }
  throw new Error(`Unknown player candidate ${value}`);
}

export function selectHelmetCandidates(
  candidates: readonly HelmetCandidatePlan[],
  options: HelmetGenerateOptions,
): HelmetCandidatePlan[] {
  return candidates
    .filter((candidate) => !options.candidateId || candidate.assetId === options.candidateId)
    .slice(0, options.maxCandidates);
}

export function selectPlayerCandidates(
  candidates: readonly PlayerCandidatePlan[],
  options: PlayerGenerateOptions,
): PlayerCandidatePlan[] {
  return candidates
    .filter((candidate) => !options.candidateId || candidate.assetId === options.candidateId)
    .slice(0, options.maxCandidates);
}

export function referenceOutputExists(asset: HelmetReferenceImagePlan): boolean {
  return existsSync(resolveRepoPath(asset.outputPath)) || existsSync(resolveRepoPath(`${asset.outputPath}.json`));
}

export function playerReferenceOutputExists(asset: PlayerReferenceImagePlan): boolean {
  return existsSync(resolveRepoPath(asset.outputPath)) || existsSync(resolveRepoPath(`${asset.outputPath}.json`));
}

export function assertCanWriteHelmetPath(relativePath: string, force: boolean): void {
  const absolutePath = resolveRepoPath(relativePath);
  const normalizedPath = normalizePathForManifest(relativePath);
  const allowedRoots = [
    `${HELMET_REFERENCE_DIR}/`,
    `${HELMET_GENERATED_DIR}/`,
    `${HELMET_PREPARED_DIR}/`,
    `${HELMET_METADATA_DIR}/`,
    `${HELMET_PUBLIC_DIR}/`,
  ];

  if (isAbsolute(relativePath) || normalizedPath.includes('..')) {
    throw new Error(`Refusing unsafe output path ${relativePath}`);
  }
  if (!allowedRoots.some((root) => normalizedPath.startsWith(root))) {
    throw new Error(`Refusing to write helmet asset outside approved directories: ${relativePath}`);
  }
  if (!force && existsSync(absolutePath)) {
    throw new Error(`${relativePath} already exists. Pass --force to overwrite.`);
  }
}

export function assertCanWritePlayerPath(relativePath: string, force: boolean): void {
  const absolutePath = resolveRepoPath(relativePath);
  const normalizedPath = normalizePathForManifest(relativePath);
  const allowedRoots = [
    `${PLAYER_REFERENCE_DIR}/`,
    `${PLAYER_GENERATED_DIR}/`,
    `${PLAYER_RIGGED_DIR}/`,
    `${PLAYER_METADATA_DIR}/`,
  ];

  if (isAbsolute(relativePath) || normalizedPath.includes('..')) {
    throw new Error(`Refusing unsafe output path ${relativePath}`);
  }
  if (!allowedRoots.some((root) => normalizedPath.startsWith(root))) {
    throw new Error(`Refusing to write player asset outside approved directories: ${relativePath}`);
  }
  if (!force && existsSync(absolutePath)) {
    throw new Error(`${relativePath} already exists. Pass --force to overwrite.`);
  }
}

export function writeHelmetReferenceProvenance(
  asset: HelmetReferenceImagePlan,
  content: Uint8Array,
  metadata: Pick<HelmetReferenceProvenance, 'revisedPrompt'>,
): void {
  writeJsonFile(resolveRepoPath(`${asset.outputPath}.json`), {
    assetId: asset.assetId,
    candidateId: asset.candidateId,
    contentHash: hashBytes(content),
    generatedAt: new Date().toISOString(),
    model: asset.model,
    outputFormat: asset.outputFormat,
    prompt: asset.prompt,
    quality: asset.quality,
    requestedSize: asset.requestedSize,
    revisedPrompt: metadata.revisedPrompt,
    view: asset.view,
  } satisfies HelmetReferenceProvenance);
}

export function writePlayerReferenceProvenance(
  asset: PlayerReferenceImagePlan,
  content: Uint8Array,
  metadata: Pick<PlayerReferenceProvenance, 'revisedPrompt'>,
): void {
  writeJsonFile(resolveRepoPath(`${asset.outputPath}.json`), {
    assetId: asset.assetId,
    candidateId: asset.candidateId,
    contentHash: hashBytes(content),
    generatedAt: new Date().toISOString(),
    model: asset.model,
    outputFormat: asset.outputFormat,
    prompt: asset.prompt,
    quality: asset.quality,
    requestedSize: asset.requestedSize,
    revisedPrompt: metadata.revisedPrompt,
    view: asset.view,
  } satisfies PlayerReferenceProvenance);
}

export function writeBinaryFile(relativePath: string, content: Uint8Array): void {
  const absolutePath = resolveRepoPath(relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
}

export function writeJsonFile(absolutePath: string, value: unknown): void {
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function readJsonFile<T>(relativePath: string): T {
  return JSON.parse(readFileSync(resolveRepoPath(relativePath), 'utf8')) as T;
}

export function requireMeshyApiKey(): string {
  const envKey = process.env.MESHY_API_KEY?.trim();
  const envFileKey = readEnvFileValue(resolveRepoPath('.env'), 'MESHY_API_KEY');
  const localKey = readFirstExistingKeyFile([
    resolve(process.cwd(), '..', 'meshy-api-key.txt'),
    resolve(process.cwd(), 'meshy-api-key.txt'),
  ]);
  const apiKey = envKey || envFileKey || localKey;

  if (!apiKey) {
    throw new Error(
      'Missing MESHY_API_KEY. Add it to a local .env file, shell environment, or local key file; never expose it to browser code.',
    );
  }

  return apiKey;
}

export function resolveRepoPath(relativePath: string): string {
  return resolve(process.cwd(), normalizePathForManifest(relativePath));
}

export function normalizePathForManifest(path: string): string {
  return normalize(path).replace(/\\/g, '/');
}

export function getFileHash(relativePath: string): string {
  return hashBytes(readFileSync(resolveRepoPath(relativePath)));
}

export function getFileSize(relativePath: string): number {
  return statSync(resolveRepoPath(relativePath)).size;
}

export function hashBytes(content: Uint8Array): string {
  return createHash('sha256').update(content).digest('hex');
}

export function toDataUri(relativePath: string, mimeType: string): string {
  const content = readFileSync(resolveRepoPath(relativePath));
  return `data:${mimeType};base64,${content.toString('base64')}`;
}

export async function withSingleRetry<T>(retryCount: number, action: () => Promise<T>): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await action();
    } catch (error) {
      if (attempt >= retryCount) {
        throw error;
      }
      attempt += 1;
    }
  }
}

export function isDirectCli(importMetaUrl: string): boolean {
  return process.argv[1] ? fileURLToPath(importMetaUrl) === resolve(process.argv[1]) : false;
}

function readFirstExistingKeyFile(paths: readonly string[]): string | null {
  for (const path of paths) {
    if (!existsSync(path)) {
      continue;
    }
    const value = readFileSync(path, 'utf8').trim();
    if (value) {
      return stripEnvQuotes(value);
    }
  }
  return null;
}

function readEnvFileValue(path: string, key: string): string | null {
  if (!existsSync(path)) {
    return null;
  }
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }
    if (trimmed.slice(0, separatorIndex).trim() === key) {
      return stripEnvQuotes(trimmed.slice(separatorIndex + 1).trim());
    }
  }
  return null;
}

function stripEnvQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, '');
}

function readCliBoolean(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
