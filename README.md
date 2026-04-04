# CryptoChat

CryptoChat is a production-style direct messaging app powered by Node.js + Express, Python PBKDF2 auth, and Supabase Postgres persistence.

## Features

- Real signup + login with secure PBKDF2 password hashing.
- Supabase-backed persistence for users, invites, connections, messages, and typing state.
- Professional 3-pane chat UX with responsive mobile collapse.
- Optimistic messages with full delivery state UI (sending/sent/delivered/read/failed).
- Virtualized message rendering for very large threads.
- Sticky date separators, grouped message bubbles, typing indicator, context menu, and drag/drop image attachments.
- Offline-aware reconnect banner with local thread cache fallback.

## 1) Configure Supabase

Run `supabase/schema.sql` inside Supabase SQL Editor.

Then set environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

> The backend requires these variables. Without them, API returns configuration errors.

## 2) Run

```bash
npm install
npm run seed
npm start
```

## Demo accounts

- nova / Nebula#2026
- orion / Quantum#2026
- lyra / Pulse#2026
- atlas / Aether#2026
- vega / Photon#2026
- zenith / Cipher#2026
- astra / Cosmic#2026
- echo / Orbit#2026
- sol / Lumen#2026
- rhea / Aurora#2026

On startup, demo users are automatically ensured in the `profiles` table.
