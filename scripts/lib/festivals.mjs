// India festival dates, by year — a plain lookup table, not a calculation.
//
// Most Indian festivals (Holi, Navratri, Ganesh Chaturthi, Diwali, etc.) are
// pegged to the lunar Hindu calendar, so their Gregorian date shifts every
// year in a way that can't be derived with a simple formula here. Rather
// than get that subtly wrong, this is a manually-maintained table: add a new
// year's entry when you need it (a December build for the next year, say),
// sourced from the Maharashtra government's official holiday list plus
// Drik Panchang-based sources — see README "India festivals" for the
// sources checked for 2026. Where a lunar festival's observed date differs
// by a day between the general Panchang date and the Maharashtra state
// holiday list (this happens — tithi transitions depend on sunrise time and
// region), this table uses the Maharashtra state date, since the dashboard
// is built for a Pune household.
//
// getFestivals(year) returns [] for any year not in the table below —
// the frontend handles that gracefully (empty sidebar list) rather than
// erroring, but you do need to come back and add the next year.

export const FESTIVALS_BY_YEAR = {
  2026: [
    { date: '2026-01-14', name: 'Makar Sankranti' },
    { date: '2026-01-26', name: 'Republic Day' },
    { date: '2026-02-15', name: 'Maha Shivratri' },
    { date: '2026-02-19', name: 'Shivaji Maharaj Jayanti' },
    { date: '2026-03-04', name: 'Holi' },
    { date: '2026-03-20', name: 'Gudi Padwa' },
    { date: '2026-03-26', name: 'Ram Navami' },
    { date: '2026-08-15', name: 'Independence Day' },
    { date: '2026-08-26', name: 'Onam' },
    { date: '2026-08-28', name: 'Raksha Bandhan' },
    { date: '2026-09-04', name: 'Janmashtami' },
    { date: '2026-09-14', name: 'Ganesh Chaturthi' },
    { date: '2026-10-02', name: 'Gandhi Jayanti' },
    { date: '2026-10-11', name: 'Navratri Begins' },
    { date: '2026-10-21', name: 'Dussehra (Dasara)' },
    { date: '2026-11-08', name: 'Diwali' },
    { date: '2026-11-11', name: 'Bhai Dooj' },
    { date: '2026-12-25', name: 'Christmas' },
  ],
};

export function getFestivals(year) {
  return FESTIVALS_BY_YEAR[year] || [];
}

// Merges getFestivals() across several years and dedupes by date — used to
// mark festival text on the 3-month grid, which can span a year boundary
// (e.g. prev=Dec 2026, current=Jan 2027, next=Feb 2027) even though the
// sidebar list itself only ever shows one calendar year at a time.
export function getFestivalsForYears(years) {
  const seen = new Set();
  const out = [];
  for (const year of years) {
    for (const festival of getFestivals(year)) {
      if (seen.has(festival.date)) continue;
      seen.add(festival.date);
      out.push(festival);
    }
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}
