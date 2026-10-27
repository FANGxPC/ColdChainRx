#!/usr/bin/env python3
"""
ColdChainRx – Pre-demo connectivity & integration checker
Verifies all 4 blockchain endpoints, Express gateway, ML service, and frontend.

Endpoints tested:
  1. GET /api/batch/:id               (Current State from Ledger)
  2. GET /api/batch/:id/history       (Complete Ledger Audit History / Hops)
  3. GET /api/device/:deviceId/batch  (Device-to-Batch Mapping)
  4. GET /api/security/offchain/:cid  (Off-Chain / IPFS Storage Data)

Usage:
    python3 check_connectivity.py
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

SWAGATA_BASE   = os.getenv("FABRIC_BACKEND_URL", "https://kiss-far-pulling-guidance.trycloudflare.com").rstrip("/")
EXPRESS_BASE   = os.getenv("NEXT_PUBLIC_API_URL", "http://localhost:3001").rstrip("/")
ML_BASE        = os.getenv("ML_SERVICE_URL", "http://localhost:5001").rstrip("/")
FRONTEND_URL   = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")

TEST_BATCH_ID  = "BATCH001"
TEST_DEVICE_ID = "ESP32_BOX_01"
TEST_CID       = "QmTestPayloadCID12345"

def check(label, url, expect_key=None, method="GET", payload=None, allow_404_json=False):
    try:
        headers = {
            "User-Agent": "ColdChainRx-ConnectivityChecker",
            "Accept": "application/json"
        }
        data_bytes = None
        if payload is not None:
            headers["Content-Type"] = "application/json"
            data_bytes = json.dumps(payload).encode("utf-8")

        req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=10) as r:
            body = r.read().decode("utf-8")
            data = json.loads(body) if "json" in r.headers.get("Content-Type", "") else body
            if isinstance(data, dict):
                val = data.get(expect_key) if expect_key else "HTTP 200 OK"
                if val is True:
                    val = "success: true"
            else:
                val = "HTTP 200 OK"
            print(f"  ✅  {label:52s} → {val}")
            return True

    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        # For off-chain IPFS test CID, 404 with JSON error is a valid confirmation the route exists and is handled
        if allow_404_json and e.code == 404:
            try:
                data = json.loads(body)
                print(f"  ✅  {label:52s} → Route active (HTTP 404: {data.get('error', 'CID not found')})")
                return True
            except Exception:
                pass
        print(f"  ⚠️   {label:52s} → HTTP {e.code}: {body[:70]}")
    except urllib.error.URLError as e:
        print(f"  ❌  {label:52s} → Unreachable ({e.reason})")
    except Exception as e:
        print(f"  ❌  {label:52s} → {e}")
    return False

print("\n================= ColdChainRx Full System Connectivity Check =================\n")

print(f"1. Swagata's Hyperledger Fabric Gateway ({SWAGATA_BASE})")
ok1_1 = check(
    f"GET /api/batch/{TEST_BATCH_ID} (Ledger Batch Details)",
    f"{SWAGATA_BASE}/api/batch/{TEST_BATCH_ID}",
    expect_key="success"
)
ok1_2 = check(
    f"GET /api/batch/{TEST_BATCH_ID}/history (Audit History)",
    f"{SWAGATA_BASE}/api/batch/{TEST_BATCH_ID}/history",
    expect_key="success"
)
ok1_3 = check(
    f"GET /api/device/{TEST_DEVICE_ID}/batch (Device Mapping)",
    f"{SWAGATA_BASE}/api/device/{TEST_DEVICE_ID}/batch",
    expect_key="success"
)
ok1_4 = check(
    f"GET /api/security/offchain/:cid (Off-chain IPFS)",
    f"{SWAGATA_BASE}/api/security/offchain/{TEST_CID}",
    allow_404_json=True
)

print(f"\n2. Express API Gateway & Proxy ({EXPRESS_BASE})")
ok2_1 = check(
    f"GET /api/batch/{TEST_BATCH_ID} (Ledger State Proxy)",
    f"{EXPRESS_BASE}/api/batch/{TEST_BATCH_ID}",
    expect_key="success"
)
ok2_2 = check(
    f"GET /api/batch/{TEST_BATCH_ID}/history (Audit History Proxy)",
    f"{EXPRESS_BASE}/api/batch/{TEST_BATCH_ID}/history",
    expect_key="success"
)
ok2_3 = check(
    f"GET /api/device/{TEST_DEVICE_ID}/batch (Device Mapping Proxy)",
    f"{EXPRESS_BASE}/api/device/{TEST_DEVICE_ID}/batch",
    expect_key="success"
)
ok2_4 = check(
    f"GET /api/security/offchain/:cid (Off-chain IPFS Proxy)",
    f"{EXPRESS_BASE}/api/security/offchain/{TEST_CID}",
    allow_404_json=True
)
ok2_5 = check(
    f"GET /api/fabric/batch/{TEST_BATCH_ID} (Backward-compat route)",
    f"{EXPRESS_BASE}/api/fabric/batch/{TEST_BATCH_ID}",
    expect_key="success"
)

print(f"\n3. Flask ML Anomaly Detection Service ({ML_BASE})")
ok3_1 = check(
    "GET /health (Service Health Check)",
    f"{ML_BASE}/health",
    expect_key="status"
)
ok3_2 = check(
    "POST /predict (ML Inference Pipeline)",
    f"{ML_BASE}/predict",
    method="POST",
    payload={"temperature": 4.5, "humidity": 60.0, "sensor_id": TEST_BATCH_ID},
    expect_key="is_anomaly"
)

print(f"\n4. Next.js Consumer & Stakeholder Portal ({FRONTEND_URL})")
ok4_1 = check(
    "GET / (Dashboard & Verification Portal)",
    f"{FRONTEND_URL}/"
)
ok4_2 = check(
    f"GET /verify/{TEST_BATCH_ID} (Consumer QR Verification)",
    f"{FRONTEND_URL}/verify/{TEST_BATCH_ID}"
)

print("\n==============================================================================")
all_fabric_ok   = ok1_1 and ok1_2 and ok1_3 and ok1_4
all_gateway_ok  = ok2_1 and ok2_2 and ok2_3 and ok2_4 and ok2_5
all_ml_ok       = ok3_1 and ok3_2
all_frontend_ok = ok4_1 and ok4_2

if all_fabric_ok and all_gateway_ok and all_ml_ok and all_frontend_ok:
    print("✅  ALL SYSTEMS NOMINAL — Blockchain, Gateway, ML, and Frontend are in sync!\n")
    sys.exit(0)
else:
    print("⚠️   Some services are not responding or returned errors:\n")
    if not all_fabric_ok:
        print(f"   → Fabric Backend issue. Check Cloudflare Tunnel URL: {SWAGATA_BASE}")
    if not all_gateway_ok:
        print(f"   → Express Gateway issue on port 3001. Ensure: node backend/server.js")
    if not all_ml_ok:
        print(f"   → Flask ML Service issue on port 5001. Ensure: python3 ml-service/app.py")
    if not all_frontend_ok:
        print(f"   → Next.js Frontend issue on port 3000. Ensure: npm run dev in frontend/")
    print("")
    sys.exit(1)
