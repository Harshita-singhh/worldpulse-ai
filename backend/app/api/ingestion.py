from fastapi import APIRouter, HTTPException

from ..ingestion.usgs import ingest_usgs_earthquakes

router = APIRouter(prefix="/ingest", tags=["ingestion"])


@router.post("/usgs")
def ingest_usgs():
    try:
        return ingest_usgs_earthquakes()
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc