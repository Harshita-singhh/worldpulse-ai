import csv
import io
import logging
import math
import os
from datetime import datetime, timezone
from typing import Any

import requests

from ..database import SessionLocal
from ..models.event import Event


logger = logging.getLogger(__name__)

FIRMS_SOURCE = "VIIRS_NOAA21_NRT"
FIRMS_AREA = "54,5.5,102,40"
FIRMS_DAY_RANGE = 1
FIRMS_AREA_URL = (
    "https://firms.modaps.eosdis.nasa.gov/api/area/csv/"
    "{map_key}/{source}/{area}/{day_range}"
)


def _optional_float(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None

    if isinstance(value, str) and not value.strip():
        return None

    try:
        number = float(value)
    except (TypeError, ValueError, OverflowError):
        return None

    if not math.isfinite(number):
        return None

    return number


def _positive_float(value: Any) -> float | None:
    number = _optional_float(value)
    return number if number is not None and number >= 0 else None


def _source_event_id(row: dict[str, str], latitude: float, longitude: float) -> str:
    satellite = (row.get("satellite") or "UNKNOWN").strip()
    acquired = (row.get("acq_date") or "").strip()
    time = (row.get("acq_time") or "").strip()
    return (
        f"{satellite}-{acquired}-{time}-"
        f"{latitude:.5f}-{longitude:.5f}"
    )


def _occurred_at(row: dict[str, str]) -> datetime | None:
    acquired = (row.get("acq_date") or "").strip()
    acquired_time = (row.get("acq_time") or "").strip().zfill(4)

    try:
        timestamp = datetime.strptime(
            f"{acquired} {acquired_time}",
            "%Y-%m-%d %H%M",
        )
    except ValueError:
        return None

    return timestamp.replace(tzinfo=timezone.utc).replace(tzinfo=None)


def _parse_row(row: dict[str, str]) -> dict[str, Any] | None:
    latitude = _optional_float(row.get("latitude"))
    longitude = _optional_float(row.get("longitude"))

    if (
        latitude is None
        or longitude is None
        or not -90 <= latitude <= 90
        or not -180 <= longitude <= 180
    ):
        return None

    frp = _positive_float(row.get("frp"))
    satellite = (row.get("satellite") or "").strip() or None
    instrument = (row.get("instrument") or "").strip() or None
    occurred_at = _occurred_at(row)

    if satellite is None or occurred_at is None:
        return None

    latitude_label = f"{latitude:.4f}"
    longitude_label = f"{longitude:.4f}"

    satellite_label = {
        "N21": "NOAA-21",
    }.get(satellite, satellite)

    return {
        "source_event_id": _source_event_id(row, latitude, longitude),
        "title": (
            f"Wildfire detection near {latitude_label}, "
            f"{longitude_label}"
        ),
        "description": (
            f"Satellite fire detection from NASA FIRMS "
            f"{instrument or 'satellite imagery'}"
            f"{f' {satellite_label}' if satellite_label else ''}."
        ),
        "latitude": latitude,
        "longitude": longitude,
        "occurred_at": occurred_at,
        "fire_radiative_power": frp,
        "fire_confidence": (
            (row.get("confidence") or "").strip() or None
        ),
        "satellite": satellite,
        "instrument": instrument,
        "brightness_temperature_ti4": _positive_float(
            row.get("bright_ti4")
        ),
        "brightness_temperature_ti5": _positive_float(
            row.get("bright_ti5")
        ),
        "daynight": (row.get("daynight") or "").strip() or None,
        "source_version": (row.get("version") or "").strip() or None,
    }


def fetch_firms_detections() -> list[dict[str, str]]:
    """Fetch bounded recent VIIRS NOAA-21 detections from NASA FIRMS."""
    map_key = os.getenv("NASA_FIRMS_MAP_KEY")

    if not map_key:
        raise RuntimeError("NASA_FIRMS_MAP_KEY is not configured")

    url = FIRMS_AREA_URL.format(
        map_key=map_key,
        source=FIRMS_SOURCE,
        area=FIRMS_AREA,
        day_range=FIRMS_DAY_RANGE,
    )

    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
    except requests.RequestException as exc:
        status_code = getattr(
            getattr(exc, "response", None),
            "status_code",
            None,
        )
        if status_code is not None:
            raise RuntimeError(
                f"NASA FIRMS request failed with HTTP {status_code}"
            ) from None
        raise RuntimeError("NASA FIRMS request failed") from None

    reader = csv.DictReader(io.StringIO(response.text))
    required_columns = {"latitude", "longitude", "acq_date", "acq_time"}
    if not reader.fieldnames or not required_columns.issubset(
        {name.strip() for name in reader.fieldnames}
    ):
        raise RuntimeError("NASA FIRMS response is missing required CSV columns")

    return [
        {key.strip(): (value or "").strip() for key, value in row.items() if key}
        for row in reader
    ]


def ingest_wildfires() -> dict[str, int]:
    """Fetch and store new bounded-area FIRMS detections idempotently."""
    detections = fetch_firms_detections()
    summary = {
        "fetched": len(detections),
        "inserted": 0,
        "skipped": 0,
    }
    db = SessionLocal()
    detected_at = datetime.now(timezone.utc).replace(tzinfo=None)

    try:
        known_ids = {
            source_event_id
            for (source_event_id,) in (
                db.query(Event.source_event_id)
                .filter(
                    Event.source == "NASA_FIRMS",
                    Event.source_event_id.isnot(None),
                )
                .all()
            )
        }

        for row in detections:
            data = _parse_row(row)
            if data is None or data["source_event_id"] in known_ids:
                summary["skipped"] += 1
                continue

            event = Event(
                source_event_id=data["source_event_id"],
                source="NASA_FIRMS",
                title=data["title"],
                description=data["description"],
                category="wildfire",
                severity="MEDIUM",
                confidence=None,
                latitude=data["latitude"],
                longitude=data["longitude"],
                country=None,
                region=None,
                occurred_at=data["occurred_at"],
                detected_at=detected_at,
                created_at=detected_at,
                fire_radiative_power=data["fire_radiative_power"],
                fire_confidence=data["fire_confidence"],
                satellite=data["satellite"],
                instrument=data["instrument"],
                brightness_temperature_ti4=data[
                    "brightness_temperature_ti4"
                ],
                brightness_temperature_ti5=data[
                    "brightness_temperature_ti5"
                ],
                daynight=data["daynight"],
                source_version=data["source_version"],
            )
            db.add(event)
            known_ids.add(data["source_event_id"])
            summary["inserted"] += 1

        db.commit()
    except Exception:
        db.rollback()
        logger.exception("NASA FIRMS wildfire ingestion database operation failed")
        raise
    finally:
        db.close()

    return summary
