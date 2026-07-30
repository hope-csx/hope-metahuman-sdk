# @hope-metahuman/sdk

The protocol client for the HOPE Metahuman Service. Zero runtime dependencies,
identical in a browser and in Node.js.

> This package is commercially licensed and is not distributed in this
> repository. See [self-hosting.md](./self-hosting.md) for how to obtain it,
> including registry authentication.

```bash
npm install @hope-metahuman/sdk
```

Most applications need one class, [`MetahumanSession`](#metahumansession), which
composes microphone capture, transcription, the agent turn, gapless audio
playback, and an audio-synchronized animation buffer. The individual clients
below are exported for anything that loop does not cover.

---

## Authentication

Every WebSocket upgrade needs a machine token, obtained by exchanging an API key
at `POST /oauth/token`. Which provider you use depends on where your code runs.

### In a browser: `TokenEndpointProvider`

```ts
import { TokenEndpointProvider } from '@hope-metahuman/sdk';

const tokenProvider = new TokenEndpointProvider({
  url: '/api/hope/stream-token',
  credentials: 'include', // send your session cookie
});
```

Your endpoint authenticates the visitor and returns
`{ "token": "…", "expiresIn": 600 }`. The provider caches the token and refetches
it 30 seconds before it expires.

### On a server: `MachineTokenProvider`

```ts
import { MachineTokenProvider } from '@hope-metahuman/sdk';

const tokenProvider = new MachineTokenProvider({
  baseUrl: process.env.HOPE_API_BASE,
  clientId: process.env.HOPE_CLIENT_ID,
  clientSecret: process.env.HOPE_CLIENT_SECRET,
});
```

**This class must never run in a browser.** It holds an API key secret, which
does not expire. Shipping one to a page hands every visitor permanent access to
your tenant. The constructor throws if it detects a browser, but treat that as a
safety net rather than a boundary you can lean on.

### Other options

`StaticTokenProvider` wraps a token you already have — useful in tests and
short-lived scripts. `CachingTokenProvider` wraps any async function that
returns `{ token, expiresIn }`, and `createTokenProvider` accepts a plain
function or a string when you want to skip the classes entirely.

A `TokenProvider` is a two-method interface, so supplying your own is
straightforward:

```ts
interface TokenProvider {
  getToken(): Promise<string>;
  invalidate(): void; // called on 401/4401 so the next attempt refetches
}
```

## MetahumanSession

```ts
import { MetahumanSession, TokenEndpointProvider } from '@hope-metahuman/sdk';

const session = new MetahumanSession({
  baseUrl: 'https://api.hope-metahuman.example',
  tokenProvider: new TokenEndpointProvider({ url: '/api/hope/stream-token' }),
  voice: { id: 'a1b2c3d4', model: 'sonic-3' },
  metahumanName: 'Dana',
  language: 'en-US',
});
```

### Lifecycle

```ts
await session.unlockAudio(); // must be inside a user gesture
await session.startListening(); // prompts for microphone permission

await session.send('Hello'); // type instead of speak
session.interrupt(); // cut the reply short
await session.stopListening();
await session.dispose();
```

`unlockAudio()` exists because browsers silently discard audio scheduled by a
page the user has not interacted with. Call it in the same click handler that
starts the conversation; without it, the first reply plays to nobody.

### Events

| Event         | Payload                                             | Notes                                                        |
| ------------- | --------------------------------------------------- | ------------------------------------------------------------ |
| `state`       | `'idle' \| 'listening' \| 'thinking' \| 'speaking'` | Drive your status indicator from this                        |
| `userInterim` | `string`                                            | Revisable transcript. Render it; do not act on it            |
| `userMessage` | `string`                                            | A committed utterance, already sent to the agent             |
| `replyToken`  | `string`                                            | A fragment of the reply; concatenate for a typewriter effect |
| `reply`       | `string`                                            | The complete reply, once the turn finishes                   |
| `micLevel`    | `number`                                            | Amplitude in `[0, 1]`, for a level meter                     |
| `agentEvent`  | `{ event, data }`                                   | Non-fatal signals such as `a2f3d_error`                      |
| `error`       | `Error`                                             | The session stays usable unless `state` says otherwise       |

`on()` returns an unsubscribe function:

```ts
const off = session.on('replyToken', (fragment) => transcript.append(fragment));
off();
```

### Driving a face

`currentPose()` returns the blendshape weights for the current audio position,
or `null` when nothing is playing:

```ts
function render(): void {
  const pose = session.currentPose();
  if (pose) avatar.applyPose(pose);
  requestAnimationFrame(render);
}
```

Call it once per frame from your own render loop. It interpolates between
buffered frames using the audio clock, so the face stays in step with the sound
even when frames arrive in bursts. Rendering is deliberately not part of the
session, which is why this package has no 3D dependency —
[`@hope-metahuman/avatar-three`](../avatar-three) wires it to Three.js in about
twenty lines.

### Multi-turn memory

The agent's memory is keyed on `sessionId`. Persist it to resume a conversation
across page loads:

```ts
const sessionId = localStorage.getItem('hope-session') ?? createSessionId();
localStorage.setItem('hope-session', sessionId);

const session = new MetahumanSession({ ...options, sessionId });
```

`reset()` starts a fresh conversation, optionally with a specified id.

## Lower-level clients

### `SttClient`

Streams microphone audio to `/stt` and emits transcripts. Audio must be
**linear16 PCM, 16 kHz, mono** — the endpoint has no format negotiation, and
sending anything else produces confident transcription of nonsense.
`MicrophoneCapture` handles the conversion.

```ts
const stt = new SttClient({ baseUrl, tokenProvider, language: 'en-US' });
stt.on('utterance', (text) => console.log('final:', text));
stt.on('interim', (text) => console.log('partial:', text));

await stt.connect();
stt.sendAudio(pcmChunk);
```

Audio sent before the socket is ready is buffered rather than dropped, up to
roughly two seconds. Beyond that the oldest chunks are discarded, on the
principle that stale speech is worse than a gap.

### `AgentStreamClient`

One conversational turn per connection: send a run envelope, receive interleaved
text, audio, and blendshapes, then the server closes.

```ts
const client = new AgentStreamClient({ baseUrl, tokenProvider });
const run = client.run({
  input: { user_query: 'Tell me about the mission.', session_id: sessionId },
  voice: { id: 'a1b2c3d4', model: 'sonic-3' },
  features: { tts: true, a2f3d: true },
});

run.on('meta', (meta) => console.log(meta.audio)); // format for this run
run.on('llm', (fragment) => process.stdout.write(fragment));
run.on('audio', (chunk) => player.enqueue(chunk));
run.on('blendshapes', (frames) => buffer.append(frames));

const { text } = await run.completed;
```

Read the audio format from the `meta` event rather than assuming it. Deployments
differ, and a hardcoded sample rate plays some tenants' audio at the wrong
pitch. `FALLBACK_AUDIO_FORMAT` is exported for the case where `meta` never
arrives, but it is a last resort, not a default.

`buildRunEnvelope()` validates and constructs the envelope on its own, if you
want to check inputs before opening a socket.

## Audio

| Export                               | Purpose                                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| `MicrophoneCapture`                  | Captures the microphone and emits 16 kHz mono linear16 chunks, resampled in an `AudioWorklet` |
| `PcmPlayer`                          | Gapless playback of streamed PCM, with a monotonic position clock                             |
| `decodePcm`                          | Decodes s16le, s24le, s32le, f32le, μ-law, and A-law into planar floats                       |
| `floatToInt16`, `pcmDurationSeconds` | Conversion and timing helpers                                                                 |

### The AudioWorklet and CSP

`MicrophoneCapture` compiles its processor from a `blob:` URL, which keeps the
SDK a single file with no side-car assets to deploy. A strict Content Security
Policy must therefore allow `worker-src blob:` — or `script-src blob:` on
browsers that do not implement `worker-src`.

If your policy cannot allow `blob:`, write the processor source to a file you
host yourself and pass its URL:

```ts
import { buildSttWorkletSource } from '@hope-metahuman/sdk';

// At build time: writeFileSync('public/hope-stt-worklet.js', buildSttWorkletSource());
new MicrophoneCapture({ workletUrl: '/hope-stt-worklet.js' });
```

## Errors

Every error extends `HopeMetahumanError`, so `instanceof` is the way to branch —
no matching on message text.

| Class                   | Raised when                                                                    | Extra fields          |
| ----------------------- | ------------------------------------------------------------------------------ | --------------------- |
| `ConfigurationError`    | Invalid options — a malformed URL, an oversized field. Thrown before any I/O   |                       |
| `AuthenticationError`   | Token acquisition or the upgrade was rejected                                  | `status`, `retryable` |
| `ConnectionClosedError` | The socket closed before the operation finished                                | `closeCode`           |
| `StreamError`           | The server reported a failure mid-stream                                       | `code`                |
| `ProtocolError`         | A frame did not match the contract — usually an SDK too old for the deployment |                       |
| `MediaError`            | Microphone access or audio playback was refused                                |                       |

```ts
import { AuthenticationError, StreamError } from '@hope-metahuman/sdk';

session.on('error', (error) => {
  if (error instanceof AuthenticationError) {
    if (error.retryable) scheduleRetry();
    else redirectToLogin();
  } else if (error instanceof StreamError && error.code === 'RATE_LIMITED') {
    showBackoffNotice();
  }
});
```

`AuthenticationError.status` is `401` whether the key ID is unknown, the secret
is wrong, or the key was revoked. The service returns the same status for all
three to prevent enumeration, so the status cannot tell you which mistake you
made — check the key ID first, since that is the most common one.

`ErrorCode` exports the stream codes worth branching on.

Error messages never include a token endpoint's response body, because that body
is not guaranteed to be free of the submitted credential in every failure mode.

## Using this in Node.js

Node has no global `WebSocket` before v22, so supply one:

```ts
import WebSocket from 'ws';

const session = new MetahumanSession({
  baseUrl,
  tokenProvider,
  voice,
  authMode: 'header', // no query-string token outside a browser
  webSocketFactory: ({ url, protocols, headers }) => new WebSocket(url, protocols, { headers }),
});
```

Set `authMode: 'header'` wherever you can. The browser default of `query` exists
only because the `WebSocket` constructor cannot set headers; query strings reach
proxy access logs, which is tolerable for a ten-minute token and needless
elsewhere.

Audio playback and microphone capture require Web Audio and are browser-only.
The protocol clients, decoding, and the blendshape buffer all work in Node.

## Licence

This documentation is [MIT](../LICENSE) licensed. The package it describes is
proprietary and commercially licensed — see [../NOTICE.md](../NOTICE.md).
