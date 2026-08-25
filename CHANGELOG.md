# Changelog

Notable changes to this repository — the examples, documentation, and tooling.

Changes to the SDK bundle itself are published with its releases; this file
tracks the material that lives here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

While the version is below 1.0.0, minor releases may contain breaking changes.
Each one will say so here.

## [Unreleased]

### Changed

- Synchronized the public guides and examples through SDK `v0.1.18`: expected
  `RunCancelledError` handling, committed-utterance barge-in with acknowledged
  Premium playback cancellation, deadlock-free room/media startup, natural
  speaking completion, stale media-track protection, and renewable Premium
  Avatar leases.
- Corrected public API CORS guidance. HOPE accepts requests from every browser
  origin when they carry valid credentials; an application's own cross-origin
  token endpoint still controls its CORS policy.
- Clarified that client-tool results are passed through unchanged rather than
  unwrapped from shapes such as `{ ok, result }`.
- Exact-version and SRI examples now pin immutable SDK `v0.1.18`.

- Configured Metahumans now choose and speak one random greeting when a session
  starts. The web element and React Native wrapper handle this automatically;
  direct integrations call `MetahumanSession.greet()` after mounting their
  renderer. Greeting transcript text is not emitted until speech begins.
- Removed the client-only `greeting` attribute/React Native prop. Greetings are
  tenant configuration and must travel through the synchronized speech turn.

- **The SDK is distributed from the CDN only.** The `@hope-metahuman/*` npm
  packages are retired, and the documentation no longer describes installing
  them. The standalone bundle now exports the whole client API — `MetahumanSession`,
  `AgentStreamClient`, the token providers, the error classes and the Three.js
  renderer are all importable from the same URL that defines `<hope-metahuman>`,
  and the Premium Avatar renderer loads on demand through `loadLiveAvatar()`.
  Two consequences are worth reading before upgrading: the bundle carries no
  TypeScript declarations, so a URL import types as `any`; and it is browser-only,
  so there is no longer a way to run the protocol client under Node. Minting a
  machine token needs one HTTPS call and no SDK — see
  [`examples/token-server`](examples/token-server).
- A configured Metahuman is addressed by `metahuman-id` alone. `voice-id` /
  `voiceId` is only for an ad-hoc session that is not a tenant Metahuman.
  React Native `HopeMetahumanView` no longer requires `voiceId`.

### Added

- Documented native Swift SDK v0.1.0 for iOS and macOS in
  [docs/swift-api.md](./docs/swift-api.md): the `HopeMetahuman` package
  (session, protocol clients, token providers, native audio, SceneKit
  rendering, SwiftUI embed view) and the `HopeMetahumanLive` package for
  Premium live avatars over LiveKit. It speaks the same wire protocol as the
  browser SDK and is delivered as a checksum-verified commercial source
  archive, separately versioned from the browser bundle.
- Added a worked native iOS example under
  [examples/ios-swift](./examples/ios-swift/): a single-file SwiftUI app using
  `HopeMetahumanView` plus controller-driven custom chrome.

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
  Metahumans, native token retrieval, event forwarding, imperative controls,
  and explicit Premium lease renewal.
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
minified, obfuscated bundle from `cdn.svc.hopemtp.app`. See
[NOTICE.md](NOTICE.md).

No 3D avatar models are distributed here. Bring your own ARKit-compatible GLB,
or load a platform-hosted model with your entitlement.

[Unreleased]: https://github.com/cornerstonex/hope-metahuman-sdk/commits/main
