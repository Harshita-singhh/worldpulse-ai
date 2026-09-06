"""Read-time event intelligence helpers.

These functions only inspect existing Event fields. They do not write to
the database or change ingest/enrichment behavior.
"""

from typing import Any

# Equal weights so the formula is easy to explain and audit.
# The six signals below always sum to 1.0.
SIGNAL_WEIGHTS = {
    "coordinates": 1 / 6,
    "occurred_at": 1 / 6,
    "country": 1 / 6,
    "region": 1 / 6,
    "severity": 1 / 6,
    "source_event_id": 1 / 6,
}

SEVERITY_RANKS = {
    "LOW": 1,
    "MEDIUM": 2,
    "HIGH": 3,
    "CRITICAL": 4,
}


def _has_value(value: Any) -> bool:
    """Treat None and blank strings as missing."""
    if value is None:
        return False
    if isinstance(value, str) and not value.strip():
        return False
    return True


def severity_rank(severity: str | None) -> int:
    """Map a severity label to a sortable integer.

    LOW=1, MEDIUM=2, HIGH=3, CRITICAL=4.
    None or any unknown label returns 0.
    """
    if not _has_value(severity):
        return 0
    return SEVERITY_RANKS.get(str(severity).strip().upper(), 0)


def score_event(event: Any) -> float:
    """Return a data-quality / completeness score from 0.0 to 1.0.

    Each present signal adds its weight:

    - coordinates: both latitude and longitude are present
    - occurred_at: event time is present
    - country: reverse-geocoded country is present
    - region: reverse-geocoded region is present
    - severity: severity label is present
    - source_event_id: upstream source id is present
    """
    signals = {
        "coordinates": _has_value(getattr(event, "latitude", None))
        and _has_value(getattr(event, "longitude", None)),
        "occurred_at": _has_value(getattr(event, "occurred_at", None)),
        "country": _has_value(getattr(event, "country", None)),
        "region": _has_value(getattr(event, "region", None)),
        "severity": _has_value(getattr(event, "severity", None)),
        "source_event_id": _has_value(getattr(event, "source_event_id", None)),
    }

    score = sum(
        SIGNAL_WEIGHTS[name] for name, present in signals.items() if present
    )
    return round(min(max(score, 0.0), 1.0), 4)
