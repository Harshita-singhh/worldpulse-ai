def detect_weather_signals(weather: dict) -> list[dict]:
    """
    Detect meaningful weather conditions from a current
    weather observation.

    Returns only conditions that cross WorldPulse
    significance thresholds.
    """

    signals = []

    city = weather["city"]
    country = weather["country"]

    temperature = weather.get("temperature_c")
    apparent_temperature = weather.get("apparent_temperature_c")
    precipitation = weather.get("precipitation_mm")
    wind_speed = weather.get("wind_speed_kmh")
    wind_gusts = weather.get("wind_gusts_kmh")
    snowfall = weather.get("snowfall_cm")
    weather_code = weather.get("weather_code")

    location = f"{city}, {country}"

    # Extreme heat
    if (
        temperature is not None
        and temperature >= 40
    ) or (
        apparent_temperature is not None
        and apparent_temperature >= 45
    ):
        signals.append(
            {
                "type": "EXTREME_HEAT",
                "severity": "HIGH",
                "location": location,
                "message": (
                    f"Extreme heat detected in {city}: "
                    f"{temperature}°C, feels like "
                    f"{apparent_temperature}°C."
                ),
            }
        )

    # Heavy precipitation
    if (
        precipitation is not None
        and precipitation >= 10
    ):
        signals.append(
            {
                "type": "HEAVY_PRECIPITATION",
                "severity": "HIGH",
                "location": location,
                "message": (
                    f"Heavy precipitation detected in "
                    f"{city}: {precipitation} mm."
                ),
            }
        )

    # Strong winds
    if (
        wind_speed is not None
        and wind_speed >= 50
    ) or (
        wind_gusts is not None
        and wind_gusts >= 60
    ):
        signals.append(
            {
                "type": "STRONG_WINDS",
                "severity": "HIGH",
                "location": location,
                "message": (
                    f"Strong winds detected in {city}: "
                    f"{wind_speed} km/h, gusts up to "
                    f"{wind_gusts} km/h."
                ),
            }
        )

    # Thunderstorms
    if (
        weather_code is not None
        and weather_code >= 95
    ):
        signals.append(
            {
                "type": "THUNDERSTORM",
                "severity": "HIGH",
                "location": location,
                "message": (
                    f"Thunderstorm conditions detected "
                    f"in {city}."
                ),
            }
        )

    # Heavy snowfall
    if (
        snowfall is not None
        and snowfall >= 2
    ):
        signals.append(
            {
                "type": "HEAVY_SNOWFALL",
                "severity": "HIGH",
                "location": location,
                "message": (
                    f"Heavy snowfall detected in {city}: "
                    f"{snowfall} cm."
                ),
            }
        )

    return signals


def detect_all_weather_signals(
    weather_data: list[dict],
) -> list[dict]:
    """
    Detect meaningful weather signals across all
    configured cities.
    """

    signals = []

    for weather in weather_data:
        signals.extend(
            detect_weather_signals(weather)
        )

    return signals