#!/usr/bin/env node
/*
 * Backward-compatibility gate.
 *
 * Asserts every build target still exposes (at least) the public surface frozen
 * in test/api-baseline.json, each member with the same `typeof`. Adding members
 * is fine (the surface may be a superset). Removing, renaming, or changing the
 * kind of an existing member is a BREAKING change and fails this test — if it is
 * intentional, bump the MAJOR version and update test/api-baseline.json.
 *
 * Both the CJS/UMD entry (require) and the ESM entry (dynamic import of the
 * built bundle) are actually loaded and exercised, so a regression in either
 * output shape is caught — not just a text grep.
 *
 * No test framework (keeps the zero-dependency posture) — plain Node + assert.
 * Run after a build:  npm test   (build → typecheck → this)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'api-baseline.json'), 'utf8'));

const failures = [];
function check(cond, msg) { if (!cond) failures.push(msg); }

// Verify one loaded module (its module-level exports + the init() instance surface).
function checkSurface(label, mod) {
  if (!mod) { failures.push(label + ': module did not load'); return; }
  for (const [name, kind] of Object.entries(baseline.module)) {
    check(typeof mod[name] === kind,
      label + ': module export "' + name + '" expected ' + kind + ', got ' + typeof mod[name]);
  }
  if (typeof mod.init !== 'function') return;
  const inst = mod.init({ spaceId: '__apitest__' });
  for (const [name, kind] of Object.entries(baseline.instance)) {
    if (!(name in inst)) {
      failures.push(label + ': instance member "' + name + '" is MISSING (was ' + kind + ')');
    } else if (typeof inst[name] !== kind) {
      failures.push(label + ': instance member "' + name + '" changed kind: ' + kind + ' -> ' + typeof inst[name]);
    }
  }
}

async function main() {
  // Build outputs consumers rely on must exist.
  const umdPath = path.join(DIST, 'service-login.js');
  const esmPath = path.join(DIST, 'service-login.esm.js');
  check(fs.existsSync(umdPath), 'dist/service-login.js missing (package.json#main)');
  check(fs.existsSync(esmPath), 'dist/service-login.esm.js missing (package.json#module)');
  check(fs.existsSync(path.join(DIST, 'service-login.min.js')), 'dist/service-login.min.js missing (package.json#browser)');
  check(fs.existsSync(path.join(DIST, 'service-login.d.ts')), 'dist/service-login.d.ts missing (package.json#types)');

  // 1) CJS / UMD entry (require).
  if (fs.existsSync(umdPath)) {
    // eslint-disable-next-line global-require
    checkSurface('cjs', require(umdPath));
  }

  // 2) ESM entry — actually import the built bundle and exercise its default export.
  //    The bundle is self-contained (no relative imports), so a data: URL import
  //    works without the .js-is-CJS ambiguity of this (non-"type":"module") package.
  if (fs.existsSync(esmPath)) {
    try {
      const src = fs.readFileSync(esmPath, 'utf8');
      const url = 'data:text/javascript;base64,' + Buffer.from(src, 'utf8').toString('base64');
      const ns = await import(url);
      check(ns && ns.default && typeof ns.default === 'object', 'esm: default export is not an object');
      checkSurface('esm(default)', ns && ns.default);
    } catch (e) {
      failures.push('esm: failed to import built bundle — ' + (e && e.message));
    }
  }

  if (failures.length) {
    console.error('✗ Backward-compatibility gate FAILED:\n' + failures.map(function (f) { return '  - ' + f; }).join('\n'));
    console.error('\nIf this change is intentional and breaking, bump the MAJOR version and update test/api-baseline.json.');
    process.exit(1);
  }

  const n = Object.keys(baseline.instance).length + Object.keys(baseline.module).length;
  console.log('✓ Backward-compatibility gate passed (' + n + ' frozen members present on both CJS and ESM entries, kinds match).');
}

main().catch(function (e) { console.error(e); process.exit(1); });
