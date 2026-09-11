from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.events import router as events_router
from .api.ingestion import router as ingestion_router
from .api.intelligence import router as intelligence_router
from .scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="WorldPulse AI API",
    description="Backend API for the WorldPulse AI global events intelligence platform.",
    version="0.1.0",
    lifespan=lifespan,
)


# Allow the React frontend to communicate with the FastAPI backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(events_router)
app.include_router(ingestion_router)
app.include_router(intelligence_router)


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