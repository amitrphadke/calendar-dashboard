#!/usr/bin/env node
// Fetches each configured calendar's ICS feed, expands it to a flat list of
// events, finds cross-calendar conflicts, and writes dist/data/events.json
// for the frontend to load.
//
// Deliberately fails the whole run (non-zero exit) if ANY source can't be
// fetched, rather than publishing a dashboard with one calendar silently
// missing. Paired with the GitHub Actions workflow (which does not deploy
// after a failed step), this means a transient outage just leaves the
// previous, still-correct deployment live instead of overwriting it with
// incomplete data. See README.md "How refresh failures are handled".
//
// Two different windows are fetched:
//   - the GRID window: previous month through next month, so the frontend's
//     3-month calendar view always has full data for every day it draws.
//   - the FAR window: further out (IMPORTANT_WINDOW_DAYS, default 180 days),
//     used only to catch "!"-important events beyond the visible grid (e.g.
//     a factory delivery date booked months ahead) for the countdown rail.
// Both are fetched in one pass per source; the frontend decides which parts
// of the merged list to use for the grid vs. the countdown.

import ical from 'node-ical';
import { mkdirSync, writeFileSync } from 'fs';
import { expandEvents } from './lib/parse-events.mjs';
import { findConflicts } from './lib/conflicts.mjs';
import { getFestivals, getFestivalsForYears } from './lib/festivals.mjs';

const IMPORTANT_WINDOW_DAYS = parseInt(process.env.IMPORTANT_WINDOW_DAYS || '180', 10);
const now = new Date();

const gridStart = startOfMonth(addMonths(now, -1));
const gridEnd = endOfMonth(addMonths(now, 1));
const farEnd = new Date(Math.max(gridEnd.getTime(), now.getTime() + IMPORTANT_WINDOW_DAYS * 86400000));

// Sidebar shows the one calendar year "current year" refers to; day-cell
// marking on the grid also needs whichever year(s) the visible 3 months
// actually fall in (only differs from the sidebar year right at a Dec/Jan
// boundary).
const festivals = getFestivals(now.getFullYear());
const gridFestivals = getFestivalsForYears([...new Set([gridStart.getFullYear(), gridEnd.getFullYear()])]);

// Add more entries here (and a matching ICS_URL_* secret) for more than two
// calendars. `color` is used as-is by the frontend for that calendar's
// dot/star/legend accent — pick anything that reads well on a dark photo.
const sources = [
  { id: 'business', label: 'Business', color: '#F2A93B', url: process.env.ICS_URL_BUSINESS },
  { id: 'personal', label: 'Personal', color: '#4C8DFF', url: process.env.ICS_URL_PERSONAL },
  { id: 'icloud', label: 'Family', color: '#34A853', url: process.env.ICS_URL_ICLOUD },
].filter((s) => !!s.url);

const outDir = 'dist/data';
mkdirSync(outDir, { recursive: true });

const meta = {
  generatedAt: now.toISOString(),
  gridStart: gridStart.toISOString(),
  gridEnd: gridEnd.toISOString(),
};

if (sources.length === 0) {
  console.warn(
    '[fetch-calendars] No ICS_URL_* environment variables set (see .env.example). ' +
      'Writing an empty events.json so the frontend still has something to load.'
  );
  writeFileSync(
    `${outDir}/events.json`,
    JSON.stringify({ ...meta, events: [], conflicts: [], festivals, gridFestivals }, null, 2)
  );
  process.exit(0);
}

const all = [];
let hadError = false;

for (const source of sources) {
  try {
    const data = await ical.async.fromURL(source.url);
    const events = expandEvents(data, source, { now: gridStart, windowEnd: farEnd });
    const importantCount = events.filter((e) => e.important).length;
    console.log(
      `[fetch-calendars] ${source.label}: ${events.length} event(s) through ${farEnd.toDateString()} (${importantCount} marked important)`
    );
    all.push(...events);
  } catch (err) {
    hadError = true;
    console.error(`[fetch-calendars] Failed to fetch/parse "${source.label}": ${err.message}`);
  }
}

all.sort((a, b) => new Date(a.start) - new Date(b.start));
const conflicts = findConflicts(all);

writeFileSync(
  `${outDir}/events.json`,
  JSON.stringify({ ...meta, events: all, conflicts, festivals, gridFestivals }, null, 2)
);
console.log(
  `[fetch-calendars] Wrote ${all.length} total event(s), ${conflicts.length} conflict(s) and ${festivals.length} India festival(s) for ${now.getFullYear()} to ${outDir}/events.json`
);

if (hadError) {
  console.error('[fetch-calendars] One or more sources failed — exiting non-zero so this run does not get deployed.');
  process.exit(1);
}

// ---- date helpers -----------------------------------------------------------

function addMonths(date, delta) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}
