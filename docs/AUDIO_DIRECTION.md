# Audio Direction

Audio is now planned product scope for the low-poly football game, including football sound effects, announcer presentation, crowd ambience, and cinematic presentation support.

Current implementation scope is tooling only. No runtime sound, `AudioContext`, announcer playback, crowd rendering, or camera change is included in this milestone.

## Production Roles

- `sfx`: short football one-shots such as cleats, catch sounds, contact, whistles, and UI feedback.
- `crowd`: loopable or layered crowd beds for future presentation states.
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
- Crowd loops should be short reviewable layers, not long final mixes.
- Announcer lines should stay concise and caption-matched.
- Approved generated files should be preserved rather than regenerated.

Generated audio assets are queued future runtime work until a dedicated runtime-audio milestone wires playback.
