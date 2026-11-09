# Connect DayShape to Firebase

The app code supports Firebase, but cloud sign-in stays disabled until the owner provides the public web configuration in `firebase-config.js` and deploys the rules to their project.

## Owner checklist

1. In [Firebase Console](https://console.firebase.google.com/), open your project → Project settings → General → Your apps → Web (`</>`). Register **DayShape** and copy `firebaseConfig`. No Analytics or Firebase Hosting is required.
2. Send the public config object to the coding agent, or fill `firebase-config.js`. Required: `apiKey`, `authDomain`, `projectId`, `appId`. Never share service-account JSON, a private key, or an account password.
3. Build → Authentication → Sign-in method: enable **Email/Password**. In Settings → Authorized domains, add **niwde787.github.io**. Email-link sign-in is not used. Add `localhost` and `127.0.0.1` only for local development.
4. Build → Firestore Database: create the **default**, **Standard edition** database in **Production mode**, in a region suitable for your family.
5. Firestore → Rules: paste the entire [firestore.rules](./firestore.rules) file and Publish. Do not enable open/Test-mode access. Alternatively use `npx firebase login`, then `npx firebase deploy --only firestore:rules --project YOUR_PROJECT_ID` from this folder.
6. Rebuild and publish DayShape. The configured site is served by GitHub Pages; Firebase hosts the account and database services.

The same checklist is available inside the app at [firebase-setup.html](./firebase-setup.html).

## First family login

- Create your parent account in DayShape, verify the email, and press **I’ve verified my email**.
- Create one family space. Sign into the same account on another device to reopen it.
- On the original device, Account & sync → **Import this device’s profiles**. This is explicit because it shares all those profiles with the family. Existing cloud IDs win; repeated imports do not duplicate records. Original guest/local data remains unchanged.
- To add your spouse: the owner enters their email in **Add another parent**, then copies and shares the family code manually. No invitation email is sent. They create/verify their own account and join using the code. Invitations are bound to the verified email and expire in 7 days.
- Children use a profile in the parent-managed family space. No child email account is necessary. All parent members can read and edit all family profiles.

## Verification before relying on cloud saving

1. Verify sign-in and password reset emails arrive.
2. Create an activity on one device and wait for **Saved to cloud**; confirm it appears on another device.
3. Make an edit offline, reconnect with the app open, and confirm delivery.
4. Invite the second parent, join, and confirm access. An unrelated account must not be able to join without its own active invitation.
5. Export a backup before clearing browser data or moving browsers.

## Engineering notes

- Uses email/password Authentication, Firestore listeners, and per-record writes. SDK bundled with esbuild; no runtime SDK CDN dependency.
- Firestore memory cache plus a durable `CloudStore` local outbox scoped by Firebase project, user UID, and family. Offline edits are overlaid on remote snapshots until acknowledged. New edits cannot be accidentally acknowledged by an earlier save.
- Independent records merge. Concurrent edits to the same record use last successful cloud write, not device clocks. Deleted entries use tombstones.
- Family ID is the creator's UID. User-to-family assignment is immutable in this first version. Invitations require verified matching emails and atomic membership creation plus invitation consumption. Owner can revoke invites and remove other parents. Reassigning a removed account to a family requires an administrator; no family switching UI yet.
- Local cache is for trusted devices and is not encryption. Sign-out blocks while an outbox is pending and clears the current user's family cache afterward. Cloud is not exposed on the signed-out screen. A removed member can still retain previously downloaded/offline data; revocation stops subsequent server access.
- Guest profiles remain in the original `forge-data` browser key for backward compatibility. No automatic upload or automatic Dropbox import. If old data only exists in Dropbox, first recover it to the original app/device before migration; this update does not read Dropbox.
- Keep one active editing tab per device. Devices can edit concurrently, but two tabs share that device's local outbox.
- No Cloud Functions, paid extensions, Analytics, or Firebase Hosting deployment is needed. Start with Spark and monitor quotas. Production readiness still requires the owner's project configuration, rules deployment, and a live two-device check.

## Commands

```text
npm ci
npm test
npm run test:rules
npm run build
npm run dev
```

Rules tests use a local Firestore emulator (`demo-dayshape`) and require Java 21. CI installs Java and runs these tests before publishing. They never connect to a production project.
