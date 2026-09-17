import requests


OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


WEATHER_CITIES = {
    "Delhi": {
        "latitude": 28.6139,
        "longitude": 77.2090,
        "country": "India",
    },
    "London": {
        "latitude": 51.5074,
        "longitude": -0.1278,
        "country": "United Kingdom",
    },
    "New York": {
        "latitude": 40.7128,
        "longitude": -74.0060,
        "country": "United States",
    },
    "Tokyo": {
        "latitude": 35.6762,
        "longitude": 139.6503,
        "country": "Japan",
    },
    "Sydney": {
        "latitude": -33.8688,
        "longitude": 151.2093,
        "country": "Australia",
    },
    "Dubai": {
        "latitude": 25.2048,
        "longitude": 55.2708,
        "country": "United Arab Emirates",
    },
    "Singapore": {
        "latitude": 1.3521,
        "longitude": 103.8198,
        "country": "Singapore",
    },
    "São Paulo": {
        "latitude": -23.5505,
        "longitude": -46.6333,
        "country": "Brazil",
    },
    "Mexico City": {
        "latitude": 19.4326,
        "longitude": -99.1332,
        "country": "Mexico",
    },
    "Cairo": {
        "latitude": 30.0444,
        "longitude": 31.2357,
        "country": "Egypt",
    },
}


CURRENT_WEATHER_VARIABLES = (
    "temperature_2m,"
    "relative_humidity_2m,"
    "apparent_temperature,"
    "precipitation,"
    "rain,"
    "showers,"
    "snowfall,"
    "weather_code,"
    "cloud_cover,"
    "wind_speed_10m,"
    "wind_direction_10m,"
    "wind_gusts_10m"
)


def fetch_city_weather(city: str) -> dict:
    """
    Fetch current weather conditions for one configured city.
    """

    if city not in WEATHER_CITIES:
        raise ValueError(f"Unknown weather city: {city}")

    location = WEATHER_CITIES[city]

    params = {
        "latitude": location["latitude"],
        "longitude": location["longitude"],
        "current": CURRENT_WEATHER_VARIABLES,
        "temperature_unit": "celsius",
        "wind_speed_unit": "kmh",
        "precipitation_unit": "mm",
        "timezone": "auto",
    }

    response = requests.get(
        OPEN_METEO_URL,
        params=params,
        timeout=15,
    )

    response.raise_for_status()

    data = response.json()

    current = data.get("current")

    if not current:
        raise RuntimeError(
            f"No current weather data returned for {city}"
        )

    return {
        "city": city,
        "country": location["country"],
        "latitude": location["latitude"],
        "longitude": location["longitude"],
        "timezone": data.get("timezone"),
        "observed_at": current.get("time"),
        "temperature_c": current.get("temperature_2m"),
        "relative_humidity": current.get(
            "relative_humidity_2m"
        ),
        "apparent_temperature_c": current.get(
            "apparent_temperature"
        ),
        "precipitation_mm": current.get(
            "precipitation"
        ),
        "rain_mm": current.get("rain"),
        "showers_mm": current.get("showers"),
        "snowfall_cm": current.get("snowfall"),
        "weather_code": current.get("weather_code"),
        "cloud_cover": current.get("cloud_cover"),
        "wind_speed_kmh": current.get(
            "wind_speed_10m"
        ),
        "wind_direction": current.get(
            "wind_direction_10m"
        ),
        "wind_gusts_kmh": current.get(
            "wind_gusts_10m"
        ),
    }


def fetch_all_weather() -> list[dict]:
    """
    Fetch current weather for all configured cities.
    """

    results = []

    for city in WEATHER_CITIES:
        try:
            results.append(
                fetch_city_weather(city)
            )
        except requests.RequestException as exc:
            print(
                f"WorldPulse weather: "
                f"failed to fetch {city}: {exc}"
            )
        except Exception as exc:
            print(
                f"WorldPulse weather: "
                f"unexpected error for {city}: {exc}"
            )

    return results