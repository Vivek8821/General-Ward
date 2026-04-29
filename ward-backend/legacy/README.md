## Legacy backend code (do not mount)

This directory contains **deprecated** implementations kept only for reference during refactors.

- Files here **must not be imported or mounted** by `ward-backend/server.js`.
- If a legacy module is imported at runtime, it should fail loudly rather than silently weakening security.

