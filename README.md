# Calendar Dashboard

A self-hosted, always-on wall display built for a large screen (designed
for 2560×1440): a three-month calendar spanning your **Business** and
**Personal** Google Calendars side by side, a days-remaining countdown for
events you've flagged important, automatic cross-calendar conflict
detection, a clock with a morning/afternoon/evening/night phase indicator,
and a rotating photo background behind it all. It's a static site — no
server to run, no framework, no accounts to sign into on the display
device itself. Runs in any kiosk browser: Chromium on a Raspberry Pi,
Fully Kiosk Browser on a Fire TV Stick or Android TV, even a laptop
browser if you just want to look at it.

```
┌───────────┬───────────────────────┬─────────────┬──────────────┐
│  12:10 PM │  DAYS REMAINING       │  CONFLICTS  │ 2026 FESTIVALS│
│ AFTERNOON │  [In 2d ...] [In 9d.] │  Fri, Sep 18│  Jan 14  ...  │
├───────────┴──────┬────────────────┴─┬───────────┤  ...  (dimmed│
│   August 2026     │  September 2026   │ October   │  once past, │
│ (previous, dimmer,│ (current — bigger,│  2026     │  next one   │
│  dots only)       │  event text on    │ (next)    │  glows,     │
│                    │  each date)       │           │  days-to-go)│
│  Su Mo Tu We ...   │   Su Mo Tu We ...  │  Su Mo... │             │
└──────────────────────────────────────────────────────┴──────────┘
      ● Business   ● Personal   ★ Important   ! Conflict  ● Festival
```

Run `npm run demo` (see Quick start) to preview this exact layout filled
with sample data before wiring up your real calendars.

## How it works

A GitHub Actions workflow runs on a schedule, fetches both calendars'
ICS feeds, expands recurring events, flags anything you've marked
important, finds overlaps between the two calendars, and writes the
result as a plain JSON file (`dist/data/events.json`) alongside the
static HTML/CSS/JS. The whole `dist/` folder gets published to GitHub
Pages. The kiosk browser just loads that page and reloads it
periodically — it never talks to Google directly, and never holds your
calendar's secret URL. That matters: see "Security" below.

## Your two calendars

The dashboard is built around exactly two calendar sources, matching how
you actually use them:

- **Business** (`ICS_URL_BUSINESS`) — the Mallet Crafts Google Calendar:
  client meetings, and factory dates like advance payments, procurement,
  and deliveries. Rendered in amber (`#F2A93B`).
- **Personal** (`ICS_URL_PERSONAL`) — your `amitrameshphadke@gmail.com`
  calendar: birthdays, exam dates, doctor appointments, and important job
  meetings you manually add. Rendered in blue (`#4C8DFF`).

An optional third slot (`ICS_URL_ICLOUD`, labeled "Family", green) is
still wired up if you ever want it — see `scripts/fetch-calendars.mjs` to
add more.

### Marking an event "important"

Prefix a title with `!` in the calendar app itself — e.g.
`!Advance payment due - teak order`. The dashboard strips the `!` before
display, adds a ★ on that day in the grid, and pulls it into the
**Days Remaining** rail sorted soonest-first. This is deliberately manual:
auto-detecting "important" from keywords would either miss things or flag
too much, and a wall display should only show what you put there on
purpose.

### Conflict detection

Any two **timed** (non-all-day) events that overlap and come from
**different** calendars — e.g. a client call double-booked over a school
pickup — are flagged: the day gets a red outline and `!` marker in the
grid, and the pair appears in the **Conflicts** panel. Two overlapping
events on the *same* calendar aren't flagged (that's an intentional
overlap, like a blocked travel window); neither is an all-day event
sharing a date with a timed one (an all-day marker doesn't really "block"
a 3pm call). See `scripts/lib/conflicts.mjs`.

### India festivals

A dedicated right-hand sidebar lists major India/Maharashtra festivals for
the current calendar year (Makar Sankranti, Holi, Ganesh Chaturthi,
Navratri, Dussehra/Dasara, Diwali, and more) — chronological, past ones
dimmed, the next upcoming one highlighted with its own days-remaining
count. The same list also marks the festival's name directly on its date
in all three months of the grid.

This is a separate, manually-maintained data source from your two
calendars — `scripts/lib/festivals.mjs` — because most of these dates are
pegged to the lunar Hindu calendar and shift every year in a way that
can't be computed with a formula. **2026's dates are filled in already**
(cross-checked against the Maharashtra government's official 2026 holiday
list and Drik Panchang-based sources). For 2027 onward, add a new entry to
`FESTIVALS_BY_YEAR` in that file before the year turns over — the sidebar
and grid both just render whatever's there and show an empty list
gracefully if a year is missing, rather than erroring.

### Structured app

You mentioned liking [Structured](https://structured.app)'s UI and that
it has an MCP server. Its help docs confirm Structured only *imports*
calendars — there's no ICS/webcal export or public API to read tasks back
out — so it can't feed this dashboard's build step. It was useful as
layout inspiration; your two Google Calendars remain the actual data
source.

## Repo structure

```
src/                 the actual page — index.html, styles.css, app.js
scripts/
  fetch-calendars.mjs     fetches + expands ICS feeds, finds conflicts -> dist/data/events.json
  gen-demo-data.mjs       writes sample events/conflicts anchored to today, for `npm run demo`
  gen-photos-manifest.mjs lists public/photos/* -> dist/data/photos.json
  build.mjs               orchestrates fetch-calendars + gen-photos-manifest + copies src/ and photos
  lib/parse-events.mjs    ICS-expansion + "!"-important-flag logic (unit tested)
  lib/conflicts.mjs       cross-calendar overlap detection (unit tested)
  lib/festivals.mjs       India festival dates by year — manually maintained, add next year here
  serve.mjs               tiny static server for local preview
  test-parse.mjs          offline test against fixtures/sample.ics + fixtures/business.ics
  preview-screenshot.mjs  optional: screenshot the built page at a given resolution
public/photos/       drop your photos here (gitignored contents; see its own README)
fixtures/             fixed-date fixture calendars used by the test — not your data
.github/workflows/deploy.yml   the scheduled build + GitHub Pages deploy
```

## Quick start (local)

```bash
npm install
npm test              # offline parser + conflict test — no network, no secrets needed
npm run demo          # preview the full layout with sample data, no calendars needed
npm run serve         # open http://localhost:8080
```

Once you're happy with the look, wire up your real calendars:

```bash
cp .env.example .env  # fill in your real ICS URLs (see below)
npm run build
npm run serve
```

Without a `.env`, `npm run build` still works — you'll just get an empty
grid and (unless you've put photos in `public/photos/`) a plain gradient
background. `npm run demo` overwrites `dist/data/events.json` with sample
data afterward, so you can see the real layout either way.

## Calendar sources

**Google Calendar:** open the calendar's settings → "Integrate calendar" →
copy the **Secret address in iCal format**. One URL per calendar. This URL
*is* your access to that calendar — treat it like a password (see
Security).

**iCloud:** Calendar app → right-click the calendar → Share Calendar →
Public Calendar → copy the link, then change `webcal://` to `https://`.

Put these in `.env` locally (see `.env.example`), and as **repository
secrets** for the deployed version — Settings → Secrets and variables →
Actions → New repository secret. Use the exact names from
`.github/workflows/deploy.yml`: `ICS_URL_BUSINESS`, `ICS_URL_PERSONAL`,
`ICS_URL_ICLOUD`. Add a fourth by copying the pattern in both
`scripts/fetch-calendars.mjs` and the workflow file.

## Photos

There's deliberately no live Google Photos or iCloud Photos integration.
Google shut down the old broad-access Photos Library API in March 2025;
the replacement Picker API is interactive-only (a person has to pick
photos in a UI each time), which doesn't fit an unattended slideshow that
should just keep following an album.

Instead: `public/photos/` is a plain folder. Whatever's in it rotates.
Get photos into it however suits you — the common pattern is a scheduled
`rclone sync` (from a Google Photos album export, a Nextcloud share, etc.)
that keeps this folder current, running wherever you deploy from. That's
outside this repo's scope on purpose, since it depends entirely on where
your photos actually live.

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. Settings → Pages → Source → **GitHub Actions**.
3. Settings → Secrets and variables → Actions → add `ICS_URL_BUSINESS` /
   `_PERSONAL` / `_ICLOUD` (whichever you use) as **secrets**.
4. Optionally add `IMPORTANT_WINDOW_DAYS` as a repository **variable**
   (not secret) to change how far out it looks for "!"-important events
   for the Days Remaining rail — defaults to 180. The 3-month grid itself
   always fetches full data regardless of this setting.
5. Push to `main`, or run the workflow manually (Actions tab → "Build and
   deploy dashboard" → Run workflow). It'll also run on its own every ~15
   minutes after that.

Your dashboard's URL will be `https://<username>.github.io/<repo>/`.

## Security

An ICS "secret address" is a bearer token, not a real secret exchange —
anyone who has the URL can read that calendar, no login required. Two
things follow from that:

- **Keep this repository private** if you use your real work calendar.
  A public repo's Actions logs and workflow file are visible to everyone;
  your secrets themselves stay hidden, but don't take chances.
- The reason the fetch happens in GitHub Actions rather than in the
  browser is exactly this: the ICS URLs live only in repository secrets
  and the Actions runner's environment. The published site's HTML/JS
  contains nothing but the already-expanded event titles and times —
  never look for `ICS_URL_*` in the browser's network tab, because it
  isn't there.

## Kiosk setup notes

**Raspberry Pi (Chromium):**
- `raspi-config` → Display Options → Screen Blanking → **Disable**.
- Launch with: `chromium-browser --kiosk --incognito --noerrdialogs --disable-infobars https://<your-pages-url>`
- Add a daily cron job to reboot (e.g. 4am) — long-running kiosk Chromium
  sessions slowly leak memory over weeks. The page's own 15-minute
  `location.reload()` (see `src/app.js`) helps but doesn't replace a
  periodic full restart.

**Xiaomi Mi TV (Android TV 9 Pie) / any Android TV / Fire TV Stick, via
Fully Kiosk Browser:** this is the device Amit is actually using.
- Install **Fully Kiosk Browser & App Lockdown** from the Play Store
  (search it from the TV's own Play Store app). If this specific Mi TV
  build doesn't surface it in search, sideload the APK instead: install
  a file-manager/browser app that can fetch a URL (e.g. "Downloader" from
  the Play Store), download the APK from fully-kiosk.com, and allow
  "install unknown apps" for that app when prompted.
- The app's UI is designed for a touchscreen, not a remote — you can still
  navigate its settings menu with the D-pad + OK/select button on first
  setup, it's just a bit more fiddly than on a tablet.
- Settings → **Web Content Settings** → Start URL → your GitHub Pages URL.
- Settings → **Device Management** → enable **Keep Screen On** and turn
  off any screensaver/motion-detection sleep option.
- Settings → **Other Settings** → enable **Start on Boot**; accept the
  Android permission dialog that appears the first time (Android TV 9
  will ask you to confirm the app can run at startup).
- Fully Kiosk has its own auto-reload timer (Settings → Web Content
  Settings → Reload Page) if you'd rather rely on that instead of the
  page's built-in 15-minute one.
- The dashboard's CSS is resolution-independent (`vw`/`vh`, not fixed
  pixels — see `src/styles.css`), so it renders correctly at whatever
  resolution this Mi TV's panel actually is; no per-device tuning needed.

## Known limitations (read before relying on this)

- **Recurrence handling is simplified.** `scripts/lib/parse-events.mjs`
  matches exceptions (`EXDATE`) and overrides (`RECURRENCE-ID`) by
  calendar date, not exact instant — correct for the normal case of at
  most one occurrence per day, which covers ordinary personal/work
  calendars. It would mis-handle a calendar with multiple daily
  occurrences of the same recurring event that also has exceptions.
  `npm test` covers the cases it does handle; read the comment at the top
  of that file before trusting it with something unusual.
- **A failed calendar fetch blocks the whole deploy**, on purpose (see
  the comment in `scripts/fetch-calendars.mjs`) — the previous good
  version of the site just keeps serving instead of an incomplete one
  replacing it. You won't get a "half updated" dashboard, but you also
  won't get a same-minute update if one source is briefly down.
- **GitHub's schedule isn't exact.** Treat 15 minutes as "roughly," not a
  guarantee — GitHub documents that scheduled workflows can be delayed
  under load.
- **No timezone handling beyond what the ICS files themselves specify.**
  This has only been tested with UTC and simple all-day events (see
  `fixtures/sample.ics`). If your calendars use floating local times or
  unusual `VTIMEZONE` blocks, check `dist/data/events.json` after a build
  before trusting the displayed times.
- **Days Remaining shows soonest-first and clips the rest.** The rail is
  sorted by days-until-event and simply hides whatever doesn't fit the
  available width, so the most urgent items are always the ones you see —
  at 1920×1080 (Fire TV Stick) that's fewer chips than at native 2560×1440.
- **A multi-day event only marks its start day** in the grid (dot/star on
  the first day only, not every day it spans) — fine for the
  meetings/appointments/deadlines this is built around, not meant for
  multi-day trips or vacations.
- **Conflict detection is intentionally narrow** — see "Conflict detection"
  above for exactly what does and doesn't count.
- **India festival dates need a manual yearly update.** See "India
  festivals" above — `scripts/lib/festivals.mjs` only has 2026 filled in;
  the sidebar and grid both degrade gracefully (empty list, no crash) for
  a year with no entry, but you do need to add one before relying on it
  for 2027.
- **Only the current month's day cells show event text.** Previous/next
  month cells stay dots-only (they're smaller) — festival names are the
  exception and get a (truncated) text label in all three months.
