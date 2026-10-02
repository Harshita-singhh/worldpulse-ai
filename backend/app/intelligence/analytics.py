from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any


def build_activity_analytics(
    events: list[Any],
    now: datetime | None = None,
) -> dict[str, Any]:
    """Build deterministic recent activity and concentration metrics."""
    current_time = now or datetime.now(timezone.utc).replace(tzinfo=None)
    if current_time.tzinfo is not None:
        current_time = current_time.astimezone(timezone.utc).replace(tzinfo=None)

    one_day_ago = current_time - timedelta(days=1)
    seven_days_ago = current_time - timedelta(days=7)
    fourteen_days_ago = current_time - timedelta(days=14)
    categories = Counter()
    recent_categories = Counter()
    active_regions = Counter()
    current_regions = Counter()
    previous_regions = Counter()
    events_last_24h = 0
    events_last_7d = 0

    for event in events:
        category = (getattr(event, "category", None) or "other").lower()
        categories[category] += 1

        occurred_at = getattr(event, "occurred_at", None)
        if not isinstance(occurred_at, datetime):
            continue
        if occurred_at.tzinfo is not None:
            occurred_at = occurred_at.astimezone(timezone.utc).replace(tzinfo=None)
        if occurred_at < fourteen_days_ago or occurred_at > current_time:
            continue

        if occurred_at >= one_day_ago:
            events_last_24h += 1
        if occurred_at >= seven_days_ago:
            events_last_7d += 1
            recent_categories[category] += 1

        region = (
            getattr(event, "region", None)
            or getattr(event, "country", None)
        )
        if not region:
            continue
        if occurred_at >= seven_days_ago:
            current_regions[region] += 1
            active_regions[region] += 1
        elif occurred_at >= fourteen_days_ago:
            previous_regions[region] += 1

    emerging_regions = []
    for region, count in current_regions.items():
        previous_count = previous_regions[region]
        if count > previous_count:
            emerging_regions.append(
                {
                    "region": region,
                    "events_last_7d": count,
                    "events_previous_7d": previous_count,
                    "change": count - previous_count,
                    "activity_score": count,
                }
            )

    emerging_regions.sort(
        key=lambda row: (
            -row["change"],
            -row["events_last_7d"],
            row["region"].lower(),
        )
    )

    return {
        "events_last_24h": events_last_24h,
        "events_last_7d": events_last_7d,
        "active_region_count": len(current_regions),
        "activity_window_days": 14,
        "category_distribution": [
            {"category": category, "count": count}
            for category, count in categories.most_common()
        ],
        "recent_activity_by_category": [
            {"category": category, "count": count}
            for category, count in recent_categories.most_common()
        ],
        "top_active_regions": [
            {
                "region": region,
                "events_last_7d": count,
                "activity_score": count,
            }
            for region, count in active_regions.most_common(5)
        ],
        "emerging_regions": emerging_regions[:5],
    }
