from datetime import datetime, timezone
from typing import Any

import requests
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models.event import Event


USGS_FEED_URL = (
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"
)


# =========================================================
# SEVERITY
# =========================================================

def magnitude_to_severity(magnitude: float | None) -> str | None:
    """Map a USGS earthquake magnitude to a WorldPulse severity label."""

    if magnitude is None:
        return None

    if magnitude < 3.0:
        return "LOW"

    if magnitude < 5.0:
        return "MEDIUM"

    if magnitude < 6.0:
        return "HIGH"

    return "CRITICAL"


# =========================================================
# TIME
# =========================================================

def unix_ms_to_datetime(
    timestamp_ms: int | float | None,
) -> datetime | None:
    """Convert a USGS Unix timestamp in milliseconds to UTC datetime."""

    if timestamp_ms is None:
        return None

    try:
        return datetime.fromtimestamp(
            float(timestamp_ms) / 1000,
            tz=timezone.utc,
        ).replace(tzinfo=None)

    except (OverflowError, OSError, TypeError, ValueError):
        return None


# =========================================================
# COORDINATES
# =========================================================

def parse_coordinates(
    geometry: dict[str, Any] | None,
) -> tuple[float | None, float | None]:
    """
    Extract latitude and longitude from USGS GeoJSON.

    GeoJSON coordinate order:
        [longitude, latitude, depth]
    """

    if not geometry:
        return None, None

    coordinates = geometry.get("coordinates")

    if not isinstance(coordinates, list):
        return None, None

    if len(coordinates) < 2:
        return None, None

    longitude = coordinates[0]
    latitude = coordinates[1]

    try:
        return float(latitude), float(longitude)

    except (TypeError, ValueError):
        return None, None


def parse_depth_km(
    geometry: dict[str, Any] | None,
) -> float | None:
    """Extract earthquake depth in kilometers."""

    if not geometry:
        return None

    coordinates = geometry.get("coordinates")

    if not isinstance(coordinates, list):
        return None

    if len(coordinates) < 3:
        return None

    try:
        return float(coordinates[2])

    except (TypeError, ValueError):
        return None


# =========================================================
# LOCATION
# =========================================================

US_STATE_NAMES = {
    "Alabama",
    "Alaska",
    "Arizona",
    "Arkansas",
    "California",
    "Colorado",
    "Connecticut",
    "Delaware",
    "Florida",
    "Georgia",
    "Hawaii",
    "Idaho",
    "Illinois",
    "Indiana",
    "Iowa",
    "Kansas",
    "Kentucky",
    "Louisiana",
    "Maine",
    "Maryland",
    "Massachusetts",
    "Michigan",
    "Minnesota",
    "Mississippi",
    "Missouri",
    "Montana",
    "Nebraska",
    "Nevada",
    "New Hampshire",
    "New Jersey",
    "New Mexico",
    "New York",
    "North Carolina",
    "North Dakota",
    "Ohio",
    "Oklahoma",
    "Oregon",
    "Pennsylvania",
    "Rhode Island",
    "South Carolina",
    "South Dakota",
    "Tennessee",
    "Texas",
    "Utah",
    "Vermont",
    "Virginia",
    "Washington",
    "West Virginia",
    "Wisconsin",
    "Wyoming",
    "District of Columbia",
}


US_STATE_ABBREVIATIONS = {
    "AL": "Alabama",
    "AK": "Alaska",
    "AZ": "Arizona",
    "AR": "Arkansas",
    "CA": "California",
    "CO": "Colorado",
    "CT": "Connecticut",
    "DE": "Delaware",
    "FL": "Florida",
    "GA": "Georgia",
    "HI": "Hawaii",
    "ID": "Idaho",
    "IL": "Illinois",
    "IN": "Indiana",
    "IA": "Iowa",
    "KS": "Kansas",
    "KY": "Kentucky",
    "LA": "Louisiana",
    "ME": "Maine",
    "MD": "Maryland",
    "MA": "Massachusetts",
    "MI": "Michigan",
    "MN": "Minnesota",
    "MS": "Mississippi",
    "MO": "Missouri",
    "MT": "Montana",
    "NE": "Nebraska",
    "NV": "Nevada",
    "NH": "New Hampshire",
    "NJ": "New Jersey",
    "NM": "New Mexico",
    "NY": "New York",
    "NC": "North Carolina",
    "ND": "North Dakota",
    "OH": "Ohio",
    "OK": "Oklahoma",
    "OR": "Oregon",
    "PA": "Pennsylvania",
    "RI": "Rhode Island",
    "SC": "South Carolina",
    "SD": "South Dakota",
    "TN": "Tennessee",
    "TX": "Texas",
    "UT": "Utah",
    "VT": "Vermont",
    "VA": "Virginia",
    "WA": "Washington",
    "WV": "West Virginia",
    "WI": "Wisconsin",
    "WY": "Wyoming",
}


def extract_location(
    place: str | None,
) -> tuple[str | None, str | None]:
    """
    Extract country and region from the USGS place field.

    Examples:

        "20 km ENE of West Yellowstone, Montana"
            -> ("United States", "Montana")

        "10 km ENE of Coso Junction, CA"
            -> ("United States", "California")

        "10 km S of Tokyo, Japan"
            -> ("Japan", "Tokyo")
    """

    if not place:
        return None, None

    place = str(place).strip()

    if not place:
        return None, None

    parts = [
        part.strip()
        for part in place.split(",")
        if part.strip()
    ]

    # -----------------------------------------------------
    # Explicit state / country after comma
    # -----------------------------------------------------

    if len(parts) >= 2:

        suffix = parts[-1]

        if suffix in US_STATE_NAMES:
            return "United States", suffix

        abbreviation = suffix.upper().replace(".", "")

        if abbreviation in US_STATE_ABBREVIATIONS:
            return (
                "United States",
                US_STATE_ABBREVIATIONS[abbreviation],
            )

        # International location
        return suffix, parts[-2]

    # -----------------------------------------------------
    # U.S. state name without comma
    # -----------------------------------------------------

    lower_place = place.lower()

    for state in US_STATE_NAMES:
        if state.lower() in lower_place:
            return "United States", state

    return None, None


# =========================================================
# USGS FETCH
# =========================================================

def fetch_usgs_features() -> list[dict[str, Any]]:
    """Fetch today's USGS earthquake GeoJSON features."""

    try:
        response = requests.get(
            USGS_FEED_URL,
            timeout=30,
        )

        response.raise_for_status()
        payload = response.json()

    except requests.RequestException as exc:
        raise RuntimeError(
            f"Failed to fetch USGS earthquake feed: {exc}"
        ) from exc

    except ValueError as exc:
        raise RuntimeError(
            f"USGS earthquake feed was not valid JSON: {exc}"
        ) from exc

    features = payload.get("features")

    if not isinstance(features, list):
        return []

    return features


# =========================================================
# EXISTING EVENTS
# =========================================================

def existing_usgs_source_ids(
    db: Session,
) -> set[str]:
    """Get USGS event IDs already stored in the database."""

    rows = (
        db.query(Event.source_event_id)
        .filter(
            Event.source == "USGS",
            Event.source_event_id.isnot(None),
        )
        .all()
    )

    return {
        row[0]
        for row in rows
        if row[0] is not None
    }


# =========================================================
# HELPER: EXTRACT USGS DATA
# =========================================================

def extract_usgs_data(
    feature: dict[str, Any],
) -> dict[str, Any] | None:
    """Convert one USGS GeoJSON feature into normalized values."""

    properties = feature.get("properties") or {}

    title = properties.get("title")

    if not title:
        return None

    geometry = feature.get("geometry")

    latitude, longitude = parse_coordinates(
        geometry
    )

    depth_km = parse_depth_km(
        geometry
    )

    place = properties.get("place")

    country, region = extract_location(
        place
    )

    # -----------------------------------------------------
    # Magnitude
    # -----------------------------------------------------

    magnitude = properties.get("mag")

    try:
        magnitude_value = (
            float(magnitude)
            if magnitude is not None
            else None
        )
    except (TypeError, ValueError):
        magnitude_value = None

    # -----------------------------------------------------
    # Tsunami
    # -----------------------------------------------------

    tsunami = properties.get("tsunami")

    try:
        tsunami_value = (
            int(tsunami)
            if tsunami is not None
            else None
        )
    except (TypeError, ValueError):
        tsunami_value = None

    # -----------------------------------------------------
    # Significance
    # -----------------------------------------------------

    significance = properties.get("sig")

    try:
        significance_value = (
            int(significance)
            if significance is not None
            else None
        )
    except (TypeError, ValueError):
        significance_value = None

    # -----------------------------------------------------
    # Return normalized data
    # -----------------------------------------------------

    return {
        "title": str(title),
        "description": place,

        "latitude": latitude,
        "longitude": longitude,

        "country": country,
        "region": region,

        "magnitude": magnitude_value,

        "magnitude_type": (
            str(properties.get("magType"))
            if properties.get("magType") is not None
            else None
        ),

        "depth_km": depth_km,

        "tsunami": tsunami_value,

        "alert": (
            str(properties.get("alert"))
            if properties.get("alert") is not None
            else None
        ),

        "significance": significance_value,

        "event_type": (
            str(properties.get("type"))
            if properties.get("type") is not None
            else None
        ),

        "usgs_url": (
            str(
                properties.get("url")
                or properties.get("detail")
            )
            if properties.get("url")
            or properties.get("detail")
            else None
        ),

        "occurred_at": unix_ms_to_datetime(
            properties.get("time")
        ),

        "updated_at": unix_ms_to_datetime(
            properties.get("updated")
        ),
    }


# =========================================================
# NORMAL INGESTION
# =========================================================

def ingest_usgs_earthquakes() -> dict[str, int]:
    """
    Fetch today's USGS earthquakes and insert only new events.
    """

    features = fetch_usgs_features()

    summary = {
        "fetched": len(features),
        "inserted": 0,
        "skipped": 0,
    }

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

            data = extract_usgs_data(feature)

            if data is None:
                summary["skipped"] += 1
                continue

            event = Event(
                source_event_id=source_event_id,
                source="USGS",

                title=data["title"],
                description=data["description"],

                category="earthquake",

                severity=magnitude_to_severity(
                    data["magnitude"]
                ),

                confidence=None,

                latitude=data["latitude"],
                longitude=data["longitude"],

                country=data["country"],
                region=data["region"],

                occurred_at=data["occurred_at"],

                detected_at=datetime.utcnow(),
                created_at=datetime.utcnow(),

                magnitude=data["magnitude"],
                magnitude_type=data["magnitude_type"],
                depth_km=data["depth_km"],
                tsunami=data["tsunami"],
                alert=data["alert"],
                significance=data["significance"],
                event_type=data["event_type"],
                usgs_url=data["usgs_url"],
                updated_at=data["updated_at"],
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


# =========================================================
# BACKFILL EXISTING USGS EVENTS
# =========================================================


def enrich_existing_usgs_events() -> dict[str, int]:
    """
    Enrich all existing USGS events using their individual
    USGS GeoJSON detail endpoints.

    Existing rows are updated in place.
    No rows are deleted.
    No duplicate rows are created.
    """

    db = SessionLocal()

    summary = {
        "checked": 0,
        "updated": 0,
        "failed": 0,
    }

    try:
        events = (
            db.query(Event)
            .filter(
                Event.source == "USGS",
                Event.source_event_id.isnot(None),
            )
            .order_by(Event.id)
            .all()
        )

        total = len(events)

        print(
            f"WorldPulse historical backfill: "
            f"processing {total} USGS events..."
        )

        for index, event in enumerate(events, start=1):

            summary["checked"] += 1

            event_id = str(event.source_event_id)

            detail_url = (
                "https://earthquake.usgs.gov/"
                "earthquakes/feed/v1.0/detail/"
                f"{event_id}.geojson"
            )

            try:
                response = requests.get(
                    detail_url,
                    timeout=20,
                )

                if response.status_code != 200:
                    print(
                        f"[{index}/{total}] "
                        f"{event_id} -> "
                        f"HTTP {response.status_code}"
                    )

                    summary["failed"] += 1
                    continue

                feature = response.json()

                data = extract_usgs_data(feature)

                if data is None:
                    print(
                        f"[{index}/{total}] "
                        f"{event_id} -> "
                        f"no usable data"
                    )

                    summary["failed"] += 1
                    continue

                # -----------------------------------------
                # Update existing database row
                # -----------------------------------------

                event.title = data["title"]

                event.description = (
                    data["description"]
                )

                event.latitude = (
                    data["latitude"]
                )

                event.longitude = (
                    data["longitude"]
                )

                event.country = (
                    data["country"]
                )

                event.region = (
                    data["region"]
                )

                event.magnitude = (
                    data["magnitude"]
                )

                event.magnitude_type = (
                    data["magnitude_type"]
                )

                event.depth_km = (
                    data["depth_km"]
                )

                event.tsunami = (
                    data["tsunami"]
                )

                event.alert = (
                    data["alert"]
                )

                event.significance = (
                    data["significance"]
                )

                event.event_type = (
                    data["event_type"]
                )

                event.usgs_url = (
                    data["usgs_url"]
                )

                event.occurred_at = (
                    data["occurred_at"]
                )

                event.updated_at = (
                    data["updated_at"]
                )

                event.severity = (
                    magnitude_to_severity(
                        data["magnitude"]
                    )
                )

                summary["updated"] += 1

                print(
                    f"[{index}/{total}] "
                    f"{event_id} -> "
                    f"UPDATED "
                    f"M{data['magnitude']} | "
                    f"{data['country']} | "
                    f"{data['region']}"
                )

            except Exception as exc:

                print(
                    f"[{index}/{total}] "
                    f"{event_id} -> "
                    f"ERROR: {exc}"
                )

                summary["failed"] += 1

        db.commit()

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()

    print(
        "\nWorldPulse historical backfill complete:"
    )

    print(
        f"checked={summary['checked']}, "
        f"updated={summary['updated']}, "
        f"failed={summary['failed']}"
    )

    return summary

# =========================================================
# DIRECT EXECUTION
# =========================================================

if __name__ == "__main__":

    result = ingest_usgs_earthquakes()

    print(result)