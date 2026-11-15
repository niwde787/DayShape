# Monday email reports on Spark

The app can save each verified parent's explicit opt-in under **Account → Weekly email report**. Reports cover all live family profiles for the previous Monday–Sunday, using the dashboard's weekly calculations. They include activity totals, category distribution, screen time, goals, flags and logging coverage. A blank week is reported as unlogged, not zero usage. Each account receives only its own report at its current verified Firebase Auth email. If that email changes, the user must save consent again.

**Delivery is not active until Google Apps Script is installed and authorized.** Saving a preference is not proof of a working sender. Firebase stays on Spark. No Firebase Functions, Cloud Scheduler, Secret Manager, Resend account, purchased domain, or Twilio account is needed for this route.

## One-time owner setup

1. Sign in to [Google Apps Script](https://script.google.com/) with the Google account that owns the DayShape Firebase project and create a private standalone project named `DayShape weekly reports`.
2. Copy `email-script/Code.gs` into Code.gs. Add a script file named `Report` and copy `email-script/Report.gs` into it. Report.gs is generated from the same report logic used in tests; rebuild it with `node email-script/build.mjs` after any report changes.
3. In Project Settings, show `appsscript.json` in the editor and replace its contents with `email-script/appsscript.json`. Keep the time zone America/New_York.
4. The script's OAuth identity must have access to the Firestore and Firebase Authentication APIs. If the default Apps Script Cloud project produces an API-disabled or OAuth configuration error, associate the script with the existing standard Google Cloud project `dayshape-630e7` (project number `176499764119`) in Project Settings. Configure its OAuth consent screen for your own account if needed. Do not enable billing or create an API key. Google OAuth apps left in external **Testing** mode can have grants expire after seven days; use a suitable publishing status for ongoing personal use and review Google's personal-use verification guidance. Do not share the script with other editors or deploy it as a public web app.
5. Run `checkDayShapeConnection` and complete Google's permission screen. It uses the project owner's Google authorization to read Firebase, send email as that owner, and manage its own trigger. It does not read your Gmail inbox. No private key or password belongs in the code. This connection check sends no email.
6. In DayShape, sign in with your verified parent account and turn on **Account → Weekly email report**. Each parent can opt in separately.
7. Review `email-script/sample-report.html` (fictional data), then run `installMondayReports`. This schedules Monday delivery roughly between 9–10am Eastern and publishes the service's configured status. Setup does not send a test email. A real opted-in Monday run is still needed to verify delivery.

Deploy updated Firestore rules before using preferences: `npx firebase deploy --only firestore:rules --project dayshape-630e7`.

## Behavior and maintenance

- Messages come from the Google account that installs the trigger, displayed as DayShape. Recipients can use any email provider. They do not need to install DayShape for email delivery.
- The trigger runs on Google's servers while the phone and app are closed. Apps Script chooses a time within the 9am hour; delivery is not guaranteed at an exact minute. DST follows America/New_York. Running sendMondayReports outside Monday 9am–9pm Eastern sends nothing.
- This is a small-family deployment. Apps Script consumer accounts currently allow 100 email recipients/day and scripts have execution limits. Firestore reads/writes still count against Spark quotas. Errors can cause missed reports; check Apps Script Executions and Google's trigger-failure emails.
- The sender rechecks email verification, disabled accounts, active family membership, family linkage and opt-in before sending. Preferences are private to their account. Send logs are server-only; logs do not contain email addresses or report bodies.
- Each user/week is claimed in Firestore before email submission. This prevents duplicate sends across reruns, but a crash or ambiguous failure can result in a missed email. Do not delete delivery claims to retry unless you have checked whether the email already arrived.
- Turning the preference off stops future sends. `stopMondayReports` disables the entire service and removes this script's Monday triggers. Already sent emails cannot be recalled.
- Profile activity names and totals are included in emails; recipients may see previews on their lock screens. No diagnosis or health claim is added.
- The previous push/SMS backend remains undeployed and is separate from this email feature.

Sources: [MailApp](https://developers.google.com/apps-script/reference/mail/mail-app), [installable triggers](https://developers.google.com/apps-script/guides/triggers/installable), [quotas](https://developers.google.com/apps-script/guides/services/quotas), [Firestore REST authorization](https://firebase.google.com/docs/firestore/use-rest-api), [Auth account lookup](https://cloud.google.com/identity-platform/docs/reference/rest/v1/projects.accounts/lookup).
