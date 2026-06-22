# Audio Asset Pipeline

This milestone keeps ElevenLabs generation offline and local-only. Browser runtime audio may consume local files from `public/audio`, but it must not call ElevenLabs.

## Security Rules

- Store the local key as `ELEVENLABS_API_KEY` in `.env` or a shell environment.
- Never use a `VITE_` prefix for the key.
- Never expose the key to Vite or browser code.
- Never log the key.
- Never commit local `.env` files.
- Runtime code may consume local files from `public/audio`, but it must not call ElevenLabs.

## Commands

```bash
npm run audio:plan
npm run audio:report
npm run audio:generate:sfx
npm run audio:generate:speech
npm run music:plan
npm run music:generate
npm run music:report
```

Generation commands default to dry-run. Paid calls require:

```bash
npx tsx tools/audio/generateSoundEffects.ts --execute --max-files=15
npx tsx tools/audio/generateSpeech.ts --execute --max-files=27
npx tsx tools/audio/generateMusic.ts --execute --max-files=15
```

Use `--force` only when intentionally replacing an existing generated file and its sidecar. Use `--max-files=1` or `AUDIO_MAX_FILES=1` for smaller batches.

## Plan Data

The typed plan is in `tools/audio/audioPlan.ts`. Each asset defines stable ID, category, kind, prompt or script, model, duration, loop flag, format, output path, generation status, runtime loading strategy, and file budget.

The first starter pack contains two streamed crowd loops, six crowd reactions, seven football one-shots, and 27 announcer speech scripts. Use `npm run audio:report` for a CLI report or `npx tsx tools/audio/audioReport.ts --write` to write the JSON report and HTML audition index under `public/audio`.

Announcer scripts live in `tools/audio/announcerScriptCatalog.ts`. Dry-run speech generation writes `public/audio/announcer/announcer-captions.json` and `public/audio/announcer/announcer-audition.html` without making paid API calls. Execute-mode speech generation creates complete MP3 files only when a valid `ELEVENLABS_API_KEY` is available to the Node process.

If no announcer voice is configured, execute mode prepares three voice-design previews under `public/audio/announcer/voice-previews`, writes metadata for each preview, and promotes the first acceptable preview to a temporary prototype voice. A selected voice can also be supplied through `FOOTBALL_ANNOUNCER_VOICE_ID` or the local generated voice config.

Music generation uses `music_v2` for title/menu/stinger tracks and the sound-effects model for stadium chant layers. The expanded music report writes `public/audio/music/music-catalog.json`, `public/audio/music/music-report.json`, and the grouped audition page at `public/audio/music/music-audition.html`.

Allowed output roots:

- `public/audio/sfx`
- `public/audio/crowd`
- `public/audio/crowd/chants`
- `public/audio/announcer`
- `public/audio/music`

## Provenance

When generation is executed, each output receives a sidecar JSON next to the audio file. The sidecar records prompt or script, model, voice ID where applicable, generation date, output format, and content hash.

The sidecar must not contain API keys, request headers, or secret-bearing data.

## Runtime Commentary

Runtime commentary reads local announcer MP3s from `public/audio/announcer` through the browser audio manifest. It does not call ElevenLabs, generate text, or depend on request-time API access. Missing optional announcer files warn in development and suppress that line without stopping gameplay.
