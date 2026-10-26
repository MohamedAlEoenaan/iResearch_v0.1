#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export npm_config_cache="${npm_config_cache:-/tmp/iresearch-npm-cache}"
npm ci --no-audit --no-fund
npm run env:init
node --input-type=module -e 'import "dotenv/config"; const u=new URL(process.env.DATABASE_URL); if(!["localhost","127.0.0.1"].includes(u.hostname)||u.pathname!=="/iresearch"||process.env.NODE_ENV==="production") throw new Error("This setup script is for the local development database only.");'
docker compose up -d db
ready=false
for attempt in {1..30}; do
  if docker compose exec -T db pg_isready -U iresearch -d iresearch >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
if [[ "$ready" != true ]]; then echo 'PostgreSQL did not become ready.' >&2; exit 1; fi
npm run db:generate
npm run db:migrate
npm run db:seed
npm run catalog:import -- catalog/website.en.json
if [[ "$(docker compose exec -T db psql -U iresearch -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = 'iresearch_test'")" != 1 ]]; then
  docker compose exec -T db createdb -U iresearch iresearch_test
fi
DOTENV_CONFIG_PATH=.env.test npm run db:migrate
npm run db:validate
npm run db:drift
