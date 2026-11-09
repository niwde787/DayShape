# DayShape

A touch-friendly family time planner for iPhone, iPad, and desktop, hosted on GitHub Pages.

## Run

Node.js 22+: `npm ci`, then `npm run dev`. Open http://127.0.0.1:4180. `npm run build` produces the static site in `dist/`.

## Features

- Loading screen, profile onboarding, and family profile switcher.
- Planned and actual activity logging, exact time inputs, sliders, custom activities/categories, and recurring plans.
- Daily, weekly, and monthly summaries; weekly minimum/maximum goals with neutral progress flags.
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

Targets are family choices, not medical guidance. No recommendation engine, notifications, or child-only access restrictions are included.
