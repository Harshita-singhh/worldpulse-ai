import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";

/* =========================================================
   SEVERITY HELPERS
========================================================= */

function getSeverityColor(severity) {
  switch (severity) {
    case "CRITICAL":
      return "#ff4d5e";
    case "HIGH":
      return "#ff914d";
    case "MEDIUM":
      return "#e6c34a";
    case "LOW":
      return "#55c59a";
    default:
      return "#718cff";
  }
}

function getMarkerRadius(severity) {
  switch (severity) {
    case "CRITICAL":
      return 9;
    case "HIGH":
      return 7;
    case "MEDIUM":
      return 6;
    case "LOW":
      return 5;
    default:
      return 5;
  }
}

function getWildfireMarkerRadius(event) {
  const frp = Number(event.fire_radiative_power || 0);

  if (!Number.isFinite(frp) || frp <= 0) {
    return 6;
  }

  return Math.min(15, Math.max(6, frp * 0.55));
}

/* =========================================================
   COUNTRY CENTERS
========================================================= */

const COUNTRY_CENTERS = {
  India: [20.5937, 78.9629],
  "United States": [39.8283, -98.5795],
  Canada: [56.1304, -106.3468],
  China: [35.8617, 104.1954],
  Japan: [36.2048, 138.2529],
  Indonesia: [-0.7893, 113.9213],
  Australia: [-25.2744, 133.7751],
  "New Zealand": [-40.9006, 174.886],
  Brazil: [-14.235, -51.9253],
  Mexico: [23.6345, -102.5528],
  Chile: [-35.6751, -71.543],
  Colombia: [4.5709, -74.2973],
  Argentina: [-38.4161, -63.6167],
  Peru: [-9.19, -75.0152],
  Philippines: [12.8797, 121.774],
  Taiwan: [23.6978, 120.9605],
  Thailand: [15.87, 100.9925],
  Vietnam: [14.0583, 108.2772],
  Myanmar: [21.9162, 95.956],
  Nepal: [28.3949, 84.124],
  Pakistan: [30.3753, 69.3451],
  Afghanistan: [33.9391, 67.71],
  Turkey: [38.9637, 35.2433],
  Iran: [32.4279, 53.688],
  Iraq: [33.2232, 43.6793],
  Israel: [31.0461, 34.8516],
  Egypt: [26.8206, 30.8025],
  "South Africa": [-30.5595, 22.9375],
  Kenya: [-0.0236, 37.9062],
  Nigeria: [9.082, 8.6753],
  Morocco: [31.7917, -7.0926],
  Algeria: [28.0339, 1.6596],
  "United Kingdom": [55.3781, -3.436],
  France: [46.2276, 2.2137],
  Germany: [51.1657, 10.4515],
  Italy: [41.8719, 12.5674],
  Spain: [40.4637, -3.7492],
  Portugal: [39.3999, -8.2245],
  Greece: [39.0742, 21.8243],
  Norway: [60.472, 8.4689],
  Sweden: [60.1282, 18.6435],
  Finland: [61.9241, 25.7482],
  Iceland: [64.9631, -19.0208],
  Russia: [61.524, 105.3188],
  Ukraine: [48.3794, 31.1656],
  Poland: [51.9194, 19.1451],
  Romania: [45.9432, 24.9668],
  Austria: [47.5162, 14.5501],
  Switzerland: [46.8182, 8.2275],
  Netherlands: [52.1326, 5.2913],
  Belgium: [50.5039, 4.4699],
  Denmark: [56.2639, 9.5018],
  Ireland: [53.1424, -7.6921],
};

/* =========================================================
   MAP POSITION UPDATER
========================================================= */

function MapUpdater({ selectedCountry }) {
  const map = useMap();

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (!selectedCountry) {
      if (reduceMotion) {
        map.setView([20, 0], 2);
      } else {
        map.flyTo([20, 0], 2, { duration: 1.2 });
      }

      return;
    }

    const center = COUNTRY_CENTERS[selectedCountry];

    if (center) {
      if (reduceMotion) {
        map.setView(center, 5);
      } else {
        map.flyTo(center, 5, { duration: 1.2 });
      }
    }
  }, [selectedCountry, map]);

  return null;
}

function MapFocusUpdater({ focusLocation }) {
  const map = useMap();

  useEffect(() => {
    if (
      !focusLocation ||
      !Number.isFinite(focusLocation.latitude) ||
      !Number.isFinite(focusLocation.longitude)
    ) {
      return;
    }

    const center = [focusLocation.latitude, focusLocation.longitude];
    const zoom = Math.max(map.getZoom(), 6);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      map.setView(center, zoom);
    } else {
      map.flyTo(center, zoom, { duration: 0.8 });
    }
  }, [focusLocation, map]);

  return null;
}

function MapZoomTracker({ onZoomChange }) {
  const map = useMap();

  useEffect(() => {
    const updateZoom = () => onZoomChange(map.getZoom());
    updateZoom();
    map.on("zoomend", updateZoom);

    return () => map.off("zoomend", updateZoom);
  }, [map, onZoomChange]);

  return null;
}

function EventCluster({
  events,
  center,
  color,
  radius,
  onEventSelect,
}) {
  const map = useMap();

  return (
    <CircleMarker
      center={center}
      radius={radius}
      pathOptions={{
        color,
        fillColor: color,
        fillOpacity: 0.75,
        weight: 2,
      }}
      eventHandlers={{
        click: () => {
          const zoom = Math.min(map.getZoom() + 2, 8);
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            map.setView(center, zoom);
          } else {
            map.flyTo(center, zoom, { duration: 0.7 });
          }
        },
      }}
    >
      <Popup>
        <div className="map-popup cluster-popup">
          <h3>{events.length} nearby events</h3>
          <p>Zoom in to explore the grouped records.</p>
          <ul>
            {events.slice(0, 12).map((event) => (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => onEventSelect?.(event)}
                >
                  {event.title || "Untitled event"}
                </button>
              </li>
            ))}
          </ul>
          {events.length > 12 && (
            <p>Showing 12 of {events.length} records.</p>
          )}
        </div>
      </Popup>
    </CircleMarker>
  );
}

/* =========================================================
   FORMATTERS
========================================================= */

function formatDate(date) {
  if (!date) {
    return "Unknown";
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

function formatConfidence(confidence) {
  if (confidence === null || confidence === undefined) {
    return "Unavailable";
  }

  const value = Number(confidence);

  if (Number.isNaN(value)) {
    return "Unavailable";
  }

  return `${Math.round(value * 100)}%`;
}

/* =========================================================
   WORLD MAP
========================================================= */

function WorldMap({
  events = [],
  severityFilter = "ALL",
  onEventSelect,
  focusLocation = null,
}) {
  const [selectedCountry, setSelectedCountry] = useState("");
  const [zoom, setZoom] = useState(2);

  /*
   * Countries currently available in the event dataset.
   */
  const availableCountries = useMemo(() => {
    const countries = events
      .map((event) => event.country)
      .filter(
        (country) =>
          country &&
          typeof country === "string" &&
          country.trim() !== ""
      );

    return [...new Set(countries)].sort();
  }, [events]);

  /*
   * Apply severity + country filtering
   * before rendering markers.
   */
  const mappedEvents = events.filter((event) => {
    const latitude = Number(event.latitude);
    const longitude = Number(event.longitude);

    const validCoordinates =
      event.latitude !== null &&
      event.longitude !== null &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude);

    const matchesSeverity =
      severityFilter === "ALL" ||
      event.severity?.toUpperCase() === severityFilter;

    const matchesCountry =
      !selectedCountry ||
      event.country === selectedCountry;

    return (
      validCoordinates &&
      matchesSeverity &&
      matchesCountry
    );
  });

  const eventClusters = useMemo(() => {
    if (zoom >= 6) {
      return mappedEvents.map((event) => [event]);
    }

    const cellSize = zoom < 3 ? 8 : zoom < 4 ? 4 : 2;
    const groups = new Map();

    mappedEvents.forEach((event) => {
      const key = [
        Math.floor(Number(event.latitude) / cellSize),
        Math.floor(Number(event.longitude) / cellSize),
      ].join(":");
      const group = groups.get(key) || [];
      group.push(event);
      groups.set(key, group);
    });

    return [...groups.values()];
  }, [mappedEvents, zoom]);

  return (
    <div className="world-map">

      {/* =================================================
          COUNTRY EXPLORER
      ================================================= */}

      <div className="map-controls">

        <div className="map-country-control">

          <label htmlFor="country-select">
            Explore Country
          </label>

          <select
            id="country-select"
            value={selectedCountry}
            onChange={(event) =>
              setSelectedCountry(event.target.value)
            }
          >
            <option value="">
              🌍 Global View
            </option>

            {availableCountries.map((country) => (
              <option
                key={country}
                value={country}
              >
                {country}
              </option>
            ))}
          </select>

        </div>

        {selectedCountry && (
          <button
            type="button"
            className="global-view-button"
            onClick={() => setSelectedCountry("")}
          >
            ← Global View
          </button>
        )}

      </div>

      {/* =================================================
          LEAFLET MAP
      ================================================= */}

      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxZoom={8}
        scrollWheelZoom={true}
        worldCopyJump={true}
        style={{
          height: "auto",
          flex: 1,
          minHeight: 0,
          width: "100%",
        }}
      >
        <MapUpdater
          selectedCountry={selectedCountry}
        />
        <MapFocusUpdater focusLocation={focusLocation} />
        <MapZoomTracker onZoomChange={setZoom} />

        {/* Dark World Basemap */}
        <TileLayer
          attribution="Tiles © Esri — Esri, TomTom, Garmin, FAO, NOAA, USGS, © OpenStreetMap contributors"
          url="https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        />

        {/* =================================================
            EVENT MARKERS
        ================================================= */}

        {eventClusters.map((cluster, clusterIndex) => {
          if (cluster.length > 1) {
            const center = [
              cluster.reduce(
                (sum, event) => sum + Number(event.latitude),
                0
              ) / cluster.length,
              cluster.reduce(
                (sum, event) => sum + Number(event.longitude),
                0
              ) / cluster.length,
            ];
            const wildfireCount = cluster.filter(
              (event) =>
                event.category?.toLowerCase() === "wildfire" ||
                event.source?.toUpperCase() === "NASA_FIRMS"
            ).length;
            const clusterColor =
              wildfireCount > cluster.length / 2
                ? "#ff8d4d"
                : "#718cff";

            return (
              <EventCluster
                key={`cluster-${clusterIndex}-${cluster[0].id}`}
                events={cluster}
                center={center}
                color={clusterColor}
                radius={Math.min(
                  16,
                  8 + Math.log2(cluster.length) * 1.5
                )}
                onEventSelect={onEventSelect}
              />
            );
          }

          const event = cluster[0];
          const categoryLabel =
            (event.category || "").toLowerCase();

          const isWildfire =
            categoryLabel === "wildfire" ||
            categoryLabel.includes("wildfire") ||
            event.source?.toUpperCase() === "NASA_FIRMS";

          const severity =
            event.severity?.toUpperCase() || "LOW";

          const color = isWildfire
            ? "#ff8d4d"
            : categoryLabel === "weather"
              ? "#54a9d8"
              : categoryLabel === "news"
                ? "#a78bfa"
                : getSeverityColor(severity);

          const latitude =
            Number(event.latitude);

          const longitude =
            Number(event.longitude);

          const radius = isWildfire
            ? getWildfireMarkerRadius(event)
            : getMarkerRadius(severity);

          return (
            <CircleMarker
              key={event.id}
              center={[
                latitude,
                longitude,
              ]}
              radius={radius}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.85,
                weight:
                  isWildfire ? 1.5 : severity === "CRITICAL" ? 2 : 1,
              }}
              eventHandlers={{
                click: () => {
                  if (onEventSelect) {
                    onEventSelect(event);
                  }
                },
              }}
            >
              <Popup>

                <div className="map-popup">

                  {/* Severity */}
                  <span
                    className={`popup-severity ${severity.toLowerCase()}`}
                  >
                    {severity}
                  </span>

                  {/* Title */}
                  <h3>
                    {event.title ||
                      "Untitled Event"}
                  </h3>

                  {/* Description */}
                  {event.description && (
                    <p className="popup-description">
                      {event.description}
                    </p>
                  )}

                  {/* Location */}
                  <p>
                    <strong>
                      Location:
                    </strong>{" "}
                    {event.country ||
                      "Unknown"}
                  </p>

                  {/* Region */}
                  <p>
                    <strong>
                      Region:
                    </strong>{" "}
                    {event.region ||
                      "Unknown"}
                  </p>

                  {/* Category */}
                  {event.category && (
                    <p>
                      <strong>
                        Category:
                      </strong>{" "}
                      {event.category}
                    </p>
                  )}

                  {/* Coordinates */}
                  <p>
                    <strong>
                      Coordinates:
                    </strong>{" "}
                    {latitude.toFixed(3)},{" "}
                    {longitude.toFixed(3)}
                  </p>

                  {/* Source */}
                  {event.source && (
                    <p>
                      <strong>
                        Source:
                      </strong>{" "}
                      {event.source}
                    </p>
                  )}

                  {(event.source_url || event.usgs_url) && (
                    <p>
                      <strong>Source record:</strong>{" "}
                      <a
                        href={event.source_url || event.usgs_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open source
                      </a>
                    </p>
                  )}

                  {isWildfire && (
                    <>
                      <p>
                        <strong>FRP:</strong>{" "}
                        {Number(
                          event.fire_radiative_power || 0
                        ).toFixed(2)} MW
                      </p>

                      <p>
                        <strong>Detection confidence:</strong>{" "}
                        {event.fire_confidence || "Unknown"}
                      </p>

                      <p>
                        <strong>Satellite:</strong>{" "}
                        {event.satellite || "Unknown"}
                      </p>

                      <p>
                        <strong>Instrument:</strong>{" "}
                        {event.instrument || "Unknown"}
                      </p>

                      <p>
                        <strong>Day/Night:</strong>{" "}
                        {event.daynight || "Unknown"}
                      </p>

                      <p>
                        <strong>Brightness temp:</strong>{" "}
                        {event.brightness_temperature_ti4 ||
                          event.brightness_temperature_ti5
                          ? `${event.brightness_temperature_ti4 || "-"} / ${event.brightness_temperature_ti5 || "-"}`
                          : "Unknown"}
                      </p>

                      <p>
                        <strong>FIRMS version:</strong>{" "}
                        {event.source_version || "Unknown"}
                      </p>
                    </>
                  )}

                  {/* Confidence */}
                  {event.confidence !== undefined && (
                    <p>
                      <strong>
                        Confidence:
                      </strong>{" "}
                      {formatConfidence(
                        event.confidence
                      )}
                    </p>
                  )}

                  {/* Occurred */}
                  {event.occurred_at && (
                    <p>
                      <strong>
                        Occurred:
                      </strong>{" "}
                      {formatDate(
                        event.occurred_at
                      )}
                    </p>
                  )}

                  {/* Event ID */}
                  <p className="popup-event-id">
                    EVENT #{event.id}
                  </p>

                </div>

              </Popup>
            </CircleMarker>
          );
        })}

      </MapContainer>

      {/* =================================================
          EMPTY STATE
      ================================================= */}

      {mappedEvents.length === 0 && (
        <div className="map-empty-state">

          <div>◉</div>

          <strong>
            {selectedCountry
              ? `Nothing is lighting up in ${selectedCountry} yet.`
              : "Nothing is lighting up here yet."}
          </strong>

          <span>
            {selectedCountry
              ? "Try another category or return to Global."
              : "Try another category or return to Global."}
          </span>

        </div>
      )}

    </div>
  );
}

export default WorldMap;