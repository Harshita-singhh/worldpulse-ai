import hashlib
import logging
import math
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urlparse
from xml.etree import ElementTree

import requests
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models.event import Event


logger = logging.getLogger(__name__)

NEWS_FEEDS = (
    {
        "source": "BBC News",
        "url": "https://feeds.bbci.co.uk/news/world/rss.xml",
        "topic_hint": "WORLD",
    },
    {
        "source": "NPR",
        "url": "https://feeds.npr.org/1004/rss.xml",
        "topic_hint": "WORLD",
    },
    {
        "source": "The Guardian",
        "url": "https://www.theguardian.com/world/rss",
        "topic_hint": "WORLD",
    },
    {
        "source": "BBC Sport",
        "url": "https://feeds.bbci.co.uk/sport/rss.xml",
        "topic_hint": "SPORTS",
    },
    {
        "source": "India Today",
        "url": "https://www.indiatoday.in/rss/home",
        "topic_hint": "INDIA",
    },
    {
        "source": "The Indian Express",
        "url": "https://indianexpress.com/section/india/feed/",
        "topic_hint": "INDIA",
    },
    {
        "source": "The Indian Express Entertainment",
        "url": "https://indianexpress.com/section/entertainment/feed/",
        "topic_hint": "ENTERTAINMENT",
    },
    {
        "source": "The Hindu Movies",
        "url": "https://www.thehindu.com/entertainment/movies/feeder/default.rss",
        "topic_hint": "ENTERTAINMENT",
    },
    {
        "source": "TechCrunch",
        "url": "https://techcrunch.com/feed/",
        "topic_hint": "TECH",
    },
    {
        "source": "ScienceDaily",
        "url": "https://www.sciencedaily.com/rss/top/science.xml",
        "topic_hint": "SCIENCE",
    },
    {
        "source": "BBC Business",
        "url": "https://feeds.bbci.co.uk/news/business/rss.xml",
        "topic_hint": "BUSINESS",
    },
)
MAX_FEED_BYTES = 5_000_000

TOPIC_KEYWORDS = {
    "SPORTS": (
        "sports",
        "cricket",
        "football",
        "soccer",
        "tennis",
        "basketball",
        "hockey",
        "rugby",
        "olympic",
        "championship",
        "tournament",
        "formula 1",
        "premier league",
        "world cup",
    ),
    "BOLLYWOOD": (
        "bollywood",
        "hindi film",
        "hindi cinema",
        "box office",
        "bollywood actor",
        "bollywood actress",
    ),
    "TECH": (
        "technology",
        "artificial intelligence",
        "cybersecurity",
        "cyber attack",
        "software",
        "smartphone",
        "semiconductor",
        "tech company",
    ),
    "SCIENCE": (
        "science",
        "scientists",
        "research",
        "space telescope",
        "nasa",
        "scientific",
    ),
    "BUSINESS": (
        "business",
        "economy",
        "inflation",
        "stock market",
        "trade",
        "interest rate",
        "earnings",
    ),
    "CLIMATE": (
        "climate",
        "climate change",
        "emissions",
        "global warming",
        "renewable energy",
        "carbon dioxide",
    ),
    "INDIA": (
        "india",
        "indian",
        "new delhi",
        "mumbai",
        "bengaluru",
        "kolkata",
    ),
    "ENTERTAINMENT": (
        "entertainment",
        "television",
        "streaming",
        "celebrity",
        "film festival",
        "music industry",
    ),
    "WORLD": (
        "international",
        "world leaders",
        "global summit",
        "across the world",
    ),
}


class _HTMLTextExtractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def _plain_text(value: str | None, limit: int = 2000) -> str | None:
    if not value:
        return None

    parser = _HTMLTextExtractor()
    parser.feed(value)
    text = re.sub(r"\s+", " ", " ".join(parser.parts)).strip()
    return text[:limit] or None


def classify_news_topic(
    title: str,
    description: str | None = None,
    topic_hint: str | None = None,
) -> str:
    """Apply transparent keyword rules, using a hint only for a scoped RSS feed."""
    text = f" {title} {description or ''} ".lower()

    for topic, keywords in TOPIC_KEYWORDS.items():
        if any(keyword in text for keyword in keywords):
            return topic

    return topic_hint or "GENERAL"


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def _child_text(element: ElementTree.Element, *names: str) -> str | None:
    expected = {name.lower() for name in names}
    for child in element:
        if _local_name(child.tag) in expected:
            text = "".join(child.itertext()).strip()
            if text:
                return text
    return None


def _article_link(entry: ElementTree.Element) -> str | None:
    for child in entry:
        if _local_name(child.tag) != "link":
            continue

        link = child.attrib.get("href") or (child.text or "").strip()
        if link and urlparse(link).scheme in {"http", "https"}:
            return link

    return None


def _article_image_url(entry: ElementTree.Element) -> str | None:
    for element in entry.iter():
        if _local_name(element.tag) not in {"content", "thumbnail", "enclosure"}:
            continue

        image_url = element.attrib.get("url") or element.attrib.get("href")
        media_type = element.attrib.get("type", "").lower()
        is_image = (
            _local_name(element.tag) == "thumbnail"
            or media_type.startswith("image/")
            or element.attrib.get("medium", "").lower() == "image"
        )
        if (
            image_url
            and urlparse(image_url).scheme in {"http", "https"}
            and is_image
        ):
            return image_url

    return None


def _occurred_at(value: str | None) -> datetime | None:
    if not value:
        return None

    try:
        date = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        try:
            date = parsedate_to_datetime(value)
        except (TypeError, ValueError, OverflowError):
            return None

    if date.tzinfo is not None:
        date = date.astimezone(timezone.utc).replace(tzinfo=None)
    return date


def _article_coordinates(
    entry: ElementTree.Element,
) -> tuple[float | None, float | None]:
    latitude_text = _child_text(entry, "lat", "latitude")
    longitude_text = _child_text(entry, "long", "lon", "longitude")

    if not latitude_text or not longitude_text:
        point = _child_text(entry, "point")
        coordinates = point.split() if point else []
        if len(coordinates) >= 2:
            latitude_text, longitude_text = coordinates[:2]

    try:
        latitude = float(latitude_text)
        longitude = float(longitude_text)
    except (TypeError, ValueError, OverflowError):
        return None, None

    if (
        not math.isfinite(latitude)
        or not math.isfinite(longitude)
        or not -90 <= latitude <= 90
        or not -180 <= longitude <= 180
    ):
        return None, None

    return latitude, longitude


def normalize_news_entry(
    entry: ElementTree.Element,
    source: str,
    topic_hint: str | None = None,
) -> dict[str, Any] | None:
    title = _plain_text(_child_text(entry, "title"), limit=500)
    link = _article_link(entry)

    if not title or not link:
        return None

    guid = _child_text(entry, "guid", "id")
    identity = guid or f"{title}\x1f{link}"
    source_event_id = "news:" + hashlib.sha256(
        f"{source}\x1f{identity}".encode("utf-8")
    ).hexdigest()

    description = _plain_text(
        _child_text(entry, "description", "summary", "content"),
    )
    occurred_at = _occurred_at(
        _child_text(entry, "pubdate", "published", "updated", "date")
    )
    latitude, longitude = _article_coordinates(entry)

    return {
        "source_event_id": source_event_id,
        "source": source,
        "source_url": link,
        "image_url": _article_image_url(entry),
        "title": title,
        "description": description,
        "event_type": classify_news_topic(title, description, topic_hint),
        "occurred_at": occurred_at,
        "latitude": latitude,
        "longitude": longitude,
        "country": _plain_text(_child_text(entry, "country"), limit=100),
        "region": _plain_text(_child_text(entry, "region", "location"), limit=100),
    }


def fetch_news_feed(feed: dict[str, str]) -> list[dict[str, Any]]:
    """Fetch and normalize one RSS or Atom feed."""
    response = requests.get(
        feed["url"],
        headers={"User-Agent": "WorldPulseAI/1.0 (RSS reader)"},
        timeout=15,
    )
    response.raise_for_status()

    if len(response.content) > MAX_FEED_BYTES:
        raise ValueError("RSS feed exceeds the 5 MB response limit")

    root = ElementTree.fromstring(response.content)
    entries = [
        element
        for element in root.iter()
        if _local_name(element.tag) in {"item", "entry"}
    ]

    articles = []
    for entry in entries:
        article = normalize_news_entry(
            entry,
            feed["source"],
            feed.get("topic_hint"),
        )
        if article is not None:
            articles.append(article)
    return articles


def _existing_news_ids(db: Session) -> set[str]:
    rows = (
        db.query(Event.source_event_id)
        .filter(
            Event.category == "news",
            Event.source_event_id.isnot(None),
        )
        .all()
    )
    return {source_event_id for (source_event_id,) in rows}


def ingest_news() -> dict[str, Any]:
    """Ingest available RSS sources and skip known stable article IDs."""
    articles: list[dict[str, Any]] = []
    feed_errors = []
    feeds_succeeded = 0

    for feed in NEWS_FEEDS:
        try:
            articles.extend(fetch_news_feed(feed))
            feeds_succeeded += 1
        except (requests.RequestException, ElementTree.ParseError, ValueError) as exc:
            message = f"{feed['source']}: {exc}"
            feed_errors.append(message)
            logger.warning("WorldPulse RSS feed failed: %s", message)
        except Exception:
            message = f"{feed['source']}: unexpected feed processing error"
            feed_errors.append(message)
            logger.exception("WorldPulse RSS feed failed: %s", feed["source"])

    summary: dict[str, Any] = {
        "fetched": len(articles),
        "inserted": 0,
        "skipped": 0,
        "feeds_succeeded": feeds_succeeded,
        "feed_errors": feed_errors,
    }
    db = SessionLocal()

    try:
        known_ids = _existing_news_ids(db)
        for article in articles:
            source_event_id = article["source_event_id"]
            if source_event_id in known_ids:
                summary["skipped"] += 1
                continue

            db.add(
                Event(
                    source_event_id=source_event_id,
                    source=article["source"],
                    title=article["title"],
                    description=article["description"],
                    category="news",
                    severity=None,
                    confidence=None,
                    country=article["country"],
                    region=article["region"],
                    latitude=article["latitude"],
                    longitude=article["longitude"],
                    occurred_at=article["occurred_at"],
                    detected_at=datetime.now(timezone.utc).replace(tzinfo=None),
                    created_at=datetime.now(timezone.utc).replace(tzinfo=None),
                    event_type=article["event_type"],
                    source_url=article["source_url"],
                    image_url=article["image_url"],
                )
            )
            known_ids.add(source_event_id)
            summary["inserted"] += 1

        db.commit()
    except Exception:
        db.rollback()
        logger.exception("RSS ingestion database operation failed")
        raise
    finally:
        db.close()

    return summary
