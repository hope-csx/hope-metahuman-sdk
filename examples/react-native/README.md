# React Native example

This Expo example puts either kind of HOPE Metahuman in an iOS or Android app
with the reusable [`HopeMetahumanView`](./components/HopeMetahumanView.tsx):

- **Standard** loads an ARKit-compatible GLB and renders it locally with WebGL,
  applying the streamed Audio2Face blendshapes against the audio clock.
- **Premium** starts a live avatar session and subscribes to its lip-synced
  WebRTC video and audio. No model is downloaded to the device.

The component hosts the supported `@hope-metahuman/embed` standalone bundle in
`react-native-webview`. This is intentional: the current commercial SDK uses
browser Web Audio and WebGL APIs and does not yet ship native microphone,
playback, or Three.js bindings. The WebView keeps those tested paths intact
while exposing React Native props, events, and imperative methods.

## Run it

```bash
cd examples/react-native
cp .env.example .env
npm install
npx expo prebuild
npm run ios       # or: npm run android
```

Fill in `.env` first. Use a development build (`expo run:*`), not Expo Go:
microphone/WebRTC permission settings are native configuration and need to be
built into the app.

On Android, the npm `react-native-webview` version and the browser engine are
separate. The engine is supplied by Android System WebView (or Chrome), so keep
that system component updated in the emulator or device. The CDN bundle targets
Chromium 66, the first release with the AudioWorklet support used by the SDK.
Older engines cannot run the audio path and should be upgraded.

The URLs loaded inside the view must be HTTPS on a device. `localhost` means
the phone itself, not your workstation. During development, use a reachable LAN
address with a trusted certificate or a tunnel.

## Standard Metahuman

```tsx
<HopeMetahumanView
  kind="standard"
  baseUrl="https://api.hope-metahuman.example"
  tokenEndpoint="https://your-app.example/api/hope/stream-token"
  metahumanId="optional-tenant-metahuman-id"
  modelUrl="https://assets.example/avatar.glb"
  framing="bust"
  onEvent={handleEvent}
/>
```

The GLB needs the 52 ARKit morph targets described in
[`docs/avatars.md`](../../docs/avatars.md). Its server must allow the app view's
service origin to fetch it. The component explicitly disables the live-avatar
probe on this path. When `metahumanId` is set, omit `voiceId` — the Metahuman
already has a voice.

## Premium Metahuman

```tsx
<HopeMetahumanView
  kind="premium"
  baseUrl="https://api.hope-metahuman.example"
  tokenEndpoint="https://your-app.example/api/hope/stream-token"
  metahumanId="3f9a2b71-5c4d-4e18-b062-7a1e9d3c8f40"
  posterUrl="https://assets.example/dana.jpg"
  onEvent={handleEvent}
/>
```

The API key behind the token needs `agent.stream`. The component starts
`POST /live-avatar-sessions`, joins the returned subscribe-only media room, and
passes its session id on each agent run. If live rendering is unavailable, the
embed falls back to the poster and local reply audio. Listen for
`{ type: 'avatar-state', state: 'failed' }` if the native UI should explain the
fallback.

## Authentication boundary

`tokenEndpoint` is called by React Native, not by the HTML document. The
component caches the returned machine token in memory, refreshes it 30 seconds
early, and sends it to the embed only when the SDK asks. It is never placed in
markup or persistent storage.

The endpoint must authenticate the app user and return:

```json
{ "token": "short-lived-machine-token", "expiresIn": 600 }
```

Pass your existing app authorization in `tokenRequestHeaders`:

```tsx
<HopeMetahumanView
  {...props}
  tokenRequestHeaders={{ Authorization: `Bearer ${appSessionToken}` }}
/>
```

Never put `HOPE_CLIENT_SECRET` in an `EXPO_PUBLIC_*` variable. Those values are
compiled into the application and are public. The API-key exchange belongs on
your backend; [`examples/token-server`](../token-server) shows the contract.

## Native controls

Keep a ref when the surrounding native UI should drive the conversation:

```tsx
const ref = useRef<HopeMetahumanViewHandle>(null);

ref.current?.send('Hello');
ref.current?.interrupt();
ref.current?.reset();
ref.current?.setMicrophoneEnabled(false);
ref.current?.stop();
```

The built-in **Start conversation** button remains inside the view because the
audio context must be unlocked by a real user gesture. Do not auto-start it
from `onLoad`—the first response can otherwise be silent on iOS.

## Production checklist

- Self-host and exactly pin the SDK bundle with `sdkUrl` when your deployment
  cannot depend on the CDN.
- Allow the service and asset origins in the tenant's browser/CORS policy.
- Keep the token endpoint authenticated and rate-limited.
- Stop/unmount the component when leaving the screen. Premium renderer time is
  billable; unmount calls the embed teardown and live-session delete path.
- Test on physical iOS and Android devices. WebGL/WebRTC behavior and
  microphone permission cannot be validated adequately in a unit test.
