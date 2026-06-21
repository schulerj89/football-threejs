---
name: football-audio-director
description: Plan and validate offline football audio production for this Three.js game. Use when creating or reviewing sound-effect, crowd, announcer, music, ambience, positional-audio, ElevenLabs generation, asset-budget, naming, provenance, or audio-pipeline work in football-threejs.
---

# Football Audio Director

## Core Rule

Treat ElevenLabs as an offline production tool only. Runtime game code may consume local generated audio files later, but browser code must never call ElevenLabs, expose `ELEVENLABS_API_KEY`, use a `VITE_` key, or generate audio at runtime.

## Official Skills

Before generating or changing ElevenLabs calls, consult the installed official skills:

- `.agents/skills/setup-api-key/SKILL.md`
- `.agents/skills/sound-effects/SKILL.md`
- `.agents/skills/text-to-speech/SKILL.md`

Do not copy official API instructions into project docs when those installed skills can be referenced directly.

## Audio Planning

- Classify every asset as one of: `oneShot`, `loop`, `speech`, `music`, or `positional`.
- Classify every asset category as one of: `sfx`, `crowd`, or `announcer`.
- Keep planned assets in `tools/audio/audioPlan.ts`.
- Require each planned asset to include stable asset ID, category, prompt or script, model ID, requested duration, looping flag, output format, output path, generation status, and budget.
- Use kebab-case asset IDs and filenames.
- Keep output paths inside `public/audio/sfx`, `public/audio/crowd`, or `public/audio/announcer`.
- Preserve approved generated files. Do not regenerate an existing file unless the user explicitly accepts `--force`.

## Generation Rules

- Use Node scripts only: `npm run audio:generate:sfx` and `npm run audio:generate:speech`.
- Default every generation command to dry-run.
- Require `--execute` for paid API calls.
- Limit automatic retries to one.
- Limit one execution by `--max-files` or `AUDIO_MAX_FILES`.
- Write provenance sidecars next to generated files with prompt/script, model, voice ID when applicable, generation date, output format, and content hash.
- Never log or commit API keys, request headers containing real secrets, or raw secret-bearing manifests.

## Budgets

- Prefer compressed web formats for runtime candidates.
- Keep one-shots short and small.
- Keep loops reviewable and avoid long ambience beds until runtime streaming exists.
- Track file count, size, loop flag, and generated status with `npm run audio:report`.
- Treat generated audio as queued future runtime work until a dedicated runtime-audio milestone wires playback.
