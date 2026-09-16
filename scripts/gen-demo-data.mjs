#!/usr/bin/env node
// Writes dist/data/events.json with believable sample events anchored to
// *today* (rather than a fixed test date), so you can preview the real
// layout — the 3-month grid, the days-remaining rail, the conflicts panel —
// before wiring up real ICS URLs. Not part of the normal build; run it
// explicitly with `npm run demo`, then `npm run serve`.
//
// This intentionally does NOT touch scripts/lib/parse-events.mjs or the
// fixtures/ used by `npm test` — those stay fixed-date so the test suite
// stays deterministic. This script builds plain event objects directly in
// the same shape expandEvents() produces.

import { mkdirSync, writeFileSync } from 'fs';
import { findConflicts } from './lib/conflicts.mjs';
import { getFestivals, getFestivalsForYears } from './lib/festivals.mjs';

const now = new Date();
const BUSINESS = { label: 'Business', color: '#F2A93B' };
const PERSONAL = { label: 'Personal', color: '#4C8DFF' };

function at(daysFromToday, hour = 0, minute = 0) {
  const d = new Date(now);
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function event({ title, important, start, end, allDay, source }) {
  return {
    title,
    important: !!important,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: !!allDay,
    calendar: source.label,
    color: source.color,
  };
}

const events = [
  event({ title: 'Procurement call — teak supplier', important: true, start: at(2, 10, 30), end: at(2, 11, 30), source: BUSINESS }),
  event({ title: 'Dentist appointment', start: at(2, 10, 0), end: at(2, 11, 0), source: PERSONAL }), // deliberately overlaps the call above
  event({ title: 'Advance payment due — walnut order', important: true, start: at(9, 0, 0), end: at(9, 23, 59), allDay: true, source: BUSINESS }),
  event({ title: 'Factory delivery — Infy 120 batch', start: at(6, 9, 0), end: at(6, 10, 0), source: BUSINESS }),
  event({ title: 'Client design review — Mallet Crafts', start: at(4, 16, 0), end: at(4, 17, 0), source: BUSINESS }),
  event({ title: 'Sprint planning', start: at(1, 18, 0), end: at(1, 19, 0), source: PERSONAL }),
  event({ title: "Amit's certificate exam", important: true, start: at(21, 9, 30), end: at(21, 12, 30), source: PERSONAL }),
  event({ title: "Mom's birthday", important: true, start: at(15, 0, 0), end: at(15, 23, 59), allDay: true, source: PERSONAL }),
  event({ title: 'Doctor appointment — annual check-up', start: at(11, 17, 30), end: at(11, 18, 15), source: PERSONAL }),
  event({ title: 'Important job meeting — Q3 review', important: true, start: at(-3, 15, 0), end: at(-3, 16, 0), source: PERSONAL }),
  event({ title: 'Factory advance — teak, phase 2', important: true, start: at(48, 0, 0), end: at(48, 23, 59), allDay: true, source: BUSINESS }),
  event({ title: 'Standup', start: at(-1, 9, 0), end: at(-1, 9, 15), source: PERSONAL }),
  event({ title: 'Vendor site visit', start: at(-6, 11, 0), end: at(-6, 13, 0), source: BUSINESS }),
];

events.sort((a, b) => new Date(a.start) - new Date(b.start));
const conflicts = findConflicts(events);

const gridStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const gridEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);

const festivals = getFestivals(now.getFullYear());
const gridFestivals = getFestivalsForYears([...new Set([gridStart.getFullYear(), gridEnd.getFullYear()])]);

mkdirSync('dist/data', { recursive: true });
writeFileSync(
  'dist/data/events.json',
  JSON.stringify(
    {
      generatedAt: now.toISOString(),
      gridStart: gridStart.toISOString(),
      gridEnd: gridEnd.toISOString(),
      events,
      conflicts,
      festivals,
      gridFestivals,
      demo: true,
    },
    null,
    2
  )
);

console.log(
  `[gen-demo-data] Wrote ${events.length} demo event(s), ${conflicts.length} conflict(s) and ${festivals.length} India festival(s) for ${now.getFullYear()} to dist/data/events.json`
);
