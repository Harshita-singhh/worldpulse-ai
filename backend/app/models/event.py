from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text
from sqlalchemy.orm import declarative_base


Base = declarative_base()


class Event(Base):
    """SQLAlchemy model for the existing PostgreSQL events table."""

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

    # =====================================================
    # USGS EARTHQUAKE INTELLIGENCE
    # =====================================================

    magnitude = Column(Numeric(5, 2))
    magnitude_type = Column(String(20))

    depth_km = Column(Numeric(8, 2))

    tsunami = Column(Integer)

    alert = Column(String(20))

    significance = Column(Integer)

    event_type = Column(String(50))

    usgs_url = Column(Text)

    updated_at = Column(DateTime)