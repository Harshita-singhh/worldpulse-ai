from geopy.geocoders import Nominatim


geolocator = Nominatim(user_agent="worldpulse-ai")


def reverse_geocode(latitude: float, longitude: float) -> tuple[str | None, str | None]:
    """Return (country, region) for a latitude/longitude pair."""
    try:
        location = geolocator.reverse(
            (latitude, longitude),
            exactly_one=True,
            language="en",
            addressdetails=True,
        )
    except Exception:
        return None, None

    if location is None:
        return None, None

    address = location.raw.get("address", {})

    country = address.get("country")
    region = (
        address.get("state")
        or address.get("region")
        or address.get("province")
    )

    return country, region