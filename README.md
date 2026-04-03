# CryptoChat

CryptoChat is a full-stack (no database) direct messaging app with a polished futuristic UI, invitation-based 1:1 channels, and Python-backed password hashing.

## Stack
- **Frontend:** HTML, CSS, vanilla JavaScript
- **Backend:** Node.js + Express
- **Security logic:** Python (`pbkdf2_sha256` hashing and verification)
- **Storage:** In-memory runtime + local seed JSON for demo accounts

## Features
- Login with hashed password verification via Python.
- Password input is hidden by default (`type="password"`) and can be toggled.
- User discovery (`search`) and invite flow (accept/decline).
- No groups; only 1:1 channels after invite acceptance.
- Responsive UI for desktop + mobile.

## Demo Accounts (plain credentials for testing)
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

> Password hashes are generated in `data/seed_accounts.json` and raw passwords are never stored there.

## Run
```bash
npm install
npm run seed
npm start
```
Open `http://localhost:3000`.

## Validation
```bash
npm run check
```
