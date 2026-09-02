import os
from collections.abc import Generator
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

# Load DATABASE_URL from a .env file at the project root if present.
project_root = Path(__file__).resolve().parent.parent.parent
load_dotenv(project_root / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Add it to a .env file in the project root, "
        "for example: DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/worldpulse"
    )

# echo=False keeps SQLAlchemy quiet. pool_pre_ping checks connections before use.
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
