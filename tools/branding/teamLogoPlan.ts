import { listTeamProfiles } from '../../src/teams/TeamRegistry';
import {
  isDirectCli,
  normalizePathForManifest,
  validateBrandImageSize,
} from './schemas';

export type TeamLogoCandidateId = 'candidate-a' | 'candidate-b';

export interface TeamLogoAssetPlan {
  readonly assetId: string;
  readonly background: 'opaque';
  readonly candidateId: TeamLogoCandidateId;
  readonly generationStatus: 'planned' | 'selected';
  readonly model: 'gpt-image-2';
  readonly notes: string;
  readonly outputFormat: 'webp';
  readonly outputPath: string;
  readonly prompt: string;
  readonly quality: 'high';
  readonly requestedSize: '1024x1024';
  readonly teamId: string;
}

interface TeamLogoDirection {
  readonly subject: string;
  readonly styleA: string;
  readonly styleB: string;
}

const TEAM_LOGO_DIRECTIONS: Record<string, TeamLogoDirection> = {
  'bay-city-current': {
    subject: 'a stylized ocean wave fused with a bright electric current zigzag, energetic but clean',
    styleA: 'bold teal wave crest with a gold electric-current accent and crisp white highlights',
    styleB: 'contained circular current swirl with a lightning-like gold path through teal water geometry',
  },
  'desert-ridge-scorpions': {
    subject: 'a sharp geometric scorpion with a raised tail and strong desert-ridge silhouette',
    styleA: 'deep purple scorpion mark with old-gold armor highlights and cream negative-space cuts',
    styleB: 'angular scorpion badge with a coiled tail, ridge-line geometry, and polished gold accent edges',
  },
  'ironwood-owls': {
    subject: 'a strong low-poly owl head with focused copper eyes and ironwood-inspired angular feather shapes',
    styleA: 'navy owl head with cream facial planes and copper eyes, symmetrical and intimidating',
    styleB: 'compact owl shield mark with ironwood feather facets, copper eye glow, and cream contrast planes',
  },
  'lakefront-lights': {
    subject: 'a geometric lighthouse with a sweeping light beam over simplified lakefront lines',
    styleA: 'crimson lighthouse silhouette with white light beam and charcoal shadow geometry',
    styleB: 'modern lighthouse badge with diagonal light rays, lake ripple motif, and restrained crimson field',
  },
  'metro-meteors': {
    subject: 'an angular meteor streak with faceted motion trails, fast and modern',
    styleA: 'blue meteor core with white-hot leading edge and pale-blue speed trails',
    styleB: 'compact meteor badge with a diagonal streak, faceted star fragments, and broadcast-sports polish',
  },
  'summit-forge': {
    subject: 'an anvil and forge-flame or sparks motif with mountain-summit geometry',
    styleA: 'forest-green anvil silhouette with old-gold sparks and cream negative space',
    styleB: 'angular forge flame rising behind an anvil, framed by subtle summit peak geometry',
  },
};

const SHARED_LOGO_DIRECTION = [
  'Create an original fictional American-football team logo badge for Football JS.',
  'Use a centered square composition suitable for a menu badge and scorebug crop.',
  'Style: bold low-poly vector-like sports identity, clean silhouette, premium broadcast-game presentation, opaque background.',
  'No words, no text, no letters, no numbers, no watermark, no real professional or college marks, no league logos, no trademarked mascots.',
].join(' ');

export const FOOTBALL_JS_TEAM_LOGO_ASSET_PLAN: readonly TeamLogoAssetPlan[] = listTeamProfiles()
  .flatMap((team) => {
    const direction = TEAM_LOGO_DIRECTIONS[team.id];
    const colors = `Team colors: primary ${team.colors.primary}, secondary ${team.colors.secondary}, accent ${team.colors.accent}.`;

    if (!direction) {
      return [];
    }

    return (['candidate-a', 'candidate-b'] as const).map((candidateId): TeamLogoAssetPlan => {
      const style = candidateId === 'candidate-a' ? direction.styleA : direction.styleB;
      const suffix = candidateId === 'candidate-a' ? 'a' : 'b';

      return {
        assetId: `${team.id}-logo-${suffix}`,
        background: 'opaque',
        candidateId,
        generationStatus: 'planned',
        model: 'gpt-image-2',
        notes: `${team.displayName} logo ${candidateId}: ${style}`,
        outputFormat: 'webp',
        outputPath: `public/branding/teams/${team.id}/${candidateId}.webp`,
        prompt: [
          SHARED_LOGO_DIRECTION,
          `Team: ${team.displayName}.`,
          `Mascot concept: ${direction.subject}.`,
          colors,
          `Candidate direction: ${style}.`,
          'Keep the badge readable at small UI sizes, avoid complex fine detail, preserve crop-safe margins.',
        ].join(' '),
        quality: 'high',
        requestedSize: '1024x1024',
        teamId: team.id,
      };
    });
  }) as readonly TeamLogoAssetPlan[];

export function validateFootballJsTeamLogoPlan(
  plan: readonly TeamLogoAssetPlan[] = FOOTBALL_JS_TEAM_LOGO_ASSET_PLAN,
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const teams = listTeamProfiles();

  if (teams.length !== 6) {
    errors.push(`Expected exactly 6 league teams, found ${teams.length}`);
  }
  if (plan.length !== teams.length * 2) {
    errors.push(`Expected exactly ${teams.length * 2} planned team logo images, found ${plan.length}`);
  }

  for (const asset of plan) {
    if (ids.has(asset.assetId)) {
      errors.push(`${asset.assetId}: duplicate asset ID`);
    }
    ids.add(asset.assetId);

    if (!/^[a-z0-9][a-z0-9_-]*$/.test(asset.assetId)) {
      errors.push(`${asset.assetId}: assetId must be stable lowercase with hyphen or underscore separators`);
    }
    if (!teams.some((team) => team.id === asset.teamId)) {
      errors.push(`${asset.assetId}: unknown team ID ${asset.teamId}`);
    }
    if (asset.model !== 'gpt-image-2') {
      errors.push(`${asset.assetId}: model must be gpt-image-2`);
    }
    if (asset.requestedSize !== '1024x1024') {
      errors.push(`${asset.assetId}: requestedSize must be 1024x1024`);
    }
    if (asset.quality !== 'high') {
      errors.push(`${asset.assetId}: quality must be high`);
    }
    if (asset.outputFormat !== 'webp') {
      errors.push(`${asset.assetId}: outputFormat must be webp`);
    }
    if (asset.background !== 'opaque') {
      errors.push(`${asset.assetId}: background must be opaque`);
    }
    if (!asset.prompt.trim()) {
      errors.push(`${asset.assetId}: prompt is required`);
    }
    if (!/\b(no|avoid)\b.*\b(words|text|letters|numbers|watermark|logos|marks)/i.test(asset.prompt)) {
      errors.push(`${asset.assetId}: prompt must explicitly prohibit text/logos/watermarks`);
    }

    errors.push(...validateTeamLogoOutputPath(asset));
    errors.push(...validateBrandImageSize({
      assetId: asset.assetId,
      category: 'emblem',
      generationStatus: asset.generationStatus,
      model: asset.model,
      outputFormat: asset.outputFormat,
      outputPath: asset.outputPath,
      prompt: asset.prompt,
      provisionalApproval: 'needsReview',
      quality: asset.quality,
      requestedSize: asset.requestedSize,
    }));
  }

  for (const team of teams) {
    const teamAssets = plan.filter((asset) => asset.teamId === team.id);
    if (teamAssets.length !== 2) {
      errors.push(`${team.id}: expected exactly 2 logo candidates`);
    }
    for (const candidateId of ['candidate-a', 'candidate-b'] as const) {
      if (teamAssets.filter((asset) => asset.candidateId === candidateId).length !== 1) {
        errors.push(`${team.id}: expected one ${candidateId} logo candidate`);
      }
    }
  }

  return errors;
}

export function assertValidFootballJsTeamLogoPlan(
  plan: readonly TeamLogoAssetPlan[] = FOOTBALL_JS_TEAM_LOGO_ASSET_PLAN,
): void {
  const errors = validateFootballJsTeamLogoPlan(plan);

  if (errors.length > 0) {
    throw new Error(`Invalid team logo asset plan:\n${errors.join('\n')}`);
  }
}

export function validateTeamLogoOutputPath(asset: TeamLogoAssetPlan): string[] {
  const errors: string[] = [];
  const normalizedPath = normalizePathForManifest(asset.outputPath);
  const expectedRoot = `public/branding/teams/${asset.teamId}/`;

  if (normalizedPath.includes('..')) {
    errors.push(`${asset.assetId}: outputPath must not contain parent traversal`);
  }
  if (!normalizedPath.startsWith(expectedRoot)) {
    errors.push(`${asset.assetId}: outputPath must stay under ${expectedRoot}`);
  }
  if (!normalizedPath.endsWith('.webp')) {
    errors.push(`${asset.assetId}: outputPath must use .webp`);
  }

  return errors;
}

if (isDirectCli(import.meta.url)) {
  const validationErrors = validateFootballJsTeamLogoPlan();
  console.log(
    JSON.stringify(
      {
        assetCount: FOOTBALL_JS_TEAM_LOGO_ASSET_PLAN.length,
        assets: FOOTBALL_JS_TEAM_LOGO_ASSET_PLAN,
        validationErrors,
      },
      null,
      2,
    ),
  );
  if (validationErrors.length > 0) {
    process.exitCode = 1;
  }
}
