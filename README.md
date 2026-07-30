# HOPE Metahuman SDK — examples and documentation

Everything you need to put a talking 3D metahuman on a web page: worked
examples, integration guides, and the full API reference for the **HOPE
Metahuman Service** SDK — real-time avatar animation, speech-to-text, speech
synthesis, and a conversational agent.

[![License: MIT](https://img.shields.io/badge/Repository-MIT-blue.svg)](./LICENSE)
[![SDK: Commercial](https://img.shields.io/badge/SDK%20bundles-Commercial-orange.svg)](./NOTICE.md)

```html
<script
  type="module"
  src="https://cdn.hope-lms.app/sdk/v0.1/hope-metahuman-embed.standalone.js"
></script>

<hope-metahuman
  base-url="https://api.hope-metahuman.example"
  token-endpoint="/api/hope/stream-token"
  model-url="/models/your-avatar.glb"
  voice-id="a1b2c3d4"
  voice-model="sonic-3"
  metahuman-name="Dana"
></hope-metahuman>
```

That is a complete integration. The element handles microphone capture,
transcription, the agent turn, gapless audio playback, and lip-synced facial
animation. The bundle embeds its own three.js, so there is nothing else to load.

---

## What is in this repository, and what is not

**This repository is MIT licensed and contains no SDK source code.**

|                                     |                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------- |
| **Here, MIT licensed**              | Examples, documentation, and tooling. Copy any of it.                  |
| **Not here, commercially licensed** | The SDK bundles themselves, delivered from the CDN or GitHub Packages. |

The SDK is proprietary. It is built from a private repository, shipped minified
and obfuscated, and requires a commercial agreement to use. This repository
shows you how to use it and documents every part of its API — it just does not
contain its implementation.

See [NOTICE.md](./NOTICE.md) for the precise split, and
[docs/self-hosting.md](./docs/self-hosting.md) for how to obtain the bundles.

No 3D avatar models are distributed here either. Bring your own
ARKit-compatible GLB, or load a platform-hosted model with your entitlement —
see [docs/avatars.md](./docs/avatars.md).

## The packages

| Package                              | What it is                                                                                           | Size                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------- |
| `@hope-metahuman/sdk`                | The protocol client. Auth, WebSocket streaming, audio, animation buffering. No runtime dependencies. | ~14 KB min           |
| `@hope-metahuman/avatar-three`       | Three.js renderer. Loads a GLB, drives its morph targets, animates blink and gaze.                   | ~6 KB min + `three`  |
| `@hope-metahuman/embed`              | The `<hope-metahuman>` custom element. Everything above, in one tag.                                 | ~42 KB min + `three` |
| `hope-metahuman-embed.standalone.js` | The element with three.js bundled in. One script tag, no import map.                                 | ~655 KB min          |

Choose by how much control you want:

- **A static page, no build step** → the standalone bundle from the CDN.
- **An application with a bundler** → `@hope-metahuman/embed` from npm, so your
  own three.js is the only copy.
- **Your own interface, our rendering** → `@hope-metahuman/sdk` +
  `@hope-metahuman/avatar-three`.
- **Your own rendering engine, or no avatar at all** → `@hope-metahuman/sdk`.

Native React, Angular, React Native, and Swift/Kotlin packages are planned; see
[Roadmap](#roadmap).

## Getting the SDK

```bash
# Static sites — nothing to install
# https://cdn.hope-lms.app/sdk/v0.1/hope-metahuman-embed.standalone.js

# Application builds — restricted registry, licence credentials required
npm install @hope-metahuman/embed three
```

Full instructions, including air-gapped self-hosting, registry authentication,
version pinning, and Content-Security-Policy:
[docs/self-hosting.md](./docs/self-hosting.md).

## Quick start

### 1. Get a credential to the browser

Your API key secret must never reach a browser. It does not expire, and anything
you ship to a page is readable by everyone who loads it. Instead, expose one
small endpoint on your own backend that mints a short-lived machine token for
signed-in users:

```ts
import { MachineTokenProvider } from '@hope-metahuman/sdk';

const tokens = new MachineTokenProvider({
  baseUrl: process.env.HOPE_API_BASE,
  clientId: process.env.HOPE_CLIENT_ID,
  clientSecret: process.env.HOPE_CLIENT_SECRET,
});

app.get('/api/hope/stream-token', requireSignedInUser, async (_req, res) => {
  res.json({ token: await tokens.getToken(), expiresIn: 600 });
});
```

Two properties make this safe: your own authentication runs first, and what the
browser receives expires in ten minutes.

Do not proxy the WebSockets themselves. Let the browser connect to the service
directly — relaying audio through your backend adds latency to a
latency-sensitive path.

### 2. Drop in the element

```html
<hope-metahuman
  base-url="https://api.hope-metahuman.example"
  token-endpoint="/api/hope/stream-token"
  model-url="/models/your-avatar.glb"
  voice-id="a1b2c3d4"
  voice-model="sonic-3"
></hope-metahuman>
```

### 3. Or build your own interface

```ts
import { MetahumanSession, TokenEndpointProvider } from '@hope-metahuman/sdk';
import { AvatarRenderer } from '@hope-metahuman/avatar-three';

const session = new MetahumanSession({
  baseUrl: 'https://api.hope-metahuman.example',
  tokenProvider: new TokenEndpointProvider({ url: '/api/hope/stream-token' }),
  voice: { id: 'a1b2c3d4', model: 'sonic-3' },
  metahumanName: 'Dana',
});

session.on('replyToken', (fragment) => transcript.append(fragment));
session.on('state', (state) => statusPill.set(state));

const avatar = new AvatarRenderer({
  canvas: document.querySelector('canvas'),
  modelUrl: '/models/your-avatar.glb',
  poseSource: () => session.currentPose(),
});
await avatar.load();
avatar.start();

// Inside a click handler — browsers discard audio scheduled without a gesture.
startButton.addEventListener('click', async () => {
  await session.unlockAudio();
  await session.startListening();
});
```

## How a conversation works

```
microphone ──► /stt ──────► utterance
                              │
                              ▼
                        /agent-stream
                              │
       ┌──────────────────────┼──────────────────────┐
       ▼                      ▼                      ▼
  text fragments        binary PCM audio      blendshape frames
       │                      │                      │
       ▼                      ▼                      ▼
   transcript          gapless playback       facial animation
                              └──── audio clock ─────┘
```

Three things about this pipeline drive most of the SDK's design, and they are
worth knowing even if you never touch the low-level clients:

**Audio format is announced, not assumed.** Each run's `meta` envelope states
the sample rate, encoding, and channel count. Deployments differ — a tenant
running its own speech synthesis may be configured differently from the public
service — so a client that hardcodes 44.1 kHz plays that tenant's audio at the
wrong pitch, with no error to explain why.

**Animation is sampled against the audio clock, never applied on arrival.**
Blendshape frames carry a `timeCode` in seconds from the start of the audio, and
they arrive over the network far faster than the audio plays. Applying them as
they arrive gives you a face that finishes talking well before the sound does.

**One run per connection.** A turn of conversation is one WebSocket that the
server closes when the reply ends. Multi-turn memory comes from reusing a
`sessionId` across connections, not from keeping a socket open.

## Documentation

| Topic                                        | Where                                                              |
| -------------------------------------------- | ------------------------------------------------------------------ |
| Element attributes, events, and theming      | [docs/embed-element.md](./docs/embed-element.md)                   |
| Protocol client API                          | [docs/javascript-api.md](./docs/javascript-api.md)                 |
| Avatar rendering and the renderer API        | [docs/three-renderer.md](./docs/three-renderer.md)                 |
| Avatar model requirements                    | [docs/avatars.md](./docs/avatars.md)                               |
| Obtaining, pinning, and self-hosting the SDK | [docs/self-hosting.md](./docs/self-hosting.md)                     |
| Commercial licence terms                     | [docs/commercial-license.md](./docs/commercial-license.md)         |
| Running the static example                   | [examples/static-chat/README.md](./examples/static-chat/README.md) |
| Service protocol reference                   | Your deployment's docs site                                        |

The published packages ship TypeScript declarations with full JSDoc, so editor
hover documentation is the fastest reference for anything not covered above —
the implementation is obfuscated, but the API surface is fully typed and
documented.

## Security notes

This SDK is used in front of systems on a FedRAMP Moderate authorization path.
A few consequences are worth stating plainly:

- **Never ship an API key secret to a browser.** Use `TokenEndpointProvider` or
  your own `TokenProvider`. `MachineTokenProvider` is server-side only.
- **Tokens are held in memory, never in `localStorage` or `sessionStorage`.**
  The SDK never writes a credential to storage, and neither should you.
- **Query-string tokens are a browser-only concession.** The `WebSocket`
  constructor cannot set headers. Query strings reach proxy access logs and
  browser history, which is tolerable for a ten-minute token and never
  acceptable for a key secret. Server runtimes should use `authMode: 'header'`.
- **Obfuscation is not a security boundary.** The bundles are obfuscated to
  deter casual reuse, not to hide anything. Nothing secret is embedded in code
  that runs on a machine someone else controls — which is exactly why the SDK
  has no API key path in the browser at all.
- **Content Security Policy.** Microphone capture loads an `AudioWorklet` from a
  `blob:` URL, so `worker-src blob:` (or `script-src blob:` where `worker-src`
  is absent) is required. If you cannot allow it, host the processor yourself
  and pass `workletUrl` — see [docs/javascript-api.md](./docs/javascript-api.md).
- **Error messages carry no credentials.** The SDK never includes a token
  endpoint's response body in an error, because that body is not guaranteed to
  be free of the submitted credential in every failure mode.

Report a vulnerability privately — see [SECURITY.md](./SECURITY.md).

## Running the example locally

Requires Node 20+ and pnpm 9+.

```bash
pnpm install
pnpm vendor        # download the SDK bundle (needs licence credentials)
pnpm example       # serve the static example on :4173
```

The example runs without `pnpm vendor` too: it falls back to the CDN, and if
neither is reachable it says so on the page rather than failing silently.

| Script                              | What it does                                                        |
| ----------------------------------- | ------------------------------------------------------------------- |
| `pnpm vendor`                       | Downloads the SDK bundle into the example and verifies its SRI hash |
| `pnpm example`                      | Serves the static example on `:4173`                                |
| `pnpm smoke`                        | Drives the example in a real browser                                |
| `pnpm lint`                         | Lints the examples and scripts                                      |
| `pnpm format` / `pnpm format:check` | Prettier                                                            |
| `pnpm clean`                        | Removes the vendored bundle                                         |

See [CONTRIBUTING.md](./CONTRIBUTING.md) for conventions.

## Roadmap

Available now:

- Browser and Node.js protocol client
- Three.js avatar rendering
- `<hope-metahuman>` custom element for static sites

Planned:

- `@hope-metahuman/react` — hooks and a `<Metahuman />` component built on
  React Three Fiber
- `@hope-metahuman/angular` — a component and injectable service
- `@hope-metahuman/react-native` — native audio capture and playback, with
  three.js rendering through `expo-gl`
- Native Swift and Kotlin clients
- Worked examples for each, in this repository

Each new package will follow the same split: the implementation ships as a
commercially licensed artifact, and its documentation and examples land here
under MIT.

## Licence

The contents of this repository are [MIT](./LICENSE) © CornerstoneX.

The SDK bundles are proprietary and separately licensed — see
[NOTICE.md](./NOTICE.md) and
[docs/commercial-license.md](./docs/commercial-license.md).
