import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DYNASTY_DECISION_DOC_PATH } from '../src/ui/FootballHubScreen';

describe('dynasty decision roadmap', () => {
  it('marks the first dynasty phase complete and keeps the hub shell pointed at the decision map', () => {
    const decisionDoc = readFileSync(DYNASTY_DECISION_DOC_PATH, 'utf8');

    expect(DYNASTY_DECISION_DOC_PATH).toBe('docs/DYNASTY_DECISIONS.md');
    expect(decisionDoc).toContain('### Phase 0: Dynasty Shell');
    expect(decisionDoc).toContain('Status: Complete in `1.22.0`.');
    expect(decisionDoc).toContain('The Dynasty destination is a non-playable planning shell.');
    expect(decisionDoc).toContain('Status: Complete in `1.22.19`.');
    expect(decisionDoc).toContain('Season-core contract: add the `DynastySaveData` schema');
    expect(decisionDoc).toContain('Save repository: persist, load, reset, and migrate the active dynasty save');
    expect(decisionDoc).toContain('Dynasty hub view: show the active user program');
    expect(decisionDoc).toContain('Weekly advance: simulate non-user games deterministically');
    expect(decisionDoc).toContain('Reload and migration hardening: validate corrupt saves');
    expect(decisionDoc).toContain('Flow hardening: prevent Play Now and Dynasty state from leaking into each other');
    expect(decisionDoc).toContain('Dynasty matchup launch settings are runtime-only');
    expect(decisionDoc).toContain('### Phase 2: Stats, Stories, and Awards');
    expect(decisionDoc).toContain('Minor updates 1-4 shipped in `1.22.20`, `1.22.21`, `1.22.22`, and `1.22.23`; patch hardening 1 shipped in `1.22.24`.');
    expect(decisionDoc).toContain('Season stats contract: add team-level season stat rows');
    expect(decisionDoc).toContain('Weekly leaders: expose passing, rushing, scoring, turnover, and yardage leaders');
    expect(decisionDoc).toContain('Story hooks: add compact Dynasty context summaries');
    expect(decisionDoc).toContain('Award watch lists: add deterministic offensive, defensive, and special teams watch rows');
    expect(decisionDoc).toContain('Stat validation hardening: reject missing, negative, mismatched, or impossible aggregate stat rows');
    expect(decisionDoc).toContain('Patch hardening plan:');
  });
});
