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
    expect(decisionDoc).toContain('Status: Complete in `1.22.25`.');
    expect(decisionDoc).toContain('Season stats contract: add team-level season stat rows');
    expect(decisionDoc).toContain('Weekly leaders: expose passing, rushing, scoring, turnover, and yardage leaders');
    expect(decisionDoc).toContain('Story hooks: add compact Dynasty context summaries');
    expect(decisionDoc).toContain('Award watch lists: add deterministic offensive, defensive, and special teams watch rows');
    expect(decisionDoc).toContain('Stat validation hardening: reject missing, negative, mismatched, or impossible aggregate stat rows');
    expect(decisionDoc).toContain('Story presentation hardening: keep Dynasty story copy generic, factual, and absent from Play Now');
    expect(decisionDoc).toContain('Dynasty story copy is suppressed for Play Now and for malformed Dynasty context.');
    expect(decisionDoc).toContain('Patch hardening plan:');
    expect(decisionDoc).toContain('### Phase 3: Player Progression');
    expect(decisionDoc).toContain('Status: Complete in `1.22.31`.');
    expect(decisionDoc).toContain('Progression preview contract: add deterministic presentation-only performance points');
    expect(decisionDoc).toContain('Weekly training summary: add a compact hub section that groups projected development by position room and archetype. Shipped in `1.22.27`.');
    expect(decisionDoc).toContain('Rating delta preview: calculate bounded projected attribute and overall changes based on position weights, still not applied to gameplay. Shipped in `1.22.28`.');
    expect(decisionDoc).toContain('Apply-to-save progression: persist approved end-of-week progression rows and roster rating deltas in Dynasty save data. Shipped in `1.22.29`.');
    expect(decisionDoc).toContain('Progression bounds hardening: reject negative, non-integer, oversized, or duplicate progression rows during save validation. Shipped in `1.22.30`.');
    expect(decisionDoc).toContain('Gameplay isolation hardening: prove progression previews and saved deltas cannot alter live gameplay ratings until explicitly applied through the approved path. Shipped in `1.22.31`.');
    expect(decisionDoc).toContain('Approved progression applications persist player/week rating delta history in the save without mutating roster registry ratings.');
    expect(decisionDoc).toContain('### Phase 4: Recruiting-Lite');
    expect(decisionDoc).toContain('Status: In progress. Minor update 1 shipped in `1.22.32`.');
    expect(decisionDoc).toContain('Prospect pool contract: add deterministic fictional prospects, position/archetype metadata, star grades, and three pitch-style fit scores without changing rosters. Shipped in `1.22.32`.');
    expect(decisionDoc).toContain('Team needs view: derive compact recruiting needs from current roster composition and ratings.');
    expect(decisionDoc).toContain('Weekly recruiting points: add a simple points allocation model for the user program.');
    expect(decisionDoc).toContain('Signing class preview: summarize likely signees and class fit without mutating rosters until offseason work.');
    expect(decisionDoc).toContain('Recruiting validation hardening: reject duplicate prospects, invalid pitch scores, impossible grades, and malformed interest rows.');
    expect(decisionDoc).toContain('Roster safety hardening: prove recruiting views and saved allocations cannot change active roster size or gameplay lineups before the offseason apply path.');
  });
});
