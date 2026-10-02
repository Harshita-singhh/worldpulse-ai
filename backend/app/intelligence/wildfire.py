import math
from collections import defaultdict
from typing import Any


GRID_SIZE = 2
HIGH_FRP_THRESHOLD_MW = 50.0


def _valid_frp(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None

    if isinstance(value, str) and not value.strip():
        return None

    try:
        frp = float(value)
    except (TypeError, ValueError, OverflowError):
        return None

    if not math.isfinite(frp) or frp < 0:
        return None

    return frp


def _valid_coordinates(event: Any) -> tuple[float, float] | None:
    try:
        latitude = float(event.latitude)
        longitude = float(event.longitude)
    except (AttributeError, TypeError, ValueError, OverflowError):
        return None

    if (
        not math.isfinite(latitude)
        or not math.isfinite(longitude)
        or not -90 <= latitude <= 90
        or not -180 <= longitude <= 180
    ):
        return None

    return latitude, longitude


def analyze_wildfires(events: list[Any]) -> dict[str, Any]:
    """Summarize wildfire detections into deterministic 2-degree cells."""
    cells: dict[tuple[int, int], dict[str, Any]] = defaultdict(
        lambda: {
            "detections": 0,
            "total_frp_mw": 0.0,
            "frp_detections": 0,
            "satellites": set(),
        }
    )
    valid_detections = 0
    high_frp_detections = 0
    total_frp_mw = 0.0

    for event in events:
        coordinates = _valid_coordinates(event)
        if coordinates is None:
            continue

        valid_detections += 1
        latitude, longitude = coordinates
        cell = (
            math.floor(latitude / GRID_SIZE),
            math.floor(longitude / GRID_SIZE),
        )
        hotspot = cells[cell]
        hotspot["detections"] += 1

        frp = _valid_frp(getattr(event, "fire_radiative_power", None))
        if frp is not None:
            hotspot["total_frp_mw"] += frp
            hotspot["frp_detections"] += 1
            total_frp_mw += frp
            if frp >= HIGH_FRP_THRESHOLD_MW:
                high_frp_detections += 1

        satellite = getattr(event, "satellite", None)
        if satellite:
            hotspot["satellites"].add(str(satellite))

    top_hotspots = []
    for (latitude_cell, longitude_cell), hotspot in cells.items():
        total_frp = hotspot["total_frp_mw"]
        detections = hotspot["detections"]
        frp_detections = hotspot["frp_detections"]
        top_hotspots.append(
            {
                "latitude": latitude_cell * GRID_SIZE + GRID_SIZE / 2,
                "longitude": longitude_cell * GRID_SIZE + GRID_SIZE / 2,
                "detections": detections,
                "total_frp_mw": round(total_frp, 2),
                "average_frp_mw": round(
                    total_frp / frp_detections,
                    2,
                ) if frp_detections else 0.0,
                "satellites": sorted(hotspot["satellites"]),
            }
        )

    top_hotspots.sort(
        key=lambda hotspot: (
            -hotspot["detections"],
            -hotspot["total_frp_mw"],
            hotspot["latitude"],
            hotspot["longitude"],
        )
    )

    return {
        "total_detections": len(events),
        "valid_detections": valid_detections,
        "hotspot_count": len(cells),
        "high_frp_detections": high_frp_detections,
        "total_frp_mw": round(total_frp_mw, 2),
        "top_hotspots": top_hotspots[:10],
    }
