#!/usr/bin/env node
// Offline sanity test for scripts/lib/parse-events.mjs and
// scripts/lib/conflicts.mjs — no network involved. Run with: npm test
//
// Uses a fixed "now" (rather than the real current time) so this test's
// result never depends on when you happen to run it. fixtures/sample.ics
// covers: a plain event, a weekly recurring event with one excluded
// occurrence and one moved (RECURRENCE-ID) occurrence, an all-day event,
// and a past event that must NOT appear. fixtures/business.ics adds a
// second calendar with one event that deliberately overlaps "Dentist" (to
// test conflict detection) and is "!"-prefixed (to test the importance flag).

import ical from 'node-ical';
import { readFileSync } from 'fs';
import assert from 'node:assert/strict';
import { expandEvents } from './lib/parse-events.mjs';
import { findConflicts } from './lib/conflicts.mjs';

const now = new Date('2026-01-01T00:00:00Z');
const windowEnd = new Date('2026-01-15T00:00:00Z');

const personalText = readFileSync(new URL('../fixtures/sample.ics', import.meta.url), 'utf8');
const personalData = ical.sync.parseICS(personalText);
const personalSource = { label: 'Personal', color: '#4C8DFF' };
const personalEvents = expandEvents(personalData, personalSource, { now, windowEnd });

const titles = personalEvents.map((e) => e.title).sort();
console.log('Personal events:', JSON.stringify(personalEvents, null, 2));

assert.deepEqual(
  titles,
  ['Dentist', 'Republic Day Prep', 'Standup (moved to 3pm)'],
  `Expected exactly these 3 events, got: ${JSON.stringify(titles)}`
);

const standup = personalEvents.find((e) => e.title === 'Standup (moved to 3pm)');
assert.equal(standup.start, '2026-01-12T15:00:00.000Z', 'Moved occurrence should use the override time (15:00), not the original 09:00');

const allDay = personalEvents.find((e) => e.title === 'Republic Day Prep');
assert.equal(allDay.allDay, true, 'All-day event should be flagged allDay');

const excludedStillPresent = personalEvents.some((e) => e.title === 'Standup' && e.start.startsWith('2026-01-05'));
assert.equal(excludedStillPresent, false, 'EXDATE occurrence must be excluded');

const pastEvent = personalEvents.some((e) => e.title === 'Old Meeting');
assert.equal(pastEvent, false, 'Past event must be filtered out');

console.log('\n✔ All parse-events assertions passed.');

// ---- Importance flag + conflict detection --------------------------------

const businessText = readFileSync(new URL('../fixtures/business.ics', import.meta.url), 'utf8');
const businessData = ical.sync.parseICS(businessText);
const businessSource = { label: 'Business', color: '#F2A93B' };
const businessEvents = expandEvents(businessData, businessSource, { now, windowEnd });

const procurementCall = businessEvents.find((e) => e.title === 'Procurement call - teak supplier');
assert.ok(procurementCall, 'Business fixture event should parse');
assert.equal(procurementCall.important, true, 'Leading "!" should set important=true and be stripped from the title');

const dentist = personalEvents.find((e) => e.title === 'Dentist');
assert.equal(dentist.important, false, 'Titles without "!" should not be flagged important');

const conflicts = findConflicts([...personalEvents, ...businessEvents]);
assert.equal(conflicts.length, 1, `Expected exactly 1 cross-calendar conflict, got ${conflicts.length}`);
assert.equal(
  new Set([conflicts[0].a.title, conflicts[0].b.title]).has('Dentist') &&
    new Set([conflicts[0].a.title, conflicts[0].b.title]).has('Procurement call - teak supplier'),
  true,
  'The one conflict should be Dentist (10:00-11:00) vs the overlapping Procurement call (10:30-11:30)'
);

const nonOverlapping = businessEvents.find((e) => e.title === 'Delivery - Infy 120 batch 1');
const involvesDelivery = conflicts.some((c) => c.a.title === nonOverlapping.title || c.b.title === nonOverlapping.title);
assert.equal(involvesDelivery, false, 'A non-overlapping event must not be reported as a conflict');

console.log('✔ All importance-flag and conflict-detection assertions passed.');
