from fastapi import APIRouter, HTTPException

from ..weather.service import fetch_all_weather
from ..weather.signals import detect_all_weather_signals


router = APIRouter(
    prefix="/weather",
    tags=["weather"],
)


@router.get("/current")
def get_current_weather():
    """
    Return current weather conditions for all configured cities.
    """

    try:
        weather = fetch_all_weather()

        return {
            "count": len(weather),
            "cities": weather,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Weather service failed: {exc}",
        ) from exc


@router.get("/signals")
def get_weather_signals():
    """
    Return meaningful weather signals detected
    across all configured cities.
    """

    try:
        weather = fetch_all_weather()

        signals = detect_all_weather_signals(weather)

        return {
            "count": len(signals),
            "signals": signals,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Weather signal detection failed: {exc}",
        ) from exc