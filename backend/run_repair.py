import json
from datetime import datetime, timezone
from pathlib import Path

from backend.app.agent.repair_engine import repair_project
from backend.app.schemas.evidence import RepairReport

PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = PROJECT_ROOT / "artifacts" / "repair-report.json"


def main() -> int:
    bug_report = (
        "In fixtures/buggy_example.py, calculate_discount returns "
        "the original price when discount_percent is 100. "
        "A 100% discount should return 0. Preserve the existing "
        "behavior for partial discounts and invalid percentages."
    )

    report = repair_project(
        project_root=PROJECT_ROOT,
        bug_report=bug_report,
        source_path="fixtures/buggy_example.py",
        test_path="fixtures/test_buggy_example.py",
        expected_failure="test_full_discount",
    )

    report["project"] = "ProofLoop"
    report["timestamp_utc"] = datetime.now(timezone.utc).isoformat()

    validated_report = RepairReport.model_validate(report)
    report_data = validated_report.model_dump(mode="json")

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(
        json.dumps(report_data, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    report = report_data

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(
        json.dumps(report, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print(f"Verification status: {report['status']}")
    print(f"Summary: {report['summary']}")
    print(f"Evidence steps: {len(report['evidence'])}")
    print(f"Report saved to: {REPORT_PATH}")

    if report.get("diff"):
        print("\nProposed patch diff:")
        print(report["diff"])

    # Only a verified repair returns exit code 0.
    return 0 if report["status"] == "verified" else 1


if __name__ == "__main__":
    raise SystemExit(main())
