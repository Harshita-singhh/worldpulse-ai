from datetime import datetime, timezone
from typing import Any

import requests
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models.event import Event

USGS_FEED_URL = (
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"
)


def magnitude_to_severity(magnitude: float | None) -> str | None:
    """Map a USGS magnitude to a WorldPulse severity label."""
    if magnitude is None:
        return None
    if magnitude < 3.0:
        return "LOW"
    if magnitude < 5.0:
        return "MEDIUM"
    if magnitude < 6.0:
        return "HIGH"
    return "CRITICAL"


def unix_ms_to_datetime(timestamp_ms: int | float | None) -> datetime | None:
    """Convert a USGS Unix timestamp in milliseconds to a UTC datetime."""
    if timestamp_ms is None:
        return None
    try:
        return datetime.fromtimestamp(float(timestamp_ms) / 1000, tz=timezone.utc).replace(
            tzinfo=None
        )
    except (OverflowError, OSError, TypeError, ValueError):
        return None


def parse_coordinates(geometry: dict[str, Any] | None) -> tuple[float | None, float | None]:
    """Return (latitude, longitude) from a GeoJSON geometry object."""
    if not geometry:
        return None, None

    coordinates = geometry.get("coordinates")
    if not isinstance(coordinates, list) or len(coordinates) < 2:
        return None, None

    longitude = coordinates[0]
    latitude = coordinates[1]
    try:
        return float(latitude), float(longitude)
    except (TypeError, ValueError):
        return None, None


def fetch_usgs_features() -> list[dict[str, Any]]:
    """Fetch today's USGS earthquake GeoJSON features."""
    try:
        response = requests.get(USGS_FEED_URL, timeout=30)
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as exc:
        raise RuntimeError(f"Failed to fetch USGS earthquake feed: {exc}") from exc
    except ValueError as exc:
        raise RuntimeError(f"USGS earthquake feed was not valid JSON: {exc}") from exc

    features = payload.get("features")
    if not isinstance(features, list):
        return []
    return features


def existing_usgs_source_ids(db: Session) -> set[str]:
    """Load USGS source_event_id values already stored in the events table."""
    rows = (
        db.query(Event.source_event_id)
        .filter(Event.source == "USGS", Event.source_event_id.isnot(None))
        .all()
    )
    return {row[0] for row in rows}


def ingest_usgs_earthquakes() -> dict[str, int]:
    """Fetch today's USGS earthquakes and insert new rows into `events`."""
    features = fetch_usgs_features()
    summary = {"fetched": len(features), "inserted": 0, "skipped": 0}

    db = SessionLocal()
    try:
        known_ids = existing_usgs_source_ids(db)

        for feature in features:
            if not isinstance(feature, dict):
                summary["skipped"] += 1
                continue

            source_event_id = feature.get("id")
            if not source_event_id:
                summary["skipped"] += 1
                continue

            source_event_id = str(source_event_id)
            if source_event_id in known_ids:
                summary["skipped"] += 1
                continue

            properties = feature.get("properties") or {}
            title = properties.get("title")
            if not title:
                summary["skipped"] += 1
                continue

            latitude, longitude = parse_coordinates(feature.get("geometry"))
            magnitude = properties.get("mag")
            try:
                magnitude_value = float(magnitude) if magnitude is not None else None
            except (TypeError, ValueError):
                magnitude_value = None

            event = Event(
                source_event_id=source_event_id,
                source="USGS",
                title=str(title),
                description=properties.get("place"),
                category="earthquake",
                severity=magnitude_to_severity(magnitude_value),
                latitude=latitude,
                longitude=longitude,
                occurred_at=unix_ms_to_datetime(properties.get("time")),
            )
            db.add(event)
            known_ids.add(source_event_id)
            summary["inserted"] += 1

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    return summary


if __name__ == "__main__":
    print(ingest_usgs_earthquakes())
