# Forge

A touch-friendly family time planner for iPhone, iPad, and desktop. Static HTML, CSS, and JavaScript; no build dependencies or server database.

## Run

Requires Node.js 22+. Run `npm run dev`, then open http://127.0.0.1:4180. Run `npm test` for domain checks and `npm run build` for static output in `dist/`.

## Included

- Loading screen and family profile onboarding.
- Daily actual and planned activity tracking, exact duration inputs, 15-minute slider/buttons, editable entries, and daily capacity checks.
- Custom activities with editable suggested categories, weekday/daily/weekly recurring plans.
- Day, week, and calendar-month summaries with category totals and planned/actual comparisons.
- Week-specific minimum/maximum goals and neutral progress flags. Targets are chosen by the family, not represented as medical guidance.
- Local persistence, offline app shell, profile switcher, JSON backup export.
- Dropbox OAuth with PKCE and short-lived session tokens; revision-checked uploads, record-level merging, and deletion tombstones.

## GitHub Pages

Push this folder as a repository with a `main` branch. Under Settings → Pages, choose GitHub Actions. The included workflow tests, builds, and deploys `dist/`. Relative asset URLs support repository paths. GitHub hosts only source and app assets; family records are saved in the browser and the connected Dropbox app folder.

## Dropbox setup

1. Create a scoped **App folder** app at https://www.dropbox.com/developers/apps.
2. Enable `files.content.read` and `files.content.write` permissions, and enable Allow public clients in OAuth settings for PKCE.
3. Register the exact app URL as an OAuth redirect URI, including its trailing slash. For local testing add `http://127.0.0.1:4180/` separately.
4. In Forge → Storage & sync, enter the app key and connect. Never embed an app secret or access token in source.
5. Connect the same parent-owned Dropbox account on each device. App profiles share the family space; they are not access-control boundaries.

Data is stored in `/forge-family-v1.json` within the app folder. Sync runs after edits and every minute while open. Tokens are session-scoped and expire; reconnect when required. Sync does not run while iOS suspends the app. Independent record updates merge; edits to the same record use newest timestamp, with a deterministic tie-break. Correct device clocks matter. Simultaneous uploads use Dropbox revisions and retry conflicts.

## Current limits

Dropbox live authorization and cross-device behavior require the user's app registration and have not been verified with a live account. GitHub publication requires a working GitHub login. No medical recommendation engine, notifications, profile privacy locks, or backup import is included. Recurring plans are generated from their start date; stopping a routine ends it before the selected date and preserves earlier occurrences. Actual logs remain independent. Offline data can be lost if browser site data is cleared; connect Dropbox and export backups. Fonts use Google Fonts when available and system fallbacks offline.

On iPhone/iPad, open the deployed URL in Safari and use Share → Add to Home Screen.
