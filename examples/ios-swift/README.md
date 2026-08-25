# iOS Swift example

A minimal SwiftUI app around the native Swift SDK: a Standard 3D Metahuman
with the built-in `HopeMetahumanView`, plus a custom transcript pane driven by
`HopeMetahumanController` to show what building your own chrome looks like.

What it shows:

- The start gate → `unlockAudio` → greeting → microphone sequence, handled by
  the controller.
- Live captions from `userInterim`, a transcript from `onUserMessage`/`onReply`
  state, and a mic level meter.
- The real error path: a failed token endpoint or an unloadable model surfaces
  in the UI via `lastError` instead of a silent black view.

## What it needs

- Xcode 16+, an iOS 16+ device or simulator (a device for the microphone).
- The `HopeMetahumanSwift-v0.1.0.zip` licensed release archive, checksum
  verified and extracted with both package directories kept together. See
  [docs/swift-api.md](../../docs/swift-api.md).
- A token endpoint on your backend.
  [examples/token-server](../token-server/) is a copyable one; remember
  `localhost` from a device means the phone, so use your machine's LAN address
  and HTTPS in anything beyond a simulator run.
- An ARKit-compatible avatar as `.usdz`, reachable by URL or bundled. No model
  is distributed in this repository ([docs/avatars.md](../../docs/avatars.md));
  a GLB converts with Reality Converter.

## How to run

1. Create a new iOS App project in Xcode (SwiftUI lifecycle), choose **File →
   Add Package Dependencies… → Add Local…**, select the extracted
   `packages/sdk-swift` directory, and add the `HopeMetahuman` product.
2. Add `NSMicrophoneUsageDescription` to the target's Info.plist.
3. Drop [`HopeChatApp.swift`](./HopeChatApp.swift) in as the app's only source
   file, and fill in the three constants at the top: `baseURL`,
   `tokenEndpoint`, and `metahumanID`, plus `modelURL` for the avatar.
4. Run on a device, tap **Start conversation**, and talk.

For a Premium live-video Metahuman, add the `HopeMetahumanLive` package and
replace the avatar view with `LiveAvatarCoordinator` +
`LiveAvatarVideoView` — the coordinator section of
[docs/swift-api.md](../../docs/swift-api.md) shows the exact wiring.
