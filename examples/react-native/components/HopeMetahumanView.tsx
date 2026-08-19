import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Linking, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

const DEFAULT_SDK_URL = 'https://cdn.hope-lms.app/sdk/v0.1/hope-metahuman-embed.standalone.js';

export type SessionState = 'idle' | 'listening' | 'thinking' | 'speaking';
export type PremiumAvatarState =
  'idle' | 'connecting' | 'waiting' | 'live' | 'reconnecting' | 'ended' | 'failed';

export type HopeMetahumanEvent =
  | { type: 'ready'; sessionId: string }
  | { type: 'state'; state: SessionState }
  | { type: 'avatar-state'; state: PremiumAvatarState }
  | { type: 'user-message'; text: string }
  | { type: 'reply'; text: string }
  | { type: 'error'; message: string };

type SharedProps = {
  /** Absolute origin of the HOPE Metahuman Service. */
  baseUrl: string;
  /** Your backend endpoint returning `{ token, expiresIn }`. */
  tokenEndpoint: string;
  /**
   * Voice for an ad-hoc session that is not a configured Metahuman.
   * Omit when `metahumanId` is set — the service uses the voice stored on
   * that Metahuman.
   */
  voiceId?: string;
  voiceModel?: string;
  metahumanName?: string;
  userName?: string;
  language?: string;
  sessionId?: string;
  greeting?: string;
  placeholder?: string;
  microphone?: boolean;
  mode?: 'conversation' | 'avatar';
  sdkUrl?: string;
  tokenRequestHeaders?: Record<string, string>;
  style?: StyleProp<ViewStyle>;
  onEvent?: (event: HopeMetahumanEvent) => void;
};

export type StandardMetahumanProps = SharedProps & {
  kind: 'standard';
  /** ARKit-compatible GLB reachable from the WebView. */
  modelUrl: string;
  metahumanId?: string;
  framing?: 'head' | 'bust' | 'full';
  background?: string;
};

export type PremiumMetahumanProps = SharedProps & {
  kind: 'premium';
  /** Tenant Metahuman configured with a Premium Avatar. */
  metahumanId: string;
  posterUrl?: string;
  previewVideoUrl?: string;
};

export type HopeMetahumanViewProps = StandardMetahumanProps | PremiumMetahumanProps;

export type HopeMetahumanViewHandle = {
  send(text: string): void;
  interrupt(): void;
  reset(): void;
  setMicrophoneEnabled(enabled: boolean): void;
  stop(): void;
};

type TokenCache = { token: string; expiresAt: number };
type BridgeMessage =
  | { type: 'token-request'; requestId: string }
  | { type: 'token-invalidate' }
  | { type: 'event'; event: HopeMetahumanEvent };

/**
 * Hosts the commercial browser embed inside a native view.
 *
 * Standard Metahumans render an ARKit GLB with WebGL. Premium Metahumans start
 * a live avatar session and receive their lip-synced video and audio over
 * WebRTC. The same conversation UI and imperative API work for both.
 */
export const HopeMetahumanView = forwardRef<HopeMetahumanViewHandle, HopeMetahumanViewProps>(
  function HopeMetahumanView(props, forwardedRef) {
    const webView = useRef<WebView>(null);
    const tokenCache = useRef<TokenCache | null>(null);
    const documentKey = JSON.stringify({
      ...props,
      onEvent: undefined,
      style: undefined,
      tokenRequestHeaders: undefined,
    });
    const tokenConfigurationKey = JSON.stringify(props.tokenRequestHeaders ?? {});
    const html = useMemo(() => buildDocument(props), [documentKey]);

    useEffect(() => {
      tokenCache.current = null;
    }, [props.tokenEndpoint, tokenConfigurationKey]);

    const run = useCallback((method: string, argument?: unknown) => {
      const encoded = argument === undefined ? '' : safeJson(argument);
      webView.current?.injectJavaScript(
        `window.__hopeInvoke(${safeJson(method)}${encoded ? `,${encoded}` : ''});true;`,
      );
    }, []);

    useImperativeHandle(
      forwardedRef,
      () => ({
        send: (text) => run('send', text),
        interrupt: () => run('interrupt'),
        reset: () => run('reset'),
        setMicrophoneEnabled: (enabled) => run('setMicrophoneEnabled', enabled),
        stop: () => run('stop'),
      }),
      [run],
    );

    const provideToken = useCallback(
      async (requestId: string) => {
        try {
          const cached = tokenCache.current;
          if (cached && cached.expiresAt - Date.now() > 30_000) {
            injectBridgeMessage(webView.current, {
              type: 'token-response',
              requestId,
              token: cached.token,
            });
            return;
          }

          const response = await fetch(props.tokenEndpoint, {
            headers: { Accept: 'application/json', ...props.tokenRequestHeaders },
            credentials: 'include',
          });
          if (!response.ok) throw new Error(`Token endpoint returned ${response.status}`);

          const body = (await response.json()) as { token?: unknown; expiresIn?: unknown };
          if (typeof body.token !== 'string' || body.token.length === 0) {
            throw new Error('Token endpoint returned no token');
          }

          const expiresIn = typeof body.expiresIn === 'number' ? body.expiresIn : 600;
          tokenCache.current = {
            token: body.token,
            expiresAt: Date.now() + expiresIn * 1000,
          };
          injectBridgeMessage(webView.current, {
            type: 'token-response',
            requestId,
            token: body.token,
          });
        } catch (cause) {
          injectBridgeMessage(webView.current, {
            type: 'token-response',
            requestId,
            error: cause instanceof Error ? cause.message : String(cause),
          });
        }
      },
      [props.tokenEndpoint, props.tokenRequestHeaders],
    );

    const onMessage = useCallback(
      (nativeEvent: WebViewMessageEvent) => {
        let message: BridgeMessage;
        try {
          message = JSON.parse(nativeEvent.nativeEvent.data) as BridgeMessage;
        } catch {
          return;
        }

        if (message.type === 'token-request') {
          void provideToken(message.requestId);
        } else if (message.type === 'token-invalidate') {
          tokenCache.current = null;
        } else if (message.type === 'event') {
          props.onEvent?.(message.event);
        }
      },
      [props.onEvent, provideToken],
    );

    return (
      <View style={[{ minHeight: 320, overflow: 'hidden' }, props.style]}>
        <WebView
          ref={webView}
          source={{ html, baseUrl: normalizedOrigin(props.baseUrl) }}
          originWhitelist={['https://*', 'http://*']}
          javaScriptEnabled
          domStorageEnabled={false}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction
          mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
          setSupportMultipleWindows={false}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={(request) => {
            if (
              request.url === 'about:blank' ||
              request.url.startsWith(normalizedOrigin(props.baseUrl))
            ) {
              return true;
            }
            if (request.navigationType !== 'other') void Linking.openURL(request.url);
            return false;
          }}
        />
      </View>
    );
  },
);

function injectBridgeMessage(target: WebView | null, message: unknown): void {
  target?.injectJavaScript(`window.__hopeReceive(${safeJson(message)});true;`);
}

function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function normalizedOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/$/, '');
  }
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function attribute(name: string, value: string | undefined): string {
  return value ? `${name}="${escapeAttribute(value)}"` : '';
}

export function buildDocument(props: HopeMetahumanViewProps): string {
  const sdkUrl = props.sdkUrl ?? DEFAULT_SDK_URL;
  const sdkOrigin = normalizedOrigin(sdkUrl);
  const assetOrigins = [
    props.kind === 'standard' ? normalizedOrigin(props.modelUrl) : undefined,
    props.kind === 'premium' && props.posterUrl ? normalizedOrigin(props.posterUrl) : undefined,
    props.kind === 'premium' && props.previewVideoUrl
      ? normalizedOrigin(props.previewVideoUrl)
      : undefined,
  ].filter((value): value is string => Boolean(value));

  const avatarAttributes =
    props.kind === 'standard'
      ? [
          attribute('model-url', props.modelUrl),
          attribute('metahuman-id', props.metahumanId),
          attribute('framing', props.framing),
          attribute('background', props.background),
          'live-avatar="off"',
        ]
      : [
          attribute('metahuman-id', props.metahumanId),
          attribute('poster-url', props.posterUrl),
          attribute('preview-video-url', props.previewVideoUrl),
        ];

  const attributes = [
    attribute('base-url', props.baseUrl),
    attribute('voice-id', props.voiceId),
    attribute('voice-model', props.voiceModel ?? 'sonic-3'),
    attribute('metahuman-name', props.metahumanName),
    attribute('user-name', props.userName),
    attribute('language', props.language ?? 'en-US'),
    attribute('session-id', props.sessionId),
    attribute('greeting', props.greeting),
    attribute('placeholder', props.placeholder),
    props.microphone === false ? 'mic="off"' : '',
    props.mode === 'avatar' ? 'mode="avatar"' : '',
    ...avatarAttributes,
  ]
    .filter(Boolean)
    .join('\n      ');

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${escapeAttribute(sdkOrigin)} 'nonce-hope-native'; connect-src https: http: wss: ws:; img-src data: blob: ${assetOrigins.map(escapeAttribute).join(' ')}; media-src blob: ${assetOrigins.map(escapeAttribute).join(' ')}; worker-src blob:; style-src 'unsafe-inline'">
    <style>html,body,hope-metahuman{display:block;width:100%;height:100%;margin:0;overflow:hidden;background:transparent}</style>
    <script id="hope-sdk" type="module" src="${escapeAttribute(sdkUrl)}"></script>
  </head>
  <body>
    <hope-metahuman
      ${attributes}
    ></hope-metahuman>
    <script nonce="hope-native">
      (() => {
        const pending = new Map();
        const send = (message) => window.ReactNativeWebView.postMessage(JSON.stringify(message));
        const element = document.querySelector('hope-metahuman');

        document.querySelector('#hope-sdk').addEventListener('error', () =>
          send({ type: 'event', event: { type: 'error', message: 'The HOPE Metahuman SDK bundle could not be loaded' } }),
        );

        window.__hopeReceive = (message) => {
          if (message.type !== 'token-response') return;
          const request = pending.get(message.requestId);
          if (!request) return;
          pending.delete(message.requestId);
          clearTimeout(request.timer);
          if (message.error) request.reject(new Error(message.error));
          else request.resolve(message.token);
        };

        window.__hopeInvoke = (method, argument) => {
          const fn = element && element[method];
          if (typeof fn !== 'function') return;
          Promise.resolve(fn.call(element, argument)).catch((error) =>
            send({ type: 'event', event: { type: 'error', message: error && error.message || String(error) } }),
          );
        };

        element.tokenProvider = {
          getToken() {
            return new Promise((resolve, reject) => {
              const requestId = String(Date.now()) + '-' + Math.random().toString(36).slice(2);
              const timer = setTimeout(() => {
                pending.delete(requestId);
                reject(new Error('Native token request timed out'));
              }, 15000);
              pending.set(requestId, { resolve, reject, timer });
              send({ type: 'token-request', requestId });
            });
          },
          invalidate() { send({ type: 'token-invalidate' }); },
        };

        const eventNames = ['ready', 'state', 'avatar-state', 'user-message', 'reply'];
        for (const name of eventNames) {
          element.addEventListener('hope-' + name, (event) =>
            send({ type: 'event', event: { type: name, ...event.detail } }),
          );
        }
        element.addEventListener('hope-error', (event) =>
          send({ type: 'event', event: { type: 'error', message: event.detail.error.message } }),
        );
      })();
    </script>
  </body>
</html>`;
}
