# Changelog

Notable changes to this repository — the examples, documentation, and tooling.

Changes to the SDK packages themselves are published with their releases; this
file tracks the material that lives here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

While the version is below 1.0.0, minor releases may contain breaking changes.
Each one will say so here.

## [Unreleased]

### Changed

- A configured Metahuman is addressed by `metahuman-id` alone. `voice-id` /
  `voiceId` is only for an ad-hoc session that is not a tenant Metahuman.
  React Native `HopeMetahumanView` no longer requires `voiceId`.

### Added

- **Tool calling documentation for the session and the element.** Handlers are no
  longer an `AgentStreamClient`-only option: `MetahumanSession` takes a `tools`
  map and forwards it to every turn, and `<hope-metahuman>` exposes a `tools`
  property alongside `tokenProvider` and `scenarioFields`. Both surface the
  accepted-tools list the service returns — as the `toolsAccepted` event and the
  `hope-tools-accepted` event respectively — so an application can fail closed
  when a binding it depends on has been renamed or deactivated, and both report
  each finished call (`tool` / `hope-tool`) for driving a saving indicator. See
  [`docs/embed-element.md`](docs/embed-element.md#tool-calling) and
  [`docs/javascript-api.md`](docs/javascript-api.md#tool-calling).
- **`examples/react-native`** — an Expo application and reusable typed
  `HopeMetahumanView` supporting Standard GLB and Premium live-video
  Metahumans, native token retrieval, event forwarding, and imperative controls.
- **Premium Avatar documentation** covering live-session creation, WebRTC
  rendering, audio routing, fallback, and billable-session teardown.

- **`examples/static-chat`** — a working static site with no build step and no
  backend: settings panel, event log, and a full conversation loop.
- **Documentation** for the whole SDK surface:
  - [`docs/embed-element.md`](docs/embed-element.md) — the `<hope-metahuman>`
    element's attributes, properties, events, and theming
  - [`docs/javascript-api.md`](docs/javascript-api.md) — the protocol client:
    sessions, token providers, the STT and agent-stream clients, audio, and
    errors
  - [`docs/three-renderer.md`](docs/three-renderer.md) — avatar rendering and
    the renderer API
  - [`docs/avatars.md`](docs/avatars.md) — ARKit model requirements, and where
    to get a model
  - [`docs/self-hosting.md`](docs/self-hosting.md) — obtaining the SDK, version
    pinning, subresource integrity, air-gapped self-hosting, and CSP
- **`pnpm vendor`** — downloads the SDK bundle for self-hosting and verifies it
  against its published SRI hash.
- **`pnpm smoke`** — drives the example in a real browser, covering the parts no
  Node test can reach.

### Notes

- The static example now switches between Standard and Premium Metahumans and
  exposes Metahuman ID, poster, fallback-video, and live-avatar state settings.

This repository contains **no SDK source code**. The SDK is proprietary and
commercially licensed; it is built from a private repository and delivered as a
minified, obfuscated bundle from `cdn.svc.hopemtp.app` or GitHub Packages. See
[NOTICE.md](NOTICE.md).

No 3D avatar models are distributed here. Bring your own ARKit-compatible GLB,
or load a platform-hosted model with your entitlement.

[Unreleased]: https://github.com/cornerstonex/hope-metahuman-sdk/commits/main
