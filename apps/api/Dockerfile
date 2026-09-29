# The API, built from the workspace root.
#
# Build context is the repository root, not this folder: the API imports
# @workflex/shared, and npm workspaces put both under one lockfile. Building
# from apps/api alone would resolve neither.
#
#   docker build -f apps/api/Dockerfile -t workflex-api .
#
# Debian slim rather than Alpine: Prisma's query engine wants glibc and
# OpenSSL, and the musl builds have a habit of failing at run time on a
# machine nobody is watching.

# --- dependencies, production only ----------------------------------------
FROM node:20-slim AS deps
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
# The API's postinstall runs `prisma generate`, which needs the schema.
COPY apps/api/prisma apps/api/prisma

RUN npm ci --omit=dev \
  --workspace @workflex/api \
  --workspace @workflex/shared \
  --include-workspace-root

# --- build ----------------------------------------------------------------
FROM node:20-slim AS build
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma

RUN npm ci \
  --workspace @workflex/api \
  --workspace @workflex/shared \
  --include-workspace-root

COPY packages/shared packages/shared
COPY apps/api apps/api

# Shared first: the API imports its build output, not its source.
RUN npm run build --workspace @workflex/shared \
  && npx prisma generate --schema apps/api/prisma/schema.prisma \
  && npm run build --workspace @workflex/api

# --- runtime --------------------------------------------------------------
FROM node:20-slim AS runtime
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --create-home --shell /usr/sbin/nologin api

ENV NODE_ENV=production

# Production dependencies, then the generated Prisma client on top of them —
# it is written into node_modules during the build and is not in the lockfile.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/shared/package.json packages/shared/package.json
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/package.json apps/api/package.json

# Migrations live in the image so a deploy can apply them before serving.
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/node_modules/prisma ./node_modules/prisma

COPY --chown=api:api apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER api
EXPOSE 3000

# The platform's own health check hits this; keeping one in the image means
# `docker run` says the same thing a deploy does.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
