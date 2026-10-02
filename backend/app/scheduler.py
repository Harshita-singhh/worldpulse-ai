import logging
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler

from .ingestion.usgs import ingest_usgs_earthquakes
from .ingestion.news import ingest_news
from .wildfires.service import ingest_wildfires


logger = logging.getLogger(__name__)


# =========================================================
# SCHEDULER
# =========================================================

scheduler = BackgroundScheduler()


# =========================================================
# USGS INGESTION JOB
# =========================================================

def run_usgs_ingestion():
    """Fetch and store new USGS earthquake events."""

    print("WorldPulse scheduler: running USGS ingestion...")

    try:
        result = ingest_usgs_earthquakes()

        print(
            "WorldPulse scheduler: "
            f"fetched={result['fetched']}, "
            f"inserted={result['inserted']}, "
            f"skipped={result['skipped']}"
        )

    except Exception as exc:
        print(
            f"WorldPulse scheduler: USGS ingestion failed: {exc}"
        )


def run_wildfire_ingestion():
    """Fetch and store new FIRMS detections without stopping the API."""
    print("WorldPulse scheduler: running wildfire ingestion...")

    try:
        result = ingest_wildfires()
        print(
            "WorldPulse scheduler: wildfire ingestion "
            f"fetched={result['fetched']}, "
            f"inserted={result['inserted']}, "
            f"skipped={result['skipped']}"
        )
    except Exception as exc:
        logger.exception(
            "WorldPulse scheduler: wildfire ingestion failed: %s",
            exc,
        )


def run_news_ingestion():
    """Fetch recent RSS articles while keeping source failures isolated."""
    logger.info("WorldPulse scheduler: running news ingestion...")

    try:
        result = ingest_news()
        print(
            "WorldPulse scheduler: news ingestion "
            f"fetched={result['fetched']}, "
            f"inserted={result['inserted']}, "
            f"skipped={result['skipped']}, "
            f"feeds_failed={len(result['feed_errors'])}"
        )
    except Exception:
        logger.exception("WorldPulse scheduler: news ingestion failed")


# =========================================================
# START
# =========================================================

def start_scheduler():
    """Start the WorldPulse background scheduler."""

    if scheduler.running:
        return

    scheduler.add_job(
        run_usgs_ingestion,
        trigger="interval",
        minutes=15,
        id="usgs_ingestion",
        next_run_time=datetime.now(scheduler.timezone),
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        run_wildfire_ingestion,
        trigger="interval",
        minutes=15,
        id="wildfire_ingestion",
        next_run_time=datetime.now(scheduler.timezone),
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        run_news_ingestion,
        trigger="interval",
        minutes=30,
        id="news_ingestion",
        next_run_time=datetime.now(scheduler.timezone),
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    scheduler.start()

    print(
        "WorldPulse scheduler: started "
        "(USGS and wildfire every 15 minutes; news every 30 minutes)"
    )


# =========================================================
# STOP
# =========================================================

def stop_scheduler():
    """Stop the WorldPulse background scheduler."""

    if scheduler.running:
        scheduler.shutdown(wait=False)

        print("WorldPulse scheduler: stopped")