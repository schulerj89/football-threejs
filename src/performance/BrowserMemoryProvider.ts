import type { BrowserMemorySnapshot } from './MemoryTypes';

export interface BrowserMemoryGlobalLike {
  navigator?: {
    deviceMemory?: number;
    userAgent?: string;
  };
  performance?: {
    memory?: {
      jsHeapSizeLimit?: number;
      totalJSHeapSize?: number;
      usedJSHeapSize?: number;
    };
    measureUserAgentSpecificMemory?: () => Promise<{
      breakdown?: unknown;
      bytes?: number;
    }>;
  };
}

export class BrowserMemoryProvider {
  constructor(
    private readonly globalLike: BrowserMemoryGlobalLike =
      globalThis as unknown as BrowserMemoryGlobalLike,
  ) {}

  async measure(): Promise<BrowserMemorySnapshot> {
    const performanceLike = this.globalLike.performance;
    const navigatorLike = this.globalLike.navigator;
    const measureUserAgentSpecificMemory =
      performanceLike?.measureUserAgentSpecificMemory;

    const userAgentMemory = typeof measureUserAgentSpecificMemory === 'function'
      ? await measureUserAgentSpecificMemory()
          .then((measurement) => ({
            breakdown: measurement.breakdown,
            bytes: measurement.bytes,
            label: 'measureUserAgentSpecificMemory',
            supported: true,
          }))
          .catch(() => ({
            label: 'measureUserAgentSpecificMemory failed',
            supported: false,
          }))
      : {
          label: 'measureUserAgentSpecificMemory unsupported',
          supported: false,
        };

    const performanceMemory = performanceLike?.memory
      ? {
          jsHeapSizeLimit: performanceLike.memory.jsHeapSizeLimit,
          supported: true,
          totalJSHeapSize: performanceLike.memory.totalJSHeapSize,
          usedJSHeapSize: performanceLike.memory.usedJSHeapSize,
        }
      : {
          supported: false,
        };

    const deviceMemory =
      typeof navigatorLike?.deviceMemory === 'number' &&
      Number.isFinite(navigatorLike.deviceMemory)
        ? {
            gigabytes: navigatorLike.deviceMemory,
            supported: true,
          }
        : {
            supported: false,
          };

    return {
      deviceMemory,
      measureUserAgentSpecificMemory: userAgentMemory,
      performanceMemory,
    };
  }

  getUnavailableFields(snapshot: BrowserMemorySnapshot): string[] {
    const unavailable: string[] = [];
    if (!snapshot.measureUserAgentSpecificMemory.supported) {
      unavailable.push('measureUserAgentSpecificMemory');
    }
    if (!snapshot.performanceMemory.supported) {
      unavailable.push('performance.memory');
    }
    if (!snapshot.deviceMemory.supported) {
      unavailable.push('navigator.deviceMemory');
    }
    return unavailable;
  }
}

export function createUnsupportedBrowserMemorySnapshot(): BrowserMemorySnapshot {
  return {
    deviceMemory: { supported: false },
    measureUserAgentSpecificMemory: {
      label: 'measureUserAgentSpecificMemory unsupported',
      supported: false,
    },
    performanceMemory: { supported: false },
  };
}
