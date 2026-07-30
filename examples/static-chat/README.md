# Static chat example

A complete talking 3D metahuman on a plain HTML page. No build step, no bundler,
no server-side code — five files you can copy onto any static host.

```bash
pnpm install
pnpm vendor       # download the SDK bundle (needs licence credentials)
pnpm example      # serve on :4173
```

Open <http://localhost:4173>. The settings panel opens on first visit; fill in a
base URL and voice ID, press **Start conversation**, and talk.

`pnpm vendor` is optional — without it the page falls back to the CDN, and if
neither is reachable it says so on the page instead of failing silently.

---

## What you need

|                |                                                        |
| -------------- | ------------------------------------------------------ |
| A deployment   | The origin of a HOPE Metahuman Service instance        |
| The SDK bundle | Commercially licensed; from the CDN or `pnpm vendor`   |
| A credential   | A token endpoint, or a machine token for local testing |
| A voice ID     | From your tenant's catalogue                           |
| A GLB avatar   | Optional; without one you get chat with no face        |

Settings entered in the panel are saved in `localStorage`, so you type them
once. To preconfigure the page instead, edit [`config.js`](./config.js) — the
panel overrides whatever is in there.

The token is deliberately excluded from what gets persisted.

### Getting a token for a local trial

For experimenting on your own machine, mint a machine token by hand and paste it
into the settings panel:

```bash
curl -X POST https://api.your-deployment.example/oauth/token \
  -H 'Content-Type: application/json' \
  -d '{"grant_type":"client_credentials","client_id":"…","client_secret":"…"}'
```

It expires in ten minutes; refresh the page and paste a new one when the
conversation stops working.

**Do not deploy a page with a pasted token, and never put the client secret in
one.** For anything real, stand up a token endpoint — a dozen lines, shown in
the [root README](../../README.md#1-get-a-credential-to-the-browser) — and put
its URL in the **Token endpoint** field. The example prefers that field when
both are filled in.

### Getting an avatar

No models ship with this repository. Bring your own ARKit-compatible GLB, or use
a platform-hosted model if your deployment is entitled to one — see
[docs/avatars.md](../../docs/avatars.md).

Leave the field empty to run chat-only; the page says so on the stage rather
than showing an empty box.

## Files

```
index.html      markup and the <hope-metahuman> tag
sdk-loader.js   picks the vendored bundle or the CDN, and reports neither
app.js          settings form, localStorage, event log
styles.css      page layout
config.js       optional preconfiguration
vendor/         the SDK bundle (downloaded, git-ignored, NOT MIT licensed)
```

Everything except `vendor/` is MIT licensed and yours to copy. `vendor/` holds
the proprietary bundle and is covered by the commercial licence that comes with
it.

## Deploying it

Copy `index.html`, `sdk-loader.js`, `app.js`, `styles.css`, `config.js`, and
`vendor/` to any static host — S3, Cloud Storage, GitHub Pages, nginx. There is
nothing to run.

On a real site, drop `sdk-loader.js` and put the script tag straight in the
page — the loader exists so this example runs with or without a vendored bundle,
which is not a decision production needs to make on every page load:

```html
<script
  type="module"
  src="https://cdn.hope-lms.app/sdk/v0.1/hope-metahuman-embed.standalone.js"
></script>
```

Two requirements the host must meet:

- **HTTPS.** Browsers refuse microphone access outside a secure context.
- **A CSP allowing `worker-src blob:`** if you set one, for the audio worklet.
  See [docs/self-hosting.md](../../docs/self-hosting.md#content-security-policy).

Your deployment's `CORS_ORIGIN` must also include the page's origin, or the
token exchange and the WebSocket upgrade are refused.

## What the code shows

Most of `app.js` is the settings panel, which exists to make the demo
self-service and is not something you would ship. The parts worth copying are
short:

```js
// Configuration is just attributes.
el.setAttribute('base-url', settings.baseUrl);
el.setAttribute('voice-id', settings.voiceId);

// Events are ordinary DOM events.
el.addEventListener('hope-reply', (event) => log('reply', event.detail.text));
el.addEventListener('hope-error', (event) => log('error', event.detail.error.message));
```

The event log in the sidebar is there so you can watch the session state change
as you speak — useful when checking whether a problem is in transcription, the
agent, or playback.

## When it doesn't work

| Symptom                                          | Cause                                                                        |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| A banner says the SDK bundle could not be loaded | Not vendored and the CDN is unreachable. Run `pnpm vendor`, or check egress. |
| "Speech-to-text transport error" immediately     | Bad base URL, expired token, or the origin is not in `CORS_ORIGIN`           |
| Microphone button does nothing                   | Not on HTTPS or `localhost`, or permission was denied                        |
| Replies arrive as text but silently              | `unlockAudio` needs a user gesture — use the start button, not autostart     |
| Face never moves                                 | The GLB has no ARKit morph targets; check `el.avatar.availableShapes`        |
| Voice sounds wrong                               | The voice ID is not in your tenant's catalogue                               |

Open the browser console — the SDK's errors carry a `code` and say which stage
failed.
