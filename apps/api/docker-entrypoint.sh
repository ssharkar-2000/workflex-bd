#!/bin/sh
# Applies pending migrations, then serves.
#
# `migrate deploy` only runs migrations already committed to the repository —
# it never invents one from a schema drift, so it cannot quietly rewrite a
# production table. It is a no-op when there is nothing pending.
#
# Set RUN_MIGRATIONS=false to skip it, which is what you want once more than
# one instance boots at a time: two containers racing the same migration is a
# lock fight, and only one of them wins cleanly.
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Applying database migrations..."
  ./node_modules/.bin/prisma migrate deploy --schema apps/api/prisma/schema.prisma
fi

echo "Starting the API on port ${PORT:-3000}..."
exec node apps/api/dist/main.js
