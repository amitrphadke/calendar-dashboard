#!/usr/bin/env node
// Optional dev helper: renders the built dashboard headlessly and saves a
// PNG, so you can check a layout/CSS change at the real target resolution
// without needing the actual screen in front of you.
//
// Requires the `playwright` package (not a listed dependency — install it
// yourself first: `npm install --no-save playwright && npx playwright install chromium`)
// and that you've already run `npm run build`.
//
// Usage: node scripts/preview-screenshot.mjs [width] [height]
//   node scripts/preview-screenshot.mjs            # defaults to 2560x1440
//   node scripts/preview-screenshot.mjs 1920 1080   # e.g. Fire TV Stick output

import { chromium } from 'playwright';
import { spawn } from 'child_process';

const width = parseInt(process.argv[2] || '2560', 10);
const height = parseInt(process.argv[3] || '1440', 10);
const outPath = `preview-${width}x${height}.png`;

const server = spawn('node', ['scripts/serve.mjs'], { stdio: 'pipe' });
await new Promise((resolve) => server.stdout.once('data', resolve));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height } });
await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: outPath });
console.log(`Saved ${outPath}`);

await browser.close();
server.kill();
