---
name: football-broadcast-writer
description: Write concise original football broadcast commentary and matching captions for football-threejs announcer assets. Use when drafting touchdown, sack, tackle, first-down, incomplete-pass, turnover, pre-snap, crowd-presentation, or cinematic football commentary scripts for offline text-to-speech generation.
---

# Football Broadcast Writer

## Voice

Write original football commentary for a stylized low-poly football game. Keep lines short, clear, and event-specific. The copy should feel like broadcast presentation without naming or imitating any real broadcaster.

## Rules

- Never imitate a named person's voice, style, cadence, or catchphrases.
- Never name real broadcasters, real teams, real players, leagues, networks, or historic games.
- Avoid unsupported facts such as player names, team histories, standings, or rivalry context unless gameplay state supplies them.
- Avoid repeated phrases across a batch. Track recently used openings and verbs.
- Match emotional intensity to the event.
- Produce caption text that exactly matches generated speech text.
- Prefer one sentence for routine results and two short sentences for major results.
- Use generic football terms that the current prototype supports: quarterback, runner, receiver, defender, sack, tackle, first down, touchdown, sideline, line of scrimmage, and turnover on downs.

## Intensity Guide

- `low`: neutral pre-snap or reset lines.
- `medium`: first down, catch, short run, incompletion, out of bounds.
- `high`: sack, tackle for loss, long gain, fourth-down stop.
- `peak`: touchdown or late-score moment.

## Output Shape

For each requested line, return:

```json
{
  "eventId": "stable-event-id",
  "intensity": "medium",
  "script": "Original spoken line.",
  "caption": "Original spoken line."
}
```

Keep scripts suitable for offline ElevenLabs text-to-speech through `tools/audio/generateSpeech.ts`. Do not include voice-cloning or impersonation direction.
