import type {
  CrowdCapacityBenchmarkSnapshot,
  CrowdCapacityReport,
  SceneResourceProfileSnapshot,
} from '../performance/MemoryTypes';

export interface MemoryDebugSnapshot {
  benchmark: CrowdCapacityBenchmarkSnapshot;
  profile: SceneResourceProfileSnapshot;
}

export interface MemoryDebugPanelOptions {
  onApplyRecommendedCount: () => string | null;
  onCancelBenchmark: () => void;
  onExportReport: () => CrowdCapacityReport | null;
  onRunBenchmark: () => void;
}

export class MemoryDebugPanel {
  readonly root = document.createElement('section');

  private readonly body = document.createElement('pre');
  private readonly status = document.createElement('div');

  constructor(private readonly options: MemoryDebugPanelOptions) {
    this.root.className = 'memory-debug-panel';
    this.root.setAttribute('aria-label', 'Memory and crowd capacity');

    const heading = document.createElement('h2');
    heading.textContent = 'Memory Profiler';
    const controls = document.createElement('div');
    controls.className = 'memory-debug-controls';
    controls.append(
      createButton('Run Crowd Capacity Test', () => {
        options.onRunBenchmark();
        this.status.textContent = 'Crowd capacity test running.';
      }),
      createButton('Cancel Test', () => {
        options.onCancelBenchmark();
        this.status.textContent = 'Crowd capacity test cancelled.';
      }),
      createButton('Apply Recommended Count', () => {
        const density = options.onApplyRecommendedCount();
        this.status.textContent = density
          ? `Applied recommended crowd density: ${density}.`
          : 'No recommendation is available yet.';
      }),
      createButton('Export Report', () => {
        const report = options.onExportReport();
        if (!report) {
          this.status.textContent = 'Run a benchmark before exporting.';
          return;
        }
        downloadJson('crowd-capacity-report.json', report);
        this.status.textContent = 'Exported crowd capacity report.';
      }),
    );
    this.status.className = 'memory-debug-status';
    this.status.textContent = 'Idle.';
    this.body.className = 'memory-debug-body';

    this.root.append(heading, controls, this.status, this.body);
    document.body.append(this.root);
  }

  sync(snapshot: MemoryDebugSnapshot): void {
    this.body.textContent = formatMemoryDebugSnapshot(snapshot);
  }

  dispose(): void {
    this.root.remove();
  }
}

export function formatMemoryDebugSnapshot(snapshot: MemoryDebugSnapshot): string {
  const profile = snapshot.profile;
  const benchmark = snapshot.benchmark;
  const browser = profile.browserMemory;
  const subsystemLines = profile.subsystemTotals
    .filter((subsystem) =>
      subsystem.objectCount > 0 ||
      subsystem.bufferBytes.totalBytes > 0 ||
      subsystem.textureCount > 0)
    .map((subsystem) =>
      `${subsystem.subsystem.padEnd(15)} objs ${subsystem.objectCount
        .toString()
        .padStart(4)} meshes ${subsystem.meshCount
        .toString()
        .padStart(4)} buffers ${formatBytes(
        subsystem.bufferBytes.totalBytes,
      ).padStart(10)} textures ${formatBytes(subsystem.estimatedTextureBytes).padStart(10)} unknownTex ${subsystem.unknownTextureCount}`,
    );
  const trialLines = benchmark.testedCounts.map((trial) =>
    `${trial.requestedCount.toString().padStart(5)} spectators avg ${trial.averageFrameTimeMs.toFixed(
      2,
    )} ms p95 ${trial.p95FrameTimeMs.toFixed(2)} ms min ${trial.minimumObservedFps.toFixed(
      1,
    )} FPS buffers +${formatBytes(trial.incrementalBufferBytes)} returned ${trial.resourceReturnNearBaseline ? 'yes' : 'no'}`,
  );

  return [
    'RENDERER COUNTERS',
    `geometries ${profile.renderer.geometries} textures ${profile.renderer.textures}`,
    `drawCalls ${profile.renderer.drawCalls} triangles ${profile.renderer.triangles}`,
    `points ${profile.renderer.points} lines ${profile.renderer.lines}`,
    '',
    'CALCULATED BUFFER BYTES',
    `attributes ${formatBytes(profile.calculatedBufferBytes.attributeBytes)}`,
    `indices ${formatBytes(profile.calculatedBufferBytes.geometryIndexBytes)}`,
    `morphs ${formatBytes(profile.calculatedBufferBytes.morphAttributeBytes)}`,
    `instance matrices ${formatBytes(profile.calculatedBufferBytes.instanceMatrixBytes)}`,
    `instance colors ${formatBytes(profile.calculatedBufferBytes.instanceColorBytes)}`,
    `custom instance attrs ${formatBytes(
      profile.calculatedBufferBytes.customInstanceAttributeBytes,
    )}`,
    `total ${formatBytes(profile.calculatedBufferBytes.totalBytes)}`,
    '',
    'TEXTURE ESTIMATES',
    `estimated ${formatBytes(profile.totals.estimatedTextureBytes)} unknown ${profile.totals.unknownTextureCount}`,
    ...profile.textureEstimates.slice(0, 6).map((texture) =>
      `${texture.name} ${texture.width ?? '?'}x${texture.height ?? '?'} ${texture.format}/${texture.type} ${texture.estimatedBytes === null ? 'unknown' : formatBytes(texture.estimatedBytes)}`,
    ),
    profile.textureEstimates.length > 6
      ? `...${profile.textureEstimates.length - 6} more texture(s)`
      : '',
    '',
    'BROWSER MEMORY',
    `UA memory ${browser.measureUserAgentSpecificMemory.supported
      ? formatBytes(browser.measureUserAgentSpecificMemory.bytes ?? 0)
      : 'unsupported'}`,
    `performance.memory ${browser.performanceMemory.supported
      ? formatBytes(browser.performanceMemory.usedJSHeapSize ?? 0)
      : 'unsupported'}`,
    `deviceMemory ${browser.deviceMemory.supported
      ? `${browser.deviceMemory.gigabytes} GiB hint`
      : 'unsupported'}`,
    '',
    'SUBSYSTEMS',
    ...(subsystemLines.length > 0 ? subsystemLines : ['none']),
    '',
    'CROWD CAPACITY BENCHMARK',
    `status ${benchmark.status} active ${benchmark.activeCount ?? 'none'} target ${benchmark.targetFrameTimeMs.toFixed(
      2,
    )} ms`,
    `Recommended for this browser session: ${benchmark.recommendedCount ?? 'not available'} stop ${benchmark.stopReason ?? 'none'}`,
    ...(trialLines.length > 0 ? trialLines : ['no completed trials']),
    '',
    profile.disclaimer,
  ].filter((line) => line !== '').join('\n');
}

function createButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KiB', 'MiB', 'GiB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
