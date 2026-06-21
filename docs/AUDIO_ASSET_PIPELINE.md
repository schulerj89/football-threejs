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
```

Generation commands default to dry-run. Paid calls require:

```bash
npx tsx tools/audio/generateSoundEffects.ts --execute --max-files=15
npx tsx tools/audio/generateSpeech.ts --execute --max-files=1
```

Use `--force` only when intentionally replacing an existing generated file and its sidecar. Use `--max-files=1` or `AUDIO_MAX_FILES=1` for smaller batches.

## Plan Data

The typed plan is in `tools/audio/audioPlan.ts`. Each asset defines stable ID, category, kind, prompt or script, model, duration, loop flag, format, output path, generation status, runtime loading strategy, and file budget.

The first starter pack contains two streamed crowd loops, six crowd reactions, and seven football one-shots. Use `npm run audio:report` for a CLI report or `npx tsx tools/audio/audioReport.ts --write` to write the JSON report and HTML audition index under `public/audio`.

Allowed output roots:

- `public/audio/sfx`
- `public/audio/crowd`
- `public/audio/announcer`

## Provenance

When generation is executed, each output receives a sidecar JSON next to the audio file. The sidecar records prompt or script, model, voice ID where applicable, generation date, output format, and content hash.

The sidecar must not contain API keys, request headers, or secret-bearing data.
