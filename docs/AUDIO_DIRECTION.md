# Audio Direction

Audio is now planned product scope for the low-poly football game, including football sound effects, announcer presentation, crowd ambience, and cinematic presentation support.

Current implementation scope includes offline generation planning, a typed prototype announcer script catalog, caption and audition artifacts, a local-file runtime mixer foundation, event-driven crowd/SFX playback from local starter-pack asset IDs, a generated Football JS menu/stinger/chant pack, and serialized broadcast-commentary playback from pre-rendered local announcer clips. Runtime playback is explicitly user-gesture gated, uses scheduled gain ramps for buses and loops, suppresses stale cues while hidden or unfocused, ducks the crowd bus during announcer speech, and exposes debug memory/node/commentary diagnostics. Runtime playlist/stinger/chant sequencing, live text generation, spatial audio, visual crowd rendering changes, and camera changes remain future work.

## Production Roles

- `sfx`: short football one-shots such as cleats, catch sounds, contact, whistles, and UI feedback.
- `crowd`: loopable or layered crowd beds for presentation states and result reactions.
- `announcer`: original broadcast-style speech generated offline from concise scripts.
- `music`: menu playlist tracks and transition stingers generated offline with `music_v2`.
- `positional`: future field-relative sounds. Runtime spatialization is deferred.

## ElevenLabs Use

ElevenLabs is used only for offline asset generation from Node scripts. Browser code must never call ElevenLabs or receive `ELEVENLABS_API_KEY`.

Use the installed official skills for API details:

- `.agents/skills/setup-api-key/SKILL.md`
- `.agents/skills/sound-effects/SKILL.md`
- `.agents/skills/text-to-speech/SKILL.md`
- `.agents/skills/music/SKILL.md`

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
- The current music catalog is written to `public/audio/music/music-catalog.json`; it groups four menu tracks, six transition stingers, and three stadium chant layers for future runtime integration.

Runtime crowd and football-event cues are mapped through the presentation event bridge. Missing optional generated files must warn in development without stopping gameplay.

Runtime commentary uses the same presentation event bridge. It must not speak on every ordinary play, must not overlap clips, and must keep captions matched to the generated script text.
