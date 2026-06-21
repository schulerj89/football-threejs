# Audio Direction

Audio is now planned product scope for the low-poly football game, including football sound effects, announcer presentation, crowd ambience, and cinematic presentation support.

Current implementation scope includes offline generation planning, a typed prototype announcer script catalog, caption and audition artifacts, a local-file runtime mixer foundation, and event-driven crowd/SFX playback from local starter-pack asset IDs. Runtime playback is explicitly user-gesture gated, uses scheduled gain ramps for buses and loops, suppresses stale cues while hidden or unfocused, and exposes debug memory/node diagnostics. Generated asset approval, announcer playback, live text generation, spatial audio, music, visual crowd rendering, and camera changes remain future work.

## Production Roles

- `sfx`: short football one-shots such as cleats, catch sounds, contact, whistles, and UI feedback.
- `crowd`: loopable or layered crowd beds for presentation states and result reactions.
- `announcer`: original broadcast-style speech generated offline from concise scripts.
- `music`: future menu or cinematic music. No music assets are planned in the current seed plan.
- `positional`: future field-relative sounds. Runtime spatialization is deferred.

## ElevenLabs Use

ElevenLabs is used only for offline asset generation from Node scripts. Browser code must never call ElevenLabs or receive `ELEVENLABS_API_KEY`.

Use the installed official skills for API details:

- `.agents/skills/setup-api-key/SKILL.md`
- `.agents/skills/sound-effects/SKILL.md`
- `.agents/skills/text-to-speech/SKILL.md`

Project-specific direction lives in:

- `.codex/skills/football-audio-director/SKILL.md`
- `.codex/skills/football-broadcast-writer/SKILL.md`

## Budget Targets

- One-shot SFX should stay under the per-asset `maxBytes` in `tools/audio/audioPlan.ts`.
- Crowd loops should be reviewable streamed layers, not long decoded buffers.
- Starter-pack compressed audio should stay under 5 MiB.
- Estimated decoded one-shot memory should stay under 8 MiB.
- `?audioDebug=1` should be used to confirm active node/source counts, streamed versus decoded assets, and longest loaded clip data during runtime audits.
- Announcer lines should stay concise and caption-matched.
- Announcer scripts should avoid player names, team names, exact statistics, real broadcaster references, and recognizable catchphrases.
- Voice-design previews and generated speech files should be preserved once accepted rather than regenerated casually.
- Approved generated files should be preserved rather than regenerated.

Runtime crowd and football-event cues are mapped through the presentation event bridge. Missing optional generated files must warn in development without stopping gameplay.
