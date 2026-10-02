from xml.etree import ElementTree

import app.ingestion.news as news_ingestion
from app.models.event import Event


def article(source="BBC News"):
    xml = ElementTree.fromstring(
        """
        <item>
          <title>Wildfire response expands after dry conditions</title>
          <description>&lt;p&gt;Officials report new containment measures.&lt;/p&gt;</description>
          <link>https://example.org/world/fire-update</link>
          <guid>article-123</guid>
          <pubDate>Fri, 02 Oct 2026 10:00:00 GMT</pubDate>
          <country>Exampleland</country>
        </item>
        """
    )
    return news_ingestion.normalize_news_entry(xml, source)


def test_news_normalization_is_stable_and_transparent():
    first = article()
    second = article()

    assert first == second
    assert first["source_event_id"].startswith("news:")
    assert first["source_url"] == "https://example.org/world/fire-update"
    assert first["description"] == "Officials report new containment measures."
    assert first["event_type"] == "GENERAL"
    assert first["country"] == "Exampleland"
    assert first["occurred_at"].isoformat() == "2026-10-02T10:00:00"


def test_atom_entries_use_stable_title_and_link_fallback():
    entry = ElementTree.fromstring(
        """
        <entry xmlns="http://www.w3.org/2005/Atom">
          <georss:point xmlns:georss="http://www.georss.org/georss">51.5 -0.12</georss:point>
          <title>Science report</title>
          <summary>Research findings published.</summary>
          <link href="https://example.org/science/report" />
          <updated>2026-10-02T10:00:00Z</updated>
        </entry>
        """
    )

    first = news_ingestion.normalize_news_entry(entry, "Science Desk")
    second = news_ingestion.normalize_news_entry(entry, "Science Desk")

    assert first == second
    assert first["event_type"] == "SCIENCE"
    assert first["source_url"] == "https://example.org/science/report"
    assert first["occurred_at"].isoformat() == "2026-10-02T10:00:00"
    assert (first["latitude"], first["longitude"]) == (51.5, -0.12)


def test_news_ingestion_deduplicates_and_isolates_feed_failures(
    client,
    monkeypatch,
):
    test_client, session_factory = client
    normalized = article()

    monkeypatch.setattr(
        news_ingestion,
        "NEWS_FEEDS",
        (
            {"source": "Unavailable", "url": "https://invalid.example/feed"},
            {"source": "BBC News", "url": "https://example.org/feed"},
        ),
    )

    def fetch_feed(feed):
        if feed["source"] == "Unavailable":
            raise ValueError("invalid XML")
        return [normalized]

    monkeypatch.setattr(news_ingestion, "fetch_news_feed", fetch_feed)

    first = test_client.post("/ingest/news")
    second = test_client.post("/ingest/news")

    assert first.status_code == 200
    assert first.json()["fetched"] == 1
    assert first.json()["inserted"] == 1
    assert first.json()["feed_errors"] == ["Unavailable: invalid XML"]
    assert second.status_code == 200
    assert second.json()["inserted"] == 0
    assert second.json()["skipped"] == 1

    with session_factory() as db:
        event = db.query(Event).filter(Event.category == "news").one()
        assert event.source_url == normalized["source_url"]
        assert event.event_type == "GENERAL"
        assert event.severity is None


def test_news_route_and_category_filter_return_source_url(client):
    test_client, session_factory = client
    normalized = article()
    with session_factory() as db:
        db.add(
            Event(
                source_event_id=normalized["source_event_id"],
                source=normalized["source"],
                title=normalized["title"],
                description=normalized["description"],
                category="news",
                event_type=normalized["event_type"],
                source_url=normalized["source_url"],
                occurred_at=normalized["occurred_at"],
            )
        )
        db.add(
            Event(
                source_event_id="eq-1",
                source="USGS",
                title="Earthquake",
                category="earthquake",
            )
        )
        db.commit()

    response = test_client.get("/news?limit=5")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["source_url"] == normalized["source_url"]
    assert len(test_client.get("/events?category=news").json()) == 1


def test_keyword_classification_has_non_ai_fallback():
    assert news_ingestion.classify_news_topic("A local report with no topic") == "GENERAL"
    assert news_ingestion.classify_news_topic("Markets react to inflation report") == "BUSINESS"
    assert news_ingestion.classify_news_topic(
        "Bollywood film earns award recognition"
    ) == "BOLLYWOOD"
    assert news_ingestion.classify_news_topic(
        "A local report with no topic",
        topic_hint="SPORTS",
    ) == "SPORTS"


def test_news_normalization_keeps_feed_image_and_topic_hint():
    entry = ElementTree.fromstring(
        """
        <item xmlns:media="http://search.yahoo.com/mrss/">
          <title>Championship results arrive</title>
          <link>https://example.org/sports/results</link>
          <media:thumbnail url="https://example.org/results.jpg" />
        </item>
        """
    )

    normalized = news_ingestion.normalize_news_entry(
        entry,
        "Sports Desk",
        topic_hint="SPORTS",
    )

    assert normalized["event_type"] == "SPORTS"
    assert normalized["image_url"] == "https://example.org/results.jpg"
