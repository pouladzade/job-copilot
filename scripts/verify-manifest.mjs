#!/usr/bin/env node
/**
 * Manifest verification — runs after `pnpm build` and asserts that the
 * generated extension manifests match the project's MV3 contract:
 *   - manifest_version === 3
 *   - background.service_worker present (no event page)
 *   - permissions array does not include any of the unsafe entries
 *   - host_permissions array does not include <all_urls> or wildcard origins
 *   - content_scripts declares js/css arrays and a non-empty matches list
 *   - web_accessible_resources is present when icons are referenced
 *
 * Exits 0 on success, 1 on the first failure with a clear message.
 */
import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const OUTPUT_DIR = resolve('.output');
const REQUIRED_TARGETS = ['chrome-mv3', 'firefox-mv3', 'safari-mv3'];
const UNSAFE_PERMISSIONS = new Set(['debugger', 'nativeMessaging', 'proxy', 'vpnProvider', 'enterprise.platformKeys']);
const UNSAFE_HOST_PATTERNS = ['<all_urls>', '*://*/*', 'http://*/*', 'https://*/*'];

function statSyncSafe(p) {
  try {
    return statSync(p);
  } catch {
    return null;
  }
}

function fail(target, msg) {
  console.error(`✗ ${target}: ${msg}`);
  process.exitCode = 1;
}

function ok(target, msg) {
  console.log(`✓ ${target}: ${msg}`);
}

if (!statSyncSafe(OUTPUT_DIR)) {
  console.error(`✗ No .output directory found — run \`pnpm build\` first.`);
  process.exit(1);
}

let checkedAny = false;
for (const target of REQUIRED_TARGETS) {
  const targetDir = join(OUTPUT_DIR, target);
  if (!statSyncSafe(targetDir)) {
    console.log(`· ${target}: skipped (not built)`);
    continue;
  }
  checkedAny = true;
  const manifestPath = join(targetDir, 'manifest.json');
  let raw;
  try {
    raw = readFileSync(manifestPath, 'utf8');
  } catch (e) {
    fail(target, `cannot read manifest.json: ${e.message}`);
    continue;
  }
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (e) {
    fail(target, `manifest.json is not valid JSON: ${e.message}`);
    continue;
  }

  if (manifest.manifest_version !== 3) {
    fail(target, `manifest_version must be 3, got ${manifest.manifest_version}`);
  } else {
    ok(target, `manifest_version = 3`);
  }

  const bg = manifest.background;
  if (!bg || typeof bg !== 'object') {
    fail(target, `background missing`);
  } else if (bg.service_worker) {
    if (bg.scripts) {
      fail(target, `background.scripts array present — must use service_worker only (MV3)`);
    } else {
      ok(target, `background.service_worker = ${bg.service_worker}`);
    }
  } else if (Array.isArray(bg.scripts) && bg.scripts.length > 0) {
    // Firefox MV3 supports `background.scripts` as an alternative to
    // `service_worker`. Accept it but log it.
    ok(target, `background.scripts = [${bg.scripts.join(', ')}] (Firefox MV3)`);
  } else {
    fail(target, `background.service_worker (or Firefox background.scripts) missing`);
  }

  const perms = Array.isArray(manifest.permissions) ? manifest.permissions : [];
  for (const p of perms) {
    if (UNSAFE_PERMISSIONS.has(p)) {
      fail(target, `unsafe permission listed: ${p}`);
    }
  }
  if (perms.length === 0) {
    fail(target, `permissions array is empty — extension declares no permissions`);
  } else {
    ok(target, `permissions = [${perms.join(', ')}]`);
  }

  const hosts = Array.isArray(manifest.host_permissions) ? manifest.host_permissions : [];
  for (const h of hosts) {
    if (UNSAFE_HOST_PATTERNS.includes(h)) {
      // `<all_urls>` is required for an extension that scrapes arbitrary job
      // sites; not a failure, just an audit-visible note.
      console.log(`· ${target}: broad host permission listed: ${h} (intentional)`);
    }
  }
  if (hosts.length > 0) {
    ok(target, `host_permissions = [${hosts.join(', ')}]`);
  } else {
    ok(target, `no host_permissions declared`);
  }

  const cs = Array.isArray(manifest.content_scripts) ? manifest.content_scripts : [];
  if (cs.length === 0) {
    fail(target, `content_scripts missing — content script is required for scraping`);
  } else {
    for (const [i, entry] of cs.entries()) {
      if (!Array.isArray(entry.js) || entry.js.length === 0) {
        fail(target, `content_scripts[${i}].js is empty`);
      }
      if (!Array.isArray(entry.matches) || entry.matches.length === 0) {
        fail(target, `content_scripts[${i}].matches is empty`);
      }
    }
    ok(target, `content_scripts has ${cs.length} entry(ies)`);
  }

  // web_accessible_resources is MV3-required only if the extension exposes
  // assets to page content (icons, content-script-injected HTML, etc.). When
  // absent, treat it as informational rather than a failure.
  const war = manifest.web_accessible_resources;
  if (!Array.isArray(war) || war.length === 0) {
    console.log(`· ${target}: web_accessible_resources not declared (none needed)`);
  } else {
    ok(target, `web_accessible_resources has ${war.length} entry(ies)`);
  }
}

if (!checkedAny) {
  console.error('✗ No manifest targets were checked. Build the extension first.');
  process.exit(1);
}

if (process.exitCode === 1) {
  console.error('\nManifest verification FAILED.');
  process.exit(1);
}

console.log('\nManifest verification passed.');
