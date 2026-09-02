from fastapi import FastAPI

app = FastAPI(
    title="WorldPulse AI API",
    description="Backend API for the WorldPulse AI global events intelligence platform.",
    version="0.1.0",
)


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