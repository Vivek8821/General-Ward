# Patient Detail UI refresh — detailed execution plan

**Scope:** Frontend-only styling and structure for the patient chart ([Patient Detail workflow in codemap](../../codemap/CODEMAP.md#L69-L94)). No API or database behavior changes unless a display bug is discovered.

**Companion file (mandatory during execution):** Update [patient-detail-ui-refresh-PROGRESS.md](./patient-detail-ui-refresh-PROGRESS.md) after **every** step so a crashed session can resume without guessing.

---

## 1) Accuracy — verified facts (do not assume beyond this)

| Fact | Source |
|------|--------|
| Client is **React 19 + Vite 7**, not Next.js | [ward-frontend/package.json](../../ward-frontend/package.json) |
| Patient chart route is `/patient/:id` | [ward-frontend/CODENAV.md](../../ward-frontend/CODENAV.md#L5-L9) |
| Main view file is `ward-frontend/src/views/PatientDetail.jsx` | Codemap [§ Patient chart tabs](../../codemap/CODEMAP.md#L69-L72), CODENAV [§ Patient detail](../../ward-frontend/CODENAV.md#L36-L56) |
| Global colors and `.btn` / `.card` / `.input-field` live in `ward-frontend/src/index.css` | Codemap anchor `fp-ward-frontend-src-index-css` |
| `patient.allergies` is **TEXT** in SQLite; seed uses values like `None`, `Penicillin` | [ward-backend/db.js](../../ward-backend/db.js) (`allergies TEXT`), [ward-backend/seed.js](../../ward-backend/seed.js) |
| History empty UI uses `border-dashed` today | [HistoryTab.jsx](../../ward-frontend/src/components/stats/HistoryTab.jsx) (empty branch ~lines 111–116) |
| Tabs are inline `TabButton` in `PatientDetail.jsx` | [PatientDetail.jsx](../../ward-frontend/src/views/PatientDetail.jsx) ~404–447 |
| There is **no** `components/ui/tabs` and **no** `@radix-ui` in frontend `package.json` today | [ward-frontend/package.json](../../ward-frontend/package.json) |

If any of the above disagrees with your working tree, **open the cited file** and correct this plan locally before executing.

---

## 2) Navigation — codemap and CODENAV

Before touching code, read:

1. [codemap/CODEMAP.md](../../codemap/CODEMAP.md) — **Architecture overview**, **Patient chart tabs**, **History timeline**, **Handover / patient notes**, **Discharge / archive**, and **First-party file inventory** for `PatientDetail.jsx`, `HistoryTab.jsx`, `HandoverNotesPanel.jsx`, `index.css`, `Layout.jsx`.
2. [ward-frontend/CODENAV.md](../../ward-frontend/CODENAV.md) — Router entrypoints and **every API call** from `PatientDetail.jsx` (ensures UI changes don’t tempt API “fixes” that aren’t requested).

---

## 3) Execution protocol (one step at a time)

**Rules:**

1. **Never** combine two numbered steps in one commit/session without updating PROGRESS.
2. After each step: **(A)** update PROGRESS, **(B)** run that step’s **Confirmation** checklist, **(C)** run that step’s **Stress / verification** block.
3. If something fails: record the exit code, error snippet, and file state in PROGRESS under **Blockers**; do not start the next step until resolved or scoped out.
4. **Confirm execution** means: checklist explicitly marked done with date and verifier note (human or automated).

---

## 4) Resume after crash — what the next session needs

The next executor should:

1. Open [patient-detail-ui-refresh-PROGRESS.md](./patient-detail-ui-refresh-PROGRESS.md).
2. Find **Last completed step:** `X.Y`.
3. Read **In progress / interrupted:** if a step was mid-edit, open the listed files and `git diff` (or editor backup) to see partial work.
4. Continue with **next** step only; do not redo completed steps unless a regression test failed.

**Optional git practice:** One commit per numbered step (`chore(ui): patient detail refresh step 1.1`) makes crash recovery trivial.

---

## 5) Edge cases, bugs, and glitches to handle explicitly

### Allergies display

- `null`, `undefined`, `''` → treat as **no allergy** (muted text).
- Trim whitespace; **case-insensitive** match for common negatives: `none`, `no allergies`, `n/a`, `na`, `nil` (extend list if product owner specifies).
- Any other non-empty string → **red / risk** presentation (badge or strong border-left card).
- **Do not** claim clinical truth beyond stored text; this is **documentation UX**, not decision support.

### Roles and visibility

- **Discharge** button: only `user.role === 'doctor'` and `patient.status !== 'discharged'` today — preserve ([PatientDetail.jsx](../../ward-frontend/src/views/PatientDetail.jsx)).
- **Escalate**: nurse-only branch — preserve.
- **History “Create Profile”**: doctor-only — preserve; empty-state CTA must still respect `readOnly` / `isDoctor`.

### Discharged / archived patients

- `fetchPatient` sets `activeTab` to `discharge` when `status === 'discharged'` — tab wiring must remain valid when swapping tab implementation.
- “Discharge Summary” tab only when discharged — preserve conditional.

### Care intensity (1–4)

- Today: colored pill next to name + level text. After redesign: if level moves into metadata bar, keep **semantic color** for high acuity (e.g. 3–4 only) or use neutral bar + small semantic chip — **decide in Step 2.1** and document in PROGRESS so design doesn’t drift mid-execution.

### Horizontal scroll / overflow

- Tab strip uses `overflow-x-auto` — after tab restyle, verify **keyboard focus** and **no clipped focus rings** on narrow viewports.

### Theme (light / dark)

- `Layout` applies `.dark` via `AuthContext` — test **both** themes after token changes ([Layout.jsx](../../ward-frontend/src/components/Layout.jsx)).

### Tailwind v4 + new dependency

- If adding `@radix-ui/react-tabs`: install in `ward-frontend`, run `npm install`, verify lockfile updated; peer dependency should align with React 19 (check npm peer warnings).
- If Radix causes issues: **fallback** documented in Phase 3 Step 3.2 (pure `<button role="tab">` strip).

---

# Phases and steps

## Phase 1 — Global neutral palette and primary token

**Goal:** Neutral dark canvas; primary color suitable for “primary action” (indigo family), without editing patient JSX yet.

| Step | Action | Confirmation (must pass) |
|------|--------|---------------------------|
| **1.0** | Read-only: copy current `--color-*` values from `:root` and `.dark` into PROGRESS for rollback reference | Values in PROGRESS match [index.css](../../ward-frontend/src/index.css) lines 3–41 |
| **1.1** | Edit **only** `.dark` background variables: `--color-bg-primary`, `--color-bg-secondary`, `--color-bg-tertiary` toward neutral zinc/slate (e.g. `#09090b`, `#18181b`, `#27272a` — adjust if contrast with text fails) | Light text still readable; no blue-grey cast on full-page background |
| **1.2** | Optionally tune **light** `:root` backgrounds if cards look muddy (minimal change) | Light mode Dashboard + Login still usable |
| **1.3** | Set `--color-primary` / `--color-primary-dark` to **indigo** hues (e.g. `#4f46e5` / `#4338ca`) for `.btn-primary` alignment | Grep: spot-check [Dashboard.jsx](../../ward-frontend/src/views/Dashboard.jsx), [VitalsTab.jsx](../../ward-frontend/src/components/stats/VitalsTab.jsx) for reliance on old lavender — adjust only if unreadable |
| **1.4** | Run `cd ward-frontend && npm run lint` and `npm run build` | Exit code 0; fix any new violations |

**Stress / verification after Phase 1**

- [ ] Toggle dark/light on Dashboard and one patient chart.
- [ ] Open Vitals tab: pain display distinguishes high vs normal without confusion.
- [ ] No console errors on navigation.

---

## Phase 2 — Patient header, metadata bar, allergies, discharge UX

**Primary file:** [PatientDetail.jsx](../../ward-frontend/src/views/PatientDetail.jsx)

| Step | Action | Confirmation |
|------|--------|--------------|
| **2.0** | In PROGRESS, sketch final header layout (name line, metadata line, allergy line, actions column) | ASCII or bullet layout agreed |
| **2.1** | Replace patient name classes: `font-semibold text-slate-900 dark:text-slate-50` (remove `text-primary` / `font-extrabold` on name) | Name not purple/blue |
| **2.2** | Replace MRN/Bed/Level pill row with **metadata bar** (`rounded-md`, separators, muted text); integrate Level per 2.0 decision | No `rounded-full` for static identifiers |
| **2.3** | Implement `normalizeAllergiesDisplay(patient.allergies)` (new small helper under `ward-frontend/src/utils/` **or** colocated function with unit-level clarity): muted vs red | Seed patients: `None` muted; `Penicillin` risk styling |
| **2.4** | Discharge header button: remove `btn-warning`; use `btn-primary` (post–Phase 1 tokens) or explicit indigo utilities | No “warning yellow” for standard discharge |
| **2.5** | Discharge modal: neutral chrome (remove yellow header treatment); submit button primary/indigo, cancel secondary | Modal reads as form, not alert |
| **2.6** | Tasks panel heading: avoid decorative `text-primary` if it competes with name | Visual hierarchy: name strongest |

**Stress / verification after Phase 2**

- [ ] Doctor on **active** patient: header, Discharge opens modal, cancel closes.
- [ ] Nurse: no Discharge; Escalate still visible when allowed.
- [ ] **Discharged** patient: read-only banner; tab set still coherent.
- [ ] Long patient name + long MRN: wrap without breaking layout (`min-w-0` where needed).

---

## Phase 3 — Tab navigation (clear active state)

| Step | Action | Confirmation |
|------|--------|--------------|
| **3.1** | **Preferred:** `cd ward-frontend && npm install @radix-ui/react-tabs`; add [components/ui/tabs.jsx](../../ward-frontend/src/components/ui/tabs.jsx) (or `.tsx` if project adds TS later — today **JSX only**) implementing List/Trigger/Content with shadcn-like classes: active `border-b-2 border-indigo-600 text-indigo-600`, inactive muted | Keyboard: Arrow keys move between tabs (Radix default); `aria-*` present |
| **3.2** | **Fallback** (if install/build fails): Replace `TabButton` styling only — `role="tablist"` on container, `aria-selected` on buttons, same visual border-bottom active | axe DevTools or manual screen reader spot-check |
| **3.3** | Wire controlled value to existing `activeTab` state; preserve discharge-tab conditional | All tab panels still render correct content |

**Stress / verification after Phase 3**

- [ ] Click each tab; URL unchanged (still client state) — **no regression** from React Router.
- [ ] Rapid clicks: no duplicate content or blank panel.
- [ ] Discharged patient: Discharge Summary tab appears and works.

---

## Phase 4 — History empty state + Handover polish

| Step | Action | Confirmation |
|------|--------|--------------|
| **4.1** | [HistoryTab.jsx](../../ward-frontend/src/components/stats/HistoryTab.jsx): empty state — remove dashed border; `border` solid; `bg-slate-*` muted; center content; **Create Profile** as clear **secondary** inside empty state for doctors | Does not look like file upload |
| **4.2** | [HandoverNotesPanel.jsx](../../ward-frontend/src/components/stats/HandoverNotesPanel.jsx): `rounded-md` on key controls; replace gratuitous `rounded-full` chips with `rounded-md` where not status; focus rings visible (indigo/slate) | Form usable in dark mode |
| **4.3** | Run `npm run lint` && `npm run build` | Exit code 0 |

**Stress / verification after Phase 4**

- [ ] Doctor: no history → empty state → Create Profile enters edit mode.
- [ ] Doctor: existing history → view mode unchanged functionally.
- [ ] Handover: create note, filter by shift/range, ensure list refresh.

---

## 6) Final regression sweep (after all phases)

Cross-check files that **grep** showed using `text-primary` / `bg-primary` for non-status decoration:

- [Dashboard.jsx](../../ward-frontend/src/views/Dashboard.jsx)
- [VitalsTab.jsx](../../ward-frontend/src/components/stats/VitalsTab.jsx)
- [DietTab.jsx](../../ward-frontend/src/components/stats/DietTab.jsx)
- [SleepTab.jsx](../../ward-frontend/src/components/stats/SleepTab.jsx)
- [HandoverNotesPanel.jsx](../../ward-frontend/src/components/stats/HandoverNotesPanel.jsx)

Only change them if Phase 1 token shift caused a **real** contrast or hierarchy bug; stay within original UX scope.

---

## 7) What this plan intentionally does **not** do

- No changes to [ward-backend](../../ward-backend/) routes, services, or SQLite schema.
- No new `/api` contracts.
- No replacement of the whole design system beyond documented tokens and listed components — avoids scope creep and merge pain.

---

*Plan version: 2 (detailed execution). Keep PROGRESS in sync.*
