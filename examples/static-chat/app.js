/**
 * Wiring for the static embed example.
 *
 * The page is a plain static site — no framework, no build step, no server-side
 * code — so this file is the whole application: it reads configuration, applies
 * it to the `<hope-metahuman>` element as attributes, and logs the events the
 * element dispatches.
 *
 * The one rule worth carrying into your own integration is how the credential
 * is handled. Configuration is persisted to local storage; the machine token
 * and the API key secret never are. Both are bearer credentials, and local
 * storage is readable by any script that ends up on the page.
 */

/** Key under which the non-secret settings are persisted. */
const STORAGE_KEY = 'hope-metahuman-example-settings';

/** Values never written to local storage, however the form is submitted. */
const SECRET_FIELDS = ['token', 'clientSecret'];

/** Defaults used when nothing else supplies a value. */
const DEFAULTS = {
  baseUrl: '',
  tokenEndpoint: '',
  clientId: '',
  avatarKind: 'standard',
  metahumanId: '',
  modelUrl: '',
  posterUrl: '',
  previewVideoUrl: '',
  voiceId: '',
  voiceModel: 'sonic-3',
  metahumanName: '',
  language: 'en-US',
};

const element = document.querySelector('#metahuman');
const form = document.querySelector('#settings-form');
const settingsPanel = document.querySelector('#settings');
const settingsToggle = document.querySelector('#settings-toggle');
const clearButton = document.querySelector('#clear-settings');
const eventLog = document.querySelector('#event-log');

/**
 * Load the checked-in `config.js`.
 *
 * @returns The exported configuration, or an empty object when the file is
 *   missing or fails to parse
 */
async function loadFileConfig() {
  try {
    const module = await import('./config.js');
    return module.default ?? {};
  } catch (error) {
    console.warn('config.js could not be loaded; using defaults.', error);
    return {};
  }
}

/**
 * Read persisted settings.
 *
 * @returns The saved settings, or an empty object when none are stored or the
 *   stored value is unreadable
 */
function loadStoredConfig() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

/**
 * Persist settings, deliberately excluding every credential.
 *
 * The API key *ID* is kept: it is a public identifier, and retyping it on
 * every reload with no security benefit only tempts people into pasting the
 * pair somewhere more permanent.
 *
 * @param settings - The current form values
 */
function storeConfig(settings) {
  const persistable = { ...settings };
  for (const field of SECRET_FIELDS) delete persistable[field];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
}

/**
 * Fill the form from a settings object.
 *
 * @param settings - Values to display
 */
function fillForm(settings) {
  for (const [name, value] of Object.entries(settings)) {
    const field = form.elements.namedItem(name);
    if (field) field.value = value ?? '';
  }
}

/** @returns The current form values as a plain object. */
function readForm() {
  return Object.fromEntries(new FormData(form).entries());
}

/**
 * Build a token provider that exchanges an API key in the browser.
 *
 * **This is a local-development shortcut, and the only one in this file that
 * you should not copy into a deployed page.** It exists because the alternative
 * for a first try — standing up a backend before you have seen the thing work —
 * is a poor trade when you are still deciding whether to use the SDK at all.
 * Unlike a pasted token it refreshes, so a session does not die after ten
 * minutes.
 *
 * What makes it unsafe is not the network call but the secret's lifetime: it
 * never expires, so one page view is enough for a visitor to keep talking to
 * your tenant forever. `examples/token-server` is the same exchange moved
 * behind your own authentication, which is where it belongs in production.
 *
 * @param baseUrl - Origin of the HOPE Metahuman Service deployment
 * @param clientId - API key ID
 * @param clientSecret - API key secret
 * @returns A `TokenProvider` the element can use
 */
function createApiKeyTokenProvider(baseUrl, clientId, clientSecret) {
  let cached = null;

  return {
    async getToken() {
      // Re-mint half a minute early so a token is never handed to a WebSocket
      // upgrade so close to expiry that the server rejects it in flight.
      if (cached && Date.now() < cached.expiresAt - 30_000) return cached.token;

      const response = await fetch(new URL('/oauth/token', baseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (!response.ok) {
        // The body is not included: it is not guaranteed to be free of the
        // submitted credential in every failure mode.
        throw new Error(`Token grant failed with ${response.status}`);
      }

      const body = await response.json();
      cached = {
        token: body.access_token,
        expiresAt: Date.now() + (body.expires_in ?? 600) * 1000,
      };
      return cached.token;
    },
    invalidate() {
      cached = null;
    },
  };
}

/**
 * Choose which credential the element should use.
 *
 * A typed API key or token wins over the configured token endpoint. Neither
 * secret is ever persisted, so their presence means someone entered one in
 * this session — deliberately, to try something — and silently preferring the
 * endpoint would make the panel look broken. `config.js` ships pointing at a
 * token endpoint, which is what should serve every page nobody is sitting in
 * front of.
 *
 * @param settings - The current form values
 * @returns A `TokenProvider`, or null to leave the element's own handling alone
 */
function credentialFor(settings) {
  if (settings.clientId && settings.clientSecret) {
    log('setup', 'Exchanging an API key in the browser — local development only.');
    return createApiKeyTokenProvider(settings.baseUrl, settings.clientId, settings.clientSecret);
  }

  if (settings.token) {
    return { getToken: () => Promise.resolve(settings.token), invalidate: () => {} };
  }

  return null;
}

/**
 * Report whether the custom element has been upgraded by the SDK bundle.
 *
 * Until the bundle loads, `<hope-metahuman>` is an ordinary unknown element
 * with no methods on it. The bundle is commercially licensed and may legitimately
 * be absent — see sdk-loader.js — so the page has to keep working without it
 * rather than throwing partway through setup and leaving the UI half-wired.
 *
 * @returns {boolean}
 */
function isElementReady() {
  return typeof element.stop === 'function';
}

/**
 * Apply settings to the element and restart it.
 *
 * The element is torn down first because base URL, credential, and model are
 * read once at start: changing an attribute on a running session would leave
 * the on-screen avatar and the live connection describing different things.
 *
 * @param settings - Values to apply
 */
async function applySettings(settings) {
  if (isElementReady()) await element.stop();

  setAttribute('base-url', settings.baseUrl);
  setAttribute('metahuman-id', settings.metahumanId);
  setAttribute('model-url', settings.avatarKind === 'standard' ? settings.modelUrl : '');
  setAttribute('poster-url', settings.posterUrl);
  setAttribute('preview-video-url', settings.previewVideoUrl);
  setAttribute('live-avatar', settings.avatarKind === 'standard' ? 'off' : '');
  setAttribute('voice-id', settings.voiceId);
  setAttribute('voice-model', settings.voiceModel);
  setAttribute('metahuman-name', settings.metahumanName);
  setAttribute('language', settings.language);

  // Credentials go through the property rather than an attribute so they never
  // appear in the DOM, in devtools' element inspector, or in a page snapshot.
  // Exactly one source is configured at a time: leaving the attribute in place
  // alongside a provider would make which of them wins the element's business
  // rather than something this page decides.
  const provider = credentialFor(settings);
  element.tokenProvider = provider;
  setAttribute('token-endpoint', provider ? '' : settings.tokenEndpoint);

  log('settings', settings.baseUrl ? `Configured for ${settings.baseUrl}` : 'Cleared');
}

/**
 * Set or remove an attribute depending on whether a value was given.
 *
 * @param name - Attribute name
 * @param value - Value, or an empty string to remove the attribute
 */
function setAttribute(name, value) {
  if (value) element.setAttribute(name, value);
  else element.removeAttribute(name);
}

/**
 * Append a line to the on-screen event log.
 *
 * @param kind - Short label shown as a tag
 * @param detail - Human-readable description
 */
function log(kind, detail) {
  const item = document.createElement('li');
  item.dataset.kind = kind;

  const time = document.createElement('time');
  time.textContent = new Date().toLocaleTimeString();

  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = kind;

  const text = document.createElement('span');
  text.textContent = detail;

  item.append(time, tag, text);
  eventLog.append(item);

  // Keep the log bounded: a long conversation produces a token event per
  // fragment and an unbounded list eventually costs real layout time.
  while (eventLog.children.length > 100) eventLog.firstElementChild?.remove();
  item.scrollIntoView({ block: 'nearest' });
}

element.addEventListener('hope-ready', (event) => {
  log('ready', `Session ${event.detail.sessionId}`);
});
element.addEventListener('hope-state', (event) => {
  log('state', event.detail.state);
});
element.addEventListener('hope-avatar-state', (event) => {
  log('avatar', event.detail.state);
});
element.addEventListener('hope-user-message', (event) => {
  log('user', event.detail.text);
});
element.addEventListener('hope-reply', (event) => {
  log('reply', event.detail.text);
});
element.addEventListener('hope-error', (event) => {
  log('error', event.detail.error.message);
});

settingsToggle.addEventListener('click', () => {
  const open = settingsPanel.hidden;
  settingsPanel.hidden = !open;
  settingsToggle.setAttribute('aria-expanded', String(open));
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const settings = readForm();
  storeConfig(settings);
  void applySettings(settings);
});

clearButton.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  const cleared = { ...DEFAULTS, token: '', clientSecret: '' };
  fillForm(cleared);
  void applySettings(cleared);
});

const fileConfig = await loadFileConfig();
const settings = { ...DEFAULTS, ...fileConfig, ...loadStoredConfig() };

fillForm(settings);
await applySettings(settings);

// An unconfigured page cannot connect to anything, so open the settings panel
// rather than leaving a start button that can only fail.
if (!settings.baseUrl || !settings.voiceId) {
  settingsPanel.hidden = false;
  settingsToggle.setAttribute('aria-expanded', 'true');
  log('setup', 'Enter a service base URL and voice ID to begin.');
}
