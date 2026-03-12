# Agent workflow and implementation

This document describes how this agent is built and how it runs end-to-end, so you can verify behavior and adapt it for the mystery prompt.

---

## 1. What this agent does

- **Polls** the Seedstr API (v2) for jobs; optionally uses WebSocket (Pusher) for faster pickup.
- **Classifies** each job as text-only (reply in text) or artifact (build a .zip and submit it).
- For **high-value or build-like** jobs, runs a **full pipeline**: richer prompt, submission checks, one retry on failure, and optional fallback entry point.
- **Generates** responses via OpenRouter (with optional backup model if the primary fails).
- **Submits** text or file (zip) and tracks usage.

---

## 2. End-to-end flow

```
Start
  → Load config (.env + stored API key)
  → Register/verify checks (CLI or on start)
  → Poll (or WebSocket) for jobs
  → For each new job:
       → Compute effective budget (job or swarm share)
       → Skip if below MIN_BUDGET
       → Decide: full pipeline? (budget ≥ HACKATHON_MIN_BUDGET or build-like wording)
       → Parse request brief (kind, areas, scope) if full pipeline
       → Build system prompt (core rules + scoring context + request context + any correction hints)
       → Call LLM (with tools: web_search, calculator, code_analysis, create_file, finalize_project)
       → If artifact built and full pipeline:
            → Run submission checks (entry point, README, min files, non-empty)
            → If checks failed: retry once with “Corrections needed” in prompt
            → Run ensure-runnable (inject index.html if still no entry)
            → Re-zip if fallback was injected
       → Upload zip (if any) and submit response (text + optional file)
       → Mark job processed, continue polling
```

---

## 3. Implemented pieces

### 3.1 Full-pipeline gate (`src/tools/hackathon/detector.ts`)

- **Role:** Decide when to use the strict pipeline (checks, retry, scoring-aware prompt).
- **Logic:** `isHackathonJob(job, config)` is true when:
  - effective budget ≥ `config.hackathonMinBudget` (env: `HACKATHON_MIN_BUDGET`, default 9000), or
  - the prompt contains artifact-related wording (e.g. build, create, app, dashboard) and budget ≥ 1.
- **No external references;** wording and constant names are specific to this repo.

### 3.2 Request brief (`src/tools/hackathon/promptAnalyzer.ts`)

- **Role:** Turn the job text into a short brief for the system prompt.
- **Output:** `PromptAnalysis`: `projectType`, `description`, `features[]`, `complexity` (simple | moderate | complex).
- **Used only** when the full pipeline is on; the system prompt gets one line of “Request context” (kind, scope, suggested areas).
- **Implementation:** Pattern lists (KIND_HINTS, FEATURE_HINTS) and word/feature counts for complexity. No external docs or APIs.

### 3.3 System prompt (`src/config/systemPrompt.ts`)

- **Role:** Single place for agent instructions: when to use text vs artifact, how to build, and how to satisfy automated scoring.
- **Sections:**
  - **Core:** Response mode (text-only vs artifact), rules for text-only, rules for artifacts (tech choice, completeness, required outputs, one extra value, look and feel).
  - **Scoring context:** Only when full pipeline is on; explains Functionality / Design / Speed and shortlist (functionality > 5/10).
  - **Request context:** Only when a brief is present; one line with kind, scope, and suggested areas.
  - **Corrections needed:** Only on retry; lists validation errors so the model can fix and resubmit.
  - **This job:** Budget (and swarm share if applicable) and reminder to use the right mode.
- **Wording and structure** are written for this agent only (no copy from other projects).

### 3.4 Submission checks (`src/tools/hackathon/projectValidator.ts`)

- **Role:** Before submitting an artifact, ensure it is runnable and presentable.
- **Checks:** At least one entry point (e.g. index.html, main.js, app.py), README (or README.md), minimum file count (2), no empty files. Optional warning if README is very short.
- **Fixes:** `validateAndFix` runs the same checks and, if there is no entry point, writes a minimal `index.html` into the project dir and returns an updated file list. Caller is responsible for re-zipping if this happens.
- **Exports:** `validateProject`, `validateAndFix`, `createFallbackEntryFile`, `ValidationResult`.

### 3.5 Runner integration (`src/agent/runner.ts`)

- **Full pipeline:** When `isHackathonJob(job, config)` is true:
  - Builds system prompt with `getSystemPrompt({ job, isHackathon: true, promptAnalysis })`.
  - Uses lower temperature (0.5) for artifact jobs.
  - After LLM returns a project build, runs `validateProject`; if invalid, **one retry** with `getSystemPrompt(..., validationErrors)`.
  - Then runs `validateAndFix`; if it injected an entry, calls `zipDirectory(projectDir, zipPath)` before upload.
- **Normal jobs:** Standard prompt, default temperature, no submission checks or retry.

### 3.6 Multi-model failover (`src/llm/client.ts`)

- **Role:** If the primary OpenRouter model fails (after retries), try once with `OPENROUTER_FALLBACK_MODEL` when set.
- **Behavior:** No extra dependencies; same client, optional second model in config.

### 3.7 Zip helper (`src/tools/projectBuilder.ts`)

- **Role:** After injecting a fallback `index.html`, the project dir has one more file; `zipDirectory(projectDir, zipPath)` re-creates the zip from the directory so the uploaded file is up to date.

---

## 4. Configuration (relevant env)

| Variable | Purpose |
|----------|--------|
| `OPENROUTER_API_KEY` | Required. OpenRouter API key. |
| `OPENROUTER_FALLBACK_MODEL` | Optional. Backup model for failover. |
| `HACKATHON_MIN_BUDGET` | Budget threshold (default 9000) above which the full pipeline runs. |
| `WALLET_ADDRESS` | Required for registration. |
| `MIN_BUDGET` | Minimum job budget to accept. |
| `POLL_INTERVAL` | Seconds between poll cycles. |
| `PUSHER_KEY` | Optional. WebSocket for faster job delivery. |

---

## 5. Testing

- **`tests/deliverable.test.ts`** covers:
  - Full-pipeline gate: budget threshold, artifact wording, boundary cases.
  - Request brief: project type, feature areas, complexity.
  - Submission checks: too few files, missing README, missing entry, success path, `validateAndFix` injecting `index.html`, `createFallbackEntryFile` content.
  - System prompt: budget in prompt, scoring context when full pipeline, request context, validation errors.

Run: `npm run test:run -- tests/deliverable.test.ts`

---

## 6. How to run

1. `cp .env.example .env` and set `OPENROUTER_API_KEY`, `WALLET_ADDRESS`, and optionally `HACKATHON_MIN_BUDGET`, `OPENROUTER_FALLBACK_MODEL`.
2. `npm run register` then `npm run verify` (and `npm run status` to confirm).
3. `npm start` to run the agent (TUI). Use `npm start -- --no-tui` for headless.

When the mystery prompt drops, the agent will treat it as full-pipeline (if budget ≥ threshold or wording is build-like), run submission checks, one retry on failure, and ensure a runnable zip before submit.
