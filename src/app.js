// No build step, no framework — this runs as-is in a kiosk browser.
// Everything is a plain fetch() of the JSON files scripts/*.mjs generated
// at build time; there is nothing here that talks to Google or iCloud
// directly (see README.md for why: keeping the ICS URLs out of the
// browser is what keeps them out of anyone who can see the screen's URL).

const RELOAD_INTERVAL_MS = 15 * 60 * 1000; // picks up new deploys; also caps how long the browser tab stays open (see README "Kiosk setup notes")
const PHOTO_INTERVAL_MS = 30 * 1000;
const MAX_COUNTDOWN_ITEMS = 8;
const MAX_CONFLICT_ITEMS = 6;
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Fixed hour bands for the day-phase indicator — not a real solar/geo
// calculation, just a simple always-available approximation of "what part
// of the day does this feel like".
const DAY_PHASES = [
  { fromHour: 5, toHour: 11, icon: '☀️', label: 'Morning' },
  { fromHour: 12, toHour: 16, icon: '🌤️', label: 'Afternoon' },
  { fromHour: 17, toHour: 20, icon: '🌇', label: 'Evening' },
  { fromHour: 21, toHour: 4, icon: '🌙', label: 'Night' }, // wraps past midnight
];

init();

async function init() {
  renderClock();
  setInterval(renderClock, 1000);

  const [data, photos] = await Promise.all([loadJSON('data/events.json'), loadJSON('data/photos.json')]);

  const events = (data?.events || []).map((e) => ({ ...e, startDate: new Date(e.start), endDate: new Date(e.end) }));
  const conflicts = data?.conflicts || [];
  const festivals = data?.festivals || []; // current-year list, for the sidebar
  const gridFestivals = data?.gridFestivals || festivals; // may span a year boundary, for the grid's day cells

  renderMonths(events, conflicts, gridFestivals);
  renderCountdown(events);
  renderConflicts(conflicts);
  renderFestivalSidebar(festivals);
  startPhotoRotation(photos?.photos || []);

  setTimeout(() => location.reload(), RELOAD_INTERVAL_MS);
}

async function loadJSON(path) {
  try {
    const res = await fetch(`${path}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('[dashboard] failed to load', path, err);
    return null;
  }
}

// ---- Clock + day phase ------------------------------------------------------

function renderClock() {
  const now = new Date();
  document.getElementById('clock-time').textContent = now.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  document.getElementById('date-line').textContent = now.toLocaleDateString([], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const phase = dayPhaseFor(now.getHours());
  document.getElementById('phase-icon').textContent = phase.icon;
  document.getElementById('phase-label').textContent = phase.label;
}

function dayPhaseFor(hour) {
  for (const phase of DAY_PHASES) {
    if (phase.fromHour <= phase.toHour) {
      if (hour >= phase.fromHour && hour <= phase.toHour) return phase;
    } else if (hour >= phase.fromHour || hour <= phase.toHour) {
      return phase; // wraps midnight (Night: 21:00-04:59)
    }
  }
  return DAY_PHASES[0];
}

// ---- Three-month grid --------------------------------------------------------

function renderMonths(events, conflicts, gridFestivals) {
  const today = new Date();
  const eventsByDay = groupEventsByDay(events);
  const festivalsByDay = groupFestivalsByDay(gridFestivals);
  const conflictDays = new Set();
  for (const c of conflicts) {
    conflictDays.add(dayKey(new Date(c.a.start)));
    conflictDays.add(dayKey(new Date(c.b.start)));
  }

  const cards = [
    { el: document.getElementById('month-prev'), offset: -1, tag: 'Previous', isCurrent: false },
    { el: document.getElementById('month-current'), offset: 0, tag: 'This Month', isCurrent: true },
    { el: document.getElementById('month-next'), offset: 1, tag: 'Next', isCurrent: false },
  ];

  for (const card of cards) {
    const anchor = new Date(today.getFullYear(), today.getMonth() + card.offset, 1);
    renderMonthCard(
      card.el,
      anchor.getFullYear(),
      anchor.getMonth(),
      card.tag,
      card.isCurrent,
      today,
      eventsByDay,
      festivalsByDay,
      conflictDays
    );
  }
}

function renderMonthCard(container, year, month, tag, isCurrent, today, eventsByDay, festivalsByDay, conflictDays) {
  container.innerHTML = '';

  const title = document.createElement('div');
  title.className = 'month-title';
  const monthName = document.createElement('span');
  monthName.textContent = new Date(year, month, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
  const tagEl = document.createElement('span');
  tagEl.className = 'month-tag';
  tagEl.textContent = tag;
  title.append(monthName, tagEl);

  const weekdayRow = document.createElement('div');
  weekdayRow.className = 'weekday-row';
  for (const w of WEEKDAY_LABELS) {
    const span = document.createElement('span');
    span.textContent = w;
    weekdayRow.appendChild(span);
  }

  const grid = document.createElement('div');
  grid.className = 'day-grid';

  const cells = buildMonthMatrix(year, month);
  for (const cell of cells) {
    grid.appendChild(renderDayCell(cell, isCurrent, today, eventsByDay, festivalsByDay, conflictDays));
  }

  container.append(title, weekdayRow, grid);
}

function buildMonthMatrix(year, month) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const cells = [];

  for (let i = 0; i < firstWeekday; i++) {
    cells.push(makeCell(daysInPrevMonth - firstWeekday + 1 + i, false, year, month - 1));
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(makeCell(day, true, year, month));
  }
  let nextDay = 1;
  while (cells.length < 42) {
    cells.push(makeCell(nextDay++, false, year, month + 1));
  }
  return cells;
}

function makeCell(day, inMonth, year, month) {
  const d = new Date(year, month, day); // Date() normalizes month/year rollover for us
  return { day: d.getDate(), inMonth, year: d.getFullYear(), month: d.getMonth() };
}

function renderDayCell(cell, isCurrent, today, eventsByDay, festivalsByDay, conflictDays) {
  const key = dayKeyParts(cell.year, cell.month, cell.day);
  const isToday = cell.inMonth && cell.year === today.getFullYear() && cell.month === today.getMonth() && cell.day === today.getDate();
  const dayInfo = eventsByDay.get(key);
  const festivalName = festivalsByDay.get(key);
  const hasConflict = conflictDays.has(key);

  const el = document.createElement('div');
  el.className = 'day-cell';
  if (!cell.inMonth) el.classList.add('out-of-month');
  if (isToday) el.classList.add('today');
  if (hasConflict) el.classList.add('has-conflict');

  const num = document.createElement('span');
  num.className = 'day-num';
  num.textContent = cell.day;
  el.appendChild(num);

  if (dayInfo) {
    const marks = document.createElement('span');
    marks.className = 'day-marks';
    for (const color of dayInfo.colors) {
      const dot = document.createElement('span');
      dot.className = 'day-dot';
      dot.style.background = color;
      marks.appendChild(dot);
    }
    el.appendChild(marks);

    if (dayInfo.important) {
      const star = document.createElement('span');
      star.className = 'day-star';
      star.textContent = '★';
      el.appendChild(star);
    }

    // The current month's cells are bigger, so they get room to show the
    // actual event title, not just a colored dot. Adjacent months stay
    // dots-only to keep their smaller cells uncluttered.
    if (isCurrent && dayInfo.titles.length > 0) {
      const label = document.createElement('span');
      label.className = 'day-label day-label-event';
      label.title = dayInfo.titles.join(', ');

      const text = document.createElement('span');
      text.className = 'day-label-text';
      text.textContent = dayInfo.titles[0];
      label.appendChild(text);

      if (dayInfo.titles.length > 1) {
        const count = document.createElement('span');
        count.className = 'day-label-count';
        count.textContent = `+${dayInfo.titles.length - 1}`;
        label.appendChild(count);
      }

      el.appendChild(label);
    }
  }

  if (festivalName) {
    const label = document.createElement('span');
    label.className = 'day-label day-label-festival';
    label.textContent = festivalName;
    label.title = festivalName;
    el.appendChild(label);
  }

  if (hasConflict) {
    const flag = document.createElement('span');
    flag.className = 'day-conflict-flag';
    flag.textContent = '!';
    el.appendChild(flag);
  }

  return el;
}

function groupEventsByDay(events) {
  const map = new Map();
  for (const event of events) {
    const key = dayKey(event.startDate);
    let entry = map.get(key);
    if (!entry) {
      entry = { colors: new Set(), important: false, titles: [] };
      map.set(key, entry);
    }
    entry.colors.add(event.color || '#888');
    if (event.important) entry.important = true;
    entry.titles.push(event.title);
  }
  // Sets don't compare well downstream; freeze to arrays once.
  for (const entry of map.values()) entry.colors = [...entry.colors];
  return map;
}

function groupFestivalsByDay(festivals) {
  const map = new Map();
  for (const festival of festivals) {
    map.set(festival.date, festival.name);
  }
  return map;
}

function dayKey(date) {
  return dayKeyParts(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayKeyParts(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ---- Countdown rail (important events, either calendar) --------------------

function renderCountdown(events) {
  const list = document.getElementById('countdown-list');
  const empty = document.getElementById('countdown-empty');
  list.innerHTML = '';

  const today = startOfDay(new Date());
  const upcoming = events
    .filter((e) => e.important && e.startDate >= today)
    .sort((a, b) => a.startDate - b.startDate)
    .slice(0, MAX_COUNTDOWN_ITEMS);

  if (upcoming.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const event of upcoming) {
    const chip = document.createElement('div');
    chip.className = 'countdown-chip';
    chip.style.borderLeftColor = event.color || '#888';

    const days = document.createElement('span');
    days.className = 'cc-days';
    days.textContent = daysRemainingLabel(event.startDate, today);

    const title = document.createElement('span');
    title.className = 'cc-title';
    title.textContent = event.title;
    title.title = `${event.title} — ${event.calendar}`;

    chip.append(days, title);
    list.appendChild(chip);
  }
}

function daysRemainingLabel(eventDate, today) {
  const diffDays = Math.round((startOfDay(eventDate).getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return `In ${diffDays}d`;
}

function startOfDay(date) {
  const d = new Date(date); // clone -- caller may still need the original instant
  d.setHours(0, 0, 0, 0);
  return d;
}

// ---- Conflicts panel ---------------------------------------------------------

function renderConflicts(conflicts) {
  const list = document.getElementById('conflicts-list');
  const empty = document.getElementById('conflicts-empty');
  list.innerHTML = '';

  const today = startOfDay(new Date());
  const upcoming = conflicts.filter((c) => new Date(c.a.end) >= today).slice(0, MAX_CONFLICT_ITEMS);

  if (upcoming.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const c of upcoming) {
    const row = document.createElement('div');
    row.className = 'conflict-row';

    const dateEl = document.createElement('span');
    dateEl.className = 'cr-date';
    dateEl.textContent = new Date(c.a.start).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

    const titleEl = document.createElement('span');
    titleEl.className = 'cr-title';
    titleEl.textContent = `${c.a.title} (${c.a.calendar})  ⚡  ${c.b.title} (${c.b.calendar})`;

    row.append(dateEl, titleEl);
    list.appendChild(row);
  }
}

// ---- Festival sidebar (India festivals, current year) ----------------------

function renderFestivalSidebar(festivals) {
  const list = document.getElementById('festival-list');
  const titleEl = document.getElementById('festival-sidebar-title');
  list.innerHTML = '';

  if (festivals.length === 0) {
    titleEl.textContent = 'India Festivals';
    const empty = document.createElement('p');
    empty.style.opacity = '0.55';
    empty.style.fontSize = '1.3vmin';
    empty.textContent = 'No festival data for this year yet — see scripts/lib/festivals.mjs.';
    list.appendChild(empty);
    return;
  }

  const year = new Date(festivals[0].date).getFullYear();
  titleEl.textContent = `${year} Festivals`;

  const today = startOfDay(new Date());
  let nextMarked = false;

  for (const festival of festivals) {
    const festivalDate = startOfDay(new Date(`${festival.date}T00:00:00`));
    const isPast = festivalDate < today;
    const isNext = !isPast && !nextMarked;
    if (isNext) nextMarked = true;

    const row = document.createElement('div');
    row.className = 'festival-row';
    if (isPast) row.classList.add('is-past');
    if (isNext) row.classList.add('is-next');

    const dateEl = document.createElement('span');
    dateEl.className = 'festival-date';
    dateEl.textContent = festivalDate.toLocaleDateString([], { day: 'numeric', month: 'short' });

    const nameEl = document.createElement('span');
    nameEl.className = 'festival-name';
    nameEl.textContent = festival.name;
    nameEl.title = festival.name;

    row.append(dateEl, nameEl);

    if (isNext) {
      const daysEl = document.createElement('span');
      daysEl.className = 'festival-days';
      daysEl.textContent = daysRemainingLabel(festivalDate, today);
      row.appendChild(daysEl);
    }

    list.appendChild(row);
  }
}

// ---- Photo rotation ---------------------------------------------------------

function startPhotoRotation(photos) {
  const fallback = document.getElementById('bg-fallback');

  if (!photos || photos.length === 0) {
    fallback.classList.add('visible');
    return;
  }

  const order = shuffle([...photos]);
  const imgA = document.getElementById('photo-a');
  const imgB = document.getElementById('photo-b');
  let index = 0;
  let showingA = true;

  imgA.src = order[0];
  imgA.classList.add('visible');

  setInterval(() => {
    index = (index + 1) % order.length;
    const next = showingA ? imgB : imgA;
    const current = showingA ? imgA : imgB;
    next.src = order[index];
    next.classList.add('visible');
    current.classList.remove('visible');
    showingA = !showingA;
  }, PHOTO_INTERVAL_MS);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
