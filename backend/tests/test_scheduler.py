import app.scheduler as scheduler
import app.main as main_module
from fastapi.testclient import TestClient


def test_scheduled_ingestion_failures_do_not_escape(
    monkeypatch,
    caplog,
    capsys,
):
    def raise_error():
        raise RuntimeError("simulated provider outage")

    monkeypatch.setattr(scheduler, "ingest_usgs_earthquakes", raise_error)
    monkeypatch.setattr(scheduler, "ingest_wildfires", raise_error)
    monkeypatch.setattr(scheduler, "ingest_news", raise_error)

    scheduler.run_usgs_ingestion()
    scheduler.run_wildfire_ingestion()
    scheduler.run_news_ingestion()

    assert "USGS ingestion failed" in capsys.readouterr().out
    assert "wildfire ingestion failed" in caplog.text
    assert "news ingestion failed" in caplog.text


def test_fastapi_lifespan_registers_unique_jobs_and_is_idempotent(monkeypatch):
    monkeypatch.setattr(
        scheduler,
        "ingest_usgs_earthquakes",
        lambda: {"fetched": 0, "inserted": 0, "skipped": 0},
    )
    monkeypatch.setattr(
        scheduler,
        "ingest_wildfires",
        lambda: {"fetched": 0, "inserted": 0, "skipped": 0},
    )
    monkeypatch.setattr(
        scheduler,
        "ingest_news",
        lambda: {
            "fetched": 0,
            "inserted": 0,
            "skipped": 0,
            "feed_errors": [],
        },
    )

    with TestClient(main_module.app) as client:
        assert client.get("/health").json() == {"status": "healthy"}
        scheduler.start_scheduler()

        jobs = {job.id: job for job in scheduler.scheduler.get_jobs()}
        assert set(jobs) == {
            "usgs_ingestion",
            "wildfire_ingestion",
            "news_ingestion",
        }
        assert all(job.max_instances == 1 for job in jobs.values())
        assert all(job.coalesce for job in jobs.values())
        assert jobs["usgs_ingestion"].trigger.interval.total_seconds() == 900
        assert jobs["wildfire_ingestion"].trigger.interval.total_seconds() == 900
        assert jobs["news_ingestion"].trigger.interval.total_seconds() == 1800

    assert not scheduler.scheduler.running
