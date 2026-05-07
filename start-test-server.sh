#!/usr/bin/env bash
# start-test-server.sh — General Ward
# Triggered by: "Start the test server"
#
# Usage:
#   bash start-test-server.sh          # preserve patient data, start servers
#   bash start-test-server.sh --fresh  # wipe data and reload initial dataset

set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/ward-backend"
FRONTEND="$ROOT/ward-frontend"
BACKEND_PORT=3001
FRONTEND_PORT=5173

# ── Colours ───────────────────────────────────────────────────────────────────
CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
RED='\033[0;31m'; BOLD='\033[1m'; RESET='\033[0m'

header() { echo -e "\n${BOLD}${CYAN}▶ $1${RESET}"; }
ok()     { echo -e "  ${GREEN}✓${RESET} $1"; }
warn()   { echo -e "  ${YELLOW}⚠${RESET}  $1"; }
fail()   { echo -e "  ${RED}✗${RESET} $1"; }

FRESH=false
for arg in "$@"; do [ "$arg" = "--fresh" ] && FRESH=true; done

BACKEND_PID="" FRONTEND_PID=""

cleanup() {
  echo -e "\n${YELLOW}Shutting down…${RESET}"
  [ -n "$BACKEND_PID"  ] && kill "$BACKEND_PID"  2>/dev/null && ok "Backend stopped"
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null && ok "Frontend stopped"
  exit 0
}
trap cleanup SIGINT SIGTERM

# ── 1. Free ports ─────────────────────────────────────────────────────────────
header "Clearing ports $BACKEND_PORT and $FRONTEND_PORT"
for PORT in $BACKEND_PORT $FRONTEND_PORT; do
  PID=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
  if [ -n "$PID" ]; then
    kill "$PID" 2>/dev/null && ok "Freed port $PORT (pid $PID)" || warn "Could not free port $PORT"
    sleep 0.5
  else
    ok "Port $PORT is free"
  fi
done

# ── 2. Install dependencies if missing ────────────────────────────────────────
header "Checking dependencies"
[ ! -d "$BACKEND/node_modules"  ] && (cd "$BACKEND"  && npm install --silent)
ok "Backend dependencies present"
[ ! -d "$FRONTEND/node_modules" ] && (cd "$FRONTEND" && npm install --silent)
ok "Frontend dependencies present"

# ── 3. Database ───────────────────────────────────────────────────────────────
header "Database"
if [ "$FRESH" = true ]; then
  warn "Fresh start requested — wiping and reloading patient data"
  rm -f "$BACKEND/ward.db" "$BACKEND/ward.db-shm" "$BACKEND/ward.db-wal"
  (cd "$BACKEND" && node scripts/seed-test.js --fresh)
else
  ok "Preserving existing patient data"
  # Idempotent — skips if data already loaded, seeds if DB is new/empty
  (cd "$BACKEND" && node scripts/seed-test.js)
fi

# ── 4. Start backend ──────────────────────────────────────────────────────────
header "Starting backend (port $BACKEND_PORT)"
(cd "$BACKEND" && NODE_ENV=development node server.js > /tmp/ward-backend.log 2>&1) &
BACKEND_PID=$!

READY=0
for i in $(seq 1 30); do
  sleep 0.5
  if curl -sf "http://localhost:$BACKEND_PORT/health" > /dev/null 2>&1; then
    READY=1; break
  fi
done
if [ "$READY" -eq 0 ]; then
  fail "Backend did not start within 15s. Check /tmp/ward-backend.log"
  tail -20 /tmp/ward-backend.log
  kill "$BACKEND_PID" 2>/dev/null
  exit 1
fi
ok "Backend ready at http://localhost:$BACKEND_PORT"

# ── 5. Start frontend ─────────────────────────────────────────────────────────
header "Starting frontend (port $FRONTEND_PORT)"
(cd "$FRONTEND" && VITE_API_BASE="http://localhost:$BACKEND_PORT" npm run dev -- --port $FRONTEND_PORT > /tmp/ward-frontend.log 2>&1) &
FRONTEND_PID=$!

READY=0
for i in $(seq 1 30); do
  sleep 0.5
  if curl -sf "http://localhost:$FRONTEND_PORT" > /dev/null 2>&1; then
    READY=1; break
  fi
done
[ "$READY" -eq 0 ] && warn "Frontend still compiling — check http://localhost:$FRONTEND_PORT in ~10s"

# ── 6. Banner ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}  General Ward — Running${RESET}"
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════${RESET}"
echo ""
echo -e "  ${BOLD}Frontend${RESET}    http://localhost:$FRONTEND_PORT"
echo -e "  ${BOLD}Backend API${RESET} http://localhost:$BACKEND_PORT/api"
echo ""
echo -e "  ${BOLD}Credentials:${RESET}"
echo -e "  ┌──────────────────┬─────────────┬───────────────────────────────┐"
echo -e "  │ User             │ Password    │ Role                          │"
echo -e "  ├──────────────────┼─────────────┼───────────────────────────────┤"
echo -e "  │ Admin User       │ admin123    │ Admin — audit + user mgmt     │"
echo -e "  │ Dr. Smith        │ doctor123   │ Doctor — clinical + discharge │"
echo -e "  │ Dr. Patel        │ doctor123   │ Doctor — clinical + discharge │"
echo -e "  │ Nurse Joy        │ nurse123    │ Nurse — vitals + tasks        │"
echo -e "  │ Nurse Riya       │ nurse123    │ Nurse — vitals + tasks        │"
echo -e "  │ PharmD Jones     │ pharma123   │ Pharmacist — pharmacy only    │"
echo -e "  └──────────────────┴─────────────┴───────────────────────────────┘"
echo ""
echo -e "  ${BOLD}Patient data:${RESET} 30 patients — data persists across restarts"
echo -e "  ${BOLD}Reset data:${RESET}    bash start-test-server.sh --fresh"
echo ""
echo -e "  Logs: /tmp/ward-backend.log  /tmp/ward-frontend.log"
echo -e "  ${YELLOW}Press Ctrl+C to stop.${RESET}"
echo ""

wait
