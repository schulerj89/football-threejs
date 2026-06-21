# Audio Direction

Audio is now planned product scope for the low-poly football game, including football sound effects, announcer presentation, crowd ambience, and cinematic presentation support.

Current implementation scope includes offline generation planning, a local-file runtime mixer foundation, and event-driven crowd/SFX playback from local starter-pack asset IDs. Generated asset approval, announcer playback, spatial audio, music, visual crowd rendering, and camera changes remain future work.

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
- Announcer lines should stay concise and caption-matched.
- Approved generated files should be preserved rather than regenerated.

Runtime crowd and football-event cues are mapped through the presentation event bridge. Missing optional generated files must warn in development without stopping gameplay.
