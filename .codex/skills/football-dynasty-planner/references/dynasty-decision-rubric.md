# Dynasty Decision Rubric

Use this rubric to decide how much depth belongs in a Football JS Dynasty phase.

## Must Fit Current Product

- The mode should work with six fictional teams first.
- It should not require roster editing, substitutions, contracts, or a huge player database to be fun.
- It should extend existing league, roster, ratings, stats, and presentation systems.
- It should stay deterministic for tests and save compatibility.

## Depth Ladder

1. Season shell: hub, schedule, standings, calendar advance, save/load.
2. Game integration: play selected matchup, simulate other games, update stats and standings.
3. Player progression: ratings changes, awards, season leaders, graduating/departing players.
4. Recruiting-lite: prospects, pitches, roster needs, commitments, signing class.
5. Program management: coach goals, budget allocation, facility identity, staff modifiers.
6. Offseason: departures, recruiting finalization, roster class intake, schedule reset.

## Design Questions To Answer Before Coding

- What is the smallest weekly loop the user can understand in under 30 seconds?
- What state must persist across app reloads?
- Which values are authoritative data versus presentation summaries?
- Which systems can be simulated without new gameplay?
- What can be delayed without blocking the main loop?
- What tests prove the mode is deterministic?

## Avoid

- Copying commercial menu layouts, names, or exact feature packaging.
- Building deep recruiting before schedule/standings/save format exists.
- Adding real schools, real athletes, real brands, or protected league references.
- Letting generated commentary or UI copy become authoritative dynasty data.
