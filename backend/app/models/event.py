from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text
from sqlalchemy.orm import declarative_base

# Shared declarative base for ORM models.
# We do not call metadata.create_all() anywhere, so this will not create or alter tables.
Base = declarative_base()


class Event(Base):
    """SQLAlchemy model that maps to the existing PostgreSQL `events` table."""

    __tablename__ = "events"

    id = Column(Integer, primary_key=True)
    source_event_id = Column(String(255))
    source = Column(String(100), nullable=False)
    title = Column(Text, nullable=False)
    description = Column(Text)
    category = Column(String(50))
    severity = Column(String(20))
    confidence = Column(Numeric(5, 4))
    latitude = Column(Numeric(9, 6))
    longitude = Column(Numeric(9, 6))
    country = Column(String(100))
    region = Column(String(100))
    occurred_at = Column(DateTime)
    detected_at = Column(DateTime)
    created_at = Column(DateTime)
