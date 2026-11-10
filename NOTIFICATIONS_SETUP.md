# DayShape reminders

The app supports opt-in device push and optional SMS for parent and child recipients. Configure it from **Switch profile → Reminders**. A verified parent account with active family membership is required. A parent sets up a child's device with them; this feature does not add a separate child login or restrict what that device can access in the existing shared family account.

## Delivery behavior

- Wednesday, at the recipient's selected local hour: this week's recorded progress.
- Monday, at that hour: a recap of the completed previous week.
- Screen/activity limits: at most one combined limit alert per week per destination and profile. Alerts use the profile's screen limit and maximum weekly activity goals; they do not diagnose abnormal behavior.
- Checks run every 15 minutes. No sends are scheduled from 9pm to 8am in the recipient's IANA time zone. Connectivity, platform settings, and Focus can delay delivery. This is not an alarm service.
- Blank days are unknown. Plans, deleted records, and future actual entries are excluded. A week with no entries produces no summary.
- Recipient settings are managed by the parent account that added them. Each parent can independently subscribe to the same child's profile. Each child's device must grant its own push permission.
- Push recipients on a device are detached before sign-out. Sign-out with an active push token requires a connection. Removing a family member or deleting a profile prevents future scheduled notifications. Previously delivered notifications are outside the app's control.

## Firebase deployment

Firebase Blaze is required and has been confirmed by the owner. `notification-config.js` contains the public VAPID key provided by the owner; it is not a secret. The existing Firebase web configuration and Firestore rules remain valid. Notification recipient records, verification proofs, rate limits, and delivery logs are server-only; no browser read/write rules are added for them.

From the local project folder:

```powershell
npx firebase login --reauth
npm ci --prefix functions
```

For push-only deployment before Twilio is connected, create a local JSON file containing `{}` outside tracked source, then store it as the backend secret:

```powershell
npx firebase functions:secrets:set DAYSHAPE_SMS_CONFIG --project dayshape-630e7 --data-file .tools/sms-disabled.json
npx firebase deploy --only functions:notifications --project dayshape-630e7
```

The functions use Node 22 in `us-central1`. The deployed callable functions are `notificationSettings`, `verifyNotificationPhone`, and `detachNotificationDevice`; the scheduled function is `deliverDayShapeReminders`. Do not place secret values in source, GitHub Pages, browser storage, or chat. GitHub Actions publishes the frontend; it does not automatically deploy Firebase functions.

For iPhone/iPad push: open **https://niwde787.github.io/DayShape/**, add to Home Screen, launch that icon, sign in, then enable push from Reminders. iOS/iPadOS 16.4 or later is needed. The recipient must explicitly grant permission. A web page open in a normal iPhone browser tab is insufficient.

## Connect Twilio later

1. Create a Twilio account, a Verify service for number verification, and a Messaging Service with a capable sender. Finish Twilio's applicable sender registration and consent requirements for the destination countries. Configure Geo Permissions and spending controls for the intended countries.
2. Configure the Messaging Service's STOP/HELP handling. Twilio enforces STOP; provider error 21610 also disables SMS in DayShape at the next attempted send. Users can stop a recipient from the app at any time.
3. Locally prepare the following JSON with the real credentials. Store it directly in Secret Manager using `functions:secrets:set`; never commit this file or paste its contents into chat.

```json
{
  "accountSid": "YOUR_TWILIO_ACCOUNT_SID",
  "authToken": "YOUR_TWILIO_AUTH_TOKEN",
  "verifyServiceSid": "YOUR_VERIFY_SERVICE_SID",
  "messagingServiceSid": "YOUR_MESSAGING_SERVICE_SID"
}
```

4. Redeploy the functions after updating the secret. SMS controls appear only when all four settings exist. Configure and test provider readiness before enabling real recipients; presence of configuration is not a delivery guarantee.
5. Each SMS recipient must agree to verification and recurring updates, with guardian approval for a child, then enter a received verification code. A changed number requires new verification. Verification proof expires after 30 days for adding recipients; this does not automatically cancel existing reminders. SMS is optional and separate from account sign-up. Normal message/data and provider charges apply.

## Reliability and privacy

The scheduler rechecks active membership, account verification/disabled status, and profile existence. Phone numbers and FCM tokens are stored in server-only Firestore collections. The UI returns only the last four phone digits and never returns push tokens. Summary text includes the profile name and recorded totals, so consent warns that this may appear on lock screens or in SMS. Do not include highly sensitive notes in activity names.

Delivery claims are recorded transactionally before provider submission, deduplicated by destination/profile/week/type/channel. Retries or concurrent scheduler runs cannot create a second send for the same claim. This favors avoiding duplicates: a timeout or crash after a claim can mean a missed notification. Failures are stored with a provider code, without message bodies or phone numbers in logs. There is no automatic retry of ambiguous sends. Operational review can inspect `notificationDeliveries` in the Firebase console.

Verification is limited to 5 sends per parent per UTC day, 5 per phone, 30 per project, and 15 checks per parent. The UI supports up to 20 recipients per parent account. The scheduler is designed for a small family deployment; revisit indexing, pagination, retention, and batching before broader use.

## Validation before calling notifications live

Run `npm test`, `npm run test:rules`, and `npm run build`. Test an opted-in physical iPhone/iPad, foreground and background delivery, sign-out detachment, removal of a family member, quiet hours, and one scheduled summary. Test SMS number verification, STOP, and delivery with a consenting recipient once Twilio is ready. No test SMS or push is sent merely by deploying the code.

Sources: [Apple Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Firebase web messaging](https://firebase.google.com/docs/cloud-messaging/web/get-started), [Firebase schedules](https://firebase.google.com/docs/functions/schedule-functions), [Twilio verification consent](https://www.twilio.com/docs/verify/consent-opt-in).
