# Broadcast Style Guide

Broadcast writing is planned product scope. Current implementation scope is the prototype announcer identity, typed script catalog, exact captions, audition artifacts, and offline generation tooling. Runtime announcer playback and live text generation are future work.

## Voice

Commentary should be concise, original, and event-specific. It may sound like football presentation, but it must not imitate a real broadcaster or use recognizable catchphrases. The prototype voice direction is energetic but controlled, warm, authoritative, and capable of excitement without shouting every line.

## Rules

- Do not name real broadcasters, teams, players, leagues, networks, or historic games.
- Do not imitate a named person's voice.
- Do not invent player names, team histories, standings, or facts the game state does not provide.
- Do not announce exact statistics, quarters, records, opponent scores, or unsupported drive history.
- Do not speak on every ordinary tackle.
- Avoid repeated phrases in a batch.
- Match the caption exactly to the spoken script.
- Prefer one short sentence for ordinary plays and two short sentences for major results.
- Keep most generated clips around one to four seconds.

## Catalog

The current catalog lives in `tools/audio/announcerScriptCatalog.ts`. It contains:

- Three variants for `firstDown`, `touchdown`, `sack`, `bigGain`, and `incomplete`.
- Two variants for `gameOpening`, `playReady`, `tackleForLoss`, `outOfBounds`, `turnoverOnDowns`, and `challengeEnding`.
- Exact captions that must match the generated speech text.

## Intensity

- `low`: pre-snap, reset, neutral context.
- `medium`: normal gain, first down, catch, incompletion, out of bounds.
- `high`: sack, tackle for loss, fourth-down stop, long gain.
- `peak`: touchdown or late-score moment.

## Example Lines

- Medium: `That moves the sticks. The offense keeps the drive alive.`
- High: `Pressure gets home. The quarterback is down behind the line.`
- Peak: `Touchdown. He found the crease and finished the drive.`

Use `.codex/skills/football-broadcast-writer/SKILL.md` for future writing tasks.
