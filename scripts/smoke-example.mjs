#!/usr/bin/env node
/**
 * Browser smoke test for the static example.
 *
 * The custom element, the WebGL renderer, and microphone capture are the parts
 * of this integration that unit tests cannot reach: they need a real document,
 * a real GPU context, and a real `AudioWorklet`. Rather than fake those deeply
 * enough to execute — which would test the fakes — this drives the actual
 * example page in a real browser and asserts the observable result.
 *
 * The SDK bundle is proprietary and is not in this repository, so the test runs
 * in two tiers:
 *
 *   - Without the bundle it checks the page's own behaviour, including that a
 *     missing bundle is reported rather than failing silently. This tier always
 *     runs, so a contributor with no licence can still verify their change.
 *   - With the bundle it additionally checks that the element registers,
 *     renders, and reports connection failures. Supply it by running
 *     `pnpm vendor`, or point `HOPE_SDK_BUNDLE` at a locally built file.
 *
 * Requests to the CDN are blocked throughout, so the result does not depend on
 * network access and "no bundle" is a deterministic state rather than a
 * timeout.
 *
 * It is opt-in (`pnpm smoke`) rather than part of `pnpm lint`, because it needs
 * a browser binary that not every contributor will have. It skips with an
 * explanation instead of failing when Playwright or a browser is missing.
 *
 * Set `SMOKE_BROWSER_PATH` to use a specific browser binary.
 *
 * @license MIT
 */
import { existsSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'));
const EXAMPLE = join(ROOT, 'examples', 'static-chat');
const BUNDLE_PATH = '/vendor/hope-metahuman-embed.standalone.js';

/** Browsers to try when Playwright has no bundled one, in order of preference. */
const SYSTEM_BROWSERS = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

/**
 * Locate the SDK bundle, if this machine has one.
 *
 * `HOPE_SDK_BUNDLE` lets the monorepo that builds the SDK run this same test
 * against a freshly built artifact, without publishing it first.
 *
 * @returns {string | null} Absolute path to the bundle, or null
 */
function findBundle() {
  const override = process.env['HOPE_SDK_BUNDLE'];
  if (override) {
    if (!existsSync(override)) {
      console.error(`HOPE_SDK_BUNDLE is set to ${override}, which does not exist.`);
      process.exit(1);
    }
    return resolve(override);
  }

  const vendored = join(EXAMPLE, 'vendor', 'hope-metahuman-embed.standalone.js');
  return existsSync(vendored) ? vendored : null;
}

/**
 * Serve the example directory on an ephemeral port.
 *
 * @param {string | null} bundlePath - Served at the vendor path when supplied
 * @returns {Promise<{ server: import('node:http').Server, origin: string }>}
 */
async function startServer(bundlePath) {
  const server = createServer((request, response) => {
    const requestPath = new URL(request.url ?? '/', 'http://localhost').pathname;

    const send = (target) => {
      response.writeHead(200, {
        'Content-Type': CONTENT_TYPES[extname(target)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      createReadStream(target).pipe(response);
    };

    if (requestPath === BUNDLE_PATH) {
      if (bundlePath) {
        send(bundlePath);
      } else {
        response.writeHead(404).end('Not found');
      }
      return;
    }

    const candidate = join(EXAMPLE, normalize(requestPath));
    const filePath = candidate.startsWith(EXAMPLE) ? candidate : EXAMPLE;

    void (async () => {
      let target = filePath;
      try {
        const info = await stat(target);
        if (info.isDirectory()) target = join(target, 'index.html');
        await stat(target);
      } catch {
        response.writeHead(404).end('Not found');
        return;
      }
      send(target);
    })();
  });

  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

/**
 * Print why the check could not run and exit successfully.
 *
 * @param {string} reason - What was missing
 */
function skip(reason) {
  console.log(`SKIP  ${reason}`);
  console.log('      The smoke test is optional; pnpm lint covers everything else.');
  process.exit(0);
}

const failures = [];

/**
 * Record a named assertion.
 *
 * @param {string} name - What is being checked
 * @param {boolean} condition - Whether it held
 * @param {string} [detail] - Extra context to print on failure
 */
function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  skip('Playwright is not installed. Run pnpm install.');
}

const bundlePath = findBundle();
const executablePath = process.env['SMOKE_BROWSER_PATH'] ?? SYSTEM_BROWSERS.find(existsSync);

const { server, origin } = await startServer(bundlePath);
let browser;

try {
  browser = await chromium.launch(executablePath ? { executablePath } : {});
} catch (error) {
  await new Promise((done) => server.close(done));
  skip(`No browser could be launched (${error.message.split('\n')[0]}).`);
}

try {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Keep the run offline and deterministic. Without this, "the bundle is
  // missing" would depend on whether the machine can reach the CDN.
  await page.route('**://cdn.hope-lms.app/**', (route) => route.abort());

  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  console.log(`\nLoading ${origin}`);
  console.log(
    bundlePath ? `SDK bundle: ${bundlePath}\n` : 'SDK bundle: not present — page-only checks\n',
  );
  await page.goto(origin, { waitUntil: 'networkidle' });

  const shell = await page.evaluate(() => ({
    sdkSource: document.documentElement.dataset.sdkSource,
    hasElement: document.querySelector('hope-metahuman') !== null,
    hasSettingsForm: document.querySelector('#settings-form') !== null,
    settingsOpen: document.querySelector('#settings')?.hidden === false,
    missingBanner: document.querySelector('.sdk-missing') !== null,
    configured: Boolean(
      document.querySelector('hope-metahuman')?.getAttribute('base-url') &&
      document.querySelector('hope-metahuman')?.getAttribute('voice-id'),
    ),
  }));

  console.log('Page shell');
  check('the page reports where it loaded the SDK from', shell.sdkSource !== undefined);
  check('the element is present in the markup', shell.hasElement);
  check('the settings form rendered', shell.hasSettingsForm);
  // Which way this should go depends on whether config.js has been filled in,
  // so both directions of the contract are asserted rather than assuming the
  // example is pristine.
  check(
    shell.configured
      ? 'the settings panel stays closed when already configured'
      : 'the settings panel opens when unconfigured',
    shell.configured ? !shell.settingsOpen : shell.settingsOpen,
  );

  if (!bundlePath) {
    console.log('\nWithout the SDK bundle');
    check('the loader reports the bundle as unavailable', shell.sdkSource === 'unavailable');
    check('the page explains what is missing rather than failing silently', shell.missingBanner);
  } else {
    console.log('\nWith the SDK bundle');
    check('the loader used the self-hosted copy', shell.sdkSource === 'vendored');
    check('no missing-bundle banner is shown', !shell.missingBanner);
    check('no console errors on load', consoleErrors.length === 0, consoleErrors.join('; '));

    const element = await page.evaluate(() => {
      const node = document.querySelector('hope-metahuman');
      const root = node?.shadowRoot;
      return {
        defined: customElements.get('hope-metahuman') !== undefined,
        upgraded: node?.constructor.name !== 'HTMLElement',
        hasCanvas: root?.querySelector('canvas') !== null,
        hasInput: root?.querySelector('input[type="text"]') !== null,
        startLabel: root?.querySelector('button')?.textContent?.trim() ?? '',
        greeting: root?.textContent?.includes('Configure a connection') ?? false,
      };
    });

    check('the custom element is registered', element.defined);
    check('the element upgraded from HTMLElement', element.upgraded);
    check('the avatar canvas rendered', element.hasCanvas);
    check('the text input rendered', element.hasInput);
    check('the start gate is shown', element.startLabel.length > 0, element.startLabel);
    check('the greeting is shown', element.greeting);
  }

  // The page opens the settings panel by itself only when it has nothing to
  // connect with. A developer who has filled in config.js gets a closed panel,
  // so it is opened explicitly here rather than assumed.
  if (await page.locator('#settings').isHidden()) {
    await page.click('#settings-toggle');
  }
  await page.waitForSelector('#settings-form [name="baseUrl"]', { state: 'visible' });

  await page.fill('#settings-form [name="baseUrl"]', 'https://api.invalid.example');
  await page.fill('#settings-form [name="voiceId"]', 'voice-demo');
  await page.selectOption('#settings-form [name="avatarKind"]', 'premium');
  await page.fill('#settings-form [name="metahumanId"]', '3f9a2b71-5c4d-4e18-b062-7a1e9d3c8f40');
  await page.fill('#settings-form [name="posterUrl"]', 'https://assets.invalid.example/dana.jpg');
  await page.click('#settings-form button[type="submit"]');
  await page.waitForTimeout(200);

  const configured = await page.evaluate(() => {
    const node = document.querySelector('hope-metahuman');
    return {
      baseUrl: node?.getAttribute('base-url'),
      voiceId: node?.getAttribute('voice-id'),
      metahumanId: node?.getAttribute('metahuman-id'),
      modelUrl: node?.getAttribute('model-url'),
      posterUrl: node?.getAttribute('poster-url'),
      liveAvatar: node?.getAttribute('live-avatar'),
      stored: Object.keys(localStorage).length > 0,
    };
  });

  console.log('\nConfiguration');
  check('the base URL reached the element', configured.baseUrl === 'https://api.invalid.example');
  check('the voice ID reached the element', configured.voiceId === 'voice-demo');
  check(
    'Premium mode reached the element',
    configured.metahumanId === '3f9a2b71-5c4d-4e18-b062-7a1e9d3c8f40' &&
      configured.modelUrl === null &&
      configured.posterUrl === 'https://assets.invalid.example/dana.jpg' &&
      configured.liveAvatar === null,
  );
  check('settings were persisted', configured.stored);

  if (bundlePath) {
    await page.evaluate(() =>
      document.querySelector('hope-metahuman')?.shadowRoot?.querySelector('button')?.click(),
    );
    await page.waitForTimeout(1500);

    const afterStart = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#event-log li')).map((item) => item.textContent ?? ''),
    );

    console.log('\nStarting against an unreachable host');
    check('the session emitted events to the page', afterStart.length > 0);
    check(
      'the connection failure surfaced as an error',
      afterStart.some((line) => line.includes('error')),
      afterStart.join(' | '),
    );
    check(
      'the failure was reported once, not twice',
      afterStart.filter((line) => line.includes('Speech-to-text transport error')).length <= 1,
      afterStart.join(' | '),
    );
  }
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}

if (failures.length > 0) {
  console.log(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}

console.log('\nAll checks passed.');
