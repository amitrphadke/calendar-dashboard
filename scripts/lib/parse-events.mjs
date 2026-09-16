// Turns node-ical's parsed calendar data into a flat, sorted list of plain
// event objects within [now, windowEnd]. Handles simple recurring events
// (RRULE), single-occurrence exceptions (EXDATE) and overridden occurrences
// (RECURRENCE-ID) — the common cases produced by Google Calendar and iCloud.
//
// Known simplification: exceptions/overrides are matched by calendar DATE
// (YYYY-MM-DD, from the ISO string) rather than the exact original instant.
// This matches how node-ical itself keys `exdate` and `recurrences`, so it's
// correct for the normal case of at most one occurrence per day. It would
// under- or over-match for a calendar with sub-daily recurring events (e.g.
// "every 6 hours") that also has exceptions — not a real-world case for a
// personal/work calendar dashboard, but worth knowing if you extend this.

export function expandEvents(icalData, source, { now, windowEnd }) {
  const out = [];

  for (const key of Object.keys(icalData)) {
    const item = icalData[key];
    if (!item || item.type !== 'VEVENT' || !item.start) continue;

    if (item.rrule) {
      const excludedDates = new Set(Object.keys(item.exdate || {}));
      const occurrences = item.rrule.between(now, windowEnd, true);

      for (const occStart of occurrences) {
        const dateKey = occStart.toISOString().slice(0, 10);
        if (excludedDates.has(dateKey)) continue;

        const override = item.recurrences && item.recurrences[dateKey];
        if (override) {
          out.push(toEvent(override, override.start, source));
        } else {
          out.push(toEvent(item, occStart, source));
        }
      }
    } else {
      const end = item.end || item.start;
      if (end >= now && item.start <= windowEnd) {
        out.push(toEvent(item, item.start, source));
      }
    }
  }

  out.sort((a, b) => new Date(a.start) - new Date(b.start));
  return out;
}

// Importance convention: prefix a title with "!" in the calendar app itself
// (either calendar) to pull it into the days-remaining countdown rail, e.g.
// "!Advance payment due - teak order". The "!" is stripped before display.
// This is a manual, explicit marker by design — auto-detecting "important"
// from keywords would either miss things or flag too much, and a wall
// display should only show what you deliberately put there.
const IMPORTANT_PREFIX = /^\s*!\s*/;

function toEvent(item, occurrenceStart, source) {
  const baseStart = item.start;
  const baseEnd = item.end || item.start;
  const durationMs = Math.max(0, baseEnd.getTime() - baseStart.getTime());
  const end = new Date(occurrenceStart.getTime() + durationMs);

  const rawTitle = item.summary || '(untitled)';
  const important = IMPORTANT_PREFIX.test(rawTitle);
  const title = rawTitle.replace(IMPORTANT_PREFIX, '');

  return {
    title,
    important,
    start: occurrenceStart.toISOString(),
    end: end.toISOString(),
    allDay: !!occurrenceStart.dateOnly || !!item.start.dateOnly,
    calendar: source.label,
    color: source.color,
  };
}
