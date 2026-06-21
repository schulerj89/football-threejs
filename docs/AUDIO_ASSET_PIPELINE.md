# Audio Asset Pipeline

This milestone adds secure offline audio-production tooling only.

## Security Rules

- Store the local key as `ELEVENLABS_API_KEY` in `.env` or a shell environment.
- Never use a `VITE_` prefix for the key.
- Never expose the key to Vite or browser code.
- Never log the key.
- Never commit local `.env` files.
- Runtime code may consume local files from `public/audio` in a future milestone, but it must not call ElevenLabs.

## Commands

```bash
npm run audio:plan
npm run audio:report
npm run audio:generate:sfx
npm run audio:generate:speech
```

Generation commands default to dry-run. Paid calls require:

```bash
npm run audio:generate:sfx -- --execute
npm run audio:generate:speech -- --execute
```

Use `--force` only when intentionally replacing an existing generated file and its sidecar. Use `--max-files=1` or `AUDIO_MAX_FILES=1` for smaller batches.

## Plan Data

The typed plan is in `tools/audio/audioPlan.ts`. Each asset defines stable ID, category, kind, prompt or script, model, duration, loop flag, format, output path, generation status, and file budget.

Allowed output roots:

- `public/audio/sfx`
- `public/audio/crowd`
- `public/audio/announcer`

## Provenance

When generation is executed, each output receives a sidecar JSON next to the audio file. The sidecar records prompt or script, model, voice ID where applicable, generation date, output format, and content hash.

The sidecar must not contain API keys, request headers, or secret-bearing data.
