# Life Replay — Mobile App

Expo / React Native client for [Life Replay](https://github.com/amuqsit57/LifeReplayAi-backend).

> Your family captures the moments. AI makes the movie.

Create an event, let everyone dump their photos and videos into it, and Life Replay
works out what happened, picks the moments that matter, and cuts them into a
finished film — while every original stays in a private family vault.

## Requirements

- Node 18+
- [Expo Go](https://expo.dev/go) (SDK 54), or an emulator
- The backend running — see the backend repo

## Run

```bash
npm install
npm start        # then scan the QR
```

Expo Go works for the whole flow: image picking and video playback need no native
modules beyond what Expo Go ships.

## The flow

```
sign up → create or join a family → create an event → add photos & videos
        → AI understands each one → generate a Replay → watch
```

| Screen | File |
| --- | --- |
| Sign in / sign up | [app/auth/](app/auth/) |
| Create or join a family | [app/family-setup.js](app/family-setup.js) |
| Events list, invite code | [app/home.js](app/home.js) |
| Event: upload, gallery, styles | [app/event/[id].js](app/event/%5Bid%5D.js) |
| Replay playback + the edit | [app/replay/[id].js](app/replay/%5Bid%5D.js) |

## How uploads work

The device never sends media through the backend. It asks for a signed URL, PUTs
the file straight to Google Cloud Storage, then confirms — see
[src/lib/upload.js](src/lib/upload.js). A 200MB video would otherwise be proxied
through a Python process for no reason.

Confirmation is a separate call so a failed upload stays visible as `uploading`
rather than silently disappearing, and one bad file never abandons the rest of a
batch.

## Polling

Analysis and rendering take minutes, so the event and replay screens poll while
work is outstanding and stop once everything settles. Nobody should have to
pull-to-refresh to find out whether their film is ready.

## Configuration

[app.json](app.json) under `expo.extra`:

```json
"supabaseUrl": "https://xxxx.supabase.co",
"supabaseAnonKey": "sb_publishable_...",
"apiUrl": null
```

Omit a key rather than setting it to `null` — Expo resolves `null` to `{}` at
runtime, which reads as configured and fails confusingly later.

Leave `apiUrl` out in development and the backend host is derived from Metro, so a
physical device reaches your laptop without anyone hardcoding a LAN IP.

The publishable key is safe to ship: row level security is what protects family
media, and it is enforced in the database.

## Layout

```
app/                 Expo Router routes
src/
  lib/
    supabase.js      Client + session
    api.js           FastAPI client
    data.js          Supabase reads and writes
    upload.js        Pick → signed URL → confirm
    config.js        Reads expo.extra safely
  ui/index.js        Screen, Card, Button, Field, Pill…
  theme.js           Dark, media-first palette
  store.js           Session state
```

## Stack

Expo SDK 54 · React Native 0.81 · Expo Router · TanStack Query · Zustand ·
Supabase · expo-image-picker · expo-av
