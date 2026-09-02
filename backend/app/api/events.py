from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.event import Event
from ..schemas.event import EventResponse

router = APIRouter()


@router.get("/events", response_model=list[EventResponse])
def get_events(db: Session = Depends(get_db)) -> list[Event]:
    """Return all rows from the existing PostgreSQL `events` table."""
    events = db.query(Event).all()
    return events
