import { useEffect, useMemo, useState } from "react";
import WorldMap from "./WorldMap";
import "./App.css";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://127.0.0.1:8000" : "")
).replace(/\/+$/, "");
const DASHBOARD_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const DISCOVERY_CATEGORIES = [
  { id: "ALL", label: "For you", icon: "✦" },
  { id: "WORLD", label: "World", icon: "◎" },
  { id: "INDIA", label: "India", icon: "◈" },
  { id: "earthquake", label: "Earthquakes", icon: "⌁" },
  { id: "wildfire", label: "Wildfires", icon: "♨" },
  { id: "weather", label: "Weather", icon: "☼" },
  { id: "NEWS", label: "News", icon: "▤" },
  { id: "SPORTS", label: "Sports", icon: "◉" },
  { id: "BOLLYWOOD", label: "Bollywood", icon: "✧" },
  { id: "TECH", label: "Tech", icon: "⌘" },
  { id: "SCIENCE", label: "Science", icon: "⌬" },
  { id: "BUSINESS", label: "Business", icon: "↗" },
];

const NEWS_CATEGORIES = [
  { id: "TRENDING", label: "Trending", icon: "↗" },
  { id: "WORLD", label: "World", icon: "◎" },
  { id: "INDIA", label: "India", icon: "◈" },
  { id: "SPORTS", label: "Sports", icon: "◉" },
  { id: "BOLLYWOOD", label: "Bollywood", icon: "✧" },
  { id: "TECH", label: "Tech", icon: "⌘" },
  { id: "SCIENCE", label: "Science", icon: "⌬" },
  { id: "BUSINESS", label: "Business", icon: "↗" },
  { id: "CLIMATE", label: "Climate", icon: "⌁" },
  { id: "ENTERTAINMENT", label: "Entertainment", icon: "✦" },
];

const NEWS_SHELF_CATEGORIES = [
  "WORLD",
  "INDIA",
  "SPORTS",
  "BOLLYWOOD",
  "TECH",
  "SCIENCE",
  "BUSINESS",
  "CLIMATE",
];

function App() {
  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState([]);
  const [weather, setWeather] = useState([]);
  const [error, setError] = useState(null);
  const [weatherSignals, setWeatherSignals] = useState([]);
  const [wildfireIntelligence, setWildfireIntelligence] =
    useState(null);
  const [newsItems, setNewsItems] = useState([]);
  const [activityAnalytics, setActivityAnalytics] =
    useState(null);

  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [refreshError, setRefreshError] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeDiscoveryCategory, setActiveDiscoveryCategory] =
    useState("ALL");
  const [activeNewsCategory, setActiveNewsCategory] =
    useState("TRENDING");
  const [mapFocusTarget, setMapFocusTarget] = useState(null);
  const [loading, setLoading] = useState({
    summary: true,
    events: true,
    weather: true,
    wildfire: true,
    news: true,
  });

  /* =========================================================
     LOAD DASHBOARD DATA
  ========================================================= */

  useEffect(() => {
    let active = true;
    let hasCoreData = false;
    let refreshInProgress = false;
    let activeController;
    let timeoutId;

    const endpoints = [
      {
        label: "global summary",
        path: "/intelligence/summary",
        update: (data) => setSummary(requireObjectResponse(data)),
      },
      {
        label: "events",
        path: "/events?limit=2000",
        update: (data) =>
          setEvents(normalizeArrayResponse(data, "events")),
      },
      {
        label: "weather",
        path: "/weather/current",
        update: (data) =>
          setWeather(normalizeArrayResponse(data, "cities")),
      },
      {
        label: "weather signals",
        path: "/weather/signals",
        update: (data) =>
          setWeatherSignals(normalizeArrayResponse(data, "signals")),
      },
      {
        label: "wildfire intelligence",
        path: "/intelligence/wildfires",
        update: (data) =>
          setWildfireIntelligence(requireObjectResponse(data)),
      },
      {
        label: "news",
        path: "/news?limit=1000",
        update: (data) =>
          setNewsItems(normalizeArrayResponse(data, "news")),
      },
      {
        label: "activity analytics",
        path: "/intelligence/analytics",
        update: (data) =>
          setActivityAnalytics(requireObjectResponse(data)),
      },
    ];

    async function loadDashboard() {
      if (refreshInProgress) {
        return;
      }

      refreshInProgress = true;
      activeController = new AbortController();
      timeoutId = window.setTimeout(
        () => activeController?.abort(),
        30_000
      );
      const results = await Promise.allSettled(
        endpoints.map(async ({ path }) => {
          const response = await fetch(
            `${API_BASE_URL}${path}`,
            {
              signal: activeController.signal,
              cache: "no-store",
            }
          );
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          return response.json();
        })
      );

      window.clearTimeout(timeoutId);
      if (!active) {
        return;
      }

      const failures = [];
      const succeeded = new Set();

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          try {
            endpoints[index].update(result.value);
            succeeded.add(endpoints[index].label);
          } catch {
            failures.push(endpoints[index].label);
          }
        } else {
          failures.push(endpoints[index].label);
        }
        setLoading((current) => ({
          ...current,
          [endpoints[index].label === "global summary"
            ? "summary"
            : endpoints[index].label === "wildfire intelligence"
              ? "wildfire"
              : endpoints[index].label]: false,
        }));
      });

      const coreLoaded =
        succeeded.has("global summary") &&
        succeeded.has("events");

      if (coreLoaded) {
        hasCoreData = true;
        setError(null);
        setLastUpdatedAt(new Date());
        setCurrentTime(Date.now());
      } else if (!hasCoreData) {
        setError(
          "WorldPulse dashboard data is temporarily unavailable."
        );
      }

      setRefreshError(
        failures.length > 0
          ? `Some data could not be refreshed: ${failures.join(", ")}. Showing the latest available data.`
          : null
      );
      refreshInProgress = false;
    }

    void loadDashboard();
    const refreshTimer = window.setInterval(
      () => void loadDashboard(),
      DASHBOARD_REFRESH_INTERVAL_MS
    );

    return () => {
      active = false;
      activeController?.abort();
      window.clearTimeout(timeoutId);
      window.clearInterval(refreshTimer);
    };
  }, []);

  /* =========================================================
     FILTERED EVENTS
  ========================================================= */

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return events.filter((event) => {
      const matchesSeverity =
        severityFilter === "ALL" ||
        event.severity?.toUpperCase() ===
          severityFilter;

      if (!matchesSeverity) {
        return false;
      }

      const matchesCategory =
        categoryFilter === "ALL" ||
        event.category?.toLowerCase() === categoryFilter;

      if (!matchesCategory) {
        return false;
      }

      if (
        activeDiscoveryCategory === "INDIA" &&
        event.country?.toLowerCase() !== "india" &&
        !normalizeNewsCategory(event.event_type).includes("INDIA")
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchableText = [
        event.title,
        event.description,
        event.country,
        event.region,
        event.category,
        event.source,
        event.severity,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [
    events,
    severityFilter,
    categoryFilter,
    activeDiscoveryCategory,
    search,
  ]);

  const visibleNewsItems = useMemo(() => {
    if (activeNewsCategory === "TRENDING") {
      return newsItems;
    }

    return newsItems.filter(
      (article) =>
        normalizeNewsCategory(article.event_type) === activeNewsCategory
    );
  }, [activeNewsCategory, newsItems]);

  const newsShelves = useMemo(
    () =>
      NEWS_SHELF_CATEGORIES.map((category) => ({
        category,
        articles: newsItems
          .filter(
            (article) =>
              normalizeNewsCategory(article.event_type) === category
          )
          .slice(0, 12),
      })).filter(({ articles }) => articles.length > 0),
    [newsItems]
  );

  const scrollToSection = (sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  };

  const selectDiscoveryCategory = (category) => {
    setActiveDiscoveryCategory(category);

    const mapCategories = {
      earthquake: "earthquake",
      wildfire: "wildfire",
      weather: "weather",
    };
    setCategoryFilter(mapCategories[category] || "ALL");

    const newsCategory =
      category === "ALL" || category === "NEWS"
        ? "TRENDING"
        : category.toUpperCase();
    if (NEWS_CATEGORIES.some(({ id }) => id === newsCategory)) {
      setActiveNewsCategory(newsCategory);
    }

    scrollToSection(
      mapCategories[category] ? "global-map" : "news-discovery"
    );
  };

  const focusMapLocation = (latitude, longitude) => {
    setActiveDiscoveryCategory("wildfire");
    setCategoryFilter("wildfire");
    setMapFocusTarget({
      latitude,
      longitude,
    });
    scrollToSection("global-map");
  };

  /* =========================================================
     DERIVED INTELLIGENCE
  ========================================================= */

  const severityCounts =
    summary?.severity_counts || {};

  const highSeverity =
    (severityCounts.HIGH || 0) +
    (severityCounts.CRITICAL || 0);

  const totalEvents =
    summary?.total_events ||
    events.length ||
    0;

  const criticalCount =
    severityCounts.CRITICAL || 0;

  const highCount =
    severityCounts.HIGH || 0;

  const mediumCount =
    severityCounts.MEDIUM || 0;

  const lowCount =
    severityCounts.LOW || 0;

  const highPriorityPercentage =
    totalEvents > 0
      ? ((highSeverity / totalEvents) * 100).toFixed(1)
      : "0.0";

  /* =========================================================
   WHAT'S HAPPENING NOW
========================================================= */

/* =========================================================
   WHAT'S HAPPENING NOW
========================================================= */

const happeningNow = useMemo(() => {
  const validEvents = events.filter(
    (event) => event && event.id
  );

  if (validEvents.length === 0) {
    return [];
  }

  const severityRank = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  const getTime = (event) => {
    if (!event.occurred_at) {
      return 0;
    }

    const time = new Date(
      event.occurred_at
    ).getTime();

    return Number.isNaN(time) ? 0 : time;
  };

  const getSeverity = (event) =>
    severityRank[
      event.severity?.toUpperCase()
    ] || 0;

  const now = currentTime;

  const recent24h = validEvents.filter((event) => {
    const eventTime = getTime(event);

    if (!eventTime) {
      return false;
    }

    const hoursAgo =
      (now - eventTime) /
      (1000 * 60 * 60);

    return hoursAgo >= 0 && hoursAgo <= 24;
  });

  const recent48h = validEvents.filter((event) => {
    const eventTime = getTime(event);

    if (!eventTime) {
      return false;
    }

    const hoursAgo =
      (now - eventTime) /
      (1000 * 60 * 60);

    return hoursAgo >= 0 && hoursAgo <= 48;
  });

  const sourceEvents =
    recent24h.length >= 4
      ? recent24h
      : recent48h;

  return [...sourceEvents]
    .sort((a, b) => {
      const severityDifference =
        getSeverity(b) -
        getSeverity(a);

      if (severityDifference !== 0) {
        return severityDifference;
      }

      return getTime(b) - getTime(a);
    })
    .filter(
      (event, index, array) =>
        array.findIndex(
          (item) =>
            item.id === event.id
        ) === index
    )
    .slice(0, 4);
}, [events, currentTime]);

  const recentEvents = useMemo(
    () =>
      [...events]
        .sort((left, right) => {
          const leftTime = left.occurred_at
            ? new Date(left.occurred_at).getTime()
            : 0;
          const rightTime = right.occurred_at
            ? new Date(right.occurred_at).getTime()
            : 0;

          return (
            (Number.isFinite(rightTime) ? rightTime : 0) -
            (Number.isFinite(leftTime) ? leftTime : 0)
          );
        })
        .slice(0, 12),
    [events]
  );

  /* =========================================================
     CATEGORY ANALYSIS
  ========================================================= */

  const categoryStats = useMemo(() => {
    const counts = {};

    events.forEach((event) => {
      const category =
        event.category || "Other";

      counts[category] =
        (counts[category] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [events]);

  const maxCategoryCount =
    categoryStats[0]?.[1] || 1;

  /* =========================================================
     COUNTRY ANALYSIS
  ========================================================= */

  const countryStats = useMemo(() => {
    const counts = {};

    events.forEach((event) => {
      const country =
        event.country || "Unknown";

      counts[country] =
        (counts[country] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [events]);

  const wildfireHotspots = useMemo(() => {
    if (!Array.isArray(wildfireIntelligence?.top_hotspots)) {
      return [];
    }

    return wildfireIntelligence.top_hotspots
      .map((hotspot) => ({
        latitude: Number(hotspot.latitude),
        longitude: Number(hotspot.longitude),
        detections: Number(hotspot.detections || 0),
        total_frp_mw: Number(hotspot.total_frp_mw || 0),
        average_frp_mw: Number(hotspot.average_frp_mw || 0),
        satellites: Array.isArray(hotspot.satellites)
          ? hotspot.satellites
          : [],
      }))
      .filter(
        (hotspot) =>
          Number.isFinite(hotspot.latitude) &&
          Number.isFinite(hotspot.longitude)
      )
      .slice(0, 6);
  }, [wildfireIntelligence]);

  /* =========================================================
     HOTSPOTS
  ========================================================= */

  const hotspotStats = useMemo(() => {
    const counts = {};

    events.forEach((event) => {
      const region =
        event.region ||
        event.country ||
        "Unknown";

      if (!counts[region]) {
        counts[region] = {
          total: 0,
          high: 0,
          critical: 0,
        };
      }

      counts[region].total += 1;

      if (
        event.severity?.toUpperCase() ===
        "HIGH"
      ) {
        counts[region].high += 1;
      }

      if (
        event.severity?.toUpperCase() ===
        "CRITICAL"
      ) {
        counts[region].critical += 1;
      }
    });

    return Object.entries(counts)
      .sort((a, b) => {
        return b[1].total - a[1].total;
      })
      .slice(0, 6);
  }, [events]);

  /* =========================================================
     RECENT ACTIVITY
  ========================================================= */

  const recentActivity = useMemo(() => {
    const now = currentTime;

    const buckets = [
      {
        label: "0–6h",
        min: 0,
        max: 6,
      },
      {
        label: "6–12h",
        min: 6,
        max: 12,
      },
      {
        label: "12–18h",
        min: 12,
        max: 18,
      },
      {
        label: "18–24h",
        min: 18,
        max: 24,
      },
      {
        label: "24–48h",
        min: 24,
        max: 48,
      },
      {
        label: "48h+",
        min: 48,
        max: Infinity,
      },
    ];

    return buckets.map((bucket) => {
      const count = events.filter((event) => {
        if (!event.occurred_at) {
          return false;
        }

        const date =
          new Date(event.occurred_at);

        if (
          Number.isNaN(date.getTime())
        ) {
          return false;
        }

        const hoursAgo =
          (now - date.getTime()) /
          (1000 * 60 * 60);

        return (
          hoursAgo >= bucket.min &&
          hoursAgo < bucket.max
        );
      }).length;

      return {
        label: bucket.label,
        count,
      };
    });
  }, [events, currentTime]);

  const maxRecentActivity =
    Math.max(
      ...recentActivity.map(
        (item) => item.count
      ),
      1
    );

  /* =========================================================
     AI-STYLE SITUATION BRIEF
  ========================================================= */

  const situationBrief = useMemo(() => {
    const topCountry =
      countryStats[0]?.[0] ||
      "multiple regions";

    const topCountryCount =
      countryStats[0]?.[1] || 0;

    const topRegion =
      hotspotStats[0]?.[0] ||
      "multiple regions";

    let status = "MONITORING";
    let statusClass = "stable";

    if (criticalCount > 0) {
      status = "ELEVATED ACTIVITY";
      statusClass = "elevated";
    }

    if (
      criticalCount >= 3 ||
      Number(highPriorityPercentage) >= 8
    ) {
      status = "HIGH ATTENTION";
      statusClass = "high";
    }

    let headline =
      `${totalEvents} source-attributed event records are available in the monitored dataset.`;

    if (highSeverity > 0) {
      headline =
        `Stored event records include ${highSeverity} high- or critical-severity items.`;
    }

    let assessment =
      "Severity labels reflect the stored event classifications.";

    if (criticalCount > 0) {
      assessment =
        `${criticalCount} stored event${
          criticalCount > 1 ? "s" : ""
        } are classified as critical.`;
    } else if (highCount > 0) {
      assessment =
        `${highCount} stored event${highCount === 1 ? "" : "s"} are classified as high severity.`;
    }

    return {
      status,
      statusClass,
      headline,
      assessment,
      topCountry,
      topCountryCount,
      topRegion,
    };
  }, [
    countryStats,
    hotspotStats,
    criticalCount,
    highCount,
    highSeverity,
    highPriorityPercentage,
    totalEvents,
  ]);

  const globalBriefFacts = useMemo(() => {
    const facts = [];

    if (activityAnalytics) {
      facts.push(
        `${activityAnalytics.events_last_24h ?? 0} stored events occurred in the last 24 hours; ${activityAnalytics.events_last_7d ?? 0} occurred in the last 7 days.`
      );

      const leadingRegion =
        activityAnalytics.top_active_regions?.[0];
      if (leadingRegion) {
        facts.push(
          `${leadingRegion.region} has the highest recorded activity in the past 7 days (${leadingRegion.events_last_7d} events).`
        );
      }
    }

    if (wildfireIntelligence) {
      facts.push(
        `NASA FIRMS data includes ${wildfireIntelligence.valid_detections ?? wildfireIntelligence.total_detections ?? 0} valid satellite detections across ${wildfireIntelligence.hotspot_count ?? 0} activity hotspots.`
      );
    }

    if (weatherSignals.length > 0) {
      facts.push(
        `Weather analysis currently reports ${weatherSignals.length} signal${weatherSignals.length === 1 ? "" : "s"} across monitored cities.`
      );
    } else if (weather.length > 0) {
      facts.push(
        `Open-Meteo conditions are available for ${weather.length} monitored cities; no significant weather signals are reported.`
      );
    }

    const latestNews = newsItems[0];
    if (latestNews) {
      facts.push(
        `Latest stored news: “${latestNews.title}” (${latestNews.source}).`
      );
    }

    return facts;
  }, [
    activityAnalytics,
    newsItems,
    weather,
    weatherSignals,
    wildfireIntelligence,
  ]);

  return (
    <div className="app">

      {/* ===================================================
          HEADER
      =================================================== */}

      <header className="topbar">
        <div>
          <div className="brand">
            <span className="brand-mark">
              ◉
            </span>

            <span>
              WORLDPULSE
            </span>

            <span className="brand-ai">
              AI
            </span>
          </div>

          <p className="subtitle">
            Global Event Intelligence Platform
          </p>
        </div>

        <div className="live-status">
          <span className="live-dot"></span>
          LIVE
          <span className="last-updated">
            {lastUpdatedAt
              ? `Checked ${formatClockTime(lastUpdatedAt)}`
              : "Connecting"}
          </span>
        </div>
      </header>

      {refreshError && (
        <div className="refresh-status" role="status">
          {refreshError}
        </div>
      )}
      {error && (
        <div className="refresh-status connection-status" role="alert">
          {error} The dashboard will retry automatically.
        </div>
      )}

      <main className="dashboard">

        <section className="intro-hero">
          <div className="hero-copy">
            <span className="hero-kicker">A clearer view of a changing world</span>
            <h1>WORLD PULSE<span>.</span></h1>
            <p>Global signals. One place.</p>
            <div className="hero-actions">
              <button
                type="button"
                className="hero-cta"
                onClick={() => scrollToSection("global-map")}
              >
                Explore the world <span aria-hidden="true">↗</span>
              </button>
              <span className="hero-updated">
                {lastUpdatedAt
                  ? `Updated ${formatRelativeTime(lastUpdatedAt)}`
                  : "Waiting for live data"}
              </span>
            </div>
          </div>
          <div className="hero-orbit" aria-hidden="true">
            <span className="orbit-ring orbit-ring-outer" />
            <span className="orbit-ring orbit-ring-inner" />
            <span className="orbit-core">◉</span>
            <span className="orbit-signal signal-one" />
            <span className="orbit-signal signal-two" />
          </div>
        </section>

        <section className="live-stat-strip" aria-label="Live dashboard totals">
          <div className="live-stat">
            <span className="live-stat-dot cyan" />
            <strong>{summary ? totalEvents.toLocaleString() : "—"}</strong>
            <span>events tracked</span>
          </div>
          <div className="live-stat">
            <span className="live-stat-dot orange" />
            <strong>
              {wildfireIntelligence
                ? Number(wildfireIntelligence.total_detections ?? 0).toLocaleString()
                : "—"}
            </strong>
            <span>wildfire detections</span>
          </div>
          <div className="live-stat">
            <span className="live-stat-dot blue" />
            <strong>{weather.length || (loading.weather ? "—" : "0")}</strong>
            <span>cities monitored</span>
          </div>
          <div className="live-stat">
            <span className="live-stat-dot violet" />
            <strong>
              {loading.events && events.length === 0
                ? "—"
                : happeningNow.length.toLocaleString()}
            </strong>
            <span>active signals</span>
          </div>
        </section>

        <nav className="discovery-nav" aria-label="Explore categories">
          {DISCOVERY_CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`discovery-tab ${
                activeDiscoveryCategory === category.id ? "active" : ""
              }`}
              aria-pressed={activeDiscoveryCategory === category.id}
              onClick={() => selectDiscoveryCategory(category.id)}
            >
              <span aria-hidden="true">{category.icon}</span>
              {category.label}
            </button>
          ))}
        </nav>

        {/* =================================================
            GLOBAL EVENT MAP
        ================================================= */}

        {/* =================================================
    WHAT'S HAPPENING NOW
================================================= */}

<section className="panel happening-panel" id="live-signals">

<div className="panel-header">

  <div>
    <span className="eyebrow">
      LIVE INTELLIGENCE
    </span>

    <h2>
      What's Happening Now
    </h2>
  </div>

  <span className="panel-count">
    {happeningNow.length} signals
  </span>

</div>

<div className="happening-grid">

  {happeningNow.length > 0 ? happeningNow.map((event) => (

    <button
      key={event.id}
      className="happening-card"
      onClick={() =>
        setSelectedEvent(event)
      }
    >

      <div className="happening-card-top">

        <span
          className={`severity-badge ${
            event.severity?.toLowerCase() ||
            "low"
          }`}
        >
          {event.severity ||
            "UNKNOWN"}
        </span>

        <span className="happening-source">
          {event.source ||
            "WORLD"}
        </span>

      </div>

      <h3>
        {event.title ||
          "Global event detected"}
      </h3>

      <div className="happening-meta">

        <span>
          {event.country ||
            "Location unavailable"}
        </span>

        {event.region && (
          <>
            <span>•</span>

            <span>
              {event.region}
            </span>
          </>
        )}

      </div>

      <div className="happening-footer">

        <span>
          {event.occurred_at
            ? formatDate(
                event.occurred_at
              )
            : "Time unavailable"}
        </span>

        <span className="explore-arrow">
          EXPLORE →
        </span>

      </div>

    </button>

  )) : loading.events ? (
    Array.from({ length: 3 }, (_, index) => (
      <div className="happening-skeleton skeleton" key={index} />
    ))
  ) : (
    <div className="intentional-empty">
      <strong>Nothing is lighting up here yet.</strong>
      <span>Try another category or explore the global map.</span>
    </div>
  )}

</div>

</section>
<section className="panel weather-panel">
  <div className="panel-header">
    <div>
      <span className="eyebrow">LIVE WEATHER</span>
      <h2>Global Weather</h2>
    </div>

    <span className="panel-count">
      {weather.length} cities
    </span>
  </div>

  <div className="weather-grid">
    {loading.weather && weather.length === 0
      ? Array.from({ length: 5 }, (_, index) => (
          <div className="weather-skeleton skeleton" key={index} />
        ))
      : weather.length > 0 ? weather.map((city) => (
      <div
        className="weather-card"
        key={`${city.city}-${city.country}`}
      >
        <div className="weather-card-top">
          <div>
            <div className="weather-city">
              {city.city}
            </div>

            <div className="weather-country">
              {city.country}
            </div>
          </div>

          <div className="weather-temperature">
            {city.temperature_c}°C
          </div>
        </div>

        <div className="weather-condition">
          <span className="weather-icon" aria-hidden="true">
            {weatherIcon(city.weather_code)}
          </span>
          {weatherDescription(city.weather_code)}
        </div>

        <div className="weather-feels">
          Feels like {city.apparent_temperature_c}°C
        </div>

        <div className="weather-metrics">
          <span>
            💧 {city.relative_humidity}%
          </span>

          <span>
            💨 {city.wind_speed_kmh} km/h
          </span>

          <span>
            ☁️ {city.cloud_cover}%
          </span>
        </div>
      </div>
    )) : (
      <div className="intentional-empty weather-empty">
        <strong>Weather is taking a breather.</strong>
        <span>Live conditions will appear when the feed is available.</span>
      </div>
    )}
  </div>

  <div className="weather-source">
    Weather data: Open-Meteo · Updated from live forecast API
  </div>

  <div className="weather-signals">
  <div className="weather-signals-header">
    <div>
      <span className="eyebrow">WEATHER INTELLIGENCE</span>
      <h3>Weather Signals</h3>
    </div>

    <span className="panel-count">
      {weatherSignals.length} active
    </span>
  </div>

  {weatherSignals.length === 0 ? (
    <div className="weather-signals-empty">
      <span className="weather-signals-status">●</span>
      <div>
        <strong>No significant weather signals detected</strong>
        <p>
          Current conditions across monitored cities
          are below WorldPulse alert thresholds.
        </p>
      </div>
    </div>
  ) : (
    <div className="weather-signals-list">
      {weatherSignals.map((signal, index) => (
        <div
          className="weather-signal"
          key={`${signal.type}-${signal.location}-${index}`}
        >
          <div className="weather-signal-severity">
            {signal.severity}
          </div>

          <div className="weather-signal-content">
            <strong>{signal.type.replaceAll("_", " ")}</strong>
            <span>{signal.location}</span>
            <p>{signal.message}</p>
          </div>
        </div>
      ))}
    </div>
  )}
</div>

</section>

        <section className="panel news-panel" id="news-discovery">
          <div className="panel-header">
            <div>
              <span className="eyebrow">THE WORLD, YOUR WAY</span>
              <h2>Stories worth a closer look</h2>
              <p className="section-deck">
                Source-reported headlines from across the world, in one place.
              </p>
            </div>

            <span className="panel-count">
              {newsItems.length} stories
            </span>
          </div>

          <div className="news-category-rail" aria-label="News topics">
            {NEWS_CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`news-topic-tab ${
                  activeNewsCategory === category.id ? "active" : ""
                }`}
                aria-pressed={activeNewsCategory === category.id}
                onClick={() => {
                  setActiveNewsCategory(category.id);
                  const hasTopCategory = DISCOVERY_CATEGORIES.some(
                    ({ id }) => id === category.id
                  );
                  setActiveDiscoveryCategory(
                    hasTopCategory ? category.id : "NEWS"
                  );
                }}
              >
                <span aria-hidden="true">{category.icon}</span>
                {category.label}
              </button>
            ))}
          </div>

          {loading.news && newsItems.length === 0 ? (
            <div className="news-feature-layout" aria-label="Loading stories">
              <div className="news-feature-skeleton skeleton" />
              <div className="news-side-skeletons">
                <div className="news-side-skeleton skeleton" />
                <div className="news-side-skeleton skeleton" />
              </div>
            </div>
          ) : visibleNewsItems.length > 0 ? (
            <>
              <div className="news-feature-layout">
                <NewsStoryCard article={visibleNewsItems[0]} featured />
                <div className="news-feature-side">
                  {visibleNewsItems.slice(1, 4).map((article) => (
                    <NewsStoryCard article={article} key={article.id} compact />
                  ))}
                  {visibleNewsItems.length === 1 && (
                    <div className="news-side-note">
                      More stories are added as independent RSS sources refresh.
                    </div>
                  )}
                </div>
              </div>

              {activeNewsCategory === "TRENDING" ? (
                <div className="news-shelves">
                  {newsShelves.map(({ category, articles }) => (
                    <section className="news-shelf" key={category}>
                      <div className="news-shelf-heading">
                        <div>
                          <span className={`topic-pip topic-${category.toLowerCase()}`} />
                          <h3>{categoryTitle(category)}</h3>
                          <span>{articles.length} stories</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveNewsCategory(category);
                            const hasTopCategory = DISCOVERY_CATEGORIES.some(
                              ({ id }) => id === category
                            );
                            setActiveDiscoveryCategory(
                              hasTopCategory ? category : "NEWS"
                            );
                          }}
                        >
                          Explore <span aria-hidden="true">→</span>
                        </button>
                      </div>
                      <div className="news-card-rail">
                        {articles.map((article) => (
                          <NewsStoryCard
                            article={article}
                            key={article.id}
                            compact
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <section className="news-shelf filtered-news-shelf">
                  <div className="news-shelf-heading">
                    <div>
                      <span className={`topic-pip topic-${activeNewsCategory.toLowerCase()}`} />
                      <h3>{categoryTitle(activeNewsCategory)}</h3>
                      <span>{visibleNewsItems.length} stories</span>
                    </div>
                  </div>
                  {visibleNewsItems.length > 1 ? (
                    <div className="news-card-rail">
                      {visibleNewsItems.slice(1).map((article) => (
                        <NewsStoryCard
                          article={article}
                          key={article.id}
                          compact
                        />
                      ))}
                    </div>
                  ) : null}
                </section>
              )}
            </>
          ) : (
            <div className="news-empty-state">
              <strong>Nothing is lighting up here yet.</strong>
              <span>Try Trending or another topic. New stories arrive with the next feed update.</span>
            </div>
          )}

          <div className="news-source-note">
            Sources: BBC News · NPR · The Guardian · BBC Sport · India Today · The Indian Express ·
            The Indian Express Entertainment · The Hindu Movies · TechCrunch · ScienceDaily · BBC Business.
            Topic labels use transparent keyword rules and feed sections; weak matches stay General.
          </div>
        </section>

        <section className="panel wildfire-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">
                WILDFIRE PULSE · NASA FIRMS
              </span>

              <h2>Fire activity, in focus</h2>
            </div>

            <span className="panel-count">
              {wildfireIntelligence
                ? `${wildfireIntelligence.total_detections ?? 0} detections`
                : "Unavailable"}
            </span>
          </div>

          {wildfireIntelligence ? (
            <>
              <div className="wildfire-kpi-grid">
                <div className="wildfire-kpi-card">
                  <span className="kpi-label">
                    SATELLITE DETECTIONS
                  </span>

                  <strong>
                    {wildfireIntelligence.total_detections ?? 0}
                  </strong>

                  <span className="kpi-description">
                    Monitored across the active grid
                  </span>
                </div>

                <div className="wildfire-kpi-card">
                  <span className="kpi-label">
                    ACTIVITY HOTSPOTS
                  </span>

                  <strong>
                    {wildfireIntelligence.hotspot_count ?? 0}
                  </strong>

                  <span className="kpi-description">
                    Detection clusters identified
                  </span>
                </div>

                <div className="wildfire-kpi-card">
                  <span className="kpi-label">
                    HIGH-FRP DETECTIONS
                  </span>

                  <strong>
                    {wildfireIntelligence.high_frp_detections ?? 0}
                  </strong>

                  <span className="kpi-description">
                    Elevated fire radiative power
                  </span>
                </div>

                <div className="wildfire-kpi-card accent">
                  <span className="kpi-label">
                    TOTAL FRP
                  </span>

                  <strong>
                    {`${Number(
                      wildfireIntelligence.total_frp_mw ?? 0
                    ).toFixed(2)} MW`}
                  </strong>

                  <span className="kpi-description">
                    Combined fire power observed
                  </span>
                </div>
              </div>

              <div className="wildfire-hotspots">
                <div className="wildfire-hotspots-header">
                  <span className="eyebrow">
                    TOP WILDFIRE ACTIVITY
                  </span>
                </div>

                {wildfireHotspots.length > 0 ? (
                  <div className="wildfire-hotspot-list">
                    {wildfireHotspots.map((hotspot, index) => (
                      <button
                        type="button"
                        key={`${hotspot.latitude}-${hotspot.longitude}-${index}`}
                        className="wildfire-hotspot-item"
                        onClick={() =>
                          focusMapLocation(
                            hotspot.latitude,
                            hotspot.longitude
                          )
                        }
                        aria-label={`Explore wildfire hotspot at ${formatCoordinate(
                          hotspot.latitude,
                          "lat"
                        )}, ${formatCoordinate(hotspot.longitude, "lon")}`}
                      >
                        <div className="wildfire-hotspot-title">
                          {formatCoordinate(
                            hotspot.latitude,
                            "lat"
                          )} · {formatCoordinate(
                            hotspot.longitude,
                            "lon"
                          )}
                        </div>

                        <div className="wildfire-hotspot-metrics">
                          <span>
                            {hotspot.detections} detections
                          </span>

                          <span>
                            {`• ${Number(
                              hotspot.total_frp_mw
                            ).toFixed(2)} MW`}
                          </span>
                        </div>

                        <div className="wildfire-hotspot-average">
                          Avg FRP {Number(
                            hotspot.average_frp_mw
                          ).toFixed(2)} MW
                        </div>

                        {hotspot.satellites.length > 0 && (
                          <div className="wildfire-hotspot-satellites">
                            {hotspot.satellites.join(", ")}
                          </div>
                        )}
                        <span className="hotspot-action">
                          View on map <span aria-hidden="true">↗</span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="wildfire-empty-state">
                    <span className="wildfire-empty-status">
                      ●
                    </span>

                    <div>
                      <strong>
                        No significant wildfire hotspots detected
                      </strong>

                      <p>
                        Current satellite detections remain
                        below the monitored activity thresholds.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : loading.wildfire ? (
            <div className="wildfire-kpi-grid wildfire-loading-grid" aria-label="Loading wildfire intelligence">
              {Array.from({ length: 4 }, (_, index) => (
                <div className="wildfire-kpi-skeleton skeleton" key={index} />
              ))}
            </div>
          ) : (
            <div className="wildfire-empty-state">
              <span className="wildfire-empty-status">
                ●
              </span>

              <div>
                <strong>
                  Wildfire intelligence unavailable
                </strong>

                <p>
                  Satellite hotspot analysis is temporarily
                  unavailable. Monitoring remains active.
                </p>
              </div>
            </div>
          )}

          <div className="wildfire-source">
            Source: NASA FIRMS · VIIRS NOAA-21 NRT
          </div>
        </section>

        <section className="panel map-panel" id="global-map">

          <div className="panel-header">

            <div>
              <span className="eyebrow">
                GLOBAL MONITORING
              </span>

              <h2>
                Global Event Map
              </h2>
            </div>

            <span className="panel-count">
              {filteredEvents.length.toLocaleString()} events · {weather.length} live cities
            </span>

          </div>

          <div className="map-controls">

            <div className="severity-filters">

              {[
                "ALL",
                "LOW",
                "MEDIUM",
                "HIGH",
                "CRITICAL",
              ].map((severity) => (
                <button
                  key={severity}
                  className={`filter-button ${
                    severityFilter === severity
                      ? "active"
                      : ""
                  }`}
                  aria-pressed={severityFilter === severity}
                  onClick={() =>
                    setSeverityFilter(
                      severity
                    )
                  }
                >
                  {severity}
                </button>
              ))}

            </div>

            <label className="category-filter">
              <span>Category</span>
              <select
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(event.target.value)
                }
              >
                <option value="ALL">ALL CATEGORIES</option>
                <option value="earthquake">EARTHQUAKES</option>
                <option value="wildfire">WILDFIRES</option>
                <option value="weather">WEATHER</option>
                <option value="news">NEWS</option>
              </select>
            </label>

            <div className="event-search">

              <input
                type="text"
                placeholder="Search events, countries, regions..."
                aria-label="Search events, countries, and regions"
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
              />

            </div>

          </div>

          <WorldMap
            events={filteredEvents}
            severityFilter="ALL"
            onEventSelect={setSelectedEvent}
            focusLocation={mapFocusTarget}
          />

          <div className="map-legend" aria-label="Map marker categories">
            <span><i className="legend-dot earthquake" /> Earthquakes</span>
            <span><i className="legend-dot wildfire" /> Wildfires</span>
            <span><i className="legend-dot weather" /> Weather</span>
            <span><i className="legend-dot news" /> News</span>
          </div>

          <div className="map-source">
            Event sources include USGS earthquakes, NASA FIRMS detections,
            and RSS articles when location coordinates are available.
          </div>
        </section>

        <section className="panel recent-events-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">EVENT TIMELINE</span>
              <h2>Recent Events</h2>
            </div>

            <span className="panel-count">
              Newest first · {recentEvents.length} shown
            </span>
          </div>

          {recentEvents.length > 0 ? (
            <div className="recent-events-list">
              {recentEvents.map((event) => (
                <button
                  type="button"
                  className="recent-event-row"
                  key={event.id}
                  aria-label={`Open event details: ${event.title || "event"}`}
                  onClick={() => setSelectedEvent(event)}
                >
                  <span
                    className={`recent-event-marker ${
                      event.category?.toLowerCase() || "other"
                    }`}
                    aria-hidden="true"
                  />

                  <div className="recent-event-main">
                    <div className="recent-event-meta">
                      <span>
                        {(event.category || "event").toUpperCase()}
                      </span>
                      <span>{event.source || "Unknown source"}</span>
                      {(event.region || event.country) && (
                        <span>
                          {[event.region, event.country]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      )}
                    </div>
                    <strong>{event.title}</strong>
                  </div>

                  <time className="recent-event-time">
                    {event.occurred_at
                      ? formatDate(event.occurred_at)
                      : "Time unavailable"}
                  </time>
                </button>
              ))}
            </div>
          ) : (
            loading.events ? (
              <div className="timeline-skeleton-list" aria-label="Loading recent events">
                {Array.from({ length: 4 }, (_, index) => (
                  <div className="timeline-skeleton skeleton" key={index} />
                ))}
              </div>
            ) : (
              <div className="news-empty-state">
                Nothing is lighting up here yet. Try another category or return to Global.
              </div>
            )
          )}
        </section>

        {/* =================================================
            GLOBAL INTELLIGENCE BRIEF
        ================================================= */}

        <section
          className="panel global-brief-panel"
          style={{
            marginTop: "24px",
            background:
              "linear-gradient(135deg, rgba(12,18,30,.98), rgba(10,14,23,.98))",
          }}
        >

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "24px",
              flexWrap: "wrap",
            }}
          >

            <div
              style={{
                flex: 1,
                minWidth: "280px",
              }}
            >

              <span className="eyebrow">
                ◉ WORLD PULSE · SOURCE-BASED
              </span>

              <h2
                style={{
                  marginBottom: "12px",
                }}
              >
                What’s moving right now
              </h2>

              <p
                style={{
                  color: "#c5d0e3",
                  fontSize: "15px",
                  lineHeight: "1.7",
                  maxWidth: "850px",
                  margin: 0,
                }}
              >
                {situationBrief.headline}
              </p>

              <ul className="global-brief-facts">
                {globalBriefFacts.length > 0 ? (
                  globalBriefFacts.map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))
                ) : (
                  <li>
                    The brief will populate as verified event,
                    weather, wildfire, and news data become available.
                  </li>
                )}
              </ul>

              <div className="brief-source-chips" aria-label="Brief data sources">
                <span>USGS</span>
                <span>NASA FIRMS</span>
                <span>Open-Meteo</span>
                <span>RSS</span>
                <span>Observed data · Rule-based</span>
              </div>

            </div>

            <div
              style={{
                padding: "10px 16px",
                borderRadius: "8px",
                border:
                  "1px solid rgba(100,150,220,.25)",
                background:
                  "rgba(40,60,100,.15)",
                fontSize: "12px",
                letterSpacing: "1.5px",
                fontWeight: 700,
                color:
                  situationBrief.statusClass ===
                  "high"
                    ? "#ff914d"
                    : situationBrief.statusClass ===
                      "elevated"
                      ? "#e6c34a"
                      : "#55c59a",
              }}
            >
              ● {situationBrief.status}
            </div>

          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "14px",
              marginTop: "24px",
            }}
          >

            <BriefCard
              label="MOST RECORDED REGION"
              value={
                situationBrief.topRegion
              }
            />

            <BriefCard
              label="TOP COUNTRY"
              value={
                situationBrief.topCountry
              }
              sub={`${situationBrief.topCountryCount} events`}
            />

            <BriefCard
              label="HIGH PRIORITY"
              value={`${highPriorityPercentage}%`}
              sub="of monitored events"
            />

            <BriefCard
              label="ASSESSMENT"
              value={
                situationBrief.assessment
              }
              compact
            />

          </div>

        </section>

        <section className="panel trends-panel" id="activity-trends">
          <div className="panel-header">
            <div>
              <span className="eyebrow">OBSERVED ACTIVITY</span>
              <h2>Event Trends</h2>
            </div>
            <span className="panel-count">
              Deterministic · Based on stored events
            </span>
          </div>

          <div className="trend-metrics">
            <div className="trend-metric">
              <span>LAST 24 HOURS</span>
              <strong>
                {activityAnalytics?.events_last_24h ?? 0}
              </strong>
            </div>
            <div className="trend-metric">
              <span>LAST 7 DAYS</span>
              <strong>
                {activityAnalytics?.events_last_7d ?? 0}
              </strong>
            </div>
          </div>

          <div className="trend-columns">
            <div>
              <h3>Most active regions · 7 days</h3>
              {(activityAnalytics?.top_active_regions || []).length > 0 ? (
                <div className="trend-list">
                  {activityAnalytics.top_active_regions.map((region) => (
                    <div className="trend-row" key={region.region}>
                      <span>{region.region}</span>
                      <strong>{region.events_last_7d}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="trend-empty">
                  No recent events have a known region or country.
                </p>
              )}
            </div>

            <div>
              <h3>Emerging activity · 7-day comparison</h3>
              {(activityAnalytics?.emerging_regions || []).length > 0 ? (
                <div className="trend-list">
                  {activityAnalytics.emerging_regions.map((region) => (
                    <div className="trend-row" key={region.region}>
                      <span>{region.region}</span>
                      <strong>
                        +{region.change} · {region.events_last_7d} total
                      </strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="trend-empty">
                  No regions currently show an increase over the prior
                  7-day period.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* =================================================
            ANALYTICS GRID
        ================================================= */}

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(420px, 100%), 1fr))",
            gap: "24px",
            marginTop: "24px",
          }}
        >

          {/* ACTIVITY TIMELINE */}

          <div className="panel">

            <div className="panel-header">

              <div>
                <span className="eyebrow">
                  TEMPORAL ANALYSIS
                </span>

                <h2>
                  Activity Timeline
                </h2>
              </div>

              <span className="panel-count">
                48 hour view
              </span>

            </div>

            <div
              style={{
                height: "220px",
                display: "flex",
                alignItems: "flex-end",
                gap: "12px",
                padding:
                  "20px 10px 8px",
              }}
            >

              {recentActivity.map(
                (item) => {
                  const height =
                    Math.max(
                      (item.count /
                        maxRecentActivity) *
                        160,
                      item.count > 0
                        ? 8
                        : 3
                    );

                  return (
                    <div
                      key={item.label}
                      style={{
                        flex: 1,
                        height: "100%",
                        display: "flex",
                        flexDirection:
                          "column",
                        justifyContent:
                          "flex-end",
                        alignItems:
                          "center",
                        gap: "8px",
                      }}
                    >

                      <span
                        style={{
                          fontSize: "11px",
                          color: "#8ca0bc",
                        }}
                      >
                        {item.count}
                      </span>

                      <div
                        style={{
                          width: "100%",
                          maxWidth: "54px",
                          height:
                            `${height}px`,
                          borderRadius:
                            "5px 5px 2px 2px",
                          background:
                            "linear-gradient(180deg, #718cff, #405a9e)",
                          boxShadow:
                            "0 0 18px rgba(113,140,255,.12)",
                        }}
                      />

                      <span
                        style={{
                          fontSize: "10px",
                          color: "#667895",
                        }}
                      >
                        {item.label}
                      </span>

                    </div>
                  );
                }
              )}

            </div>

          </div>

          {/* CATEGORY DISTRIBUTION */}

          <div className="panel">

            <div className="panel-header">

              <div>
                <span className="eyebrow">
                  EVENT CLASSIFICATION
                </span>

                <h2>
                  Event Categories
                </h2>
              </div>

            </div>

            <div
              style={{
                display: "flex",
                flexDirection:
                  "column",
                gap: "16px",
                marginTop: "8px",
              }}
            >

              {categoryStats.length ===
              0 ? (
                <p
                  style={{
                    color: "#71809a",
                  }}
                >
                  No category data
                  available.
                </p>
              ) : (
                categoryStats.map(
                  ([category, count]) => {
                    const percentage =
                      (count /
                        maxCategoryCount) *
                      100;

                    return (
                      <div
                        key={category}
                      >

                        <div
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            marginBottom:
                              "7px",
                          }}
                        >

                          <span
                            style={{
                              color:
                                "#b9c7dc",
                              fontSize:
                                "13px",
                            }}
                          >
                            {category}
                          </span>

                          <strong
                            style={{
                              color:
                                "#eef4ff",
                              fontSize:
                                "13px",
                            }}
                          >
                            {count}
                          </strong>

                        </div>

                        <div
                          style={{
                            height: "6px",
                            background:
                              "#171e2a",
                            borderRadius:
                              "10px",
                            overflow:
                              "hidden",
                          }}
                        >

                          <div
                            style={{
                              width:
                                `${percentage}%`,
                              height: "100%",
                              borderRadius:
                                "10px",
                              background:
                                "linear-gradient(90deg, #536ed0, #718cff)",
                            }}
                          />

                        </div>

                      </div>
                    );
                  }
                )
              )}

            </div>

          </div>

        </section>

        {/* =================================================
            SEVERITY + COUNTRIES
        ================================================= */}

        <section className="main-grid">

          {/* SEVERITY */}

          <div className="panel">

            <div className="panel-header">

              <div>
                <span className="eyebrow">
                  EVENT ANALYSIS
                </span>

                <h2>
                  Severity Overview
                </h2>
              </div>

              <span className="panel-count">
                {highSeverity} high priority
              </span>

            </div>

            <div className="severity-list">

              <SeverityRow
                label="LOW"
                count={lowCount}
                total={totalEvents}
                className="low"
              />

              <SeverityRow
                label="MEDIUM"
                count={mediumCount}
                total={totalEvents}
                className="medium"
              />

              <SeverityRow
                label="HIGH"
                count={highCount}
                total={totalEvents}
                className="high"
              />

              <SeverityRow
                label="CRITICAL"
                count={criticalCount}
                total={totalEvents}
                className="critical"
              />

            </div>

          </div>

          {/* COUNTRIES */}

          <div className="panel">

            <div className="panel-header">

              <div>
                <span className="eyebrow">
                  GEOGRAPHIC ANALYSIS
                </span>

                <h2>
                  Top Countries
                </h2>
              </div>

            </div>

            <div className="ranking-list">

              {(summary?.top_countries ||
                []).map(
                (country, index) => {
                  const topCount =
                    summary?.top_countries?.[0]
                      ?.event_count || 1;

                  const percentage =
                    (country.event_count /
                      topCount) *
                    100;

                  return (
                    <div
                      className="ranking-row"
                      key={
                        country.country
                      }
                    >

                      <span className="rank">
                        {String(
                          index + 1
                        ).padStart(
                          2,
                          "0"
                        )}
                      </span>

                      <span className="ranking-name">
                        {country.country}
                      </span>

                      <div className="ranking-bar">

                        <div
                          className="ranking-fill"
                          style={{
                            width:
                              `${percentage}%`,
                          }}
                        />

                      </div>

                      <strong>
                        {
                          country.event_count
                        }
                      </strong>

                    </div>
                  );
                }
              )}

            </div>

          </div>

        </section>

        {/* =================================================
            EVENT CONCENTRATION
        ================================================= */}

        <section className="panel">

          <div className="panel-header">

            <div>
              <span className="eyebrow">
                ACTIVITY CONCENTRATION
              </span>

              <h2>
                Most Recorded Regions
              </h2>
            </div>

            <span className="panel-count">
              Ranked by stored event volume
            </span>

          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "14px",
            }}
          >

            {hotspotStats.map(
              ([region, stats], index) => (
                <div
                  key={region}
                  style={{
                    border:
                      "1px solid rgba(100,120,150,.16)",
                    borderRadius: "10px",
                    padding: "18px",
                    background:
                      "rgba(12,18,28,.65)",
                  }}
                >

                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      marginBottom:
                        "18px",
                    }}
                  >

                    <span
                      style={{
                        fontSize: "11px",
                        color: "#5f7492",
                        letterSpacing:
                          "1px",
                      }}
                    >
                      #{index + 1}
                    </span>

                    {(stats.critical >
                      0 ||
                      stats.high > 0) && (
                      <span
                        style={{
                          fontSize: "10px",
                          color:
                            stats.critical >
                            0
                              ? "#ff4d5e"
                              : "#ff914d",
                          letterSpacing:
                            "1px",
                          fontWeight: 700,
                        }}
                      >
                        HIGH / CRITICAL
                      </span>
                    )}

                  </div>

                  <h3
                    style={{
                      margin:
                        "0 0 10px",
                      fontSize: "16px",
                      color:
                        "#eaf1ff",
                    }}
                  >
                    {region}
                  </h3>

                  <div
                    style={{
                      display: "flex",
                      gap: "18px",
                    }}
                  >

                    <span
                      style={{
                        color: "#7387a4",
                        fontSize:
                          "12px",
                      }}
                    >
                      <strong
                        style={{
                          color:
                            "#dfe8f7",
                          fontSize:
                            "18px",
                        }}
                      >
                        {stats.total}
                      </strong>{" "}
                      events
                    </span>

                    <span
                      style={{
                        color: "#7387a4",
                        fontSize:
                          "12px",
                      }}
                    >
                      <strong
                        style={{
                          color:
                            "#ff914d",
                          fontSize:
                            "18px",
                        }}
                      >
                        {stats.high +
                          stats.critical}
                      </strong>{" "}
                      high / critical
                    </span>

                  </div>

                </div>
              )
            )}

          </div>

        </section>

        {/* =================================================
            TOP REGIONS
        ================================================= */}

        <section className="panel">

          <div className="panel-header">

            <div>
              <span className="eyebrow">
                REGIONAL ACTIVITY
              </span>

              <h2>
                Top Regions
              </h2>
            </div>

          </div>

          <div className="region-grid">

            {(summary?.top_regions ||
              []).map(
              (region, index) => (
                <div
                  className="region-card"
                  key={region.region}
                >

                  <span className="region-rank">
                    #{index + 1}
                  </span>

                  <span className="region-name">
                    {region.region}
                  </span>

                  <strong>
                    {region.event_count}
                  </strong>

                  <span className="region-events">
                    events
                  </span>

                </div>
              )
            )}

          </div>

        </section>

        {/* =================================================
            PRIORITY FEED
        ================================================= */}

        <section className="panel events-panel">

          <div className="panel-header">

            <div>
              <span className="eyebrow">
                PRIORITY FEED
              </span>

              <h2>
                Recent High-Severity Events
              </h2>
            </div>

            <span className="panel-count">
              {
                summary?.recent_high_severity_events
                  ?.length || 0
              } events
            </span>

          </div>

          <div className="events-list">

            {(
              summary?.recent_high_severity_events ||
              []
            ).map((event) => (

              <div
                className="event-row"
                key={event.id}
                onClick={() =>
                  setSelectedEvent(event)
                }
              >

                <div
                  className={`severity-indicator ${
                    event.severity?.toLowerCase()
                  }`}
                />

                <div className="event-main">

                  <div className="event-topline">

                    <span
                      className={`severity-badge ${
                        event.severity?.toLowerCase()
                      }`}
                    >
                      {event.severity}
                    </span>

                    <span className="event-id">
                      EVENT #{event.id}
                    </span>

                  </div>

                  <h3>
                    {event.title}
                  </h3>

                  <div className="event-meta">

                    <span>
                      {event.country ||
                        "Location unavailable"}
                    </span>

                    <span>•</span>

                    <span>
                      {event.region ||
                        "Region unavailable"}
                    </span>

                    {event.occurred_at && (
                      <>
                        <span>•</span>

                        <span>
                          {formatDate(
                            event.occurred_at
                          )}
                        </span>
                      </>
                    )}

                  </div>

                </div>

                <div className="quality">

                  <span>
                    DATA QUALITY
                  </span>

                  <strong>
                    {event.data_quality_score !=
                    null
                      ? Math.round(
                          event.data_quality_score *
                            100
                        )
                      : "—"}

                    {event.data_quality_score !=
                    null
                      ? "%"
                      : ""}
                  </strong>

                </div>

              </div>

            ))}

          </div>

        </section>

      </main>

      {/* =====================================================
          EVENT INTELLIGENCE MODAL
      ===================================================== */}

      {selectedEvent && (
        <div
          className="event-modal-backdrop"
          onClick={() =>
            setSelectedEvent(null)
          }
        >

          <div
            className="event-modal intelligence-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* CLOSE */}

            <button
              className="modal-close"
              onClick={() =>
                setSelectedEvent(null)
              }
              aria-label="Close event details"
            >
              ×
            </button>

            {/* HEADER */}

            <div className="modal-header">

              <div className="modal-event-status">

                <span
                  className={`severity-badge ${
                    selectedEvent.severity?.toLowerCase() ||
                    "low"
                  }`}
                >
                  {selectedEvent.severity ||
                    "UNKNOWN"}
                </span>

                <span className="event-id">
                  EVENT #{selectedEvent.id}
                </span>

              </div>

              <span className="modal-source">
                {selectedEvent.source ||
                  "Unknown Source"}
              </span>

            </div>

            {/* TITLE */}

            <h2 className="modal-title">
              {selectedEvent.title ||
                "Untitled Event"}
            </h2>

            {/* LOCATION */}

            <div className="modal-location">

              <span className="location-icon">
                ◎
              </span>

              <span>
                {selectedEvent.country ||
                  "Location unavailable"}

                {selectedEvent.region
                  ? ` · ${selectedEvent.region}`
                  : ""}
              </span>

            </div>

            {/* =================================================
                RULE-BASED EVENT ASSESSMENT
            ================================================= */}

            <section className="intelligence-section assessment-section">

              <div className="intelligence-section-header">

                <div>
                  <span className="eyebrow">
                    RULE-BASED ASSESSMENT
                  </span>

                  <h3>
                    Event Assessment
                  </h3>
                </div>

                <span className="ai-indicator">
                  ● DERIVED
                </span>

              </div>

              <div className="assessment-box">

                <div className="assessment-icon">
                  ✦
                </div>

                <div>

                  <strong>
                    {getAssessmentTitle(
                      selectedEvent
                    )}
                  </strong>

                  <p>
                    {getAssessmentText(
                      selectedEvent
                    )}
                  </p>

                </div>

              </div>

            </section>

            {/* =================================================
                WHY IT MATTERS
            ================================================= */}

            <section className="intelligence-section">

              <div className="intelligence-section-header">

                <div>
                  <span className="eyebrow">
                    SOURCE-BASED CONTEXT
                  </span>

                  <h3>
                    Event Context
                  </h3>
                </div>

              </div>

              <p className="why-matters-text">
                {getWhyItMatters(
                  selectedEvent
                )}
              </p>

            </section>
{/* =================================================
    EVENT DETAILS
================================================= */}

<section className="intelligence-section">

  <div className="intelligence-section-header">

    <div>
      <span className="eyebrow">
        EVENT INFORMATION
      </span>

      <h3>
        Event Details
      </h3>
    </div>

  </div>

  {/* CORE EVENT INFORMATION */}

  <div className="modal-grid">

    <DetailItem
      label="Country"
      value={
        selectedEvent.country ||
        "Unavailable"
      }
    />

    <DetailItem
      label="Region"
      value={
        selectedEvent.region ||
        "Unavailable"
      }
    />

    <DetailItem
      label="Category"
      value={
        selectedEvent.category ||
        "Unknown"
      }
    />

    <DetailItem
      label="Event Type"
      value={
        selectedEvent.event_type ||
        "Unknown"
      }
    />

    <DetailItem
      label="Source"
      value={
        selectedEvent.source ||
        "Unknown"
      }
    />

    <DetailItem
      label="Source Event ID"
      value={
        selectedEvent.source_event_id ||
        "Unavailable"
      }
    />

    <DetailItem
      label="Coordinates"
      value={
        selectedEvent.latitude != null &&
        selectedEvent.longitude != null
          ? `${Number(
              selectedEvent.latitude
            ).toFixed(3)}, ${Number(
              selectedEvent.longitude
            ).toFixed(3)}`
          : "Unavailable"
      }
    />

    <DetailItem
      label="Occurred"
      value={formatDate(
        selectedEvent.occurred_at
      )}
    />

  </div>


  {/* =================================================
      USGS EARTHQUAKE DATA
  ================================================= */}

  {selectedEvent.source === "USGS" && (
    <>

      <div
        style={{
          marginTop: "22px",
          marginBottom: "12px",
          fontSize: "10px",
          letterSpacing: "1.3px",
          color: "#617694",
          fontWeight: 700,
        }}
      >
        USGS SEISMIC DATA
      </div>

      <div className="modal-grid">

        <DetailItem
          label="Magnitude"
          value={
            selectedEvent.magnitude != null
              ? Number(
                  selectedEvent.magnitude
                ).toFixed(2)
              : "Unavailable"
          }
        />

        <DetailItem
          label="Magnitude Type"
          value={
            selectedEvent.magnitude_type ||
            "Unavailable"
          }
        />

        <DetailItem
          label="Depth"
          value={
            selectedEvent.depth_km != null
              ? `${Number(
                  selectedEvent.depth_km
                ).toFixed(2)} km`
              : "Unavailable"
          }
        />

        <DetailItem
          label="Tsunami"
          value={
            selectedEvent.tsunami === 1
              ? "Yes"
              : selectedEvent.tsunami === 0
                ? "No"
                : "Unavailable"
          }
        />

        <DetailItem
          label="Alert"
          value={
            selectedEvent.alert
              ? selectedEvent.alert.toUpperCase()
              : "No alert"
          }
        />

        <DetailItem
          label="Significance"
          value={
            selectedEvent.significance != null
              ? selectedEvent.significance
              : "Unavailable"
          }
        />

      </div>


      {/* USGS SOURCE LINK */}

      {selectedEvent.usgs_url && (
        <div
          style={{
            marginTop: "18px",
            paddingTop: "16px",
            borderTop:
              "1px solid rgba(100,120,150,.12)",
          }}
        >
          <a
            href={selectedEvent.usgs_url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              color: "#8ca8ff",
              fontSize: "12px",
              fontWeight: 700,
              textDecoration: "none",
              letterSpacing: ".3px",
            }}
          >
            VIEW USGS EVENT RECORD ↗
          </a>
        </div>
      )}

    </>
  )}

</section>

            <section className="intelligence-section">

              <div className="intelligence-section-header">

                <div>
                  <span className="eyebrow">
                    DATA SIGNAL
                  </span>

                  <h3>
                    Confidence & Quality
                  </h3>
                </div>

              </div>

              <div className="signal-grid">

                <SignalCard
                  label="CONFIDENCE"
                  value={formatConfidence(
                    selectedEvent.confidence
                  )}
                  description="Source confidence"
                />

                <SignalCard
                  label="DATA QUALITY"
                  value={
                    selectedEvent.data_quality_score !=
                    null
                      ? `${Math.round(
                          selectedEvent.data_quality_score *
                            100
                        )}%`
                      : "—"
                  }
                  description="Event data quality"
                />

                <SignalCard
                  label="SEVERITY"
                  value={
                    selectedEvent.severity ||
                    "UNKNOWN"
                  }
                  description="Current classification"
                />

              </div>

            </section>

            {/* =================================================
                TIMELINE
            ================================================= */}

            <section className="intelligence-section">

              <div className="intelligence-section-header">

                <div>
                  <span className="eyebrow">
                    EVENT CHRONOLOGY
                  </span>

                  <h3>
                    Timeline
                  </h3>
                </div>

              </div>

              <div className="event-timeline">

                <TimelineItem
                  label="Occurred"
                  value={formatDate(
                    selectedEvent.occurred_at
                  )}
                  active
                />

                <TimelineItem
                  label="Detected"
                  value={formatDate(
                    selectedEvent.detected_at
                  )}
                  active={
                    Boolean(
                      selectedEvent.detected_at
                    )
                  }
                />

                <TimelineItem
                  label="Created"
                  value={formatDate(
                    selectedEvent.created_at
                  )}
                  active={
                    Boolean(
                      selectedEvent.created_at
                    )
                  }
                />

              </div>

            </section>

            {/* =================================================
                DESCRIPTION
            ================================================= */}

            {selectedEvent.description && (
              <section className="intelligence-section">

                <div className="intelligence-section-header">

                  <div>
                    <span className="eyebrow">
                      SOURCE DESCRIPTION
                    </span>

                    <h3>
                      Event Description
                    </h3>
                  </div>

                </div>

                <p className="modal-description">
                  {selectedEvent.description}
                </p>

              </section>
            )}

            {/* =================================================
                MODAL FOOTER
            ================================================= */}

            <div className="modal-footer">

              <span>
                WORLDPULSE INTELLIGENCE ENGINE
              </span>

              <span>
                Event #{selectedEvent.id}
              </span>

            </div>

          </div>

        </div>
      )}

      {/* =====================================================
          FOOTER
      ===================================================== */}

      <footer>

        <span>
          WORLDPULSE AI v0.2.0
        </span>

        <span>
          Powered by real-time global event data
        </span>

      </footer>

    </div>
  );
}

/* =========================================================
   BRIEF CARD
========================================================= */

function BriefCard({
  label,
  value,
  sub,
  compact = false,
}) {
  return (
    <div
      style={{
        padding: "17px",
        borderRadius: "9px",
        border:
          "1px solid rgba(100,120,150,.15)",
        background:
          "rgba(15,22,34,.72)",
        minHeight: compact
          ? "85px"
          : "70px",
      }}
    >

      <span
        style={{
          display: "block",
          fontSize: "10px",
          letterSpacing: "1.3px",
          color: "#617694",
          marginBottom: "9px",
        }}
      >
        {label}
      </span>

      <strong
        style={{
          display: "block",
          color: "#e8f0ff",
          fontSize: compact
            ? "12px"
            : "19px",
          lineHeight: compact
            ? "1.5"
            : "1.2",
          fontWeight: compact
            ? 500
            : 700,
        }}
      >
        {value}
      </strong>

      {sub && (
        <span
          style={{
            display: "block",
            marginTop: "6px",
            color: "#647996",
            fontSize: "11px",
          }}
        >
          {sub}
        </span>
      )}

    </div>
  );
}

function NewsStoryCard({ article, featured = false, compact = false }) {
  const category = normalizeNewsCategory(article.event_type);
  const summary = article.description?.trim();

  return (
    <article
      className={`news-story-card topic-${category.toLowerCase()} ${
        featured ? "featured" : ""
      } ${compact ? "compact" : ""}`}
    >
      <div className="news-story-art">
        {article.image_url ? (
          <img
            src={article.image_url}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="news-art-mark" aria-hidden="true">
            {category === "WILDFIRES" ? "♨" : "◉"}
          </span>
        )}
        {featured && <span className="featured-label">FEATURED STORY</span>}
      </div>

      <div className="news-story-body">
        <div className="news-story-meta">
          <span className={`news-topic-pill topic-${category.toLowerCase()}`}>
            {categoryTitle(category)}
          </span>
          <span className="news-story-source">{article.source}</span>
          <time dateTime={article.occurred_at || undefined}>
            {formatRelativeTime(article.occurred_at)}
          </time>
        </div>

        <h3>{article.title}</h3>

        {summary && (
          <p>
            {summary.length > (featured ? 260 : 180)
              ? `${summary.slice(0, featured ? 257 : 177).trimEnd()}…`
              : summary}
          </p>
        )}

        {article.source_url && (
          <a
            className="news-read-link"
            href={article.source_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Read story <span aria-hidden="true">↗</span>
          </a>
        )}
      </div>
    </article>
  );
}

/* =========================================================
   SEVERITY ROW
========================================================= */

function SeverityRow({
  label,
  count,
  total,
  className,
}) {
  const percentage =
    total > 0
      ? (count / total) * 100
      : 0;

  return (
    <div className="severity-row">

      <div className="severity-info">

        <span
          className={`severity-dot ${className}`}
        />

        <span>
          {label}
        </span>

        <strong>
          {count}
        </strong>

      </div>

      <div className="severity-bar">

        <div
          className={`severity-fill ${className}`}
          style={{
            width:
              `${percentage}%`,
          }}
        />

      </div>

      <span className="percentage">
        {percentage.toFixed(1)}%
      </span>

    </div>
  );
}

/* =========================================================
   DETAIL ITEM
========================================================= */

function DetailItem({
  label,
  value,
}) {
  return (
    <div className="detail-item">

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

    </div>
  );
}

/* =========================================================
   SIGNAL CARD
========================================================= */

function SignalCard({
  label,
  value,
  description,
}) {
  return (
    <div className="signal-card">

      <span className="signal-label">
        {label}
      </span>

      <strong>
        {value}
      </strong>

      <span className="signal-description">
        {description}
      </span>

    </div>
  );
}

/* =========================================================
   TIMELINE ITEM
========================================================= */

function TimelineItem({
  label,
  value,
  active = false,
}) {
  return (
    <div
      className={`timeline-item ${
        active ? "active" : ""
      }`}
    >

      <div className="timeline-marker">
        <span />
      </div>

      <div className="timeline-content">

        <span>
          {label}
        </span>

        <strong>
          {value}
        </strong>

      </div>

    </div>
  );
}

/* =========================================================
   EVENT ASSESSMENT HELPERS
========================================================= */

function getAssessmentTitle(event) {
  const severity =
    event?.severity?.toUpperCase();

  if (severity === "CRITICAL") {
    return "Critical event requiring immediate attention";
  }

  if (severity === "HIGH") {
    return "High-priority event requiring monitoring";
  }

  if (severity === "MEDIUM") {
    return "Moderate event requiring continued observation";
  }

  if (severity === "LOW") {
    return "Low-severity event currently under monitoring";
  }

  return "Event classification available";
}


function getAssessmentText(event) {
  const severity =
    event?.severity?.toUpperCase();

  const category =
    event?.category || "event";

  const country =
    event?.country ||
    "an unspecified location";

  if (severity === "CRITICAL") {
    return `This ${category} event has been classified as critical. Activity in ${country} should be monitored closely for further developments, escalation, or related events.`;
  }

  if (severity === "HIGH") {
    return `This ${category} event has been classified as high severity. Continued monitoring is recommended, particularly for additional activity or changes in the affected region.`;
  }

  if (severity === "MEDIUM") {
    return `This ${category} event represents a moderate intelligence signal. Monitoring the surrounding region may help identify whether the activity is isolated or developing into a broader pattern.`;
  }

  return `This ${category} event is currently classified as low severity. It remains part of the monitored global event picture and can provide useful context when combined with related events.`;
}


function getWhyItMatters(event) {
  const category =
    event?.category?.toLowerCase() ||
    "event";

  const country =
    event?.country ||
    "the affected area";

  const region =
    event?.region ||
    "the surrounding region";

  if (
    category.includes("earthquake")
  ) {
    return `Seismic activity in ${country} can provide an early signal of changing conditions in ${region}. Individual events may be low impact, but clusters or increasing magnitude can warrant closer observation.`;
  }

  if (
    category.includes("conflict") ||
    category.includes("war") ||
    category.includes("military")
  ) {
    return `Events of this type can indicate changing security conditions in ${region}. Monitoring additional events can help determine whether the activity is isolated or part of a broader pattern.`;
  }

  if (
    category.includes("weather") ||
    category.includes("storm") ||
    category.includes("flood")
  ) {
    return `This event may indicate changing environmental conditions in ${region}. Additional events in the same area can help establish whether the situation is developing or remaining localized.`;
  }

  if (
    category.includes("fire") ||
    category.includes("wildfire")
  ) {
    return `Activity of this type can evolve rapidly and may affect surrounding areas. Continued monitoring of ${region} can help identify changes in scale or severity.`;
  }

  return `This event contributes to the broader WorldPulse intelligence picture for ${country} and ${region}. Its significance can increase when combined with related events, geographic clustering, or changes in severity.`;
}

/* =========================================================
   HELPERS
========================================================= */

function normalizeArrayResponse(data, property) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.[property])) {
    return data[property];
  }

  throw new Error(`Expected an array response or a ${property} array.`);
}

function requireObjectResponse(data) {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data;
  }

  throw new Error("Expected an object response.");
}

function formatConfidence(
  confidence
) {
  if (
    confidence === null ||
    confidence === undefined
  ) {
    return "Unavailable";
  }

  const value =
    Number(confidence);

  if (Number.isNaN(value)) {
    return "Unavailable";
  }

  return `${Math.round(
    value * 100
  )}%`;
}

function formatCoordinate(value, axis) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "—";
  }

  const absoluteValue = Math.abs(numericValue).toFixed(2);

  if (axis === "lat") {
    return `${absoluteValue}°${numericValue >= 0 ? "N" : "S"}`;
  }

  return `${absoluteValue}°${numericValue >= 0 ? "E" : "W"}`;
}


function formatDate(date) {
  if (!date) {
    return "Unavailable";
  }

  const parsed =
    new Date(date);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return date;
  }

  return parsed.toLocaleString(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  );
}

function formatClockTime(date) {
  return new Date(date).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(value) {
  if (!value) {
    return "Time unavailable";
  }

  const date = new Date(value);
  const elapsed = Date.now() - date.getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) {
    return formatDate(value);
  }

  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : formatDate(value);
}

function normalizeNewsCategory(value) {
  const category = value?.trim().toUpperCase();
  const legacyCategories = {
    ECONOMY: "BUSINESS",
    TECHNOLOGY: "TECH",
    SOCIETY: "GENERAL",
    GEOPOLITICS: "WORLD",
    CONFLICT: "WORLD",
    DISASTER: "GENERAL",
    GENERAL: "GENERAL",
  };

  if (legacyCategories[category]) {
    return legacyCategories[category];
  }

  return NEWS_CATEGORIES.some(({ id }) => id === category)
    ? category
    : "GENERAL";
}

function categoryTitle(category) {
  const titles = {
    BOLLYWOOD: "Bollywood",
    BUSINESS: "Business",
    CLIMATE: "Climate",
    ENTERTAINMENT: "Entertainment",
    GENERAL: "General",
    INDIA: "India",
    SCIENCE: "Science",
    SPORTS: "Sports",
    TECH: "Tech",
    WORLD: "World",
  };

  return titles[category] || "General";
}

function weatherIcon(code) {
  const value = Number(code);
  if (value === 0) return "☀";
  if (value === 1 || value === 2) return "⛅";
  if (value === 3) return "☁";
  if (value === 45 || value === 48) return "≋";
  if (value >= 51 && value <= 67) return "☂";
  if (value >= 71 && value <= 77) return "❄";
  if (value >= 80 && value <= 82) return "☔";
  if (value >= 95) return "ϟ";
  return "◌";
}

function weatherDescription(code) {
  const descriptions = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    80: "Rain showers",
    81: "Rain showers",
    82: "Heavy rain showers",
    95: "Thunderstorm",
    96: "Thunderstorm + hail",
    99: "Thunderstorm + heavy hail",
  };

  return descriptions[code] || "Unknown conditions";
}

export default App;