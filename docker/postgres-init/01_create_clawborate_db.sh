#!/bin/bash
# Creates the clawborate application database and a dedicated user.
# Runs automatically on first postgres container initialization (empty data volume).
# For existing volumes, run manually: docker exec clawborate-postgres-1 /docker-entrypoint-initdb.d/01_create_clawborate_db.sh
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE USER clawborate WITH PASSWORD '${APP_DB_PASSWORD:-clawborate}';
    CREATE DATABASE clawborate OWNER clawborate;
    GRANT ALL PRIVILEGES ON DATABASE clawborate TO clawborate;
EOSQL
