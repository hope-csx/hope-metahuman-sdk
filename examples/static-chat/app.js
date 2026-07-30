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
 * never is. A token is a bearer credential, and local storage is readable by
 * any script that ends up on the page.
 */

/** Key under which the non-secret settings are persisted. */
const STORAGE_KEY = 'hope-metahuman-example-settings';

/** Defaults used when nothing else supplies a value. */
const DEFAULTS = {
  baseUrl: '',
  tokenEndpoint: '',
  modelUrl: '',
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

/** Held in memory only, for the lifetime of the page. */
let machineToken = '';

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
 * Persist settings, deliberately excluding the token.
 *
 * @param settings - The current form values
 */
function storeConfig(settings) {
  const persistable = { ...settings };
  delete persistable.token;
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
  setAttribute('token-endpoint', settings.tokenEndpoint);
  setAttribute('model-url', settings.modelUrl);
  setAttribute('voice-id', settings.voiceId);
  setAttribute('voice-model', settings.voiceModel);
  setAttribute('metahuman-name', settings.metahumanName);
  setAttribute('language', settings.language);

  // The token goes through the property rather than an attribute so it never
  // appears in the DOM, in devtools' element inspector, or in a page snapshot.
  machineToken = settings.token ?? '';
  element.tokenProvider = machineToken
    ? { getToken: () => Promise.resolve(machineToken), invalidate: () => {} }
    : null;

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
  fillForm({ ...DEFAULTS, token: '' });
  void applySettings({ ...DEFAULTS, token: '' });
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
