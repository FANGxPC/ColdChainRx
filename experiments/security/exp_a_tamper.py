"""
ColdChainRx - Week 7 Security Experiment A
===========================================
Threat: Data Poisoning / Tampered Sensor Data
STRIDE Category: Tampering
Attacker Model: An adversary intercepts or forges MQTT/HTTP sensor messages
                and injects malicious payloads to corrupt the cold-chain ledger.

This script sends deliberately malformed / out-of-range / tampered payloads
to the gateway validation layer AND to the off-chain verify endpoint, then
records every response as evidence.

Evidence output: experiments/security/exp_a_tamper.json
"""

import json
import os
import sys
import time
import requests
from datetime import datetime, timezone

# ------------------------------------------------------------------ #
# Configuration                                                        #
# ------------------------------------------------------------------ #

try:
    from dotenv import load_dotenv
    load_dotenv(override=True)
except ImportError:
    pass

FABRIC_BASE = os.getenv(
    "FABRIC_BACKEND_URL",
    "http://10.194.253.204:5000"
).rstrip("/")

ACTIVE_BATCH_ID = "BATCH_1792760493"
SENSOR_ID       = "Sensor_Omkar_01"

FABRIC_TEMP_URL   = f"{FABRIC_BASE}/api/iot/temperature"
FABRIC_UPLOAD_URL = f"{FABRIC_BASE}/api/security/offchain/upload"
FABRIC_VERIFY_URL = f"{FABRIC_BASE}/api/security/offchain/verify"

TIMEOUT = 10

# ------------------------------------------------------------------ #
# Attack payloads for Part 1 — Gateway / Fabric injection             #
# ------------------------------------------------------------------ #

ATTACK_PAYLOADS = [
    {
        "label": "A1 - Extreme cold (physically impossible: -200°C)",
        "payload": {
            "batchId":     ACTIVE_BATCH_ID,
            "sensor_id":   SENSOR_ID,
            "temperature": -200.0,
            "humidity":    55.0,
            "reporter":    "Attacker",
            "timestamp":   datetime.now(timezone.utc).isoformat(),
        },
    },
    {
        "label": "A2 - Extreme heat (physically impossible: +500°C)",
        "payload": {
            "batchId":     ACTIVE_BATCH_ID,
            "sensor_id":   SENSOR_ID,
            "temperature": 500.0,
            "humidity":    55.0,
            "reporter":    "Attacker",
            "timestamp":   datetime.now(timezone.utc).isoformat(),
        },
    },
    {
        "label": "A3 - Null temperature field",
        "payload": {
            "batchId":     ACTIVE_BATCH_ID,
            "sensor_id":   SENSOR_ID,
            "temperature": None,
            "humidity":    55.0,
            "reporter":    "Attacker",
            "timestamp":   datetime.now(timezone.utc).isoformat(),
        },
    },
    {
        "label": "A4 - String value as temperature (type confusion)",
        "payload": {
            "batchId":     ACTIVE_BATCH_ID,
            "sensor_id":   SENSOR_ID,
            "temperature": "cold",
            "humidity":    55.0,
            "reporter":    "Attacker",
            "timestamp":   datetime.now(timezone.utc).isoformat(),
        },
    },
    {
        "label": "A5 - Missing batchId (incomplete record)",
        "payload": {
            "sensor_id":   SENSOR_ID,
            "temperature": 5.0,
            "humidity":    55.0,
            "reporter":    "Attacker",
            "timestamp":   datetime.now(timezone.utc).isoformat(),
        },
    },
    {
        "label": "A6 - SQL/NoSQL injection in batchId",
        "payload": {
            "batchId":     "'; DROP TABLE batches; --",
            "sensor_id":   SENSOR_ID,
            "temperature": 5.0,
            "humidity":    55.0,
            "reporter":    "Attacker",
            "timestamp":   datetime.now(timezone.utc).isoformat(),
        },
    },
    {
        "label": "A7 - Humidity out of physical range (150%)",
        "payload": {
            "batchId":     ACTIVE_BATCH_ID,
            "sensor_id":   SENSOR_ID,
            "temperature": 5.0,
            "humidity":    150.0,
            "reporter":    "Attacker",
            "timestamp":   datetime.now(timezone.utc).isoformat(),
        },
    },
    {
        "label": "A8 - Empty JSON body",
        "payload":       {},
    },
]


def test_attack_payload(label, payload):
    """POST payload to Fabric IoT endpoint; return result dict."""
    print(f"\n  [TEST] {label}")
    try:
        resp = requests.post(
            FABRIC_TEMP_URL,
            json=payload,
            timeout=TIMEOUT,
        )
        result = {
            "label":       label,
            "status_code": resp.status_code,
            "response":    resp.text[:300],
            "blocked":     resp.status_code not in (200, 201),
        }
        verdict = "BLOCKED" if result["blocked"] else "ACCEPTED (potential vuln!)"
        print(f"         HTTP {resp.status_code} -> {verdict}")
        return result
    except requests.exceptions.Timeout:
        print("         TIMEOUT (backend unreachable)")
        return {"label": label, "status_code": None, "response": "TIMEOUT", "blocked": None}
    except requests.exceptions.ConnectionError as exc:
        print(f"         CONNECTION ERROR: {exc}")
        return {"label": label, "status_code": None, "response": str(exc)[:200], "blocked": None}


# ------------------------------------------------------------------ #
# Part 2 — Off-chain tamper verification                              #
# ------------------------------------------------------------------ #

ORIGINAL_TELEMETRY = [
    {"batchId": ACTIVE_BATCH_ID, "temperature": 4.5,  "humidity": 55.0, "sensor_id": SENSOR_ID},
    {"batchId": ACTIVE_BATCH_ID, "temperature": 5.1,  "humidity": 57.0, "sensor_id": SENSOR_ID},
    {"batchId": ACTIVE_BATCH_ID, "temperature": 4.9,  "humidity": 54.0, "sensor_id": SENSOR_ID},
]

TAMPERED_TELEMETRY = [
    {"batchId": ACTIVE_BATCH_ID, "temperature": -10.0, "humidity": 55.0, "sensor_id": SENSOR_ID},
    {"batchId": ACTIVE_BATCH_ID, "temperature":  50.0, "humidity": 57.0, "sensor_id": SENSOR_ID},
    {"batchId": ACTIVE_BATCH_ID, "temperature":   4.9, "humidity": 54.0, "sensor_id": SENSOR_ID},
]


def run_offchain_tamper_test():
    """Upload original data, then verify against tampered copy. Returns result dict."""
    print("\n--- Part 2: Off-Chain Anti-Tamper Verification ---")

    # Step 1: Upload legitimate data
    print("  [1] Uploading original telemetry...")
    try:
        upload_resp = requests.post(
            FABRIC_UPLOAD_URL,
            json={"batchId": ACTIVE_BATCH_ID, "telemetryData": ORIGINAL_TELEMETRY},
            timeout=TIMEOUT,
        )
        if upload_resp.status_code not in (200, 201):
            print(f"  Upload failed: HTTP {upload_resp.status_code} — {upload_resp.text[:200]}")
            return {"error": f"Upload HTTP {upload_resp.status_code}", "response": upload_resp.text[:200]}
        resp_data = upload_resp.json()
        cid = resp_data.get("data", {}).get("cid") or resp_data.get("cid")
        print(f"  Uploaded. CID = {cid}")
    except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as exc:
        print(f"  Upload unreachable: {exc}")
        return {"error": str(exc)[:200]}

    # Step 2: Verify tampered data against the CID
    print("  [2] Verifying tampered data against original CID...")
    try:
        verify_resp = requests.post(
            FABRIC_VERIFY_URL,
            json={"expectedCid": cid, "data": TAMPERED_TELEMETRY},
            timeout=TIMEOUT,
        )
        verify_result = verify_resp.json() if verify_resp.status_code == 200 else {"raw": verify_resp.text[:200]}
        print(f"  Verify HTTP {verify_resp.status_code}: {json.dumps(verify_result)}")

        tampered_detected = verify_result.get("tampered", None)
        matches           = verify_result.get("matches", None)
        verdict = "TAMPER DETECTED (correct)" if tampered_detected else "NOT DETECTED (unexpected)"
        print(f"  Verdict: {verdict}")

        return {
            "cid":              cid,
            "upload_status":    upload_resp.status_code,
            "verify_status":    verify_resp.status_code,
            "verify_response":  verify_result,
            "tampered_flag":    tampered_detected,
            "matches_flag":     matches,
            "tamper_detected":  tampered_detected is True and matches is False,
        }
    except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as exc:
        print(f"  Verify unreachable: {exc}")
        return {"cid": cid, "error": str(exc)[:200]}


# ------------------------------------------------------------------ #
# Main                                                                 #
# ------------------------------------------------------------------ #

def main():
    print("=" * 60)
    print("EXPERIMENT A — Data Poisoning / Tampered Sensor Data")
    print("STRIDE: Tampering")
    print("=" * 60)

    evidence = {
        "experiment":      "A - Data Poisoning / Tampered Sensor Data",
        "stride_category": "Tampering",
        "run_timestamp":   datetime.now(timezone.utc).isoformat(),
        "target_endpoint": FABRIC_TEMP_URL,
        "batch_id":        ACTIVE_BATCH_ID,
        "part1_gateway_injection_tests":  [],
        "part2_offchain_tamper_test":     {},
        "summary": {}
    }

    # --- Part 1 ---
    print("\n--- Part 1: Malicious Payload Injection (8 attack vectors) ---")
    for attack in ATTACK_PAYLOADS:
        result = test_attack_payload(attack["label"], attack["payload"])
        evidence["part1_gateway_injection_tests"].append(result)
        time.sleep(0.3)   # polite pacing

    blocked_count = sum(
        1 for r in evidence["part1_gateway_injection_tests"]
        if r.get("blocked") is True
    )
    skipped_count = sum(
        1 for r in evidence["part1_gateway_injection_tests"]
        if r.get("blocked") is None
    )

    # --- Part 2 ---
    evidence["part2_offchain_tamper_test"] = run_offchain_tamper_test()

    # --- Summary ---
    evidence["summary"] = {
        "total_injection_tests":  len(ATTACK_PAYLOADS),
        "blocked_by_backend":     blocked_count,
        "backend_unreachable":    skipped_count,
        "offchain_tamper_caught": evidence["part2_offchain_tamper_test"].get("tamper_detected", None),
    }

    print("\n" + "=" * 60)
    print("SUMMARY")
    print(f"  Injection tests:  {len(ATTACK_PAYLOADS)}")
    print(f"  Blocked:          {blocked_count}")
    print(f"  Unreachable:      {skipped_count}")
    print(f"  Tamper detected:  {evidence['summary']['offchain_tamper_caught']}")
    print("=" * 60)

    out_path = os.path.join(os.path.dirname(__file__), "exp_a_tamper.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(evidence, f, indent=2)
    print(f"\nEvidence saved to: {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
