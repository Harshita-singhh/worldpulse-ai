ALTER TABLE events ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE events ADD COLUMN IF NOT EXISTS fire_radiative_power NUMERIC(10, 2);
ALTER TABLE events ADD COLUMN IF NOT EXISTS fire_confidence VARCHAR(20);
ALTER TABLE events ADD COLUMN IF NOT EXISTS satellite VARCHAR(20);
ALTER TABLE events ADD COLUMN IF NOT EXISTS instrument VARCHAR(20);
ALTER TABLE events ADD COLUMN IF NOT EXISTS brightness_temperature_ti4 NUMERIC(8, 2);
ALTER TABLE events ADD COLUMN IF NOT EXISTS brightness_temperature_ti5 NUMERIC(8, 2);
ALTER TABLE events ADD COLUMN IF NOT EXISTS daynight VARCHAR(1);
ALTER TABLE events ADD COLUMN IF NOT EXISTS source_version VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_events_category_occurred_at
    ON events (category, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_source_event_id
    ON events (source, source_event_id);
