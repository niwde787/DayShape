# DayShape

A touch-friendly family time planner for iPhone, iPad, and desktop, hosted on GitHub Pages.

## Run

Node.js 22+: `npm ci`, then `npm run dev`. Open http://127.0.0.1:4180. `npm run build` produces the static site in `dist/`.

## Features

- Loading screen, profile onboarding, and family profile switcher.
- Planned and actual activity logging, exact time inputs, sliders, custom activities/categories, and recurring plans.
- Daily, weekly, and monthly summaries; weekly minimum/maximum goals with neutral progress flags.
- Light, dark, and device-following themes, saved per device. Gentle dashboard entrances, animated time totals, and goal bars respect Reduce Motion.
- Local mode that preserves existing profiles. JSON export and an offline app shell.
- Firebase parent accounts, email verification, password reset, family invitations, cloud saving, and account-scoped offline edits.
- Explicit, repeatable import of this device's profiles into the signed-in family. No automatic upload of old local data.

## Firebase setup

Read **[FIREBASE_SETUP.md](./FIREBASE_SETUP.md)** or open the app's [setup guide](https://niwde787.github.io/forge/firebase-setup.html).

The owner must provide the public Firebase web config in `firebase-config.js`, enable Email/Password authentication, create the default Standard Firestore database, authorize `niwde787.github.io`, and publish `firestore.rules`. With empty configuration, the app continues in local mode and shows setup instructions. No service-account credentials belong in this repository.

Parent members share all profiles in their family. Children do not need email accounts. The owner creates email-bound invitations and shares the family code manually; DayShape does not send invitation emails. Firebase sends verification and password-reset emails when requested in the app.

## Checks and deployment

- `npm test`: app flow, offline queue, migration, and domain tests. Legacy Dropbox tests are retained for the old unused adapter.
- `npm run test:rules`: Firestore emulator security tests using `demo-dayshape` (requires Java 21). Never connects to production.
- `npm run build`: bundle Firebase and app JavaScript with esbuild.
- GitHub Actions installs dependencies, runs both test suites, builds, and publishes to Pages. Firebase rules are deployed separately to the owner's Firebase project.

Only code and static assets are published to GitHub Pages. Family records live in the browser and, once configured and signed in, Firestore.

## Limits

Cloud activation requires the owner's Firebase project and a live two-device check. Offline edits synchronize while the app is open and connected; iOS can suspend background activity. Last cloud write wins for concurrent edits to the same record; separate records sync independently. Keep one active editing tab per device. Sign out only after pending saves complete. A removed member may retain previously downloaded data. Account-to-family assignment is fixed in this version; family switching and rejoining after removal require administrator assistance.

The previous Dropbox adapter is no longer used by the app. The original `forge-data` local key is retained so the rename and Firebase update do not erase existing device profiles. Clearing browser data can delete unsynced edits; export a backup first.

Targets are family choices, not medical guidance. No notifications or child-only access restrictions are included.

## Time balance and trends

Each dashboard shows recorded time, time not yet recorded, and available planning hours for the selected day, week, or month. Actual and planned time are separate budgets; they are never added together. Remaining recorded time is unknown time, not a promise of free time. Activities should represent nonoverlapping uses of time.

Open **Targets & screens** in Weekly balance & trends to set a profile's weekly category budget (up to 168 hours), an optional screen cap, and the activity tags included in screen totals. Zero screen hours is a valid limit; blank disables the cap. Tags apply to historical entries and sync with activities; budgets sync with profiles. Setting targets does not create planned entries. Use My plan for dated tasks and recurring routines, and My goals for individual activity limits.

The weekly insight panel follows the week containing the selected date, including on the month view. It shows four weeks of recorded totals and screen time, with logged-day coverage. It flags exceeded screen/activity limits and increases of more than 50% and at least 60 minutes over the average of matching weekdays in two or more of the prior four weeks. Each compared weekday must have an entry in both periods. Blank days are unknown, future actual entries are excluded, and plans never affect trends. Even logged days may be incomplete; these comparisons describe records, not diagnoses. New profiles show a history-building message until there is enough comparable data.

The uploaded weekday example is described as an illustration, not multiplied into a prescribed weekly schedule. [CDC sleep guidance](https://www.cdc.gov/sleep/about/) gives 9–12 hours for ages 6–12 and 8–10 for ages 13–17. The app links to the [AAP family media plan](https://www.healthychildren.org/English/family-life/Media/Pages/How-to-Make-a-Family-Media-Use-Plan.aspx) so families can choose screen habits together.
