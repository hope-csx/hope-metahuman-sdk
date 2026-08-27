# Premium avatars

A Standard 3D Metahuman is an ARKit-compatible GLB drawn on the client and
driven by streamed blendshapes. A premium avatar is rendered by the service and
arrives as lip-synced WebRTC video and audio. The agent, workflow, tools,
transcription, and conversation memory are otherwise the same.

## Two premium tiers, one client path

A Metahuman is configured on one of three tiers. The first renders on the
client; the other two are live video and are **indistinguishable to this SDK**.

| Tier          | Rendered by              | What the client does                |
| ------------- | ------------------------ | ----------------------------------- |
| Standard 3D   | Your page, from a GLB    | Draw morph targets from blendshapes |
| Premium       | The service (live video) | Subscribe to the media room         |
| Ultra Premium | The service (live video) | Subscribe to the media room         |

Everything on this page applies to both premium tiers without modification.
They differ in the upstream renderer the service dispatches to, in appearance
catalogue, and in metering — none of which is visible on the wire.

Tenants that already render what used to be called simply "Premium" are on
**Ultra Premium** and need no change: the tier was renamed, not repointed.

If you want to display which tier a Metahuman is on, read `avatarTier`
(`STANDARD_3D` | `PREMIUM` | `ULTRA_PREMIUM`) from `GET /metahumans/:id`.
`avatarProvider` and the interaction config's `appearance.kind` are unchanged
and still report `PREMIUM` for both premium tiers — they describe _how_ to
render, not what the tenant is billed for, so branching on them stays correct:

```js
if (metahuman.avatarProvider === 'PREMIUM') {
  // Live video. Works for Premium and Ultra Premium alike.
  await startLiveAvatar(metahuman.id);
}
```

Avatar access is configured per tenant. Not every tenant is entitled to every
tier, and the service rejects interactions for a Metahuman whose tier is no
longer available. Client applications do not choose a substitute tier: show the
normal unavailable/configuration state and let a tenant administrator move the
Metahuman to one of the tenant's available tiers.

For the shortest integrations, `<hope-metahuman>` selects the complete premium
path whenever it has a `metahuman-id` and no `model-url`:

```html
<hope-metahuman
  base-url="https://api.hope-metahuman.example"
  token-endpoint="/api/hope/stream-token"
  metahuman-id="3f9a2b71-5c4d-4e18-b062-7a1e9d3c8f40"
  poster-url="/images/dana.jpg"
></hope-metahuman>
```

It starts the renderer, joins its room, routes conversation audio to it, shows
the poster while it connects, falls back to local audio when needed, and ends
the billable session when the element is stopped or removed.

## Native Swift on iOS

The licensed `HopeMetahumanLive` SwiftPM package uses the same media lifecycle,
but its audio device must be configured before the first greeting. Call
`MetahumanSessionOptions.useLiveAvatarAudio()` before constructing the session.
The coordinator then ensures LiveKit's microphone side is running before remote
playout begins, keeping the one iOS audio I/O unit in duplex mode:

```swift
var options = MetahumanSessionOptions(
  baseURL: baseURL,
  tokenProvider: provider,
  metahumanId: metahumanId
)
options.useLiveAvatarAudio()
let session = try MetahumanSession(options)

let coordinator = LiveAvatarCoordinator(sessionClient: liveClient, session: session)
try await coordinator.start(metahumanId: metahumanId)
```

The live package pins LiveKit Swift SDK exactly to `2.16.0`. See the
[Swift API guide](./swift-api.md#premium-avatars) for explicit permission
handling and the complete view setup.

## Direct API

Applications building their own browser interface drive the live renderer
directly. It is the one part of the API that is not a static export of the
bundle: it depends on the LiveKit media client, which the import-map build
leaves external, so it is fetched on demand by `loadLiveAvatar()` and awaited
before use. Everything else comes straight off the bundle.

```js
import {
  LiveAvatarSessionClient,
  MetahumanSession,
  loadLiveAvatar,
} from 'https://cdn.svc.hopemtp.app/sdk/v0.1/hope-metahuman-embed.standalone.js';

const { LiveAvatarRenderer, createLivekitRoom } = await loadLiveAvatar();
```

Then perform three steps in order: start a session, join the room, and route
agent speech to it.

```js
const sessions = new LiveAvatarSessionClient({ baseUrl, tokenProvider });
let live = await sessions.start(metahumanId, { deferGreeting: true });

const renderer = new LiveAvatarRenderer({
  video: document.querySelector('video'),
  createRoom: createLivekitRoom,
  onStateChange: (state) => setStatus(state),
  onSpeakingChange: (speaking) => session.setLiveAvatarSpeaking(speaking),
});
await renderer.connect(live);

session.liveAvatarSessionId = live.id;
session.liveAvatarPlaybackController = sessions;
const mediaReady = renderer.waitForMedia();
const greeting = session.greet();
await Promise.all([mediaReady, greeting]);
```

Only set `liveAvatarSessionId` after the room connection succeeds. While it is
set, each agent run announces `audioTransport: 'live-avatar'` and sends no
binary audio frames: the avatar's media track carries the voice. Playing local
audio too would make every reply audible twice.

Room connection and media readiness are intentionally separate. Some providers
do not publish video or audio until the greeting begins, so awaiting media before
`session.greet()` creates a deadlock. Start both concurrently as above.
`waitForMedia()` has a bounded 30-second timeout and cleans up a media connection
that never becomes ready.

The playback controller makes premium barge-in deterministic. A non-empty
committed participant utterance cancels active avatar playback and waits for the
renderer to acknowledge the flush before starting the replacement turn. Noise,
VAD-only `speech_started` signals, and interim transcripts do not interrupt.
`onSpeakingChange` clears the pending-playback state after a real speaking
`true` → `false` transition, preventing an unnecessary cancellation after a
greeting or reply finishes naturally.

Clear the id if the renderer fails so the next turn resumes local PCM playback:

```js
session.liveAvatarSessionId = null;
```

## Lifecycle states

| State          | What the client should show                    |
| -------------- | ---------------------------------------------- |
| `idle`         | Nothing has started                            |
| `connecting`   | Poster while joining the room                  |
| `waiting`      | Poster and a short “avatar is joining” message |
| `live`         | The video track                                |
| `reconnecting` | Poster; keep the conversation active           |
| `failed`       | Poster and local speech fallback               |
| `ended`        | Idle or completed state                        |

Joining normally completes before the external renderer publishes. A few
seconds in `waiting` is expected. After joining, call `session.greet()` as shown
above. It chooses a configured greeting at random (or “Hello.”), speaks it on
the avatar's media track, and emits transcript text only once speaking begins.
The drop-in element and React Native wrapper perform this sequence automatically.

## Failure and fallback

`POST /live-avatar-sessions` requires a machine token with `agent.stream` and
returns:

```json
{
  "id": "session-uuid",
  "metahumanId": "metahuman-uuid",
  "url": "wss://media.example",
  "token": "subscribe-only-room-token",
  "roomName": "hope-…",
  "avatarIdentity": "premium-avatar",
  "expiresAt": "2026-08-18T18:00:00.000Z"
}
```

- `409` means the Metahuman uses a Standard 3D avatar. Render its GLB instead.
- `503` means the deployment has no live media plane, or the tier this Metahuman
  is on is not configured or is out of renderer capacity. Do not retry
  immediately; show the poster and play local audio.
- `502` means this renderer start was refused or unreachable. A bounded retry
  can be appropriate before falling back.

A `503` on one tier says nothing about the other. A deployment may be licensed
for Premium and not Ultra Premium, or the reverse, so treat the fallback as
per-Metahuman rather than disabling live rendering globally.

The room token may subscribe but cannot publish. It is still a credential:
never log or persist it, render only the participant named by
`avatarIdentity`, and discard it when the session ends.

## Renewing the lease

Live sessions use a renewable lease. Before `live.expiresAt`, renew only
while the participant is still present, then schedule again from the returned
expiry:

```js
live = await sessions.renew(live.id);
scheduleRenewalBefore(live.expiresAt);
```

Renewal retains the existing session id, renderer, and room. Its fresh viewer
token is available if the media connection later needs to be rebuilt. It cannot
revive an expired or ended session; start a new one in that case. Renewal also
does not replace teardown—stop renewing when the participant leaves and call
`end()` promptly because renderer time is billable.

## Teardown

Renderer time is billed on both premium tiers — at different rates — and
concurrency is capped. Release it when the screen, page, or conversation ends
instead of waiting for expiry:

```js
await renderer.disconnect();
await sessions.end(live.id);
```

`end()` is idempotent. Calling it from more than one teardown path is safe.

For React Native, use the ready-made component in
[`examples/react-native`](../examples/react-native), which preserves this
lifecycle inside a native view.

## Custom avatars

The Premium tier can render an avatar built from a photograph of a real person,
alongside the stock catalogue. Ultra Premium and Standard 3D are stock-only for
now.

Creating one is tenant administration rather than client work, so it does not
appear in this SDK: an operator uploads a portrait in the admin portal, or a
back-office integration posts one to
`POST /organizations/:orgId/premium-avatars/custom`. The build is asynchronous
and takes a few minutes.

Once it reports `READY`, a custom avatar is selectable on a Metahuman exactly
like a stock one, and nothing on this page changes — the session start, media
subscription, barge-in, renewal, and teardown are identical. There is no client
attribute or flag to set, and no way to tell from the media stream that an
avatar was custom-built.

Your deployment's docs site documents the upload endpoint, the portrait
requirements, and the polling contract.
