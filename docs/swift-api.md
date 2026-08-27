# Swift API

The native Swift SDK puts a talking Metahuman in an iOS or macOS application
with no WebView anywhere: native microphone capture, native gapless playback,
SceneKit facial animation, and LiveKit-based premium avatars. It speaks the
same wire protocol as the browser bundle, against the same endpoints —
`/oauth/token`, `/stt`, `/agent-stream`, and `/live-avatar-sessions` — so a
deployment that serves the web SDK serves this one unchanged.

Two packages:

| Package             | What it is                                                                                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HopeMetahuman`     | The SDK: protocol clients, token providers, `MetahumanSession`, audio, SceneKit rendering, and the SwiftUI `HopeMetahumanView`.                                                                     |
| `HopeMetahumanLive` | Premium and Ultra Premium live avatars over WebRTC (LiveKit). Separate so a Standard 3D application never links WebRTC — the same split the web SDK makes by dynamically importing its live module. |

Like the browser bundle, the implementation is commercially licensed and is
not in this repository; it ships as a Swift package under your commercial
agreement. The first packaged release is Swift SDK `v0.1.0`; its version line
is independent of the browser bundle's patch number. This page is its
reference.

Requirements: iOS 16 / macOS 13, and `NSMicrophoneUsageDescription` in
Info.plist for anything that listens.

## Installation

Obtain `HopeMetahumanSwift-v0.1.0.zip` and its adjacent `.sha256` file through
your licensed distribution channel. Verify the archive before extracting it:

```sh
shasum -a 256 -c HopeMetahumanSwift-v0.1.0.zip.sha256
```

Keep the two package directories together. In Xcode, choose **File → Add
Package Dependencies… → Add Local…**, select `packages/sdk-swift`, and add the
`HopeMetahuman` product to your application target. Applications rendering
either premium tier also add the sibling `packages/sdk-swift-live` package and its
`HopeMetahumanLive` product; the live package resolves the core through the
relative sibling path. The archive is source under the commercial licence—it
is not published to the public browser CDN or committed to this MIT repository.

## The embedded view

The SwiftUI counterpart of the [`<hope-metahuman>` element](./embed-element.md),
for Standard 3D avatars:

```swift
import HopeMetahuman

HopeMetahumanView(
  HopeMetahumanConfiguration(
    session: MetahumanSessionOptions(
      baseURL: "https://api.hope-metahuman.example",
      tokenProvider: TokenEndpointProvider(
        .init(url: URL(string: "https://your-backend.example/api/hope/stream-token")!)
      ),
      metahumanId: "3f9a2b71-5c4d-4e18-b062-7a1e9d3c8f40"
    ),
    avatar: AvatarViewOptions(modelURL: modelURL)
  )
)
```

That is a complete integration: a start gate (audio output must be unlocked by
direct user interaction, the same rule the web enforces), the configured
greeting, microphone capture and transcription, the agent turn, gapless
playback, and lip-synced facial animation.

The view renders SceneKit formats — `.usdz`, `.scn`, `.dae`. A GLB from the
web pipeline can be converted with Apple's Reality Converter, but validate the
result: conversion can change material or rig metadata. The resulting model
must retain the 52 ARKit blendshape names described in
[docs/avatars.md](./avatars.md), in any supported naming convention.

For custom chrome, use `HopeMetahumanController` — an `ObservableObject`
publishing `state`, `transcript`, `userInterim`, `micLevel`, and `lastError` —
with your own layout, placing a `MetahumanAvatarView` wherever it belongs:

```swift
let controller = HopeMetahumanController(configuration)
// your button:
Task { await controller.start() }
// your input field:
controller.send(text)
controller.setMicrophoneEnabled(false)
controller.stop()
```

## Authentication

The provider contract mirrors the JavaScript one:

```swift
public protocol TokenProvider: Sendable {
  func token() async throws -> String
  func invalidate() async   // called after UNAUTHORIZED so the next attempt refetches
}
```

- **`TokenEndpointProvider`** — fetches short-lived tokens from an endpoint on
  _your_ backend, which applies your authentication before minting. **This is
  the correct provider for a distributed app.** Accepts both response shapes
  (`{token, expiresIn}` and `{access_token, expires_in}`), caches, and
  refreshes 30 seconds early.
- **`MachineTokenProvider`** — exchanges an API key at `POST /oauth/token`.
  Trusted environments only: an IPA is as readable as a JS bundle, so the
  secret must not ship in an app.
- **`StaticTokenProvider`**, **`ClosureTokenProvider`** — demos and
  bring-your-own plumbing.
- **`CachingTokenProvider`** — the caching layer itself (an actor), reusable
  around any mint function. Concurrent cold-cache callers share one in-flight
  request, which matters against the token endpoint's 20-requests-per-minute
  budget.

One deliberate difference from the browser: the default WebSocket auth mode is
**`header`** (`Authorization: Bearer` on the upgrade request), not `query`.
Browsers can't set upgrade headers; URLSession can, and query strings reach
proxy access logs where headers do not. `query` and `cookie` remain available
on every client's options.

## `MetahumanSession`

The conversation loop, mirroring the
[JavaScript session](./javascript-api.md) API and semantics:

```swift
let session = try MetahumanSession(
  MetahumanSessionOptions(baseURL: baseURL, tokenProvider: provider, metahumanId: metahumanId)
)

session.onStateChange   = { state in ... }          // idle / listening / thinking / speaking
session.onUserInterim   = { text in ... }           // render it; do not act on it
session.onUserMessage   = { text in ... }
session.onReplyToken    = { fragment in ... }
session.onReply         = { text in ... }
session.onMicLevel      = { level in ... }          // RMS in [0, 1]
session.onAgentEvent    = { name, data in ... }     // ignore names you don't recognize
session.onToolsAccepted = { names in ... }          // per turn; empty means all refused
session.onTool          = { name, ok in ... }
session.onAudioTransport = { transport in ... }     // .binary or .liveAvatar
session.onError         = { error in ... }

try await session.unlockAudio()      // from a button tap
try await session.greet()            // after mounting the renderer; requires metahumanId
try await session.startListening()   // prompts for microphone permission

try await session.send("Hello")      // type instead of speak
try await session.interrupt()        // cut the reply short; live video waits for playback flush
await session.stopListening()
session.setMicrophoneMuted(true)     // silence without releasing the device
session.reset()                      // new conversation memory
try await session.dispose()
```

Everything the web session documents holds here: `greet()` is idempotent per
conversation and speaks one random configured greeting; committed non-empty
utterances interrupt playback while VAD-only signals never do; `send` cuts the
current reply short first and awaits the renderer's flush before releasing
replacement speech; tool handlers are read at each turn's start; cancellation
surfaces as `HopeMetahumanError.runCancelled` and is normal control flow — the
session swallows it on the hands-free path.

Construction requires `metahumanId` or a complete `voice` (`AgentStreamVoice`,
model default `sonic-3`). Options mirror the JS session: `sessionId`
(generated as `conv-<uuid>`), `metahumanName`, `userName`, `language`,
`archetypeId`, `scenarioFields`, `tools`, `features` (defaults
`{tts: true, a2f3d: true}`), `leadInSeconds` (0.1), `releaseDurationMs` (300),
`authMode`, plus native extras: `endUserRef` (the protocol's opaque end-user
reference) and injectable `connector` / `speechPlayerFactory` /
`microphoneFactory` for tests and custom audio pipelines.

### Rendering seam

Rendering is not baked into the session. `session.poseProvider` is a
thread-safe `FacePoseProvider`; call `currentPose()` once per frame **from any
render thread**:

```swift
func renderer(_ renderer: SCNSceneRenderer, updateAtTime time: TimeInterval) {
  if let pose = poseProvider.currentPose() {   // nil means idle
    faceController.apply(pose)
  }
}
```

It samples the blendshape buffer against the audio clock (never wall time —
the 100 ms lead-in and any network stall would desynchronize lips from sound),
interpolates between the ~30 fps animation frames, and eases the final pose
back to neutral over `releaseDurationMs` when the reply ends.

`MetahumanAvatarView` (an `SCNView`) does this for you, layering the
autonomous idle animation — blink, saccades, gaze drift — under the speech
pose, with the element's framing options: `framing` (`head`/`bust`/`full`),
`background`, `cameraFov` (default 28), `cameraPosition`/`cameraTarget`, and
per-shape `blendshapeScales`.

## Protocol clients

For one turn or one transcript at a time, the lower-level clients mirror their
JS namesakes.

**`AgentStreamClient`** — one turn per WebSocket, matching the
[protocol contract](./javascript-api.md):

```swift
let client = try AgentStreamClient(.init(baseURL: baseURL, tokenProvider: provider))
let run = try await client.run(
  AgentRunOptions(userQuery: "Good morning.", sessionId: sessionId, metahumanId: metahumanId,
                  features: AgentStreamRunFeatures(tts: true, a2f3d: true))
)
for await event in run.events {
  switch event {
  case .meta(let meta): player.beginReply(format: meta.audio)
  case .token(let fragment): append(fragment)
  case .audio(let chunk): player.enqueue(chunk)
  case .blendshapes(let frames): buffer.append(frames)
  case .event, .tool: break
  }
}
let result = try await run.result()
```

`run.events` buffers from the moment the run is created, so nothing is missed
before iteration starts. Client tool calling works exactly as on the web:
supply `tools: [name: handler]` (max 32; names must match active `CLIENT`
bindings), the accepted subset arrives on `meta.tools`, handlers answer
`tool_call` frames mid-run, a thrown error crosses the wire as its message
only (truncated to 512 characters), and a failed tool does not fail the run.
Input limits are enforced before any I/O as
`HopeMetahumanError.configuration`.

**`SttClient`** — streaming transcription. Audio must be 16 kHz mono
little-endian 16-bit PCM; there is no negotiation and no server-side
resampling. Audio sent before the server's `ready` is buffered, then flushed.
`onInterim`/`onFinal`/`onUtterance` mirror the web events; `finalize()` gives
push-to-talk a deterministic utterance boundary. `MicrophoneCapture` produces
exactly the right format, with voice processing (echo cancellation above all —
it is what stops the metahuman's own speech being transcribed back) enabled by
default, and mute-as-silence so endpointing stays warm.

**Audio utilities** — `PcmCodec` (s16le/f32le/µ-law/A-law decode, asymmetric
int16 encode), `PcmChunkQueue` (the gapless scheduling core and animation
clock), `PcmPlayer` (AVFoundation playback), `BlendshapeBuffer`,
`blendPoses`/`scalePose`, `arkitBlendshapeNames`/`speechBlendshapeNames`,
`normalizeBlendshapeName`.

## Premium avatars

`LiveAvatarSessionClient` mirrors the REST contract in
[docs/premium-avatars.md](./premium-avatars.md) — `start` (with
`deferGreeting`), `renew`, `cancelPlayback` (resolves only after the renderer
acknowledges the flush), `end` — with the same status semantics: 409 means not
a premium avatar (fall back), 503 means no live rendering for that tier in this
deployment, 404 on renew means the lease already expired.

Both premium tiers use this one client and coordinator. Nothing below branches
on the tier, and a Metahuman's `avatarTier` (`STANDARD_3D` | `PREMIUM` |
`ULTRA_PREMIUM`) is informational — useful for a badge in your own UI, not for
choosing a code path.

`HopeMetahumanLive` adds the media plane. `LiveAvatarCoordinator` runs the
documented start sequence in the correct — and deadlock-prone if hand-rolled —
order: start with `deferGreeting`, join the room, assign
`session.liveAvatarSessionId` and the playback controller, begin the greeting
_concurrently_ with the media boundary, renew the lease a minute before
expiry:

```swift
import HopeMetahumanLive

let coordinator = LiveAvatarCoordinator(sessionClient: liveClient, session: session)
try await coordinator.start(metahumanId: metahumanId)
// SwiftUI:
LiveAvatarVideoView(trackPort: coordinator.videoTrack)
```

On a live-avatar turn the session plays nothing locally — the avatar's own
audio track carries the reply — and barge-in covers both planes: the local
stop is synchronous, the media plane waits for the acknowledged cancel.

## Errors

One enum, `HopeMetahumanError`, carrying the same taxonomy as the JS error
classes: `.configuration`, `.authentication(message:status:)`,
`.serviceRequest(message:status:)`, `.stream(message:code:)`,
`.protocolViolation`, `.connectionClosed(message:closeCode:)`,
`.runCancelled(reason:)`, `.media`. `isRetryable` mirrors the web rule
(no status, 429, or 5xx). `ErrorCode` and `CloseCode` expose the wire
constants; branch on the error envelope's `code`, not the close code — 1008
covers both auth failure and rate limiting.

## Relationship to the browser SDK

| Web export                                           | Swift counterpart                                      |
| ---------------------------------------------------- | ------------------------------------------------------ |
| `<hope-metahuman>`                                   | `HopeMetahumanView` / `HopeMetahumanController`        |
| `MetahumanSession`                                   | `MetahumanSession`                                     |
| `AgentStreamClient`, `SttClient`                     | Same names                                             |
| `TokenEndpointProvider`, `MachineTokenProvider`      | Same names                                             |
| `AvatarRenderer`, `FaceController`                   | `MetahumanAvatarView`, `FaceController` (SceneKit)     |
| `loadLiveAvatar()`, `LiveAvatarSessionClient`        | `HopeMetahumanLive` package, `LiveAvatarSessionClient` |
| `MicrophoneCapture`, `PcmPlayer`, `BlendshapeBuffer` | Same names                                             |

The React Native component in this repository remains the WebView-based
integration; the Swift SDK is the "fully native audio capture/playback and
rendering" the roadmap promised, delivered for Apple platforms first.
