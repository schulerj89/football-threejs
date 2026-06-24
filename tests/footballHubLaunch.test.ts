import { describe, expect, it } from 'vitest';
import { shouldPersistFootballHubLaunchSettings } from '../src/ui/FootballHubScreen';

describe('football hub launch policy', () => {
  it('persists Play Now settings but keeps Dynasty launch settings runtime-only', () => {
    expect(shouldPersistFootballHubLaunchSettings({ source: 'playNow' })).toBe(true);
    expect(shouldPersistFootballHubLaunchSettings({ source: 'dynasty' })).toBe(false);
  });
});
