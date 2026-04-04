#!/usr/bin/env python3
"""Password hashing and verification helpers for CryptoChat."""

from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import sys


def hash_password(password: str, iterations: int = 220_000) -> dict:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations
    )
    return {
        "algo": "pbkdf2_sha256",
        "iterations": iterations,
        "salt": salt,
        "hash": digest.hex(),
    }


def verify_password(password: str, entry: dict) -> bool:
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        entry["salt"].encode("utf-8"),
        int(entry["iterations"]),
    )
    return hmac.compare_digest(digest.hex(), entry["hash"])


def _main() -> int:
    if len(sys.argv) > 1 and sys.argv[1] == "hash":
        if len(sys.argv) != 3:
            print("Usage: auth_logic.py hash <password>")
            return 2
        print(json.dumps(hash_password(sys.argv[2])))
        return 0

    if len(sys.argv) > 1 and sys.argv[1] == "verify":
        payload = json.loads(sys.stdin.read())
        result = verify_password(payload["password"], payload["entry"])
        print(json.dumps({"valid": result}))
        return 0

    print(
        "Usage:\n"
        "  auth_logic.py hash <password>\n"
        "  auth_logic.py verify   # JSON from stdin"
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(_main())
