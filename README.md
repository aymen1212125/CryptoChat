# CryptoChat

CryptoChat is an in-memory direct messaging web app with a multi-page flow:
- `/login.html` (authentication)
- `/discover.html` (search users + invites + chat list)
- `/chat.html` (dedicated chat page)

## Stack
- Frontend: HTML + CSS + JS (multi-page, non-SPA)
- Backend: Node.js + Express
- Password logic: Python PBKDF2 verification

## Behavior
- No groups, only invite-based 1:1 chats.
- No friend suggestions: users appear only after search input (2+ chars).
- Passwords are hashed in seed data.

## Demo accounts
| Username | Password |
|---|---|
| nova | Nebula#2026 |
| orion | Quantum#2026 |
| lyra | Pulse#2026 |
| atlas | Aether#2026 |
| vega | Photon#2026 |
| zenith | Cipher#2026 |
| astra | Cosmic#2026 |
| echo | Orbit#2026 |
| sol | Lumen#2026 |
| rhea | Aurora#2026 |

## Run
```bash
npm install
npm run seed
npm start
```

## Deploy on Render
- Type: **Web Service**
- Root Directory: **(leave empty)**
- Build Command: `npm install && npm run seed`
- Start Command: `npm start`
