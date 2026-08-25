// A complete single-file SwiftUI integration of the native Swift SDK.
//
// Fill in the four constants below, add the HopeMetahuman package and an
// NSMicrophoneUsageDescription, and run on a device. See README.md.

import HopeMetahuman
import SwiftUI

// MARK: Configuration — the only part you need to change.

/// Absolute base URL of your HOPE Metahuman Service deployment.
private let baseURL = "https://api.hope-metahuman.example"

/// Endpoint on YOUR backend that mints short-lived stream tokens for the
/// signed-in user. Never put the API key secret in the app — an IPA is as
/// readable as a JS bundle. examples/token-server is a copyable endpoint.
private let tokenEndpoint = URL(string: "https://your-backend.example/api/hope/stream-token")!

/// The Metahuman to talk to, from your admin portal.
private let metahumanID = "3f9a2b71-5c4d-4e18-b062-7a1e9d3c8f40"

/// ARKit-compatible avatar as .usdz — bundled here, but a remote URL works.
private let modelURL = Bundle.main.url(forResource: "avatar", withExtension: "usdz")

@main
struct HopeChatApp: App {
  var body: some Scene {
    WindowGroup {
      ChatScreen()
    }
  }
}

struct ChatScreen: View {
  @StateObject private var controller = HopeMetahumanController(
    HopeMetahumanConfiguration(
      session: MetahumanSessionOptions(
        baseURL: baseURL,
        tokenProvider: TokenEndpointProvider(.init(url: tokenEndpoint)),
        metahumanId: metahumanID
      ),
      avatar: modelURL.map { AvatarViewOptions(modelURL: $0, framing: .bust) }
    )
  )
  @State private var draft = ""

  var body: some View {
    VStack(spacing: 0) {
      // The complete embedded metahuman: avatar, start gate, captions.
      HopeMetahumanView(controller: controller)
        .frame(maxHeight: 360)
        .background(Color.black.opacity(0.9))

      // Custom chrome from the same controller: transcript, level, errors.
      List {
        ForEach(controller.transcript) { entry in
          HStack {
            if entry.role == .user { Spacer(minLength: 40) }
            Text(entry.text)
              .padding(10)
              .background(
                entry.role == .user ? Color.accentColor.opacity(0.2) : Color.gray.opacity(0.15),
                in: RoundedRectangle(cornerRadius: 10)
              )
            if entry.role == .metahuman { Spacer(minLength: 40) }
          }
          .listRowSeparator(.hidden)
        }
        if !controller.userInterim.isEmpty {
          Text(controller.userInterim).italic().foregroundStyle(.secondary)
            .listRowSeparator(.hidden)
        }
      }
      .listStyle(.plain)

      // The error path is part of the interface, not a console message: a
      // refused token, an unreachable service, or a bad model lands here.
      if let error = controller.lastError {
        Text(error)
          .font(.footnote)
          .foregroundStyle(.red)
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(.horizontal)
      }

      HStack(spacing: 12) {
        Button {
          controller.setMicrophoneEnabled(!controller.microphoneOn)
        } label: {
          Image(systemName: controller.microphoneOn ? "mic.fill" : "mic.slash.fill")
            .symbolRenderingMode(.hierarchical)
        }
        .disabled(!controller.started)

        MicLevelMeter(level: controller.micLevel)
          .frame(width: 40, height: 8)

        TextField("Type instead of speaking…", text: $draft)
          .textFieldStyle(.roundedBorder)
          .onSubmit(sendDraft)
          .disabled(!controller.started)

        Button("Send", action: sendDraft)
          .disabled(!controller.started || draft.isEmpty)
      }
      .padding()
    }
  }

  private func sendDraft() {
    let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !text.isEmpty else { return }
    draft = ""
    controller.send(text)
  }
}

/// The session reports microphone RMS in [0, 1]; scale it up the way the web
/// element's meter does, since conversational speech rarely exceeds ~0.15.
struct MicLevelMeter: View {
  let level: Float

  var body: some View {
    GeometryReader { proxy in
      ZStack(alignment: .leading) {
        Capsule().fill(Color.gray.opacity(0.2))
        Capsule()
          .fill(Color.green)
          .frame(width: proxy.size.width * CGFloat(min(1, level * 6)))
      }
    }
    .animation(.linear(duration: 0.05), value: level)
  }
}
