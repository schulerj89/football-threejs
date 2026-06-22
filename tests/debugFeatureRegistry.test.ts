import { describe, expect, it } from 'vitest';
import { DebugFeatureRegistry } from '../src/ui/DebugFeatureRegistry';

describe('DebugFeatureRegistry', () => {
  it('creates features lazily and disposes them when disabled', () => {
    const registry = new DebugFeatureRegistry();
    let created = 0;
    let disposed = 0;

    registry.register({
      create: () => {
        created += 1;
        return {
          dispose: () => {
            disposed += 1;
          },
        };
      },
      enabled: false,
      id: 'camera',
      label: 'Camera',
    });

    expect(created).toBe(0);
    registry.setEnabled('camera', true);
    expect(created).toBe(1);
    expect(registry.isEnabled('camera')).toBe(true);
    registry.setEnabled('camera', false);
    expect(disposed).toBe(1);
  });

  it('reports snapshots and disposes active features on registry disposal', () => {
    const registry = new DebugFeatureRegistry();
    let disposed = 0;

    registry.register({
      create: () => ({
        dispose: () => {
          disposed += 1;
        },
      }),
      enabled: true,
      id: 'general',
      label: 'General metrics',
    });

    expect(registry.getSnapshots()).toEqual([
      {
        enabled: true,
        id: 'general',
        label: 'General metrics',
      },
    ]);

    registry.dispose();
    expect(disposed).toBe(1);
    expect(registry.isEnabled('general')).toBe(false);
  });

  it('disables every active feature at once', () => {
    const registry = new DebugFeatureRegistry();
    const disposed: string[] = [];

    for (const id of ['camera', 'officials']) {
      registry.register({
        create: () => ({
          dispose: () => {
            disposed.push(id);
          },
        }),
        enabled: true,
        id,
        label: id,
      });
    }

    registry.disableAll();

    expect(disposed.sort()).toEqual(['camera', 'officials']);
    expect(registry.getSnapshots().every((feature) => !feature.enabled)).toBe(true);
  });
});
