import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..ingestion.news import ingest_news
from ..models.event import Event
from ..schemas.event import EventResponse


logger = logging.getLogger(__name__)
router = APIRouter(tags=["news"])


@router.get("/news", response_model=list[EventResponse])
def get_news(
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
) -> list[Event]:
    return (
        db.query(Event)
        .filter(Event.category == "news")
        .order_by(Event.occurred_at.desc())
        .limit(limit)
        .all()
    )


@router.post("/ingest/news")
def ingest_news_articles():
    try:
        return ingest_news()
    except Exception as exc:
        logger.exception("News ingestion endpoint failed")
        raise HTTPException(
            status_code=500,
            detail="News ingestion failed",
        ) from exc
