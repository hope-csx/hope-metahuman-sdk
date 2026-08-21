# Licensing notice

This repository contains two categories of material with different licences.
The distinction matters before you build anything on it, so it is stated here
plainly rather than buried in a footnote.

## MIT — everything in this repository

Every file tracked in this repository is MIT licensed and yours to use, modify,
and redistribute:

- `examples/` — the static chat example, in full
- `docs/` — all integration and API documentation
- `scripts/` — the local server, the vendoring script, and the smoke test
- configuration, CI workflows, and this notice

Copy any of it into your own project. Attribution is appreciated but the MIT
terms in [`LICENSE`](LICENSE) are the whole of the obligation.

## Commercial — the SDK bundles, which are _not_ in this repository

The SDK itself is proprietary and is deliberately absent here:

| Artifact                             | Distribution                       |
| ------------------------------------ | ---------------------------------- |
| `hope-metahuman-embed.standalone.js` | `https://cdn.svc.hopemtp.app/sdk/` |

That one file is the whole of it. The `@hope-metahuman/*` npm packages that were
once published to a restricted registry are retired: the bundle now exports the
entire client API, so there is nothing an install could have provided that the
CDN does not. Copies obtained under an agreement before the channel closed
remain licensed on the same terms.

These are built from a private repository, shipped minified and obfuscated, and
licensed only under a commercial agreement with CornerstoneX. Using them
requires a current entitlement; the full terms travel with the artifacts and are
also published at
[`docs/commercial-license.md`](docs/commercial-license.md).

The examples here reference those bundles by URL. Nothing in this repository
grants you a licence to them, and none of it is compiled from their source.

**Licensing enquiries:** licensing@cornerstonex.ai

## Third-party software

The standalone browser bundle embeds two third-party libraries, so that a page
needs one script tag and no import map:

| Library                                                    | Licence    | Why it is in there              |
| ---------------------------------------------------------- | ---------- | ------------------------------- |
| [three.js](https://threejs.org)                            | MIT        | Renders Standard Metahuman GLBs |
| [livekit-client](https://github.com/livekit/client-sdk-js) | Apache-2.0 | Premium Avatar WebRTC media     |

Each library's copyright line and permission notice are reproduced inside the
bundle itself, at the top and in the collected licence comments at the end,
because both licences require the notice to travel with every copy and the file
is served from a CDN with nothing beside it. Your rights to three.js and to
livekit-client come from their own licences and are unaffected by the commercial
terms above.

## 3D avatar models

No avatar models are distributed here, in either licence category. Models are
separately licensed assets, and the ones we ship to customers are delivered
through the platform rather than through a public repository.

Bring your own ARKit-compatible GLB, or load a platform-hosted model with your
entitlement. See [`docs/avatars.md`](docs/avatars.md).
