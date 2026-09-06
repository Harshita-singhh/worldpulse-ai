import time

from ..database import SessionLocal
from ..models.event import Event
from .geocoding import reverse_geocode


BATCH_SIZE = 25
REQUEST_DELAY_SECONDS = 1


def enrich_events_with_location() -> dict[str, int]:
    """Enrich events with country and region using reverse geocoding."""

    db = SessionLocal()

    summary = {
        "checked": 0,
        "enriched": 0,
        "skipped": 0,
    }

    try:
        # Get a stable list of event IDs first.
        event_ids = [
            row[0]
            for row in (
                db.query(Event.id)
                .filter(
                    Event.country.is_(None),
                    Event.latitude.isnot(None),
                    Event.longitude.isnot(None),
                )
                .order_by(Event.id)
                .all()
            )
        ]

        total = len(event_ids)

        print(f"WorldPulse enrichment: {total} events need enrichment.")

        for batch_start in range(0, total, BATCH_SIZE):
            batch_ids = event_ids[
                batch_start:batch_start + BATCH_SIZE
            ]

            print(
                f"WorldPulse enrichment: processing "
                f"{batch_start + 1}-{batch_start + len(batch_ids)} "
                f"of {total}..."
            )

            events = (
                db.query(Event)
                .filter(Event.id.in_(batch_ids))
                .order_by(Event.id)
                .all()
            )

            for event in events:
                summary["checked"] += 1

                country, region = reverse_geocode(
                    float(event.latitude),
                    float(event.longitude),
                )

                if country is None:
                    summary["skipped"] += 1
                    print(
                        f"  Skipped event {event.id}: "
                        f"no location found"
                    )
                else:
                    event.country = country
                    event.region = region
                    summary["enriched"] += 1

                    print(
                        f"  Enriched event {event.id}: "
                        f"{country} / {region}"
                    )

                # Respect the geocoding service's request rate.
                time.sleep(REQUEST_DELAY_SECONDS)

            # Commit after every batch.
            db.commit()

            print(
                f"  Batch complete — "
                f"enriched: {summary['enriched']}, "
                f"skipped: {summary['skipped']}"
            )

        print("WorldPulse enrichment: complete.")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()

    return summary