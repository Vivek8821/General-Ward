#!/usr/bin/env bash
# start-test-server.sh — General Ward test environment
# Triggered by: "Start the test server"
# Stops on Ctrl+C and cleans up both processes automatically.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/ward-backend"
FRONTEND="$ROOT/ward-frontend"
BACKEND_PORT=3001
FRONTEND_PORT=5173

# ── Colours ──────────────────────────────────────────────────────────────────
CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
RED='\033[0;31m'; BOLD='\033[1m'; RESET='\033[0m'

header() { echo -e "\n${BOLD}${CYAN}▶ $1${RESET}"; }
ok()     { echo -e "  ${GREEN}✓${RESET} $1"; }
warn()   { echo -e "  ${YELLOW}⚠${RESET}  $1"; }
fail()   { echo -e "  ${RED}✗${RESET} $1"; }

BACKEND_PID="" FRONTEND_PID=""

cleanup() {
  echo -e "\n${YELLOW}Shutting down test servers…${RESET}"
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
if [ ! -d "$BACKEND/node_modules" ]; then
  echo "  Installing backend dependencies…"
  (cd "$BACKEND" && npm install --silent)
fi
ok "Backend dependencies present"

if [ ! -d "$FRONTEND/node_modules" ]; then
  echo "  Installing frontend dependencies…"
  (cd "$FRONTEND" && npm install --silent)
fi
ok "Frontend dependencies present"

# ── 3. Seed test database (clean slate) ───────────────────────────────────────
header "Seeding test database"
rm -f "$BACKEND/ward.db" "$BACKEND/ward.db-shm" "$BACKEND/ward.db-wal"
(cd "$BACKEND" && node scripts/seed-test.js)

# ── 4. Start backend ──────────────────────────────────────────────────────────
header "Starting backend (port $BACKEND_PORT)"
(cd "$BACKEND" && NODE_ENV=development npm start > /tmp/ward-backend.log 2>&1) &
BACKEND_PID=$!

# Wait for backend to be ready (up to 15 s)
READY=0
for i in $(seq 1 30); do
  sleep 0.5
  if curl -sf "http://localhost:$BACKEND_PORT/health" > /dev/null 2>&1; then
    READY=1; break
  fi
done
if [ "$READY" -eq 0 ]; then
  fail "Backend did not start within 15s. Check /tmp/ward-backend.log"
  cat /tmp/ward-backend.log | tail -20
  kill "$BACKEND_PID" 2>/dev/null
  exit 1
fi
ok "Backend ready at http://localhost:$BACKEND_PORT"

# ── 5. Start frontend ─────────────────────────────────────────────────────────
header "Starting frontend (port $FRONTEND_PORT)"
(cd "$FRONTEND" && VITE_API_BASE="http://localhost:$BACKEND_PORT" npm run dev -- --port $FRONTEND_PORT > /tmp/ward-frontend.log 2>&1) &
FRONTEND_PID=$!

# Wait for Vite (up to 15 s)
READY=0
for i in $(seq 1 30); do
  sleep 0.5
  if curl -sf "http://localhost:$FRONTEND_PORT" > /dev/null 2>&1; then
    READY=1; break
  fi
done
if [ "$READY" -eq 0 ]; then
  warn "Frontend health check timed out — it may still be compiling."
  warn "Check http://localhost:$FRONTEND_PORT in 10 s, or see /tmp/ward-frontend.log"
fi

# ── 6. Ready banner ───────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}  General Ward — Test Server Ready${RESET}"
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════${RESET}"
echo ""
echo -e "  ${BOLD}Frontend${RESET}   http://localhost:$FRONTEND_PORT"
echo -e "  ${BOLD}Backend API${RESET} http://localhost:$BACKEND_PORT/api"
echo ""
echo -e "  ${BOLD}Test credentials:${RESET}"
echo -e "  ┌──────────────────┬─────────────┬───────────────────────────────┐"
echo -e "  │ Role             │ Password    │ Can access                    │"
echo -e "  ├──────────────────┼─────────────┼───────────────────────────────┤"
echo -e "  │ Admin User       │ admin123    │ Everything + audit log        │"
echo -e "  │ Dr. Smith        │ doctor123   │ Patients, meds, discharge     │"
echo -e "  │ Nurse Joy        │ nurse123    │ Patients, vitals, tasks       │"
echo -e "  └──────────────────┴─────────────┴───────────────────────────────┘"
echo ""
echo -e "  ${BOLD}Test data loaded:${RESET}"
echo -e "  • 12 patients across Wards A, B, C (various care intensities)"
echo -e "  • 6 patients with vitals (NEWS2 scores active)"
echo -e "  • p5 Michael Brown — NEWS2 score 9 (critical, pending escalation)"
echo -e "  • 6 medications prescribed across patients"
echo -e "  • 3 pharmacy stocks with 8 batches (FEFO ordering)"
echo -e "  • 2 escalations, 4 tasks, 4 handover notes, 5 observations"
echo ""
echo -e "  See ${BOLD}TEST_PROTOCOL.md${RESET} for the full feature checklist."
echo -e "  Logs: /tmp/ward-backend.log  /tmp/ward-frontend.log"
echo ""
echo -e "  ${YELLOW}Press Ctrl+C to stop both servers.${RESET}"
echo ""

wait
