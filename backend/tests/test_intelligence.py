from datetime import datetime, timedelta
from types import SimpleNamespace

from app.intelligence.analytics import build_activity_analytics
from app.intelligence.wildfire import analyze_wildfires


def test_wildfire_analysis_ignores_malformed_frp():
    events = [
        SimpleNamespace(
            latitude=23,
            longitude=87,
            fire_radiative_power=value,
            satellite="N21",
        )
        for value in (None, "", "not-a-number", -2, float("nan"), 50.5)
    ]

    result = analyze_wildfires(events)

    assert result["total_detections"] == 6
    assert result["valid_detections"] == 6
    assert result["high_frp_detections"] == 1
    assert result["total_frp_mw"] == 50.5
    assert result["top_hotspots"][0]["average_frp_mw"] == 50.5


def test_analytics_counts_recent_activity_without_predictive_claims():
    now = datetime(2026, 10, 2, 12)
    events = [
        SimpleNamespace(
            category="wildfire",
            occurred_at=now - timedelta(hours=2),
            region="Region A",
            country="Country A",
        ),
        SimpleNamespace(
            category="earthquake",
            occurred_at=now - timedelta(days=3),
            region="Region A",
            country="Country A",
        ),
        SimpleNamespace(
            category="news",
            occurred_at=now - timedelta(days=9),
            region="Region B",
            country="Country B",
        ),
    ]

    result = build_activity_analytics(events, now)

    assert result["events_last_24h"] == 1
    assert result["events_last_7d"] == 2
    assert result["active_region_count"] == 1
    assert result["top_active_regions"][0]["region"] == "Region A"
    assert result["emerging_regions"][0]["change"] == 2
    assert result["category_distribution"][0] == {
        "category": "wildfire",
        "count": 1,
    }
