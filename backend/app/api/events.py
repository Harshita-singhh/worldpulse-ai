from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.event import Event
from ..schemas.event import EventResponse

router = APIRouter()


@router.get("/events", response_model=list[EventResponse])
def get_events(
    category: str | None = Query(default=None),
    limit: int | None = Query(default=None, ge=1, le=5000),
    db: Session = Depends(get_db),
) -> list[Event]:
    """Return all rows from the existing PostgreSQL `events` table."""
    query = db.query(Event)

    if category:
        query = query.filter(Event.category == category)

    if limit is not None:
        query = query.order_by(Event.occurred_at.desc()).limit(limit)

    events = query.all()
    return events
