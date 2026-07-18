-- PostgreSQL initialisation script
-- Runs once when the container first starts (docker-entrypoint-initdb.d)

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;
-- Enable pgvector for face embedding search
CREATE EXTENSION IF NOT EXISTS vector;
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Enable trigram indexes for full-text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- Enable btree_gist for exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Create Grafana database (co-located with VMS for dev simplicity)
CREATE DATABASE grafana OWNER sentinel;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE sentinel_vms TO sentinel;
GRANT ALL PRIVILEGES ON DATABASE grafana TO sentinel;

-- Set timezone
ALTER DATABASE sentinel_vms SET timezone TO 'UTC';
