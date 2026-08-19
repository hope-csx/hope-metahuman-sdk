# Getting and hosting the SDK bundle

The SDK is proprietary and is not part of this repository. This page covers how
to obtain it and which delivery route suits your deployment.

All three routes serve the same artifacts, built and published together. See
[`../NOTICE.md`](../NOTICE.md) for what is and is not covered by which licence.

## Route 1 — the CDN

The fastest way to a working page, and the right choice for a public website:

```html
<script
  type="module"
  src="https://cdn.hope-lms.app/sdk/v0.1/hope-metahuman-embed.standalone.js"
></script>

<hope-metahuman
  base-url="https://api.your-deployment.example"
  token-endpoint="/api/metahuman-token"
  metahuman-id="your-metahuman-id"
></hope-metahuman>
```

That is the whole integration. The standalone bundle embeds its own copy of
three.js, so there is no import map and nothing else to load.

### Version pinning

| URL form        | Behaviour                                                     |
| --------------- | ------------------------------------------------------------- |
| `/sdk/v0.1.4/…` | Exact version. Never changes.                                 |
| `/sdk/v0.1/…`   | Major.minor track. Picks up patches, never a breaking change. |

There is deliberately no `latest`. A silent major upgrade underneath a
production page is not a convenience.

### Subresource integrity

Every published version has an SRI hash at
`https://cdn.hope-lms.app/sdk/v0.1.4/hope-metahuman-embed.standalone.js.sri`.
Pin an exact version and use it if you want the browser to reject a bundle whose
bytes have changed:

```html
<script
  type="module"
  src="https://cdn.hope-lms.app/sdk/v0.1.4/hope-metahuman-embed.standalone.js"
  integrity="sha384-…"
  crossorigin="anonymous"
></script>
```

SRI and the mutable track URL do not combine: pinning bytes to a URL whose
content is meant to change will break your page on the next patch release.

## Route 2 — self-hosting

Serve the bundle from your own origin. Preferred, and often required, when:

- the network is air-gapped or egress-filtered, so the CDN is unreachable;
- your Content-Security-Policy allows no external script origins, which is the
  usual posture for government and regulated deployments;
- you need the bytes to be identical for the life of a release, independent of
  anything we do.

Download it with the helper in this repository:

```bash
pnpm vendor          # major.minor track
pnpm vendor 0.1.4    # an exact version
```

The download is verified against its published SRI hash and rejected if it does
not match. Copy the result out of `examples/static-chat/vendor/` and serve it
from your own static host:

```html
<script type="module" src="/assets/hope-metahuman-embed.standalone.js"></script>
```

Point the script at a mirror you control with `HOPE_SDK_CDN`:

```bash
HOPE_SDK_CDN=https://artifacts.internal.example pnpm vendor 0.1.4
```

## Route 3 — npm, for application builds

Building with a bundler — React, Angular, Vue, or anything else — is better
served by the packages than by the standalone script, because your application
supplies its own copy of three.js instead of loading a second one:

```bash
npm install @hope-metahuman/sdk @hope-metahuman/avatar-three \
  @hope-metahuman/avatar-live @hope-metahuman/embed three livekit-client
```

The packages are published to GitHub Packages with restricted access, so
authenticate first. In `.npmrc`:

```ini
@hope-metahuman:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${HOPE_SDK_TOKEN}
```

`HOPE_SDK_TOKEN` is issued with your licence. Keep it out of source control and
out of any client bundle — it grants package downloads, not service access.

`three` is the Standard renderer's peer dependency. `livekit-client` is the
Premium renderer's peer dependency. Install them yourself so the application
has one copy of each runtime.

## Content-Security-Policy

Self-hosted, everything is same-origin apart from the service connection:

```
default-src 'self';
script-src 'self';
connect-src 'self' https://api.your-deployment.example wss://api.your-deployment.example wss://media.your-deployment.example;
img-src 'self' data:;
media-src 'self' blob:;
worker-src 'self' blob:;
```

From the CDN, add its origin to `script-src`:

```
script-src 'self' https://cdn.hope-lms.app;
```

`worker-src blob:` is required either way: microphone capture runs in an
`AudioWorklet` whose processor is loaded from a blob URL, because a static
worklet file would be a second artifact to host and to keep in step.

The bundle needs neither `unsafe-inline` nor `unsafe-eval`.

Premium Avatars also need the WebSocket media origin returned by
`POST /live-avatar-sessions` in `connect-src`, plus `media-src blob:`. Ask the
deployment operator for its stable media origin rather than allowing all
`wss:` destinations.

## Verifying what you received

```bash
# Recompute the hash and compare against the published value
openssl dgst -sha384 -binary hope-metahuman-embed.standalone.js | openssl base64 -A
curl -s https://cdn.hope-lms.app/sdk/v0.1.4/hope-metahuman-embed.standalone.js.sri
```

`pnpm vendor` performs this check for you and deletes the download on mismatch.

The bundle carries its version and licence in a banner comment at the top of the
file, along with the three.js copyright and permission notice.
