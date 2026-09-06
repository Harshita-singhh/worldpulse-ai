
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.event import Event
from ..intelligence.scoring import score_event


router = APIRouter(
    prefix="/intelligence",
    tags=["intelligence"],
)


@router.get("/summary")
def intelligence_summary(db: Session = Depends(get_db)):
    """
    Return dashboard-ready intelligence derived from stored events.
    """

    # Database timestamps are currently timezone-naive,
    # so we compare them against a naive UTC timestamp.
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    last_24_hours = now - timedelta(hours=24)

    # ---------------------------------------------------------
    # 1. Total events
    # ---------------------------------------------------------

    total_events = db.query(Event).count()

    # ---------------------------------------------------------
    # 2. Events in the last 24 hours
    # ---------------------------------------------------------

    events_last_24h = (
        db.query(Event)
        .filter(Event.occurred_at >= last_24_hours)
        .count()
    )

    # ---------------------------------------------------------
    # 3. Severity distribution
    # ---------------------------------------------------------

    severity_counts = {}

    for severity in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]:
        severity_counts[severity] = (
            db.query(Event)
            .filter(Event.severity == severity)
            .count()
        )

    # ---------------------------------------------------------
    # 4. Top countries
    # ---------------------------------------------------------

    country_rows = (
        db.query(
            Event.country,
            func.count(Event.id).label("event_count"),
        )
        .filter(
            Event.country.isnot(None),
            Event.country != "",
        )
        .group_by(Event.country)
        .order_by(func.count(Event.id).desc())
        .limit(10)
        .all()
    )

    top_countries = [
        {
            "country": row[0],
            "event_count": row[1],
        }
        for row in country_rows
    ]

    # ---------------------------------------------------------
    # 5. Top regions
    # ---------------------------------------------------------

    region_rows = (
        db.query(
            Event.region,
            func.count(Event.id).label("event_count"),
        )
        .filter(
            Event.region.isnot(None),
            Event.region != "",
        )
        .group_by(Event.region)
        .order_by(func.count(Event.id).desc())
        .limit(10)
        .all()
    )

    top_regions = [
        {
            "region": row[0],
            "event_count": row[1],
        }
        for row in region_rows
    ]

    # ---------------------------------------------------------
    # 6. Recent high-severity events
    # ---------------------------------------------------------

    recent_high_severity_events = (
        db.query(Event)
        .filter(
            Event.severity.in_(["HIGH", "CRITICAL"])
        )
        .order_by(Event.occurred_at.desc())
        .limit(10)
        .all()
    )

    recent_events = [
        {
            "id": event.id,
            "title": event.title,
            "severity": event.severity,
            "country": event.country,
            "region": event.region,
            "occurred_at": event.occurred_at,
            "data_quality_score": score_event(event),
        }
        for event in recent_high_severity_events
    ]

    # ---------------------------------------------------------
    # 7. Final intelligence response
    # ---------------------------------------------------------

    return {
        "total_events": total_events,
        "events_last_24h": events_last_24h,
        "severity_counts": severity_counts,
        "top_countries": top_countries,
        "top_regions": top_regions,
        "recent_high_severity_events": recent_events,
    }