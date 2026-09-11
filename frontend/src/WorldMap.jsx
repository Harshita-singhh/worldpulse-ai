import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";

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

// Keeps the map view stable when filters change
function MapUpdater({ events }) {
  const map = useMap();

  useEffect(() => {
    if (!events.length) return;

    // Don't automatically zoom aggressively.
    // Just keep the global view when filtering.
    map.setView([20, 0], 2);
  }, [events, map]);

  return null;
}

function formatDate(date) {
  if (!date) return "Unknown";

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

function WorldMap({
  events = [],
  severityFilter = "ALL",
  onEventSelect,
}) {
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

    return validCoordinates && matchesSeverity;
  });

  return (
    <div className="world-map">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxZoom={8}
        scrollWheelZoom={true}
        worldCopyJump={true}
        style={{
          height: "100%",
          width: "100%",
        }}
      >
        <MapUpdater events={mappedEvents} />

        {/* Dark World Basemap */}
        <TileLayer
          attribution="Tiles © Esri — Esri, TomTom, Garmin, FAO, NOAA, USGS, © OpenStreetMap contributors"
          url="https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        />

        {/* Event Markers */}
        {mappedEvents.map((event) => {
          const severity = event.severity?.toUpperCase() || "LOW";
          const color = getSeverityColor(severity);

          const latitude = Number(event.latitude);
          const longitude = Number(event.longitude);

          return (
            <CircleMarker
              key={event.id}
              center={[latitude, longitude]}
              radius={getMarkerRadius(severity)}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.85,
                weight: severity === "CRITICAL" ? 2 : 1,
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
                  <h3>{event.title || "Untitled Event"}</h3>

                  {/* Description */}
                  {event.description && (
                    <p className="popup-description">
                      {event.description}
                    </p>
                  )}

                  {/* Location */}
                  <p>
                    <strong>Location:</strong>{" "}
                    {event.country || "Unknown"}
                  </p>

                  <p>
                    <strong>Region:</strong>{" "}
                    {event.region || "Unknown"}
                  </p>

                  {/* Category */}
                  {event.category && (
                    <p>
                      <strong>Category:</strong>{" "}
                      {event.category}
                    </p>
                  )}

                  {/* Coordinates */}
                  <p>
                    <strong>Coordinates:</strong>{" "}
                    {latitude.toFixed(3)}, {longitude.toFixed(3)}
                  </p>

                  {/* Source */}
                  {event.source && (
                    <p>
                      <strong>Source:</strong>{" "}
                      {event.source}
                    </p>
                  )}

                  {/* Confidence */}
                  {event.confidence !== undefined && (
                    <p>
                      <strong>Confidence:</strong>{" "}
                      {formatConfidence(event.confidence)}
                    </p>
                  )}

                  {/* Occurred */}
                  {event.occurred_at && (
                    <p>
                      <strong>Occurred:</strong>{" "}
                      {formatDate(event.occurred_at)}
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

      {/* Empty state */}
      {mappedEvents.length === 0 && (
        <div className="map-empty-state">
          <div>◉</div>
          <strong>No events found</strong>
          <span>
            No events match the current filter.
          </span>
        </div>
      )}
    </div>
  );
}

export default WorldMap;