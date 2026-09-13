-- /destination/nearby filters on ST_DWithin(location::geography, ...) because the
-- radius is in metres. The cast makes it an expression, so the plain GIST index on
-- the geometry column cannot serve it — verified with EXPLAIN + enable_seqscan=off,
-- which still produced a sequential scan. A matching functional index fixes that.
CREATE INDEX IF NOT EXISTS idx_destination_location_geog
  ON "Destination" USING GIST ((location::geography));
