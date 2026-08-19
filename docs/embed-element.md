# The `<hope-metahuman>` element

A chattable 3D metahuman in one tag, for pages that have no build step and no
application stack.

> This documents `@hope-metahuman/embed`, which is commercially licensed and is
> not distributed in this repository. See
> [self-hosting.md](./self-hosting.md) for how to obtain it.

## Loading it

On a static page, use the standalone bundle. It embeds three.js, so this is the
entire integration — no import map, nothing else to load:

```html
<script
  type="module"
  src="https://cdn.hope-lms.app/sdk/v0.1/hope-metahuman-embed.standalone.js"
></script>

<hope-metahuman
  base-url="https://api.hope-metahuman.example"
  token-endpoint="/api/hope/stream-token"
  metahuman-id="3f9a2b71-5c4d-4e18-b062-7a1e9d3c8f40"
  model-url="/models/your-avatar.glb"
></hope-metahuman>
```

In an application with a bundler, install the package instead so your own
three.js is the only copy in the output:

```bash
npm install @hope-metahuman/embed three
```

```ts
import '@hope-metahuman/embed';
```

The element renders its own chat interface in a shadow root: an avatar canvas, a
transcript, a text input, a microphone button, and a start gate. It handles
microphone permission, transcription, the agent turn, audio playback, and lip
sync.

A complete working page is in
[`examples/static-chat`](../examples/static-chat).

---

## Attributes

### Connection

| Attribute        | Required | Description                                              |
| ---------------- | -------- | -------------------------------------------------------- |
| `base-url`       | yes      | Origin of your HOPE Metahuman Service deployment         |
| `token-endpoint` | —        | URL on your backend returning `{ token, expiresIn }`     |
| `token`          | —        | A machine token you already have. Expires in ten minutes |
| `voice-id`       | —        | Voice for an ad-hoc session. Omit when `metahuman-id` is set — the Metahuman already has a voice |
| `voice-model`    | —        | Synthesis model. Defaults to `sonic-3`                   |
| `auth-mode`      | —        | `cookie` only for a same-site signed-in application      |

Supply exactly one credential source. `token-endpoint` is the right answer for
anything you deploy; see [`examples/token-server`](../examples/token-server) for
one you can copy.

**Never put an API key secret in HTML** — not in `token`, not in any other
attribute, not in a script tag on the page. A secret does not expire, and
markup is readable by everyone who loads the document. There is deliberately no
attribute that accepts one.

For a local trial without a backend, set the `tokenProvider` property from
script with values entered at runtime, so the secret is neither committed nor
persisted:

```js
// localhost only.
document.querySelector('hope-metahuman').tokenProvider = new MachineTokenProvider({
  baseUrl: 'http://localhost:3001',
  clientId: idFromAForm,
  clientSecret: secretFromAForm,
});
```

The [static example](../examples/static-chat) does exactly this, behind its
settings panel.

### Conversation

| Attribute        | Default   | Description                                        |
| ---------------- | --------- | -------------------------------------------------- |
| `session-id`     | generated | Persist to resume a conversation across page loads |
| `metahuman-id`   | —         | Tenant Metahuman. Resolves workflow, persona, language, and voice |
| `metahuman-name` | —         | The persona's own name                             |
| `user-name`      | —         | Name of the person speaking                        |
| `language`       | `en-US`   | BCP-47 tag for transcription and replies           |
| `archetype-id`   | `3`       | Behavioural persona, 1–8                           |

### Appearance

| Attribute            | Default              | Description                                                                |
| -------------------- | -------------------- | -------------------------------------------------------------------------- |
| `model-url`          | —                    | GLB avatar. Without it, the element is chat-only and requests no animation |
| `framing`            | `head`               | `head`, `bust`, or `full`                                                  |
| `background`         | transparent          | Canvas background colour                                                   |
| `idle-animation`     | on                   | `off` disables blink and gaze                                              |
| `camera-fov`         | `28`                 | Vertical field of view in degrees; lower is a longer, flatter lens         |
| `camera-position`    | automatic            | `x, y, z` camera placement. Overrides `framing`                            |
| `camera-target`      | automatic            | `x, y, z` point the camera looks at                                        |
| `lock-root-rotation` | on                   | `off` lets the model's idle clip turn the avatar away from the camera      |
| `mode`               | —                    | `avatar` hides the transcript and input, leaving only the face             |
| `mic`                | —                    | `off` starts without the microphone; the button still enables it           |
| `greeting`           | —                    | An opening line shown before the first turn                                |
| `placeholder`        | `Say something…`     | Text input placeholder                                                     |
| `start-label`        | `Start conversation` | Start button text                                                          |
| `start-hint`         |                      | Text under the start button                                                |
| `poster-url`         | —                    | Still shown while Premium video starts or falls back                       |
| `preview-video-url`  | —                    | Muted visual fallback when live rendering is unavailable                   |
| `live-avatar`        | on                   | `off` disables the Premium session attempt                                 |

Omitting `model-url` also turns off animation generation server-side, which
saves the tenant the cost of rendering blendshapes nothing will display.

When `metahuman-id` is present, the service resolves its trusted workflow,
persona, language, and voice for every turn. This is the recommended contract
for tenant-managed Metahumans.

### Orientation and camera

The avatar faces the viewer by default. Avatar GLBs pose facing the camera, but
the idle body animation baked into them commonly yaws the whole skeleton — about
32° for the Avaturn idle these models ship with — so the element discards that
one rotation track and keeps the rest of the body animation. Set
`lock-root-rotation="off"` if your model's clip is meant to turn it.

To replace the automatic framing, give the camera a position and a target:

```html
<hope-metahuman
  model-url="/models/your-avatar.glb"
  camera-fov="20"
  camera-position="0, 1.62, 0.75"
  camera-target="0, 1.6, 0"
></hope-metahuman>
```

Coordinates are in the model's own world space. For an avatar authored at human
scale in metres with the feet at the origin, eye level is around `y = 1.6`. A
malformed value is ignored rather than breaking the page, falling back to
automatic framing.

For values computed at runtime, set the `cameraOptions` property before
`start()`; it takes precedence over the attributes.

```js
document.querySelector('hope-metahuman').cameraOptions = {
  fov: 20,
  position: [0, 1.62, 0.75],
  target: [0, 1.6, 0],
};
```

See [three-renderer.md](./three-renderer.md) for the full explanation of why the
root rotation is dropped.

## Premium Avatars

Give the element a `model-url` for a Standard 3D Metahuman. Give it a
`metahuman-id` with no `model-url` for a Premium Avatar: it starts a live
service renderer, subscribes to its video/audio room, and routes each reply to
the avatar's own lip-synced audio track.

```html
<hope-metahuman
  base-url="https://api.hope-metahuman.example"
  token-endpoint="/api/hope/stream-token"
  metahuman-id="3f9a2b71-5c4d-4e18-b062-7a1e9d3c8f40"
  poster-url="/images/dana.jpg"
></hope-metahuman>
```

The npm path also needs `livekit-client`; the standalone bundle already carries
it. While the renderer starts, the element shows `poster-url`. A Standard
Metahuman, a deployment without live rendering, or a failed renderer degrades
to `preview-video-url`/`poster-url` with locally played speech instead of ending
the conversation. See [premium-avatars.md](./premium-avatars.md).

## The start gate

Nothing connects until the visitor presses **Start conversation**. This is not a
stylistic choice: browsers discard audio scheduled by a page the user has not
interacted with, so a metahuman that auto-starts would talk to an empty room.
The gate turns that constraint into a deliberate opt-in, which is also what you
want before requesting microphone permission.

To use your own button, hide the gate with CSS and call `start()`:

```js
document.querySelector('#my-button').addEventListener('click', () => {
  document.querySelector('hope-metahuman').start();
});
```

`start()` must still run inside a real user gesture.

## Properties and methods

```ts
const el = document.querySelector('hope-metahuman');

el.tokenProvider = myProvider; // takes precedence over the attributes
el.scenarioFields = [{ field_name: 'unit', stated_value: 'Ranger Battalion', is_deceptive: false }];

await el.start(); // must be inside a user gesture
await el.send('Hello'); // resolves when the reply finishes
el.interrupt(); // cut the current reply short
await el.setMicrophoneEnabled(true);
el.reset(); // clear memory and the transcript
await el.stop(); // tear down, back to the start gate

el.session; // the underlying MetahumanSession, or null before start()
el.avatar; // the underlying AvatarRenderer, or null with no model-url
el.liveAvatar; // the live Premium renderer, or null on the Standard path
```

`session` and `avatar` are escape hatches: anything the element does not expose
as an attribute can be reached through them.

## Events

All events bubble, cross shadow boundaries, and carry their payload in `detail`.

| Event               | `detail`                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| `hope-ready`        | `{ sessionId }`                                                                                     |
| `hope-state`        | `{ state: 'idle' \| 'listening' \| 'thinking' \| 'speaking' }`                                      |
| `hope-avatar-state` | `{ state: 'idle' \| 'connecting' \| 'waiting' \| 'live' \| 'reconnecting' \| 'ended' \| 'failed' }` |
| `hope-user-message` | `{ text }`                                                                                          |
| `hope-reply`        | `{ text }`                                                                                          |
| `hope-error`        | `{ error }`                                                                                         |

```js
el.addEventListener('hope-reply', (event) => {
  analytics.track('metahuman_reply', { length: event.detail.text.length });
});
```

## Theming

The interface is in a shadow root, so page CSS cannot reach inside it. Style it
through custom properties, which do pierce the boundary:

```css
hope-metahuman {
  --hope-accent: #6d5efc;
  --hope-accent-contrast: #ffffff;
  --hope-surface: rgba(17, 21, 33, 0.72);
  --hope-surface-raised: rgba(30, 36, 52, 0.9);
  --hope-border: rgba(255, 255, 255, 0.1);
  --hope-text: #f4f5f7;
  --hope-text-muted: #97a0b5;
  --hope-danger: #ff6b6b;
  --hope-radius: 16px;
  --hope-font: 'Inter', system-ui, sans-serif;
  --hope-stage-background: radial-gradient(120% 90% at 50% 0%, #2a3350, #080a12);

  width: 100%;
  height: 600px;
}
```

Set the element's own size with ordinary CSS; the canvas follows its container.
For a light interface, override `--hope-surface`, `--hope-text`, and
`--hope-stage-background` together — the defaults assume a dark stage, and
changing only one of the three produces unreadable contrast.

## Accessibility

The transcript is an `aria-live` region, so replies are announced to screen
readers as they complete. The microphone button carries `aria-pressed`, controls
are labelled and keyboard-reachable in visual order, and every interactive
element meets the 44 px touch target minimum.

Because a spoken interface excludes some users by construction, the text input
is a first-class path rather than a fallback: everything the metahuman can be
told by voice can be typed, and every reply appears as text as well as audio.

## Content Security Policy

Microphone capture compiles an `AudioWorklet` from a `blob:` URL, so a strict
policy needs:

```
worker-src blob:;
connect-src 'self' https://api.hope-metahuman.example wss://api.hope-metahuman.example;
```

Add `script-src blob:` for browsers that do not implement `worker-src`. The
element sets no inline styles that would require `unsafe-inline` beyond its own
shadow stylesheet, and it never uses `unsafe-eval`. If `blob:` is not
permissible in your environment, host the worklet yourself — see
[javascript-api.md](./javascript-api.md#the-audioworklet-and-csp) — and drive
the session directly rather than through this element.

## Browser support

Chrome, Edge, Safari 16.4+, and Firefox. All four have custom elements,
`AudioWorklet`, and WebGL2. Speech requires a secure context (HTTPS or
`localhost`), which browsers enforce for microphone access regardless.

## Licence

This documentation is [MIT](../LICENSE) licensed. The package it describes is
proprietary and commercially licensed — see [../NOTICE.md](../NOTICE.md).
