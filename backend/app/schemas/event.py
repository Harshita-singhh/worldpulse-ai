from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class EventResponse(BaseModel):
    """Pydantic schema used to return Event rows from the API."""

    # Allow FastAPI to build this schema from SQLAlchemy ORM objects.
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
