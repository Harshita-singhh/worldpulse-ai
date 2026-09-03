from fastapi import FastAPI

from .api.events import router as events_router
from .api.ingestion import router as ingestion_router

app = FastAPI(
    title="WorldPulse AI API",
    description="Backend API for the WorldPulse AI global events intelligence platform.",
    version="0.1.0",
)

app.include_router(events_router)
app.include_router(ingestion_router)

@app.get("/")
def root():
    return {
        "message": "WorldPulse AI backend is running!",
        "version": "0.1.0",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }