#!/usr/bin/env python3
"""Generate seeded users with hashed passwords for in-memory usage."""

from __future__ import annotations

import json
from pathlib import Path

from auth_logic import hash_password

USERS = [
    ("nova", "Nebula#2026"),
    ("orion", "Quantum#2026"),
    ("lyra", "Pulse#2026"),
    ("atlas", "Aether#2026"),
    ("vega", "Photon#2026"),
    ("zenith", "Cipher#2026"),
    ("astra", "Cosmic#2026"),
    ("echo", "Orbit#2026"),
    ("sol", "Lumen#2026"),
    ("rhea", "Aurora#2026"),
]


def main() -> None:
    output = []
    for username, password in USERS:
        output.append({"username": username, "password": hash_password(password)})

    out_path = Path(__file__).resolve().parents[1] / "data" / "seed_accounts.json"
    out_path.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"Wrote {len(output)} users to {out_path}")


if __name__ == "__main__":
    main()
