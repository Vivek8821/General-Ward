---
id: "enterprise_hardening_cookie_csrf"
file_type: rationale
community: "Enterprise Hardening & DB Architecture"
community_id: 2
source_file: "docs/plans/enterprise-hardening-detailed.md"
tags:
  - "rationale"
  - community/Enterprise_Hardening_&_DB_Architecture
---

# Cookie Sessions & CSRF (Phase C)

**Source:** `docs/plans/enterprise-hardening-detailed.md`

## Description

HttpOnly cookie + double-submit CSRF selected over BFF proxy. Eliminates localStorage JWT storage. authenticateToken reads both Authorization header and cookie during migration window. CORS must use explicit origins (not *) when credentials: true.

## Referenced by

- [[Enterprise Hardening & DB Architecture/Enterprise Hardening Detailed Plan|Enterprise Hardening Detailed Plan]] → **references**
- [[Enterprise Hardening & DB Architecture/CSRF Enforcement Tightening (Step 4.2)|CSRF Enforcement Tightening (Step 4.2)]] → **semantically_similar_to** `INFERRED`

---

*Community: [[Enterprise Hardening & DB Architecture/_COMMUNITY_Enterprise Hardening & DB Architecture|Enterprise Hardening & DB Architecture]]*