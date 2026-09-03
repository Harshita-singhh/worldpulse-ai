from apscheduler.schedulers.background import BackgroundScheduler

from .ingestion.usgs import ingest_usgs_earthquakes


scheduler = BackgroundScheduler()


def run_usgs_ingestion():
    print("WorldPulse scheduler: running USGS ingestion...")
    result = ingest_usgs_earthquakes()
    print(f"WorldPulse scheduler: {result}")


def start_scheduler():
    scheduler.add_job(
        run_usgs_ingestion,
        trigger="interval",
        minutes=15,
        id="usgs_ingestion",
        replace_existing=True,
    )
    scheduler.start()


def stop_scheduler():
    scheduler.shutdown()