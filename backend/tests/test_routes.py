from datetime import datetime, timezone

from app.models.event import Event


def test_summary_events_and_activity_analytics_routes(client):
    test_client, session_factory = client
    with session_factory() as db:
        db.add(
            Event(
                source_event_id="quake-test",
                source="USGS",
                title="Test earthquake",
                category="earthquake",
                severity="HIGH",
                country="Exampleland",
                region="North",
                occurred_at=datetime.now(timezone.utc).replace(tzinfo=None),
            )
        )
        db.commit()

    assert test_client.get("/intelligence/summary").status_code == 200
    assert len(test_client.get("/events?category=earthquake").json()) == 1

    analytics = test_client.get("/intelligence/analytics")
    assert analytics.status_code == 200
    assert analytics.json()["events_last_24h"] == 1
    assert analytics.json()["events_last_7d"] == 1
    assert analytics.json()["top_active_regions"][0]["region"] == "North"


def test_health_and_wildfire_intelligence_routes(client):
    test_client, session_factory = client
    with session_factory() as db:
        db.add(
            Event(
                source_event_id="fire-test",
                source="NASA_FIRMS",
                title="Fire detection",
                category="wildfire",
                latitude=23,
                longitude=87,
                fire_radiative_power=55,
                satellite="N21",
            )
        )
        db.commit()

    assert test_client.get("/health").json() == {"status": "healthy"}
    intelligence = test_client.get("/intelligence/wildfires")
    assert intelligence.status_code == 200
    assert intelligence.json()["high_frp_detections"] == 1
    assert intelligence.json()["total_frp_mw"] == 55
