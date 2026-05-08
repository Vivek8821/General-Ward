#!/usr/bin/env bash
# Production environment setup — generates secrets and creates .env from .env.example.
# Run once before the first `docker compose up --build`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$ROOT/.env"
EXAMPLE_FILE="$ROOT/.env.example"

if [ ! -f "$EXAMPLE_FILE" ]; then
  echo "ERROR: $EXAMPLE_FILE not found. Is this the right directory?" >&2
  exit 1
fi

if [ -f "$ENV_FILE" ]; then
  echo "⚠  .env already exists at $ENV_FILE"
  echo "   Delete it first if you want to regenerate secrets."
  exit 1
fi

if ! command -v openssl &>/dev/null; then
  echo "ERROR: openssl is required to generate secrets but was not found." >&2
  exit 1
fi

JWT_SECRET=$(openssl rand -hex 32)
PG_PASSWORD=$(openssl rand -hex 32)

# Replace both change_me_before_production placeholders (first = PG_PASSWORD, second = JWT_SECRET)
# .env.example lists PG_PASSWORD first, JWT_SECRET second.
FIRST_DONE=false
while IFS= read -r line; do
  if [[ "$line" == *"change_me_before_production"* ]] && [ "$FIRST_DONE" = false ]; then
    echo "${line/change_me_before_production/$PG_PASSWORD}"
    FIRST_DONE=true
  elif [[ "$line" == *"change_me_before_production"* ]]; then
    echo "${line/change_me_before_production/$JWT_SECRET}"
  else
    echo "$line"
  fi
done < "$EXAMPLE_FILE" > "$ENV_FILE"

echo ""
echo "✓ .env created at $ENV_FILE"
echo ""
echo "  PG_PASSWORD → set (${PG_PASSWORD:0:8}...)"
echo "  JWT_SECRET  → set (${JWT_SECRET:0:8}...)"
echo ""
echo "Before starting, open .env and set:"
echo "  CORS_ORIGIN=https://your-hospital-domain.example  (required)"
echo ""
echo "To enable HTTPS:"
echo "  1. Place fullchain.pem and privkey.pem in ./nginx/certs/"
echo "  2. In nginx/nginx.conf, set server_name and uncomment the HTTPS server block"
echo "  3. In nginx/nginx.conf, uncomment: return 301 https://\$host\$request_uri;"
echo ""
echo "Then deploy:"
echo "  docker compose up --build"
