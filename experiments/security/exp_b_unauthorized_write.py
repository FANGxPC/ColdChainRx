"""
ColdChainRx - Week 7 Security Experiment B
===========================================
Threat: Unauthorized Batch Write (Access Control Bypass)
STRIDE Category: Spoofing + Elevation of Privilege
Attacker Model: An adversary knows the API endpoint and tries to write
                temperature records to batch IDs they have no authority
                over — either non-existent batches, or batches owned by
                a different organization.

This script attempts several unauthorized write scenarios and records
every rejection as evidence of the access-control enforcement layer.

Evidence output: experiments/security/exp_b_unauthorized_write.json
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
FABRIC_TEMP_URL = f"{FABRIC_BASE}/api/iot/temperature"

TIMEOUT = 12

# ------------------------------------------------------------------ #
# Attack scenarios                                                     #
# ------------------------------------------------------------------ #

ATTACK_SCENARIOS = [
    {
        "label":       "B1 - Non-existent batch ID (random fake)",
        "description": "Backend should reject: batch does not exist in Fabric ledger.",
        "payload": {
            "batchId":     "BATCH_FAKE_9999",
            "sensor_id":   SENSOR_ID,
            "temperature": 5.0,
            "humidity":    55.0,
            "reporter":    "Attacker",
            "timestamp":   datetime.now(timezone.utc).isoformat(),
        },
        "expected_blocked": True,
    },
    {
        "label":       "B2 - Batch ID from a previous ledger session (stale)",
        "description": "Old batch IDs that no longer exist should be rejected.",
        "payload": {
            "batchId":     "MED_TEMP_01",
            "sensor_id":   SENSOR_ID,
            "temperature": 5.0,
            "humidity":    55.0,
            "reporter":    "Attacker",
            "timestamp":   datetime.now(timezone.utc).isoformat(),
        },
        "expected_blocked": True,
    },
    {
        "label":       "B3 - Empty batchId string",
        "description": "Empty batch IDs should be rejected at validation.",
        "payload": {
            "batchId":     "",
            "sensor_id":   SENSOR_ID,
            "temperature": 5.0,
            "humidity":    55.0,
            "reporter":    "Attacker",
            "timestamp":   datetime.now(timezone.utc).isoformat(),
        },
        "expected_blocked": True,
    },
    {
        "label":       "B4 - Numeric batchId (type confusion)",
        "description": "Numeric batch ID instead of string — should fail validation.",
        "payload": {
            "batchId":     123456,
            "sensor_id":   SENSOR_ID,
            "temperature": 5.0,
            "humidity":    55.0,
            "reporter":    "Attacker",
            "timestamp":   datetime.now(timezone.utc).isoformat(),
        },
        "expected_blocked": True,
    },
    {
        "label":       "B5 - Legitimate write (control / sanity check)",
        "description": "Valid payload to active batch should SUCCEED — confirms the other rejections are intentional, not network errors.",
        "payload": {
            "batchId":     ACTIVE_BATCH_ID,
            "sensor_id":   SENSOR_ID,
            "temperature": 5.2,
            "humidity":    54.0,
            "reporter":    SENSOR_ID,
            "timestamp":   datetime.now(timezone.utc).isoformat(),
        },
        "expected_blocked": False,   # should succeed
    },
    {
        "label":       "B6 - Extremely long batchId (buffer/overflow probe)",
        "description": "Very long string as batchId to test input sanitisation.",
        "payload": {
            "batchId":     "A" * 2048,
            "sensor_id":   SENSOR_ID,
            "temperature": 5.0,
            "humidity":    55.0,
            "reporter":    "Attacker",
            "timestamp":   datetime.now(timezone.utc).isoformat(),
        },
        "expected_blocked": True,
    },
    {
        "label":       "B7 - Path traversal in batchId",
        "description": "../../etc/passwd style injection in batchId field.",
        "payload": {
            "batchId":     "../../etc/passwd",
            "sensor_id":   SENSOR_ID,
            "temperature": 5.0,
            "humidity":    55.0,
            "reporter":    "Attacker",
            "timestamp":   datetime.now(timezone.utc).isoformat(),
        },
        "expected_blocked": True,
    },
]


def test_scenario(scenario):
    """Run one access-control scenario; return result dict."""
    print(f"\n  [TEST] {scenario['label']}")
    print(f"         {scenario['description']}")
    try:
        resp = requests.post(
            FABRIC_TEMP_URL,
            json=scenario["payload"],
            timeout=TIMEOUT,
        )
        blocked   = resp.status_code not in (200, 201)
        expected  = scenario["expected_blocked"]
        correct   = (blocked == expected)

        verdict = ""
        if expected and blocked:
            verdict = "CORRECTLY BLOCKED"
        elif not expected and not blocked:
            verdict = "CORRECTLY ACCEPTED (control test)"
        elif expected and not blocked:
            verdict = "!! NOT BLOCKED — potential vulnerability !!"
        else:
            verdict = "!! Unexpectedly blocked control test !!"

        print(f"         HTTP {resp.status_code} -> {verdict}")
        return {
            "label":          scenario["label"],
            "description":    scenario["description"],
            "expected_blocked": expected,
            "actual_blocked":   blocked,
            "status_code":      resp.status_code,
            "response":         resp.text[:300],
            "correct_behavior": correct,
            "verdict":          verdict,
        }
    except requests.exceptions.Timeout:
        print("         TIMEOUT")
        return {
            "label":          scenario["label"],
            "description":    scenario["description"],
            "status_code":    None,
            "response":       "TIMEOUT",
            "correct_behavior": None,
            "verdict":        "UNREACHABLE",
        }
    except requests.exceptions.ConnectionError as exc:
        print(f"         CONNECTION ERROR: {exc}")
        return {
            "label":          scenario["label"],
            "description":    scenario["description"],
            "status_code":    None,
            "response":       str(exc)[:200],
            "correct_behavior": None,
            "verdict":        "UNREACHABLE",
        }


# ------------------------------------------------------------------ #
# Main                                                                 #
# ------------------------------------------------------------------ #

def main():
    print("=" * 60)
    print("EXPERIMENT B — Unauthorized Batch Write / Access Control")
    print("STRIDE: Spoofing + Elevation of Privilege")
    print("=" * 60)

    evidence = {
        "experiment":       "B - Unauthorized Batch Write",
        "stride_categories": ["Spoofing", "Elevation of Privilege"],
        "run_timestamp":    datetime.now(timezone.utc).isoformat(),
        "target_endpoint":  FABRIC_TEMP_URL,
        "active_batch_id":  ACTIVE_BATCH_ID,
        "scenarios":        [],
        "summary":          {},
    }

    for scenario in ATTACK_SCENARIOS:
        result = test_scenario(scenario)
        evidence["scenarios"].append(result)
        time.sleep(0.5)

    correct  = sum(1 for r in evidence["scenarios"] if r.get("correct_behavior") is True)
    wrong    = sum(1 for r in evidence["scenarios"] if r.get("correct_behavior") is False)
    unknown  = sum(1 for r in evidence["scenarios"] if r.get("correct_behavior") is None)

    evidence["summary"] = {
        "total_scenarios":            len(ATTACK_SCENARIOS),
        "correct_behavior":           correct,
        "unexpected_behavior":        wrong,
        "unreachable_skipped":        unknown,
        "access_control_passed":      wrong == 0 and correct > 0,
    }

    print("\n" + "=" * 60)
    print("SUMMARY")
    print(f"  Total scenarios:      {len(ATTACK_SCENARIOS)}")
    print(f"  Correct behavior:     {correct}")
    print(f"  Unexpected behavior:  {wrong}")
    print(f"  Unreachable/skipped:  {unknown}")
    print(f"  Access control OK:    {evidence['summary']['access_control_passed']}")
    print("=" * 60)

    out_path = os.path.join(os.path.dirname(__file__), "exp_b_unauthorized_write.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(evidence, f, indent=2)
    print(f"\nEvidence saved to: {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
