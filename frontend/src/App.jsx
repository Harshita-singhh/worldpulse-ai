import { useEffect, useMemo, useState } from "react";
import WorldMap from "./WorldMap";
import "./App.css";

const API_BASE_URL = "http://127.0.0.1:8000";

function App() {
  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);

  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    let isMounted = true;
  
    async function loadDashboard() {
      try {
        const [summaryResponse, eventsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/intelligence/summary`),
          fetch(`${API_BASE_URL}/events`),
        ]);
  
        if (!summaryResponse.ok) {
          throw new Error("Failed to fetch WorldPulse intelligence");
        }
  
        if (!eventsResponse.ok) {
          throw new Error("Failed to fetch WorldPulse events");
        }
  
        const summaryData = await summaryResponse.json();
        const eventsData = await eventsResponse.json();
  
        if (!isMounted) return;
  
        setSummary(summaryData);
  
        setEvents(
          Array.isArray(eventsData)
            ? eventsData
            : eventsData.events || []
        );
  
        setError(null);
      } catch (err) {
        if (!isMounted) return;
  
        console.error("WorldPulse refresh error:", err);
        setError((currentError) => currentError || err.message);
      }
    }
  
    loadDashboard();
  
    const interval = setInterval(loadDashboard, 60000);
  
    return () => {
      isMounted = false;
      clearInterval(interval);
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
        event.severity?.toUpperCase() === severityFilter;

      if (!matchesSeverity) {
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
  }, [events, severityFilter, search]);

  /* =========================================================
     DERIVED INTELLIGENCE
  ========================================================= */

  const severityCounts = summary?.severity_counts || {};

  const highSeverity =
    (severityCounts.HIGH || 0) +
    (severityCounts.CRITICAL || 0);

  const totalEvents = summary?.total_events || events.length || 0;

  const criticalCount = severityCounts.CRITICAL || 0;
  const highCount = severityCounts.HIGH || 0;
  const mediumCount = severityCounts.MEDIUM || 0;
  const lowCount = severityCounts.LOW || 0;

  const highPriorityPercentage =
    totalEvents > 0
      ? ((highSeverity / totalEvents) * 100).toFixed(1)
      : "0.0";

  /* =========================================================
     CATEGORY ANALYSIS
  ========================================================= */

  const categoryStats = useMemo(() => {
    const counts = {};

    events.forEach((event) => {
      const category = event.category || "Other";
      counts[category] = (counts[category] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [events]);

  const maxCategoryCount = categoryStats[0]?.[1] || 1;

  /* =========================================================
     COUNTRY ANALYSIS
  ========================================================= */

  const countryStats = useMemo(() => {
    const counts = {};

    events.forEach((event) => {
      const country = event.country || "Unknown";
      counts[country] = (counts[country] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [events]);

  /* =========================================================
     HOTSPOTS
  ========================================================= */

  const hotspotStats = useMemo(() => {
    const counts = {};

    events.forEach((event) => {
      const region = event.region || event.country || "Unknown";

      if (!counts[region]) {
        counts[region] = {
          total: 0,
          high: 0,
          critical: 0,
        };
      }

      counts[region].total += 1;

      if (event.severity === "HIGH") {
        counts[region].high += 1;
      }

      if (event.severity === "CRITICAL") {
        counts[region].critical += 1;
      }
    });

    return Object.entries(counts)
      .sort((a, b) => {
        const scoreA =
          a[1].total + a[1].high * 3 + a[1].critical * 6;

        const scoreB =
          b[1].total + b[1].high * 3 + b[1].critical * 6;

        return scoreB - scoreA;
      })
      .slice(0, 6);
  }, [events]);

  /* =========================================================
     RECENT ACTIVITY
  ========================================================= */

  const recentActivity = useMemo(() => {
    const now = Date.now();

    const buckets = [
      { label: "0–6h", min: 0, max: 6 },
      { label: "6–12h", min: 6, max: 12 },
      { label: "12–18h", min: 12, max: 18 },
      { label: "18–24h", min: 18, max: 24 },
      { label: "24–48h", min: 24, max: 48 },
      { label: "48h+", min: 48, max: Infinity },
    ];

    return buckets.map((bucket) => {
      const count = events.filter((event) => {
        if (!event.occurred_at) return false;

        const date = new Date(event.occurred_at);

        if (Number.isNaN(date.getTime())) return false;

        const hoursAgo =
          (now - date.getTime()) / (1000 * 60 * 60);

        return hoursAgo >= bucket.min && hoursAgo < bucket.max;
      }).length;

      return {
        label: bucket.label,
        count,
      };
    });
  }, [events]);

  const maxRecentActivity =
    Math.max(...recentActivity.map((item) => item.count), 1);

  /* =========================================================
     AI-STYLE SITUATION BRIEF
  ========================================================= */

  const situationBrief = useMemo(() => {
    const topCountry =
      countryStats[0]?.[0] || "multiple regions";

    const topCountryCount = countryStats[0]?.[1] || 0;

    const topRegion =
      hotspotStats[0]?.[0] || "multiple regions";

    let status = "STABLE";
    let statusClass = "stable";

    if (criticalCount > 0) {
      status = "ELEVATED";
      statusClass = "elevated";
    }

    if (criticalCount >= 3 || highPriorityPercentage >= 8) {
      status = "HIGH ATTENTION";
      statusClass = "high";
    }

    let headline =
      "Global event activity remains distributed across multiple regions.";

    if (highSeverity > 0) {
      headline =
        `Elevated activity detected with ${highSeverity} high-priority events requiring attention.`;
    }

    let assessment =
      "Most monitored events are currently classified as low severity.";

    if (criticalCount > 0) {
      assessment =
        `${criticalCount} critical event${
          criticalCount > 1 ? "s" : ""
        } detected. Continued monitoring is recommended.`;
    } else if (highCount > 0) {
      assessment =
        `${highCount} high-severity events are currently driving the priority signal.`;
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
  ]);

  /* =========================================================
     ERROR
  ========================================================= */

  if (error) {
    return (
      <div className="app">
        <div className="error-screen">
          <h1>WORLDPULSE AI</h1>
          <p>{error}</p>
          <span>
            Make sure the FastAPI backend is running on port 8000.
          </span>
        </div>
      </div>
    );
  }

  /* =========================================================
     LOADING
  ========================================================= */

  if (!summary) {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="loading-dot"></div>
          <p>Connecting to WorldPulse intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="topbar">
        <div>
          <div className="brand">
            <span className="brand-mark">◉</span>
            <span>WORLDPULSE</span>
            <span className="brand-ai">AI</span>
          </div>

          <p className="subtitle">
            Global Event Intelligence Platform
          </p>
        </div>

        <div className="live-status">
          <span className="live-dot"></span>
          LIVE
        </div>
      </header>

      <main className="dashboard">

        {/* ===================================================
            KPI CARDS
        =================================================== */}

        <section className="kpi-grid">

          <div className="kpi-card">
            <span className="kpi-label">
              TOTAL EVENTS
            </span>

            <strong>
              {totalEvents}
            </strong>

            <span className="kpi-description">
              Events monitored
            </span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">
              LAST 24 HOURS
            </span>

            <strong>
              {summary.events_last_24h}
            </strong>

            <span className="kpi-description">
              Recently detected
            </span>
          </div>

          <div className="kpi-card warning">
            <span className="kpi-label">
              HIGH SEVERITY
            </span>

            <strong>
              {highCount}
            </strong>

            <span className="kpi-description">
              Events requiring attention
            </span>
          </div>

          <div className="kpi-card critical">
            <span className="kpi-label">
              CRITICAL
            </span>

            <strong>
              {criticalCount}
            </strong>

            <span className="kpi-description">
              Highest severity
            </span>
          </div>

        </section>

        {/* ===================================================
            GLOBAL MAP
        =================================================== */}

        <section className="panel map-panel">

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
              {filteredEvents.length} events
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
                  onClick={() =>
                    setSeverityFilter(severity)
                  }
                >
                  {severity}
                </button>

              ))}

            </div>

            <div className="event-search">

              <input
                type="text"
                placeholder="Search events, countries, regions..."
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
          />

        </section>

        {/* ===================================================
            AI SITUATION BRIEF
        =================================================== */}

        <section
          className="panel"
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

            <div style={{ flex: 1, minWidth: "280px" }}>

              <span className="eyebrow">
                AI INTELLIGENCE
              </span>

              <h2 style={{ marginBottom: "12px" }}>
                Situation Brief
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

            </div>

            <div
              style={{
                padding: "10px 16px",
                borderRadius: "8px",
                border: "1px solid rgba(100,150,220,.25)",
                background: "rgba(40,60,100,.15)",
                fontSize: "12px",
                letterSpacing: "1.5px",
                fontWeight: 700,
                color:
                  situationBrief.statusClass === "high"
                    ? "#ff914d"
                    : situationBrief.statusClass === "elevated"
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
              label="PRIMARY REGION"
              value={situationBrief.topRegion}
            />

            <BriefCard
              label="TOP COUNTRY"
              value={situationBrief.topCountry}
              sub={`${situationBrief.topCountryCount} events`}
            />

            <BriefCard
              label="HIGH PRIORITY"
              value={`${highPriorityPercentage}%`}
              sub="of monitored events"
            />

            <BriefCard
              label="ASSESSMENT"
              value={situationBrief.assessment}
              compact
            />

          </div>

        </section>

        {/* ===================================================
            ANALYTICS GRID
        =================================================== */}

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(420px, 1fr))",
            gap: "24px",
            marginTop: "24px",
          }}
        >

          {/* ---------- ACTIVITY TIMELINE ---------- */}

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
                padding: "20px 10px 8px",
              }}
            >

              {recentActivity.map((item) => {

                const height =
                  Math.max(
                    (item.count / maxRecentActivity) * 160,
                    item.count > 0 ? 8 : 3
                  );

                return (
                  <div
                    key={item.label}
                    style={{
                      flex: 1,
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      alignItems: "center",
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
                        height: `${height}px`,
                        borderRadius: "5px 5px 2px 2px",
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
              })}

            </div>

          </div>

          {/* ---------- CATEGORY DISTRIBUTION ---------- */}

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
                flexDirection: "column",
                gap: "16px",
                marginTop: "8px",
              }}
            >

              {categoryStats.length === 0 ? (

                <p style={{ color: "#71809a" }}>
                  No category data available.
                </p>

              ) : (

                categoryStats.map(([category, count]) => {

                  const percentage =
                    (count / maxCategoryCount) * 100;

                  return (
                    <div key={category}>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: "7px",
                        }}
                      >

                        <span
                          style={{
                            color: "#b9c7dc",
                            fontSize: "13px",
                          }}
                        >
                          {category}
                        </span>

                        <strong
                          style={{
                            color: "#eef4ff",
                            fontSize: "13px",
                          }}
                        >
                          {count}
                        </strong>

                      </div>

                      <div
                        style={{
                          height: "6px",
                          background: "#171e2a",
                          borderRadius: "10px",
                          overflow: "hidden",
                        }}
                      >

                        <div
                          style={{
                            width: `${percentage}%`,
                            height: "100%",
                            borderRadius: "10px",
                            background:
                              "linear-gradient(90deg, #536ed0, #718cff)",
                          }}
                        />

                      </div>

                    </div>
                  );
                })

              )}

            </div>

          </div>

        </section>

        {/* ===================================================
            SEVERITY + COUNTRIES
        =================================================== */}

        <section className="main-grid">

          {/* ---------- SEVERITY ---------- */}

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

          {/* ---------- COUNTRIES ---------- */}

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

              {(summary.top_countries || []).map(
                (country, index) => {

                  const topCount =
                    summary.top_countries?.[0]
                      ?.event_count || 1;

                  const percentage =
                    (country.event_count / topCount) * 100;

                  return (
                    <div
                      className="ranking-row"
                      key={country.country}
                    >

                      <span className="rank">
                        {String(index + 1).padStart(
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
                            width: `${percentage}%`,
                          }}
                        />
                      </div>

                      <strong>
                        {country.event_count}
                      </strong>

                    </div>
                  );
                }
              )}

            </div>

          </div>

        </section>

        {/* ===================================================
            EMERGING HOTSPOTS
        =================================================== */}

        <section className="panel">

          <div className="panel-header">

            <div>
              <span className="eyebrow">
                RISK INTELLIGENCE
              </span>

              <h2>
                Emerging Hotspots
              </h2>
            </div>

            <span className="panel-count">
              Ranked by activity
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
                      justifyContent: "space-between",
                      marginBottom: "18px",
                    }}
                  >

                    <span
                      style={{
                        fontSize: "11px",
                        color: "#5f7492",
                        letterSpacing: "1px",
                      }}
                    >
                      #{index + 1}
                    </span>

                    {(stats.critical > 0 ||
                      stats.high > 0) && (
                      <span
                        style={{
                          fontSize: "10px",
                          color:
                            stats.critical > 0
                              ? "#ff4d5e"
                              : "#ff914d",
                          letterSpacing: "1px",
                          fontWeight: 700,
                        }}
                      >
                        ● PRIORITY
                      </span>
                    )}

                  </div>

                  <h3
                    style={{
                      margin: "0 0 10px",
                      fontSize: "16px",
                      color: "#eaf1ff",
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
                        fontSize: "12px",
                      }}
                    >
                      <strong
                        style={{
                          color: "#dfe8f7",
                          fontSize: "18px",
                        }}
                      >
                        {stats.total}
                      </strong>{" "}
                      events
                    </span>

                    <span
                      style={{
                        color: "#7387a4",
                        fontSize: "12px",
                      }}
                    >
                      <strong
                        style={{
                          color: "#ff914d",
                          fontSize: "18px",
                        }}
                      >
                        {stats.high + stats.critical}
                      </strong>{" "}
                      priority
                    </span>

                  </div>

                </div>

              )
            )}

          </div>

        </section>

        {/* ===================================================
            TOP REGIONS
        =================================================== */}

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

            {(summary.top_regions || []).map(
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

        {/* ===================================================
            PRIORITY FEED
        =================================================== */}

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
                summary.recent_high_severity_events
                  ?.length || 0
              } events
            </span>

          </div>

          <div className="events-list">

            {(
              summary.recent_high_severity_events || []
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
                    {event.data_quality_score != null
                      ? Math.round(
                          event.data_quality_score * 100
                        )
                      : "—"}

                    {event.data_quality_score != null
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
          EVENT MODAL
      ===================================================== */}

      {selectedEvent && (

        <div
          className="event-modal-backdrop"
          onClick={() =>
            setSelectedEvent(null)
          }
        >

          <div
            className="event-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <button
              className="modal-close"
              onClick={() =>
                setSelectedEvent(null)
              }
            >
              ×
            </button>

            <div className="modal-header">

              <span
                className={`severity-badge ${
                  selectedEvent.severity?.toLowerCase()
                }`}
              >
                {selectedEvent.severity}
              </span>

              <span className="event-id">
                EVENT #{selectedEvent.id}
              </span>

            </div>

            <h2>
              {selectedEvent.title ||
                "Untitled Event"}
            </h2>

            {selectedEvent.description && (

              <p className="modal-description">
                {selectedEvent.description}
              </p>

            )}

            <div className="modal-grid">

              <DetailItem
                label="Country"
                value={
                  selectedEvent.country ||
                  "Location unavailable"
                }
              />

              <DetailItem
                label="Region"
                value={
                  selectedEvent.region ||
                  "Region unavailable"
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
                label="Source"
                value={
                  selectedEvent.source ||
                  "Unknown"
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
                label="Confidence"
                value={formatConfidence(
                  selectedEvent.confidence
                )}
              />

              <DetailItem
                label="Occurred"
                value={formatDate(
                  selectedEvent.occurred_at
                )}
              />

              <DetailItem
                label="Data Quality"
                value={
                  selectedEvent.data_quality_score !=
                  null
                    ? `${Math.round(
                        selectedEvent.data_quality_score *
                          100
                      )}%`
                    : "Unavailable"
                }
              />

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
        minHeight: compact ? "85px" : "70px",
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
          fontSize: compact ? "12px" : "19px",
          lineHeight: compact ? "1.5" : "1.2",
          fontWeight: compact ? 500 : 700,
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
    total > 0 ? (count / total) * 100 : 0;

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
            width: `${percentage}%`,
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

function DetailItem({ label, value }) {
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
   HELPERS
========================================================= */

function formatConfidence(confidence) {
  if (
    confidence === null ||
    confidence === undefined
  ) {
    return "Unavailable";
  }

  const value = Number(confidence);

  if (Number.isNaN(value)) {
    return "Unavailable";
  }

  return `${Math.round(value * 100)}%`;
}

function formatDate(date) {
  if (!date) {
    return "Unavailable";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default App;