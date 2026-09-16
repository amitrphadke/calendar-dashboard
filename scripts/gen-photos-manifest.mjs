#!/usr/bin/env node
// Scans public/photos/ and writes dist/data/photos.json listing them, so the
// frontend (which can't list a directory itself on a static host) knows
// what to rotate through. Drop JPEG/PNG/WebP files into public/photos/ —
// nothing else to configure. Empty is fine; the frontend falls back to a
// plain background.

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs';
import { extname } from 'path';

const PHOTOS_DIR = 'public/photos';
const OUT_DIR = 'dist/data';
const ALLOWED = new Set(['.jpg', '.jpeg', '.png', '.webp']);

mkdirSync(OUT_DIR, { recursive: true });

let files = [];
if (existsSync(PHOTOS_DIR)) {
  files = readdirSync(PHOTOS_DIR)
    .filter((f) => ALLOWED.has(extname(f).toLowerCase()))
    .sort();
}

writeFileSync(`${OUT_DIR}/photos.json`, JSON.stringify({ photos: files.map((f) => `photos/${f}`) }, null, 2));
console.log(`[gen-photos-manifest] Wrote manifest with ${files.length} photo(s).`);
