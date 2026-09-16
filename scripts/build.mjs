#!/usr/bin/env node
// Assembles dist/: copies the static frontend and any photos, then runs the
// two data-generating scripts. `npm run build` runs this.
//
// Deliberately does NOT catch a fetch-calendars failure: if a configured
// calendar source can't be fetched, this script exits non-zero too, so
// `npm run build` (and the CI step that calls it) fails loudly instead of
// quietly shipping a dashboard with a calendar missing. Locally, with no
// .env at all, fetch-calendars treats "zero sources configured" as normal
// and exits 0 with an empty events.json — see scripts/fetch-calendars.mjs.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { execSync } from 'child_process';
import { extname } from 'path';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

cpSync('src', 'dist', { recursive: true });

if (existsSync('public/photos')) {
  const ALLOWED = new Set(['.jpg', '.jpeg', '.png', '.webp']);
  mkdirSync('dist/photos', { recursive: true });
  for (const f of readdirSync('public/photos')) {
    if (ALLOWED.has(extname(f).toLowerCase())) {
      cpSync(`public/photos/${f}`, `dist/photos/${f}`);
    }
  }
}
console.log('[build] Copied static assets to dist/');

execSync('node scripts/gen-photos-manifest.mjs', { stdio: 'inherit' });
execSync('node scripts/fetch-calendars.mjs', { stdio: 'inherit' });

console.log('[build] Done.');
