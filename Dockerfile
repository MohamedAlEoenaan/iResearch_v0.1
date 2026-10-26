# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1
COPY --chown=node:node package*.json ./
# Optional enterprise CA is supplied as a build secret, never committed to the image.
RUN --mount=type=secret,id=corporate_ca \
    if [ -f /run/secrets/corporate_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/corporate_ca; fi; \
    npm ci --no-audit --no-fund --fetch-retries=1 --fetch-timeout=30000
COPY --chown=node:node . .
RUN --mount=type=secret,id=corporate_ca \
    if [ -f /run/secrets/corporate_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/corporate_ca; fi; \
    npm run db:generate && npm run build && chown -R node:node /app
ENV NODE_ENV=production
EXPOSE 3000
USER node
CMD ["npm","run","start"]
