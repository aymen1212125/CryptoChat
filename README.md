# CryptoChat

CryptoChat is an in-memory, invite-only direct messaging app with a professional Telegram-like layout (custom design language) and multi-page UX:
- `/login.html`
- `/discover.html`
- `/chat.html`

## Stack
- Frontend: HTML + CSS + JavaScript
- Backend: Node.js + Express
- Password security: Python PBKDF2 verification

## Behavior
- No groups (1:1 chat only)
- No friend suggestions (explicit search required, 2+ characters)
- Invite/accept flow before chat
- Dedicated chat page with message polling

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

## Render settings
- Type: **Web Service**
- Root Directory: **(leave empty)**
- Build Command: `npm install && npm run seed`
- Start Command: `npm start`
