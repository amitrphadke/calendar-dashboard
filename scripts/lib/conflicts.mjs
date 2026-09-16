// Flags overlapping-time events that come from DIFFERENT calendars — the
// case that actually matters for a two-hat business/personal schedule
// ("did I double-book a client call over the school pickup?").
//
// Scoped deliberately narrow: only timed (non-all-day) events are compared.
// An all-day event sharing a date with a timed event isn't usually a real
// conflict (a "Diwali prep" all-day marker doesn't block a 3pm call), and
// including it would just add noise. Two overlapping events on the SAME
// calendar aren't flagged either — that's you double-booking yourself
// within one calendar, a different (and probably intentional, e.g. a
// blocked-out travel window) situation than a cross-calendar clash.

export function findConflicts(events) {
  const timed = events.filter((e) => !e.allDay);
  const conflicts = [];

  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i];
      const b = timed[j];
      if (a.calendar === b.calendar) continue;
      if (!overlaps(a, b)) continue;

      conflicts.push({
        a: { title: a.title, calendar: a.calendar, color: a.color, start: a.start, end: a.end },
        b: { title: b.title, calendar: b.calendar, color: b.color, start: b.start, end: b.end },
      });
    }
  }

  conflicts.sort((x, y) => new Date(x.a.start) - new Date(y.a.start));
  return conflicts;
}

function overlaps(a, b) {
  return new Date(a.start) < new Date(b.end) && new Date(b.start) < new Date(a.end);
}
