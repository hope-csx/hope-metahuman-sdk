#!/usr/bin/env node
/**
 * Download the HOPE Metahuman SDK bundle for self-hosting.
 *
 * The bundle is proprietary and commercially licensed, so it is not committed
 * to this repository. This script fetches it into `examples/static-chat/vendor/`
 * so the example can run without reaching the CDN at page load — which is the
 * only way it runs at all on an air-gapped network, and one fewer external
 * origin to justify in a Content-Security-Policy review everywhere else.
 *
 * The downloaded file is verified against the SRI hash published beside it. A
 * bundle that fails the check is deleted rather than left on disk, because a
 * partially-written or tampered file that merely logs a warning is worse than
 * no file at all: the loader would happily serve it.
 *
 * Usage:
 *   pnpm vendor                 # major.minor track, picks up patches
 *   pnpm vendor 0.1.19          # an exact version
 *   HOPE_SDK_CDN=... pnpm vendor  # a mirror you host
 *
 * @license MIT
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const vendorDir = join(repoRoot, 'examples', 'static-chat', 'vendor');

const DEFAULT_VERSION = 'v0.1';
const origin = process.env.HOPE_SDK_CDN ?? 'https://cdn.svc.hopemtp.app';

const requested = process.argv[2] ?? DEFAULT_VERSION;
const version = requested.startsWith('v') ? requested : `v${requested}`;

const base = `${origin}/sdk/${version}`;
const BUNDLE = 'hope-metahuman-embed.standalone.js';

/**
 * Fetch a URL, failing loudly with the status rather than a generic error.
 *
 * @param {string} url
 * @returns {Promise<Response>}
 */
async function get(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} returned ${response.status} ${response.statusText}`);
  }
  return response;
}

async function main() {
  console.log(`Fetching the SDK bundle ${version} from ${origin}`);

  const bundle = Buffer.from(await (await get(`${base}/${BUNDLE}`)).arrayBuffer());

  // The published SRI hash is the same string a page would put in its
  // `integrity` attribute, so checking it here catches a corrupted or swapped
  // artifact before it is ever served.
  const expected = (await (await get(`${base}/${BUNDLE}.sri`)).text()).trim();
  const actual = `sha384-${createHash('sha384').update(bundle).digest('base64')}`;

  if (expected !== actual) {
    throw new Error(
      `Integrity check failed for ${BUNDLE}.\n  expected: ${expected}\n  actual:   ${actual}`,
    );
  }

  await mkdir(vendorDir, { recursive: true });
  await writeFile(join(vendorDir, BUNDLE), bundle);

  // Ship the licence next to the bundle. It governs that file, not this
  // repository, and someone finding the directory later should be able to
  // tell the difference without going looking.
  try {
    const licence = await (await get(`${base}/LICENSE.md`)).text();
    await writeFile(join(vendorDir, 'LICENSE.md'), licence);
  } catch (error) {
    console.warn(`Warning: could not fetch the bundle licence — ${error.message}`);
  }

  await writeFile(
    join(vendorDir, 'README.md'),
    [
      '# Vendored SDK bundle',
      '',
      '**The contents of this directory are NOT MIT licensed and are not part of',
      'this repository.** They are proprietary, commercially licensed artifacts',
      'downloaded by `pnpm vendor`. See `LICENSE.md` here, and',
      '`docs/self-hosting.md` in the repository root.',
      '',
      `- Source: \`${base}/${BUNDLE}\``,
      `- Version: \`${version}\``,
      `- Integrity: \`${expected}\``,
      '',
      'This directory is git-ignored. Do not commit it.',
      '',
    ].join('\n'),
  );

  const kib = (bundle.byteLength / 1024).toFixed(1);
  console.log(`Wrote ${join(vendorDir, BUNDLE)} (${kib} KiB)`);
  console.log(`Integrity verified: ${expected}`);
}

try {
  await main();
} catch (error) {
  // Leave nothing half-written: the loader prefers whatever is in vendor/, so
  // a truncated file here would be served in preference to the good CDN copy.
  await rm(vendorDir, { recursive: true, force: true });
  console.error(`\nCould not vendor the SDK bundle.\n${error.message}`);
  console.error(
    '\nThe bundle is commercially licensed. If you do not have access, contact ' +
      'licensing@cornerstonex.ai. The example also runs directly against the CDN ' +
      'with no vendoring at all.',
  );
  process.exit(1);
}
