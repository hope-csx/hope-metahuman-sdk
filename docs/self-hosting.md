# Getting and hosting the SDK bundle

The SDK is proprietary and is not part of this repository. This page covers how
to obtain it and which delivery route suits your deployment.

There is one artifact, `hope-metahuman-embed.standalone.js`, and two ways to
serve it: from our CDN, or from your own origin. Both routes deliver the same
bytes from the same build, so a page can move between them by changing one URL.
See [`../NOTICE.md`](../NOTICE.md) for what is and is not covered by which
licence.

## Route 1 — the CDN

The fastest way to a working page, and the right choice for a public website:

```html
<script
  type="module"
  src="https://cdn.svc.hopemtp.app/sdk/v0.1/hope-metahuman-embed.standalone.js"
></script>

<hope-metahuman
  base-url="https://api.your-deployment.example"
  token-endpoint="/api/metahuman-token"
  metahuman-id="your-metahuman-id"
></hope-metahuman>
```

That is the whole integration. The standalone bundle embeds its own copy of
three.js and of the Premium Avatar media client, so there is no import map, no
separate `three` install, and nothing else to load.

Code that wants the API rather than the element imports from the same URL:

```js
import {
  AvatarRenderer,
  MetahumanSession,
  TokenEndpointProvider,
} from 'https://cdn.svc.hopemtp.app/sdk/v0.1/hope-metahuman-embed.standalone.js';
```

A browser resolves that URL itself, so an import needs no build step. A bundler
is a different matter: some leave an absolute URL for the browser to fetch at
runtime and some refuse to resolve it at all, so if yours objects, take Route 2
and import the file from your own tree.

### Version pinning

| URL form        | Behaviour                                                     |
| --------------- | ------------------------------------------------------------- |
| `/sdk/v0.1.4/…` | Exact version. Never changes.                                 |
| `/sdk/v0.1/…`   | Major.minor track. Picks up patches, never a breaking change. |

There is deliberately no `latest`. A silent major upgrade underneath a
production page is not a convenience.

### Subresource integrity

Every published version has an SRI hash at
`https://cdn.svc.hopemtp.app/sdk/v0.1.4/hope-metahuman-embed.standalone.js.sri`.
Pin an exact version and use it if you want the browser to reject a bundle whose
bytes have changed:

```html
<script
  type="module"
  src="https://cdn.svc.hopemtp.app/sdk/v0.1.4/hope-metahuman-embed.standalone.js"
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
<script type="module" src="/vendor/hope-metahuman-embed.standalone.js"></script>
```

Imports work the same way, against your path instead of the CDN URL:

```js
import { MetahumanSession } from '/vendor/hope-metahuman-embed.standalone.js';
```

This is also the route for an application built with a bundler. The file is a
static asset in your own tree rather than something fetched during the build, so
a build machine with no egress still produces a working page, and the deployment
carries the exact bytes you tested. Nothing else needs installing: three.js and
the Premium Avatar media client are already inside the file.

Point the script at a mirror you control with `HOPE_SDK_CDN`:

```bash
HOPE_SDK_CDN=https://artifacts.internal.example pnpm vendor 0.1.4
```

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
script-src 'self' https://cdn.svc.hopemtp.app;
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
curl -s https://cdn.svc.hopemtp.app/sdk/v0.1.4/hope-metahuman-embed.standalone.js.sri
```

`pnpm vendor` performs this check for you and deletes the download on mismatch.

The bundle carries its version and licence in a banner comment at the top of the
file, along with the three.js copyright and permission notice.
