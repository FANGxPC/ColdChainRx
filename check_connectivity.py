#!/usr/bin/env python3
"""
ColdChainRx – Pre-demo connectivity checker
Run this before your demo to verify all services are reachable.

Usage:
    python -X utf8 check_connectivity.py
"""

import json
import os
import sys
import urllib.request
import urllib.error

try:
    from dotenv import load_dotenv
    load_dotenv(override=True)
except ImportError:
    pass

SWAGATA_BASE  = os.getenv("FABRIC_BACKEND_URL", "http://10.194.253.204:5000").rstrip("/")
EXPRESS_BASE  = "http://localhost:3001"
ML_BASE       = "http://localhost:5001"
TEST_BATCH_ID = "BATCH_1792760493"

def check(label, url, expect_key=None):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ColdChainRx-Checker"})
        with urllib.request.urlopen(req, timeout=8) as r:
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

print(f"1. Swagata's Fabric Backend ({SWAGATA_BASE})")
ok1 = check(
    f"GET /api/batch/{TEST_BATCH_ID}",
    f"{SWAGATA_BASE}/api/batch/{TEST_BATCH_ID}",
    expect_key="success"
)

print(f"\n2. Your Express Gateway ({EXPRESS_BASE})")
ok2 = check(
    "GET /api/fabric/batch/:id (proxy)",
    f"{EXPRESS_BASE}/api/fabric/batch/{TEST_BATCH_ID}",
    expect_key="success"
)

print(f"\n3. Flask ML Service ({ML_BASE})")
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
        print(f"   → Ensure Cloudflare Tunnel is running at: {SWAGATA_BASE}")
    if not ok2:
        print("   → Run:  node backend/server.js")
    if not ok3:
        print("   → Run:  ml-service/.venv/Scripts/python.exe ml-service/app.py")
sys.exit(0 if (ok1 and ok2 and ok3) else 1)
