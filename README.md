# HOPE Metahuman SDK — examples and documentation

Everything you need to put a talking Standard 3D or Premium live-video
Metahuman in a web or React Native application: worked examples, integration
guides, and the API reference for the **HOPE Metahuman Service** SDK.

[![License: MIT](https://img.shields.io/badge/Repository-MIT-blue.svg)](./LICENSE)
[![SDK: Commercial](https://img.shields.io/badge/SDK%20bundles-Commercial-orange.svg)](./NOTICE.md)

```html
<script
  type="module"
  src="https://cdn.svc.hopemtp.app/sdk/v0.1/hope-metahuman-embed.standalone.js"
></script>

<hope-metahuman
  base-url="https://api.hope-metahuman.example"
  token-endpoint="/api/hope/stream-token"
  metahuman-id="3f9a2b71-5c4d-4e18-b062-7a1e9d3c8f40"
  model-url="/models/your-avatar.glb"
></hope-metahuman>
```

That is a complete integration. The element handles microphone capture,
transcription, the agent turn, gapless audio playback, and lip-synced facial
animation. The bundle embeds its own three.js, so there is nothing else to load.

---

## What is in this repository, and what is not

**This repository is MIT licensed and contains no SDK source code.**

|                                     |                                                       |
| ----------------------------------- | ----------------------------------------------------- |
| **Here, MIT licensed**              | Examples, documentation, and tooling. Copy any of it. |
| **Not here, commercially licensed** | The SDK bundle itself, delivered from the CDN.        |

The SDK is proprietary. It is built from a private repository, shipped minified
and obfuscated, and requires a commercial agreement to use. This repository
shows you how to use it and documents every part of its API — it just does not
contain its implementation.

See [NOTICE.md](./NOTICE.md) for the precise split, and
[docs/self-hosting.md](./docs/self-hosting.md) for how to obtain the bundles.

No 3D avatar models are distributed here either. Bring your own
ARKit-compatible GLB, or load a platform-hosted model with your entitlement —
see [docs/avatars.md](./docs/avatars.md).

## One bundle, several ways in

The SDK ships as a single file, `hope-metahuman-embed.standalone.js`. Three.js
and the Premium Avatar media client are bundled inside it, so a page needs one
script tag and no import map. Everything below is an export of that one file
rather than a separate thing to install:

| Export                                          | What it is                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `<hope-metahuman>`                              | The custom element. Registers itself when the bundle loads. Standard and Premium Metahumans.      |
| `MetahumanSession`                              | The conversation loop — microphone, transcription, agent turn, speech playback, animation buffer. |
| `AgentStreamClient`, `SttClient`                | The protocol clients, for one turn or one transcript at a time.                                   |
| `MachineTokenProvider`, `TokenEndpointProvider` | Authentication.                                                                                   |
| `AvatarRenderer`, `FaceController`              | Three.js rendering: loads a GLB, drives its morph targets, animates blink and gaze.               |
| `loadLiveAvatar()`                              | Premium Avatar WebRTC renderer, fetched on demand.                                                |

Choose by how much control you want:

- **A static page, no build step** → the `<hope-metahuman>` element, one script
  tag. See [docs/embed-element.md](./docs/embed-element.md).
- **Your own interface, our rendering** → `MetahumanSession` plus
  `AvatarRenderer`. See [docs/javascript-api.md](./docs/javascript-api.md).
- **Your own rendering engine, or no avatar at all** → `MetahumanSession` on its
  own, and read the blendshape buffer yourself.
- **A React Native application** → copy the typed
  [`HopeMetahumanView`](./examples/react-native/components/HopeMetahumanView.tsx).

React Native is available today through the reusable WebView component in this
repository; a fully native audio/rendering package remains on the roadmap.

## Getting the SDK

There is nothing to install. Load the bundle from the CDN:

```html
<script
  type="module"
  src="https://cdn.svc.hopemtp.app/sdk/v0.1/hope-metahuman-embed.standalone.js"
></script>
```

Or import from it, when you want the API rather than the element:

```js
import { MetahumanSession } from 'https://cdn.svc.hopemtp.app/sdk/v0.1/hope-metahuman-embed.standalone.js';
```

Importing also defines `<hope-metahuman>`, which is harmless if you never use
the element.

Serving the file from your own origin is supported and is the only way this runs
on an air-gapped network — `pnpm vendor` downloads it and checks it against its
published SRI hash. Full instructions, including version pinning, subresource
integrity, and Content-Security-Policy:
[docs/self-hosting.md](./docs/self-hosting.md).

## Quick start

### 1. Get a credential to the browser

Your API key secret must never reach a browser. It does not expire, and anything
you ship to a page is readable by everyone who loads it. Instead, expose one
small endpoint on your own backend that mints a short-lived machine token for
signed-in users:

```js
app.get('/api/hope/stream-token', requireSignedInUser, async (_req, res) => {
  const response = await fetch(new URL('/oauth/token', process.env.HOPE_API_BASE), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: process.env.HOPE_CLIENT_ID,
      client_secret: process.env.HOPE_CLIENT_SECRET,
    }),
  });

  const { access_token, expires_in } = await response.json();
  res.set('Cache-Control', 'no-store').json({ token: access_token, expiresIn: expires_in });
});
```

The SDK is a browser bundle, so there is nothing to install on your server — the
exchange is one HTTPS call. Two properties make it safe: your own authentication
runs first, and what the browser receives expires in ten minutes. A complete,
runnable version, with caching and a refresh margin, is in
[`examples/token-server`](./examples/token-server).

Do not proxy the WebSockets themselves. Let the browser connect to the service
directly — relaying audio through your backend adds latency to a
latency-sensitive path.

Just evaluating? The [static example](./examples/static-chat) will exchange an
API key from the browser if you type one into its settings panel, so you can
skip this step entirely until you have seen the thing work. That is a
`localhost` shortcut and nothing more — see
[Security notes](#security-notes).

### 2. Drop in the element

```html
<hope-metahuman
  base-url="https://api.hope-metahuman.example"
  token-endpoint="/api/hope/stream-token"
  metahuman-id="3f9a2b71-5c4d-4e18-b062-7a1e9d3c8f40"
  model-url="/models/your-avatar.glb"
></hope-metahuman>
```

For a Premium Avatar, keep `metahuman-id`, omit `model-url`, and optionally add
`poster-url`. The same element starts its live session and displays the
lip-synced WebRTC stream.

### 3. Or build your own interface

```js
import {
  AvatarRenderer,
  MetahumanSession,
  TokenEndpointProvider,
} from 'https://cdn.svc.hopemtp.app/sdk/v0.1/hope-metahuman-embed.standalone.js';

const session = new MetahumanSession({
  baseUrl: 'https://api.hope-metahuman.example',
  tokenProvider: new TokenEndpointProvider({ url: '/api/hope/stream-token' }),
  metahumanId: '3f9a2b71-5c4d-4e18-b062-7a1e9d3c8f40',
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

| Topic                                        | Where                                                                |
| -------------------------------------------- | -------------------------------------------------------------------- |
| Element attributes, events, and theming      | [docs/embed-element.md](./docs/embed-element.md)                     |
| Protocol client API                          | [docs/javascript-api.md](./docs/javascript-api.md)                   |
| Avatar rendering and the renderer API        | [docs/three-renderer.md](./docs/three-renderer.md)                   |
| Premium Avatar lifecycle and renderer        | [docs/premium-avatars.md](./docs/premium-avatars.md)                 |
| Avatar model requirements                    | [docs/avatars.md](./docs/avatars.md)                                 |
| Obtaining, pinning, and self-hosting the SDK | [docs/self-hosting.md](./docs/self-hosting.md)                       |
| Commercial licence terms                     | [docs/commercial-license.md](./docs/commercial-license.md)           |
| Running the static example                   | [examples/static-chat/README.md](./examples/static-chat/README.md)   |
| A token endpoint you can copy                | [examples/token-server/README.md](./examples/token-server/README.md) |
| React Native Standard/Premium component      | [examples/react-native/README.md](./examples/react-native/README.md) |
| Service protocol reference                   | Your deployment's docs site                                          |

The CDN bundle does not carry TypeScript declarations, so the pages above are
the reference — a URL import types as `any`, and an editor will not hover-document
it. If you want types, declare the shapes you use in your own project against
[docs/javascript-api.md](./docs/javascript-api.md), which documents every option,
method, and event with its exact type.

## Security notes

This SDK is used in front of systems on a FedRAMP Moderate authorization path.
A few consequences are worth stating plainly:

- **Never ship an API key secret to a browser.** Not in HTML, not in a script
  tag, not in an environment variable your bundler inlines. A secret does not
  expire, so one page view lets a visitor use your tenant indefinitely, and
  revoking it means revoking the key for everyone. Use `TokenEndpointProvider`
  or your own `TokenProvider`; keep `MachineTokenProvider` on a server. Runtime
  detection is not a security boundary—your architecture is. On `localhost`,
  the static example can exchange a key entered at runtime; move that exchange
  to a server before deployment.
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
- Live Premium Avatar sessions and WebRTC rendering
- React Native Standard/Premium example and reusable component

Planned:

- `@hope-metahuman/react` — hooks and a `<Metahuman />` component built on
  React Three Fiber
- `@hope-metahuman/angular` — a component and injectable service
- `@hope-metahuman/react-native` — fully native audio capture/playback and
  rendering (the current component uses the supported browser SDK in a WebView)
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
