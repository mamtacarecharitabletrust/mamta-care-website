"""Generate Indian public/optional holiday names from the pinned Python package.

These are *calculated suggestions*, not official public-holiday notifications.
Subdivisions and moon-sighting dates may be incomplete or changed by authorities.
The output is a local GitHub Actions intermediate; no visitor IP or data used.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import holidays

YEAR_START = max(2028, datetime.now(timezone.utc).year)
YEARS = range(YEAR_START, YEAR_START + 6)
# Important state/UT coverage. Known codes validated by the package.
SUBDIVISIONS = [
    None, "AP", "AS", "BR", "CH", "DL", "GA", "GJ", "HR", "JK",
    "KA", "KL", "MH", "MP", "OD", "PB", "RJ", "TN", "TG",
    "UP", "WB",
]
records: list[dict] = []
for year in YEARS:
    for subdivision in SUBDIVISIONS:
        try:
            collection = holidays.country_holidays(
                "IN", subdiv=subdivision, years=year, language="en_US"
            )
        except (ValueError, KeyError):
            # Some subdivisions are not available in particular package versions.
            continue
        for date, names in sorted(collection.items()):
            for name in str(names).split(";"):
                name = name.strip()
                if name:
                    records.append(
                        {
                            "date": date.isoformat(),
                            "name": name,
                            "source": "IN" if subdivision is None else "IN-" + subdivision,
                        }
                    )

output = Path(".holiday-tools/holiday-candidates.json")
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(
    f"Generated {len(records)} holiday name candidates for "
    f"{YEAR_START}-{YEAR_START + 5}, subdivisions {len(SUBDIVISIONS)}"
)
if len(records) < 100:
    raise RuntimeError("Too few Indian holiday candidates: refusing to publish.")
