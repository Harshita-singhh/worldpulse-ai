import logging

from fastapi import APIRouter, HTTPException

from ..wildfires.service import ingest_wildfires


router = APIRouter(prefix="/ingest", tags=["wildfire ingestion"])
logger = logging.getLogger(__name__)


@router.post("/wildfires")
def ingest_wildfire_detections():
    try:
        return ingest_wildfires()
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Wildfire ingestion endpoint failed")
        raise HTTPException(
            status_code=500,
            detail="Wildfire ingestion failed",
        ) from exc
