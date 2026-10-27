"""
ColdChainRx - Week 7 Security Master Runner
============================================
Runs all three security experiments in sequence and produces
a combined summary report.

Usage:
    python experiments/security/run_all_security.py

Individual experiments can also be run standalone:
    python experiments/security/exp_a_tamper.py
    python experiments/security/exp_b_unauthorized_write.py
    python experiments/security/exp_c_rate_limit.py
"""

import json
import os
import subprocess
import sys
from datetime import datetime, timezone

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))

EXPERIMENTS = [
    ("A", "exp_a_tamper.py",            "exp_a_tamper.json"),
    ("B", "exp_b_unauthorized_write.py", "exp_b_unauthorized_write.json"),
    ("C", "exp_c_rate_limit.py",         "exp_c_rate_limit.json"),
]


def run_experiment(label, script_name, output_file):
    script_path = os.path.join(SCRIPT_DIR, script_name)
    output_path = os.path.join(SCRIPT_DIR, output_file)

    print(f"\n{'='*60}")
    print(f"  Running Experiment {label}: {script_name}")
    print(f"{'='*60}")

    result = subprocess.run(
        [sys.executable, "-X", "utf8", script_path],
        cwd=PROJECT_ROOT,
        capture_output=False,
    )

    if os.path.exists(output_path):
        with open(output_path, encoding="utf-8") as f:
            return json.load(f)
    return {"error": f"Output file not found after running {script_name}"}


def main():
    print("\n" + "=" * 60)
    print("  ColdChainRx — Week 7 Security Experiments")
    print(f"  Run started: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 60)

    combined = {
        "run_timestamp": datetime.now(timezone.utc).isoformat(),
        "results": {}
    }

    for label, script, output in EXPERIMENTS:
        combined["results"][f"experiment_{label}"] = run_experiment(label, script, output)

    # Write combined report
    combined_path = os.path.join(SCRIPT_DIR, "security_experiments_combined.json")
    with open(combined_path, "w", encoding="utf-8") as f:
        json.dump(combined, f, indent=2)

    print(f"\n\nAll experiments complete.")
    print(f"Combined report: {combined_path}")
    print("\nIndividual reports:")
    for _, _, output in EXPERIMENTS:
        print(f"  {os.path.join(SCRIPT_DIR, output)}")


if __name__ == "__main__":
    main()
