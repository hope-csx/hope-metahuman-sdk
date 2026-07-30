/**
 * Loads the HOPE Metahuman SDK bundle and defines the <hope-metahuman> element.
 *
 * The bundle is proprietary and commercially licensed; it is not in this
 * repository. See ../../docs/self-hosting.md for how to obtain it.
 *
 * Two sources are supported, in order:
 *
 *   1. `./vendor/` — a copy you host yourself, downloaded by `pnpm vendor`.
 *      Preferred, and the only option on an air-gapped network. Self-hosting
 *      also means one fewer external origin in your Content-Security-Policy,
 *      which is usually the difference between a security review passing and
 *      turning into a conversation.
 *   2. The CDN — convenient for getting started, and what most public sites
 *      will use.
 *
 * A real deployment normally picks one and hard-codes it. The fallback here
 * exists so the example runs whether or not you have vendored the bundle yet.
 *
 * @license MIT — this file. The bundle it loads is licensed separately.
 */

/**
 * Pinned to a major.minor track, which picks up patch releases but never a
 * breaking change. Pin the exact patch version (and add `integrity`) if you
 * need the bytes to be identical on every load.
 */
const SDK_VERSION = 'v0.1';
const CDN_ORIGIN = 'https://cdn.hope-lms.app';

const LOCAL_URL = './vendor/hope-metahuman-embed.standalone.js';
const CDN_URL = `${CDN_ORIGIN}/sdk/${SDK_VERSION}/hope-metahuman-embed.standalone.js`;

/**
 * Report whether a self-hosted bundle is present.
 *
 * Checked with HEAD rather than by catching a failed `import()`, so that the
 * common case of "not vendored yet" does not put a 404 in the console and send
 * someone debugging the wrong problem.
 *
 * @returns {Promise<boolean>}
 */
async function hasLocalBundle() {
  try {
    const response = await fetch(LOCAL_URL, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

const source = (await hasLocalBundle()) ? LOCAL_URL : CDN_URL;

try {
  await import(source);
  document.documentElement.dataset.sdkSource = source === LOCAL_URL ? 'vendored' : 'cdn';
} catch (error) {
  document.documentElement.dataset.sdkSource = 'unavailable';

  // Without the bundle the page renders its chrome and then silently does
  // nothing, which is a confusing first experience. Say what is missing.
  const banner = document.createElement('div');
  banner.setAttribute('role', 'alert');
  banner.className = 'sdk-missing';
  banner.innerHTML = '';
  banner.append(
    Object.assign(document.createElement('strong'), {
      textContent: 'The HOPE Metahuman SDK bundle could not be loaded.',
    }),
    Object.assign(document.createElement('p'), {
      textContent:
        'It is commercially licensed and is not part of this repository. Run "pnpm vendor" ' +
        'with your licence credentials to download it, or check that this page can reach ' +
        `${CDN_ORIGIN}.`,
    }),
  );
  document.body.prepend(banner);

  console.error('[hope-metahuman] failed to load the SDK bundle from', source, error);
}
