export type MemorySubsystemId =
  | 'crowd'
  | 'field'
  | 'football'
  | 'helmets'
  | 'officials'
  | 'other'
  | 'players'
  | 'routeArt'
  | 'stadium'
  | 'uiRenderTargets';

export type MemoryEstimateConfidence = 'calculated' | 'estimated' | 'unknown' | 'unsupported';

export interface RendererCounterSnapshot {
  drawCalls: number;
  geometries: number;
  lines: number;
  points: number;
  textures: number;
  triangles: number;
}

export interface CalculatedBufferMemorySnapshot {
  attributeBytes: number;
  customInstanceAttributeBytes: number;
  geometryIndexBytes: number;
  instanceColorBytes: number;
  instanceMatrixBytes: number;
  morphAttributeBytes: number;
  totalBytes: number;
}

export interface TextureMemoryEstimate {
  bytesPerPixel: number | null;
  confidence: MemoryEstimateConfidence;
  estimatedBytes: number | null;
  format: string;
  height: number | null;
  id: string;
  isCompressed: boolean;
  kind: 'renderTarget' | 'texture';
  mipmapMultiplier: number | null;
  name: string;
  notes: string[];
  type: string;
  width: number | null;
}

export interface BrowserMemoryMeasurement {
  bytes?: number;
  breakdown?: unknown;
  label: string;
  supported: boolean;
}

export interface PerformanceMemoryMeasurement {
  jsHeapSizeLimit?: number;
  totalJSHeapSize?: number;
  usedJSHeapSize?: number;
  supported: boolean;
}

export interface DeviceMemoryMeasurement {
  gigabytes?: number;
  supported: boolean;
}

export interface BrowserMemorySnapshot {
  deviceMemory: DeviceMemoryMeasurement;
  measureUserAgentSpecificMemory: BrowserMemoryMeasurement;
  performanceMemory: PerformanceMemoryMeasurement;
}

export interface SubsystemMemorySnapshot {
  bufferBytes: CalculatedBufferMemorySnapshot;
  estimatedTextureBytes: number;
  geometryCount: number;
  materialCount: number;
  meshCount: number;
  notes: string[];
  objectCount: number;
  subsystem: MemorySubsystemId;
  textureCount: number;
  unknownTextureCount: number;
}

export interface SceneResourceProfileSnapshot {
  browserMemory: BrowserMemorySnapshot;
  calculatedBufferBytes: CalculatedBufferMemorySnapshot;
  disclaimer: string;
  renderer: RendererCounterSnapshot;
  subsystemTotals: SubsystemMemorySnapshot[];
  textureEstimates: TextureMemoryEstimate[];
  totals: {
    estimatedTextureBytes: number;
    materialCount: number;
    meshCount: number;
    objectCount: number;
    unknownTextureCount: number;
  };
}

export interface CrowdCapacityTrialResult {
  averageFrameTimeMs: number;
  drawCalls: number;
  frameCount: number;
  incrementalBufferBytes: number;
  jsApplicationMemoryBytes: number | null;
  minimumObservedFps: number;
  p95FrameTimeMs: number;
  requestedCount: number;
  resourceReturnNearBaseline: boolean;
  triangles: number;
}

export interface CrowdCapacityReport {
  baseline: SceneResourceProfileSnapshot;
  candidateCounts: number[];
  recommendedCount: number;
  recommendationLabel: string;
  renderer: RendererCounterSnapshot;
  stopReason: string;
  targetFrameTimeMs: number;
  testedCounts: CrowdCapacityTrialResult[];
  timestamp: string;
  unavailableMeasurementFields: string[];
  userAgent: string;
}

export type CrowdCapacityBenchmarkStatus = 'cancelled' | 'completed' | 'idle' | 'running';

export interface CrowdCapacityBenchmarkSnapshot {
  activeCount: number | null;
  candidateCounts: number[];
  currentTrialSeconds: number;
  recommendedCount: number | null;
  status: CrowdCapacityBenchmarkStatus;
  stopReason: string | null;
  targetFrameTimeMs: number;
  testedCounts: CrowdCapacityTrialResult[];
}
