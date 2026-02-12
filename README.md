# Parent PPTO (Parent Paid Time Off)

A cozy, real-time PWA for two parents to coordinate daily effort, mint PTO minutes, and spend/schedule guilt-free breaks.

## Features in this prototype

- Anonymous Firebase Auth + household code join flow (fast iOS Safari setup)
- Firestore real-time sync across devices
- Household energy economy:
  - Effort points accumulate in a shared point bank
  - Threshold conversion mints PTO minutes
  - Split defaults to 60/40 (logger/partner), configurable to 50/50 or 70/30
- Deterministic `mark done` transaction with idempotency guard (`status !== done`)
- Parent balances with transparent overdraft (up to 30 minutes)
- Breaks:
  - Start timer now (deduct immediately)
  - End early refund unused minutes
  - Schedule future breaks for partner visibility
- Decompression requests with partner acknowledgements: `Got it`, `In 5`, `Can we do 15?`
- Calendar weekly/day view for tasks + events
- Warm feed updates (no shame tone)
- Installable PWA (manifest + service worker)
- Firebase Hosting ready

## Tech stack

- Vite + React + React Router
- Plain CSS (fastest stable setup for v1)
- Firebase Auth + Firestore
- `vite-plugin-pwa`

## Firestore collections

- `households/{householdId}`
- `households/{householdId}/members/{uid}`
- `households/{householdId}/taskTemplates/{templateId}`
- `households/{householdId}/dailyTasks/{dateKey}/items/{itemId}`
- `households/{householdId}/events/{eventId}`
- `households/{householdId}/feed/{feedId}`
- `households/{householdId}/stats/{dateKey}`
- `householdCodes/{CODE}` for join flow
- `users/{uid}` for current household lookup

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy env template and fill Firebase web app credentials:

```bash
cp .env.example .env
```

3. Start dev server:

```bash
npm run dev
```

4. Open the printed local URL in browser.

## Firebase setup

1. Create a Firebase project.
2. Enable Authentication:
   - Enable `Anonymous` provider.
3. Create Firestore in production mode.
4. Create a web app in Firebase project settings and copy config into `.env`.

Install Firebase CLI (if needed):

```bash
npm install -g firebase-tools
firebase login
```

Initialize in this repo (first time):

```bash
firebase init hosting firestore
```

Use these answers:
- Public directory: `dist`
- Single-page app rewrite: `Yes`
- GitHub deploys: optional
- Firestore rules file: `firestore.rules`

## Firestore index note

If the app shows this banner:

- `Building database index... try again in a minute.`

Firebase is still building a required index (commonly for `taskTemplates` queries with filters + ordering). Open the Firestore error details in browser dev tools, click the Firebase Console index link in that error, and create the suggested index. Once status is `Enabled`, refresh the app.

## Deploy

1. Build:

```bash
npm run build
```

2. Deploy hosting + rules:

```bash
firebase deploy --only hosting,firestore:rules
```

## iPhone install (Safari)

1. Open deployed URL in Safari.
2. Tap Share button.
3. Tap `Add to Home Screen`.
4. Open the installed app icon.

## Two-phone quick start (tomorrow morning flow)

1. Phone A opens app and taps `Create Household`.
2. Phone A notes household code from Settings/Home header (stored in household doc as `code`).
3. Phone B opens app, taps `Join Household`, enters code.
4. Both phones should immediately see the same tasks/events/feeds in real time.

## Determinism and safety notes

- Task completion is transaction-based and awards once:
  - If task already `done`, transaction exits without re-crediting.
- PTO conversion and split allocation happen in the same transaction.
- Overdraft payback happens automatically on future credits.

## Core files

- `src/services/householdService.js` business logic + transactions
- `src/context/HouseholdContext.jsx` real-time listeners + badge/toast state
- `src/pages/*` UI pages
- `firestore.rules` access controls
- `vite.config.js` PWA configuration

## Known prototype limits

- Auth is anonymous for speed; for production, upgrade to email/Google linking.
- No push notifications in v1 (in-app badge + toast only).
- No Cloud Functions yet; all logic is client transaction-based.
