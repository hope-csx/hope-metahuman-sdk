# Premium Avatars

A Standard Metahuman is an ARKit-compatible GLB drawn on the client and driven
by streamed blendshapes. A Premium Avatar is rendered by the service and
arrives as lip-synced WebRTC video and audio. The agent, workflow, tools,
transcription, and conversation memory are otherwise the same.

For the shortest integrations, `<hope-metahuman>` selects the complete Premium
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

## Direct API

Applications building their own browser interface install the live renderer
and its peer dependency:

```bash
npm install @hope-metahuman/sdk @hope-metahuman/avatar-live livekit-client
```

Then perform three steps in order: start a session, join the room, and route
agent speech to it.

```ts
import { LiveAvatarSessionClient, MetahumanSession } from '@hope-metahuman/sdk';
import { LiveAvatarRenderer, createLivekitRoom } from '@hope-metahuman/avatar-live';

const sessions = new LiveAvatarSessionClient({ baseUrl, tokenProvider });
const live = await sessions.start(metahumanId);

const renderer = new LiveAvatarRenderer({
  video: document.querySelector('video'),
  createRoom: createLivekitRoom,
  onStateChange: (state) => setStatus(state),
  onSpeakingChange: (speaking) => setSpeaking(speaking),
});
await renderer.connect(live);

session.liveAvatarSessionId = live.id;
```

Only set `liveAvatarSessionId` after the room connection succeeds. While it is
set, each agent run announces `audioTransport: 'live-avatar'` and sends no
binary audio frames: the avatar's media track carries the voice. Playing local
audio too would make every reply audible twice.

Clear the id if the renderer fails so the next turn resumes local PCM playback:

```ts
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
seconds in `waiting` is expected. The service sends a configured greeting (or
“Hello.”) once the client joins, which brings the video track up without
requiring the user to speak first.

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

- `409` means the Metahuman uses a Standard avatar. Render its GLB instead.
- `503` means the deployment has no live media plane or has no renderer
  capacity. Do not retry immediately; show the poster and play local audio.
- `502` means this renderer start was refused or unreachable. A bounded retry
  can be appropriate before falling back.

The room token may subscribe but cannot publish. It is still a credential:
never log or persist it, render only the participant named by
`avatarIdentity`, and discard it when the session ends.

## Teardown

Premium renderer time is billed and concurrency is capped. Release it when the
screen, page, or conversation ends instead of waiting for expiry:

```ts
await renderer.disconnect();
await sessions.end(live.id);
```

`end()` is idempotent. Calling it from more than one teardown path is safe.

For React Native, use the ready-made component in
[`examples/react-native`](../examples/react-native), which preserves this
lifecycle inside a native view.
