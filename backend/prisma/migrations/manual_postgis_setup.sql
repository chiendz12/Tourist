-- Run this AFTER `prisma migrate dev` creates the base tables.
-- It enables PostGIS and adds spatial indexes.
-- (Prisma's native migration also generates `CREATE EXTENSION postgis;` because of `extensions = [postgis]`.)

CREATE EXTENSION IF NOT EXISTS postgis;

-- Spatial GIST indexes
CREATE INDEX IF NOT EXISTS idx_destination_location ON "Destination" USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_route_path           ON "Route"       USING GIST (path);
CREATE INDEX IF NOT EXISTS idx_province_centroid    ON "Province"    USING GIST (centroid);
