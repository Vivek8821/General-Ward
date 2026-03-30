# Stress-test gate — procedure

Run after any change that touches backend routes, middleware, `api.ts`, authentication, or database queries.

## Prerequisites

1. Database seeded: `node ward-backend/seed.js` (stop the API first to avoid SQLite lock conflicts).
2. Backend running: `cd ward-backend && node server.js`.

## Quick command

```bash
cd ward-backend
node stressEverything.js
```

Default configuration: **20 seconds**, **10 concurrent workers**, hitting reads and writes across patients, stats, notes, tasks, medications, escalations, and observations. Uses JWT tokens (no cookie auth) so CSRF middleware is bypassed by design.

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `WARD_API_BASE` | `http://localhost:3001/api` | API base URL |
| `WARD_DB_PATH` | `ward-backend/ward.db` | SQLite path (only used when `STRESS_SEED_DB=1`) |
| `DURATION_SEC` | `20` | How long to run |
| `CONCURRENCY` | `10` | Parallel request workers |
| `REQ_TIMEOUT_MS` | `10000` | Per-request abort timeout |
| `STRESS_SEED_DB` | `0` | `1` to seed stress fixtures directly (backend must be stopped) |

## Reading the output

The script prints a JSON summary:

```
{
  "totalRequests": ...,
  "ok2xxOr3xx": ...,
  "forbidden403": ...,   // Expected: cross-tenant reads are blocked
  "other4xx": ...,
  "server5xx": ...,       // Should be 0
  "timeouts": ...,        // Should be 0
  "fetchErrors": ...,     // Should be 0
  "latencyP95Ms": ...,    // Target: under 200ms for local dev
  "statusHistogram": {},
  "server5xxErrorMessages": {}
}
```

## Pass criteria

| Metric | Acceptable |
|--------|-----------|
| `server5xx` | **0** |
| `timeouts` | **0** |
| `fetchErrors` | **0** |
| `forbidden403` | Non-zero is expected (cross-tenant isolation tests) |
| `latencyP95Ms` | Under **200ms** locally; under **500ms** on CI/shared infra |

## When to fail a change

- Any `server5xx > 0` means a backend crash or unhandled error under load.
- Any `timeouts > 0` means the server hung for more than `REQ_TIMEOUT_MS`.
- Unexpected `other4xx` spikes (beyond normal validation) may indicate regressions.

## Full-seed mode (optional, heavier)

Stop the backend first, then:

```bash
STRESS_SEED_DB=1 DURATION_SEC=30 CONCURRENCY=20 node stressEverything.js
```

This creates dedicated stress fixtures in `ward.db`, then starts the backend and runs. Useful for clean-room benchmarking but requires the server to be stopped during seeding.

## Integration with per-step checkpoints

After running, record in your checkpoint:

```text
Stress run: DURATION_SEC=20 CONCURRENCY=10 node stressEverything.js
Result: totalRequests=N, server5xx=0, timeouts=0, p95=Xms
```
