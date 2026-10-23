#!/usr/bin/env python3
"""
ColdChainRx – Pre-demo connectivity checker
Run this before your demo to verify all services are reachable.

Usage:
    python3 check_connectivity.py
"""

import urllib.request
import urllib.error
import json
import sys

SWAGATA_BASE  = "http://10.194.253.204:5000"  # confirmed IP — same 10.194.253.x subnet
EXPRESS_BASE  = "http://localhost:3001"
ML_BASE       = "http://localhost:5001"
TEST_BATCH_ID = "BATCH_1792760493"

def check(label, url, expect_key=None):
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            body = r.read().decode()
            data = json.loads(body)
            value = data.get(expect_key, "✓") if expect_key else "✓"
            print(f"  ✅  {label:45s} → {value}")
            return True
    except urllib.error.HTTPError as e:
        print(f"  ⚠️   {label:45s} → HTTP {e.code}: {e.read().decode()[:80]}")
    except urllib.error.URLError as e:
        print(f"  ❌  {label:45s} → Unreachable ({e.reason})")
    except Exception as e:
        print(f"  ❌  {label:45s} → {e}")
    return False

print("\n======= ColdChainRx Connectivity Check =======\n")

print("1. Swagata's Fabric Backend")
ok1 = check(
    f"GET /api/batch/{TEST_BATCH_ID}",
    f"{SWAGATA_BASE}/api/batch/{TEST_BATCH_ID}",
    expect_key="success"
)

print("\n2. Your Express Gateway (must be running: node server.js)")
ok2 = check(
    "GET /api/fabric/batch/:id (proxy)",
    f"{EXPRESS_BASE}/api/fabric/batch/{TEST_BATCH_ID}",
    expect_key="success"
)

print("\n3. Flask ML Service (must be running: python app.py)")
ok3 = check(
    "GET /health",
    f"{ML_BASE}/health",
    expect_key="status"
)

print("\n================================================")
if ok1 and ok2 and ok3:
    print("✅  All systems nominal — you're ready for the demo!\n")
else:
    print("⚠️   Some services are down. Fix issues above before demoing.\n")
    if not ok1:
        print("   → Ask Swagata to run:  npm start  (in her backend folder)")
    if not ok2:
        print("   → Run:  node server.js  (in ColdChainRx-Portal/backend/)")
    if not ok3:
        print("   → Run:  ./venv/bin/python app.py  (in ColdChainRx-Portal/ml-service/)")
sys.exit(0 if (ok1 and ok2 and ok3) else 1)
