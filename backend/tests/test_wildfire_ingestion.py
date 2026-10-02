import app.wildfires.service as wildfire_service
from app.models.event import Event


def test_wildfire_ingestion_is_bounded_and_idempotent(
    client,
    monkeypatch,
):
    test_client, session_factory = client
    row = {
        "latitude": "23.125",
        "longitude": "87.125",
        "acq_date": "2026-10-02",
        "acq_time": "714",
        "frp": "4.25",
        "confidence": "n",
        "satellite": "N21",
        "instrument": "VIIRS",
        "bright_ti4": "340.13",
        "bright_ti5": "293.77",
        "daynight": "D",
        "version": "2.0NRT",
    }
    monkeypatch.setattr(
        wildfire_service,
        "fetch_firms_detections",
        lambda: [row],
    )

    first = test_client.post("/ingest/wildfires")
    second = test_client.post("/ingest/wildfires")

    assert first.status_code == 200
    assert first.json() == {
        "fetched": 1,
        "inserted": 1,
        "skipped": 0,
    }
    assert second.status_code == 200
    assert second.json() == {
        "fetched": 1,
        "inserted": 0,
        "skipped": 1,
    }

    with session_factory() as db:
        event = db.query(Event).filter(Event.category == "wildfire").one()
        assert event.source == "NASA_FIRMS"
        assert float(event.fire_radiative_power) == 4.25
        assert event.satellite == "N21"

    assert wildfire_service.FIRMS_AREA == "54,5.5,102,40"
    assert wildfire_service.FIRMS_DAY_RANGE == 1
