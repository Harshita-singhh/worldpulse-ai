from apscheduler.schedulers.background import BackgroundScheduler

from .ingestion.usgs import ingest_usgs_earthquakes


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


# =========================================================
# START
# =========================================================

def start_scheduler():
    """Start the WorldPulse background scheduler."""

    if scheduler.running:
        return

    # Run once immediately when the backend starts.
    run_usgs_ingestion()

    # Continue automatically every 15 minutes.
    scheduler.add_job(
        run_usgs_ingestion,
        trigger="interval",
        minutes=15,
        id="usgs_ingestion",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    scheduler.start()

    print(
        "WorldPulse scheduler: started "
        "(USGS ingestion every 15 minutes)"
    )


# =========================================================
# STOP
# =========================================================

def stop_scheduler():
    """Stop the WorldPulse background scheduler."""

    if scheduler.running:
        scheduler.shutdown(wait=False)

        print("WorldPulse scheduler: stopped")