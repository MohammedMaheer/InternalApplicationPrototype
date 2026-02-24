#!/bin/sh
set -e

# Restore the database from GCS if a replica exists
litestream restore -if-replica-exists -config /app/litestream.yml /app/data/app.db

# Start the app under Litestream so it continuously replicates
exec litestream replicate -exec "node server.js" -config /app/litestream.yml
