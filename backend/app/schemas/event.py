from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class EventResponse(BaseModel):
    """Pydantic schema used to return Event rows from the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int

    source_event_id: str | None = None
    source: str

    title: str
    description: str | None = None

    category: str | None = None
    severity: str | None = None
    confidence: Decimal | None = None

    latitude: Decimal | None = None
    longitude: Decimal | None = None

    country: str | None = None
    region: str | None = None

    occurred_at: datetime | None = None
    detected_at: datetime | None = None
    created_at: datetime | None = None

    # =====================================================
    # USGS EARTHQUAKE INTELLIGENCE
    # =====================================================

    magnitude: Decimal | None = None
    magnitude_type: str | None = None

    depth_km: Decimal | None = None

    tsunami: int | None = None

    alert: str | None = None

    significance: int | None = None

    event_type: str | None = None

    usgs_url: str | None = None

    updated_at: datetime | None = None