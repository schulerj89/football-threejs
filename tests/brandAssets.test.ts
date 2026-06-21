import { Buffer } from 'node:buffer';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  FOOTBALL_JS_BRAND_ASSET_PLAN,
  validateFootballJsBrandAssetPlan,
} from '../tools/branding/brandAssetPlan';
import {
  createBrandAssetReport,
  selectBrandAssets,
  writeBrandAssetReportFiles,
} from '../tools/branding/brandAssetReport';
import { generateBrandImages } from '../tools/branding/generateBrandImages';
import {
  BRAND_GALLERY_PATH,
  BRAND_REPORT_PATH,
  BRAND_SELECTION_PATH,
  FOOTBALL_JS_EMBLEM_RUNTIME_PATH,
  FOOTBALL_JS_TITLE_RUNTIME_PATH,
  assertCanWriteBrandAsset,
  findBrowserOpenAISecretReferences,
  requireOpenAIApiKey,
  validateBrandAssetPlan,
  type BrandGenerateOptions,
} from '../tools/branding/schemas';
import { GAME_BRAND } from '../src/config/GameBrand';

const ORIGINAL_CWD = process.cwd();
const ORIGINAL_OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const DEFAULT_GENERATE_OPTIONS: BrandGenerateOptions = {
  execute: false,
  force: false,
  maxFiles: 2,
  retryCount: 1,
};

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
  if (ORIGINAL_OPENAI_API_KEY === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = ORIGINAL_OPENAI_API_KEY;
  }
});

describe('Football JS brand asset pipeline', () => {
  it('defines the official in-game brand through a central config', () => {
    expect(GAME_BRAND).toMatchObject({
      announcerName: 'Gridiron Local Prototype Announcer',
      emblemImageUrl: '/branding/football-js-emblem.webp',
      heroImageUrl: '/branding/football-js-title.webp',
      shortTitle: 'Football JS',
      title: 'Football JS',
    });
  });

  it('validates the typed GPT Image 2 brand generation plan', () => {
    expect(validateFootballJsBrandAssetPlan()).toEqual([]);
    expect(validateBrandAssetPlan(FOOTBALL_JS_BRAND_ASSET_PLAN)).toEqual([]);
    expect(FOOTBALL_JS_BRAND_ASSET_PLAN).toHaveLength(4);
    expect(FOOTBALL_JS_BRAND_ASSET_PLAN.filter((asset) => asset.category === 'title')).toHaveLength(2);
    expect(FOOTBALL_JS_BRAND_ASSET_PLAN.filter((asset) => asset.category === 'emblem')).toHaveLength(2);
    expect(FOOTBALL_JS_BRAND_ASSET_PLAN.every((asset) => asset.model === 'gpt-image-2')).toBe(true);
    expect(FOOTBALL_JS_BRAND_ASSET_PLAN.every((asset) => asset.quality === 'high')).toBe(true);
    expect(FOOTBALL_JS_BRAND_ASSET_PLAN.every((asset) => asset.outputFormat === 'webp')).toBe(true);
  });

  it('rejects invalid output paths before generation', () => {
    const invalidPlan = [
      {
        ...FOOTBALL_JS_BRAND_ASSET_PLAN[0],
        outputPath: '../public/branding/title/escape.webp',
      },
      ...FOOTBALL_JS_BRAND_ASSET_PLAN.slice(1),
    ];

    expect(validateBrandAssetPlan(invalidPlan)).toContain(
      'football-js-title-01: outputPath must not contain parent traversal',
    );
  });

  it('fails paid execution when OPENAI_API_KEY is missing', async () => {
    await withTemporaryCwd(async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(
        generateBrandImages(FOOTBALL_JS_BRAND_ASSET_PLAN, {
          ...DEFAULT_GENERATE_OPTIONS,
          execute: true,
          maxFiles: 1,
        }),
      ).rejects.toThrow(/Missing OPENAI_API_KEY/);
    });
  });

  it('keeps dry-run generation from making an API request or writing files', async () => {
    await withTemporaryCwd(async (cwd) => {
      let requestCalled = false;
      const summary = await generateBrandImages(
        FOOTBALL_JS_BRAND_ASSET_PLAN,
        DEFAULT_GENERATE_OPTIONS,
        {
          requestImage: async () => {
            requestCalled = true;
            throw new Error('dry-run should not request images');
          },
        },
      );

      expect(summary).toEqual({
        dryRun: true,
        generated: [],
        skipped: ['football-js-title-01', 'football-js-title-02'],
      });
      expect(requestCalled).toBe(false);
      expect(existsSync(join(cwd, 'public/branding/title/football-js-title-01.webp'))).toBe(false);
    });
  });

  it('skips existing generated files unless force is supplied', async () => {
    await withTemporaryCwd(async (cwd) => {
      process.env.OPENAI_API_KEY = 'test-key';
      const existingPath = join(cwd, 'public/branding/title/football-js-title-01.webp');
      mkdirSync(join(cwd, 'public/branding/title'), { recursive: true });
      writeFileSync(existingPath, 'existing image placeholder');
      writeFileSync(`${existingPath}.json`, '{}');
      let requestCalled = false;

      const summary = await generateBrandImages(
        FOOTBALL_JS_BRAND_ASSET_PLAN,
        {
          ...DEFAULT_GENERATE_OPTIONS,
          execute: true,
          maxFiles: 1,
        },
        {
          requestImage: async () => {
            requestCalled = true;
            return Buffer.from('new image');
          },
        },
      );

      expect(summary).toEqual({
        dryRun: false,
        generated: [],
        skipped: ['football-js-title-01'],
      });
      expect(requestCalled).toBe(false);
      expect(readFileSync(existingPath, 'utf8')).toBe('existing image placeholder');
      expect(() => assertCanWriteBrandAsset(FOOTBALL_JS_BRAND_ASSET_PLAN[0], false)).toThrow(/--force/);
    });
  });

  it('generates report, gallery, selection manifest, and stable runtime filenames', async () => {
    await withTemporaryCwd(async (cwd) => {
      process.env.OPENAI_API_KEY = 'test-key';
      const generatedContent = Buffer.from('brand-image-bytes');
      const summary = await generateBrandImages(
        FOOTBALL_JS_BRAND_ASSET_PLAN,
        {
          ...DEFAULT_GENERATE_OPTIONS,
          execute: true,
          maxFiles: 4,
        },
        {
          requestImage: async () => generatedContent,
        },
      );
      const selection = selectBrandAssets(FOOTBALL_JS_BRAND_ASSET_PLAN, {
        emblemAssetId: 'football-js-emblem-01',
        force: false,
        selectedAt: '2026-06-21T00:00:00.000Z',
        titleAssetId: 'football-js-title-01',
      });
      const report = createBrandAssetReport();
      writeBrandAssetReportFiles(report);

      expect(summary.generated).toEqual([
        'football-js-title-01',
        'football-js-title-02',
        'football-js-emblem-01',
        'football-js-emblem-02',
      ]);
      expect(report.validationErrors).toEqual([]);
      expect(report.generatedCount).toBe(4);
      expect(selection.title.runtimeImageUrl).toBe('/branding/football-js-title.webp');
      expect(selection.emblem.runtimeImageUrl).toBe('/branding/football-js-emblem.webp');
      expect(existsSync(join(cwd, FOOTBALL_JS_TITLE_RUNTIME_PATH))).toBe(true);
      expect(existsSync(join(cwd, FOOTBALL_JS_EMBLEM_RUNTIME_PATH))).toBe(true);
      expect(existsSync(join(cwd, BRAND_SELECTION_PATH))).toBe(true);
      expect(existsSync(join(cwd, BRAND_REPORT_PATH))).toBe(true);
      expect(existsSync(join(cwd, BRAND_GALLERY_PATH))).toBe(true);
      expect(readFileSync(join(cwd, BRAND_GALLERY_PATH), 'utf8')).toContain('Football JS Brand Gallery');
    });
  });

  it('reads local API keys only from Node-only sources', async () => {
    await withTemporaryCwd(async (cwd) => {
      writeFileSync(join(cwd, '.env'), 'OPENAI_API_KEY="env-file-key"\n');
      expect(requireOpenAIApiKey({ env: {}, allowLocalFiles: false })).toBe('env-file-key');
      expect(() =>
        requireOpenAIApiKey({
          allowLocalFiles: false,
          env: {},
          envFilePath: null,
          localKeyFiles: [],
        }),
      ).toThrow(/Missing OPENAI_API_KEY/);
    });
  });

  it('does not put OpenAI secrets or API calls in browser-facing source or manifests', async () => {
    await withTemporaryCwd(async (cwd) => {
      const selection = selectBrandAssetsFixture(cwd);
      expect(selection).toBeTruthy();

      const files = [
        {
          path: 'src/config/GameBrand.ts',
          text: readFileSync(join(ORIGINAL_CWD, 'src/config/GameBrand.ts'), 'utf8'),
        },
        {
          path: BRAND_SELECTION_PATH,
          text: readFileSync(join(cwd, BRAND_SELECTION_PATH), 'utf8'),
        },
      ];

      expect(findBrowserOpenAISecretReferences(files)).toEqual([]);
    });
  });
});

async function withTemporaryCwd(action: (cwd: string) => Promise<void> | void): Promise<void> {
  const cwd = mkdtempSync(join(tmpdir(), 'football-brand-assets-'));
  process.chdir(cwd);
  try {
    await action(cwd);
  } finally {
    process.chdir(ORIGINAL_CWD);
    rmSync(cwd, { force: true, recursive: true });
  }
}

function selectBrandAssetsFixture(cwd: string): unknown {
  const titlePath = join(cwd, FOOTBALL_JS_BRAND_ASSET_PLAN[0].outputPath);
  const emblemPath = join(cwd, FOOTBALL_JS_BRAND_ASSET_PLAN[2].outputPath);
  mkdirSync(join(cwd, 'public/branding/title'), { recursive: true });
  mkdirSync(join(cwd, 'public/branding/emblem'), { recursive: true });
  writeFileSync(titlePath, 'title fixture');
  writeFileSync(emblemPath, 'emblem fixture');

  return selectBrandAssets(FOOTBALL_JS_BRAND_ASSET_PLAN, {
    emblemAssetId: 'football-js-emblem-01',
    force: false,
    selectedAt: '2026-06-21T00:00:00.000Z',
    titleAssetId: 'football-js-title-01',
  });
}
