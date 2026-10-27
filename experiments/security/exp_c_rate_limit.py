"""
ColdChainRx - Week 7 Security Experiment C
===========================================
Threat: Denial of Service / Rate Limiting
STRIDE Category: Denial of Service
Attacker Model: An adversary floods the consumer verification portal
                (Express proxy, port 3001) with rapid repeated requests
                to exhaust resources or scrape ledger data.

This script fires rapid-fire requests at the Express rate-limiter and
captures the moment HTTP 429 kicks in. It also tests the Next.js
frontend proxy and the Fabric backend directly.

Evidence output: experiments/security/exp_c_rate_limit.json
"""

import json
import os
import sys
import time
import concurrent.futures
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

ACTIVE_BATCH_ID = "BATCH_1792760493"

# Express proxy /api/ route — limit: 100 req / 15 min
EXPRESS_API_URL = f"http://localhost:3001/api/fabric/batch/{ACTIVE_BATCH_ID}"

# Express /verify/ route — tighter limit: 20 req / 5 min
EXPRESS_VERIFY_URL = f"http://localhost:3001/verify/{ACTIVE_BATCH_ID}"

# Next.js API route (local, always running)
NEXTJS_URL  = f"http://localhost:3000/api/fabric/batch/{ACTIVE_BATCH_ID}"

TIMEOUT = 6

# ------------------------------------------------------------------ #
# Flood runner                                                         #
# ------------------------------------------------------------------ #

def single_request(req_index, url):
    """Fire one GET request; returns a compact result dict."""
    t_start = time.monotonic()
    try:
        resp = requests.get(url, timeout=TIMEOUT)
        elapsed_ms = round((time.monotonic() - t_start) * 1000, 1)
        return {
            "req":         req_index,
            "status":      resp.status_code,
            "elapsed_ms":  elapsed_ms,
            "rate_limited": resp.status_code == 429,
        }
    except requests.exceptions.Timeout:
        return {"req": req_index, "status": "TIMEOUT", "elapsed_ms": None, "rate_limited": False}
    except requests.exceptions.ConnectionError:
        return {"req": req_index, "status": "CONN_ERR", "elapsed_ms": None, "rate_limited": False}


def run_flood(label, url, n_requests=30, max_workers=15):
    """Send n_requests in parallel; return list of results."""
    print(f"\n  Flooding: {label}")
    print(f"  Target:   {url}")
    print(f"  Requests: {n_requests}  |  Workers: {max_workers}")

    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {
            pool.submit(single_request, i + 1, url): i
            for i in range(n_requests)
        }
        for future in concurrent.futures.as_completed(futures):
            results.append(future.result())

    # Sort by request index for readable output
    results.sort(key=lambda r: r["req"])

    status_counts = {}
    for r in results:
        key = str(r["status"])
        status_counts[key] = status_counts.get(key, 0) + 1

    print(f"  Status distribution: {json.dumps(status_counts)}")
    rate_limited_count = sum(1 for r in results if r.get("rate_limited"))
    print(f"  Rate-limited (429): {rate_limited_count}")

    return results, status_counts


# ------------------------------------------------------------------ #
# Sequential burst (simulates a script kiddie with a loop)            #
# ------------------------------------------------------------------ #

def run_sequential_burst(label, url, n_requests=25, delay_s=0.05):
    """Send requests one at a time with a tiny delay; captures where 429 first appears."""
    print(f"\n  Sequential burst: {label}")
    print(f"  Target:   {url}")
    print(f"  Requests: {n_requests}  |  Inter-request delay: {delay_s}s")

    results = []
    first_429 = None
    for i in range(1, n_requests + 1):
        result = single_request(i, url)
        results.append(result)
        status_str = str(result["status"])
        if result.get("rate_limited") and first_429 is None:
            first_429 = i
            print(f"  !! First 429 at request #{i}")
        marker = " <-- RATE LIMITED" if result.get("rate_limited") else ""
        print(f"     #{i:02d}  HTTP {status_str}  ({result.get('elapsed_ms', '?')} ms){marker}")
        time.sleep(delay_s)

    return results, first_429


# ------------------------------------------------------------------ #
# Main                                                                 #
# ------------------------------------------------------------------ #

def main():
    print("=" * 60)
    print("EXPERIMENT C — Rate Limiting / DoS Defence")
    print("STRIDE: Denial of Service")
    print("=" * 60)

    evidence = {
        "experiment":       "C - Rate Limiting / DoS Defence",
        "stride_category":  "Denial of Service",
        "run_timestamp":    datetime.now(timezone.utc).isoformat(),
        "active_batch_id":  ACTIVE_BATCH_ID,
        "tests":            {},
        "summary":          {},
    }

    # -------------------------------------------------------------- #
    # Test C1: Express /verify/ — parallel flood (25 req, 15 workers)#
    # Hits the tighter verifyLimiter: 20 req / 5 min                 #
    # -------------------------------------------------------------- #
    c1_results, c1_counts = run_flood(
        label      = "C1 - Express /verify/ parallel flood (limit: 20/5min)",
        url        = EXPRESS_VERIFY_URL,
        n_requests = 25,
        max_workers= 15,
    )
    evidence["tests"]["C1_express_verify_parallel_flood"] = {
        "url":             EXPRESS_VERIFY_URL,
        "rate_limit_rule": "20 requests per 5 minutes",
        "n_requests":      25,
        "status_counts":   c1_counts,
        "results":         c1_results,
    }

    time.sleep(2)  # let rate limiter reset window partially

    # -------------------------------------------------------------- #
    # Test C2: Express /api/ — sequential burst (30 req, 50ms apart) #
    # Hits the apiLimiter: 100 req / 15 min                          #
    # -------------------------------------------------------------- #
    c2_results, c2_first_429 = run_sequential_burst(
        label      = "C2 - Express /api/ sequential burst (limit: 100/15min)",
        url        = EXPRESS_API_URL,
        n_requests = 30,
        delay_s    = 0.05,
    )
    c2_counts = {}
    for r in c2_results:
        key = str(r["status"])
        c2_counts[key] = c2_counts.get(key, 0) + 1

    evidence["tests"]["C2_express_api_sequential_burst"] = {
        "url":             EXPRESS_API_URL,
        "rate_limit_rule": "100 requests per 15 minutes",
        "n_requests":      30,
        "inter_request_delay_s": 0.05,
        "first_429_at_request": c2_first_429,
        "status_counts":   c2_counts,
        "results":         c2_results,
    }

    time.sleep(2)

    # -------------------------------------------------------------- #
    # Test C3: Next.js API route — sequential burst                   #
    # -------------------------------------------------------------- #
    c3_results, c3_first_429 = run_sequential_burst(
        label      = "C3 - Next.js /api/fabric/batch sequential burst",
        url        = NEXTJS_URL,
        n_requests = 20,
        delay_s    = 0.1,
    )
    c3_counts = {}
    for r in c3_results:
        key = str(r["status"])
        c3_counts[key] = c3_counts.get(key, 0) + 1

    evidence["tests"]["C3_nextjs_api_sequential_burst"] = {
        "url":             NEXTJS_URL,
        "n_requests":      20,
        "inter_request_delay_s": 0.1,
        "first_429_at_request": c3_first_429,
        "status_counts":   c3_counts,
        "results":         c3_results,
    }

    # -------------------------------------------------------------- #
    # Summary                                                         #
    # -------------------------------------------------------------- #
    c1_429 = c1_counts.get("429", 0)
    c2_429 = c2_counts.get("429", 0)
    c3_429 = c3_counts.get("429", 0)

    evidence["summary"] = {
        "C1_express_verify_parallel_429_count":   c1_429,
        "C2_express_api_sequential_first_429":    c2_first_429,
        "C3_nextjs_sequential_first_429":         c3_first_429,
        "rate_limiting_active_on_express_verify": c1_429 > 0,
        "rate_limiting_active_on_express_api":    c2_429 > 0,
        "rate_limiting_active_on_nextjs":         c3_429 > 0,
        "dos_protection_verdict": (
            "PROTECTED" if c1_429 > 0 else "NOT ENFORCED on /verify/ — investigate"
        ),
        "rate_limit_rules": {
            "/verify/": "20 requests per 5 minutes (verifyLimiter)",
            "/api/":    "100 requests per 15 minutes (apiLimiter)",
        },
    }

    print("\n" + "=" * 60)
    print("SUMMARY")
    print(f"  C1 /verify/ parallel 429s:    {c1_429}/25")
    print(f"  C2 /api/ first sequential 429: request #{c2_first_429}")
    print(f"  C3 Next.js first 429:          request #{c3_first_429}")
    print(f"  DoS protection: {evidence['summary']['dos_protection_verdict']}")
    print("=" * 60)

    out_path = os.path.join(os.path.dirname(__file__), "exp_c_rate_limit.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(evidence, f, indent=2)
    print(f"\nEvidence saved to: {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
