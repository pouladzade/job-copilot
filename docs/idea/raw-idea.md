# System Architecture Specification

## Local-First Multi-Platform AI Job Copilot (DeepSeek API Edition)

**Version:** 1.0
**Status:** Draft — ready for implementation
**Automation policy:** Human-in-the-loop (HITL) only. No auto-submit, ever.

---

## 1. Purpose & Scope

A personal tool that helps a job seeker go from "found a listing" to "submitted a tailored application" faster, while keeping a human in control of every meaningful action. The system:

- Scrapes a job posting from a supported site via a browser extension
- Sends the posting + resume context to DeepSeek's API for tailoring
- Generates a summary, resume bullet suggestions, cover letter, and screening-question answers
- Presents everything in a review UI for editing
- Fills the web form fields only after the user approves
- Requires the user to personally click the final "Submit" button on the job site
- Logs every application to a local database for later search and analysis

Non-goals: fully autonomous applying, mimicking human typing/mouse patterns to evade bot detection, or bypassing site terms of service.

---

## 2. High-Level Architecture

```
┌─────────────────────────────┐
│        BROWSER LEVEL         │
│                               │
│  Target Job Page (LinkedIn,  │
│  Indeed, Lever, Greenhouse,   │
│  Ashby, ZipRecruiter...)      │
│         │ DOM scrape          │
│         ▼                     │
│  Site Adapter (per platform)  │
│         │ raw fields          │
│         ▼                     │
│  Normalizer → JobPosting JSON │
└───────────┬───────────────────┘
            │ HTTP (localhost)
            ▼
┌─────────────────────────────┐
│     LOCAL BACKEND (FastAPI)  │
│                               │
│  Orchestrator                 │
│   ├─ Resume Loader             │
│   ├─ Prompt Builder            │
│   ├─ DeepSeek Client           │
│   ├─ Response Validator        │
│   └─ Application Store (DB)    │
└───────────┬───────────────────┘
            │ HTTPS (api.deepseek.com)
            ▼
┌─────────────────────────────┐
│        DeepSeek API          │
│   deepseek-chat / deepseek-   │
│   reasoner, JSON mode         │
└───────────────────────────────┘
            │
            ▼
┌─────────────────────────────┐
│         REVIEW UI            │
│  (extension popup or local    │
│   web page)                   │
│  - Edit generated content      │
│  - Approve → Fill Form         │
│  - User clicks Submit manually │
└───────────────────────────────┘
```

Design principle: **the LLM never touches the DOM, and the DOM-scraping code never touches the LLM.** Everything passes through the `JobPosting` and `ApplicationDraft` schemas defined below.

---

## 3. Component Breakdown

### 3.1 Browser Extension

Responsibilities:

- Detect supported job site via URL/DOM matching
- Scrape raw fields (title, company, location, description, form field labels)
- Normalize into `JobPosting` schema (see 4.1)
- POST to local backend (`http://localhost:8787`)
- Render the Review UI (can be a popup, side panel, or injected overlay)
- Fill form fields on approval, using field labels matched to `ApplicationDraft` answers
- **Never** trigger form submission — that button is always left to the user

Adapter pattern (self-registering, so new sites don't require touching core logic):

```js
registerAdapter({
  id: 'linkedin',
  matches: (url) => url.includes('linkedin.com/jobs'),
  scrapeJobPosting: () => {
    /* returns raw fields */
  },
  scrapeFormFields: () => {
    /* returns list of {label, type, selector} */
  },
  fillField: (selector, value) => {
    /* sets value, dispatches input event */
  },
});
```

Adapters to build first: LinkedIn, Indeed, Greenhouse, Lever, Ashby (in that order — Greenhouse/Lever/Ashby have far more stable, semantic HTML than LinkedIn/Indeed, so they're good for validating the pipeline before fighting brittle selectors).

### 3.2 Local Backend (FastAPI)

Responsibilities:

- Receive scraped `JobPosting` from the extension
- Load resume content
- Build the prompt
- Call DeepSeek API
- Validate the JSON response against a schema
- Return `ApplicationDraft` to the extension
- Persist the application record (draft, edits, outcome) to local SQLite

Endpoints:

| Method | Path                        | Purpose                                              |
| ------ | --------------------------- | ---------------------------------------------------- |
| POST   | `/jobs/normalize`           | Accepts raw scrape, returns cleaned `JobPosting`     |
| POST   | `/applications/generate`    | Accepts `JobPosting`, returns `ApplicationDraft`     |
| POST   | `/applications/{id}/save`   | Persists user-edited draft + status                  |
| GET    | `/applications`             | Lists past applications (for the Job Memory queries) |
| POST   | `/applications/{id}/status` | Updates status (interview, offer, rejected, etc.)    |

Runs on `localhost` only, no external exposure needed. The DeepSeek API key lives in a local `.env` file, never sent to the browser.

### 3.3 DeepSeek API Integration

- Base URL: `https://api.deepseek.com/v1/chat/completions` (OpenAI-compatible schema)
- Recommended model: `deepseek-chat` for tailoring/cover letters (fast, cheap); consider `deepseek-reasoner` only if you want it to reason through ambiguous screening questions — it costs more and is usually unnecessary for this task
- Use **JSON mode / structured output** by instructing the system prompt to return only valid JSON matching a fixed schema, and validate with Pydantic on receipt
- API key stored in environment variable `LLM_API_KEY`, loaded server-side only
- Set a hard `max_tokens` ceiling and a request timeout (e.g., 30s) with a retry-once-then-fail policy
- Log token usage per request to a local file so you can track actual cost over time

Example call (Python, backend-side only):

```python
import os, httpx

async def call_deepseek(messages: list[dict]) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.deepseek.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {os.environ['LLM_API_KEY']}"},
            json={
                "model": "deepseek-chat",
                "messages": messages,
                "response_format": {"type": "json_object"},
                "temperature": 0.4,
                "max_tokens": 1800,
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
```

### 3.4 Review UI

A simple panel (extension popup or localhost web page) showing:

```
----------------------------------------
Software Engineer @ Company X
----------------------------------------
Resume: [ backend.md ▾ ]  (auto-matched, 82% keyword overlap)
----------------------------------------
✓ Professional Summary          [Edit]
✓ Cover Letter                  [Edit]
✓ Screening Questions
   Q: Why do you want to work here?
   <generated answer>            [Edit]
   Q: Salary Expectations
   <generated answer>            [Edit]
   Q: Years of Python Experience
   <generated answer>            [Edit]
----------------------------------------
[ Fill Form ]   [ Cancel ]
```

Rules:

- Nothing is written to the page DOM until the user clicks "Fill Form"
- "Fill Form" only fills fields — it never submits
- Every field the model was unsure about should be flagged (see `confidence` / `missing_information` in the schema) so the user's eye is drawn there first

### 3.5 Application Store (Job Memory)

SQLite database, single file, local. Table sketch:

```sql
CREATE TABLE applications (
    id INTEGER PRIMARY KEY,
    company TEXT,
    role TEXT,
    job_url TEXT,
    date_applied TEXT,
    resume_version TEXT,
    cover_letter TEXT,
    screening_answers_json TEXT,
    status TEXT DEFAULT 'draft', -- draft, submitted, interview, offer, rejected
    notes TEXT,
    created_at TEXT,
    updated_at TEXT
);
```

This is what lets you later ask the local LLM things like "which companies responded to my AI-focused resume version" or "draft a better cover letter than the one I used at Company X" — feed it a SQL query result as context.

---

## 4. Data Schemas

### 4.1 `JobPosting` (adapter output → backend input)

```json
{
  "title": "string",
  "company": "string",
  "location": "string",
  "description": "string",
  "requirements": "string",
  "salary_range": "string | null",
  "source_url": "string",
  "source_site": "linkedin | indeed | greenhouse | lever | ashby | other"
}
```

### 4.2 `ApplicationDraft` (DeepSeek output → review UI input)

```json
{
  "resume_summary": "string",
  "cover_letter": "string",
  "screening_answers": [{ "question": "string", "answer": "string", "confidence": 0.0 }],
  "missing_information": ["string"],
  "overall_confidence": 0.0
}
```

Validate this on the backend with a Pydantic model before it ever reaches the UI — reject and retry once if the model returns malformed JSON.

---

## 5. Resume Content Management (Multi-Resume Support)

Since the system needs to support several resume variants (e.g., backend-focused, ML-focused, frontend-focused), each resume is still small enough on its own to skip RAG — the change is adding a **selection layer** on top, not retrieval within a resume.

### 5.1 Structure

```
data/
  resumes/
    backend.md
    ml.md
    frontend.md
    ...
  profiles/
    backend.json      # structured facts specific to that variant, if they differ
  profile.json         # shared facts: work auth, salary floor, notice period, contact info
  resume_index.json    # metadata used for auto-matching (see 5.2)
```

Each resume file stays a single self-contained document (~800–1,200 words), so whichever one is selected is still sent to DeepSeek in full — no chunking or embeddings needed.

`profile.json` holds facts that should be **identical across all variants** (work authorization, salary expectations, notice period) so those screening answers stay consistent no matter which resume is active. Variant-specific `profiles/*.json` only need to override fields that genuinely differ (e.g., a different "years of experience with X" framing).

### 5.2 Resume Selection

Two ways to pick which resume to use for a given job, both available in the Review UI:

**a) Manual** — a dropdown in the Review UI listing all resumes in `data/resumes/`, defaulting to the last one used for that company/role type if there's a match in the Application Store.

**b) Auto-suggested** — `resume_index.json` stores a short tag list per resume:

```json
{
  "backend.md": { "tags": ["backend", "api", "python", "django", "postgres"] },
  "ml.md": { "tags": ["machine learning", "pytorch", "llm", "nlp", "mlops"] },
  "frontend.md": { "tags": ["react", "frontend", "typescript", "css"] }
}
```

On `/applications/generate`, the backend does a simple keyword-overlap score between the `JobPosting.description`/`requirements` and each resume's tags, and pre-selects the best match in the UI (still overridable by the user — this is a suggestion, not an automatic decision). No embeddings or LLM call needed for this step; a plain keyword match is enough at this scale and keeps the extra step cheap and fast.

If you eventually maintain more than ~8–10 resume variants, or the keyword-overlap heuristic starts picking wrong resumes often, that's the signal to swap in a proper embedding-based similarity search instead — not before.

### 5.3 Schema Updates

`JobPosting` gains an optional field so the extension or backend can pass along an explicit choice:

```json
{
  ...
  "resume_hint": "string | null"
}
```

`ApplicationDraft` gains a field so the UI always shows which resume was used and why:

```json
{
  ...
  "resume_used": "string",
  "resume_selection_reason": "auto-matched | user-selected | last-used-for-company"
}
```

`applications.resume_version` in the Application Store (Section 3.5) already captures which resume was used per application — this is what makes "which resume got the most interviews" queries possible later.

---

## 6. Prompt Design

Keep prompts versioned as files, not inline strings, so you can iterate without touching code:

```
prompts/
  tailor_v1.md
  coverletter_v1.md
  screening_v1.md
```

System prompt should explicitly instruct:

1. Output valid JSON only, matching the given schema, no markdown fences
2. Never invent facts not present in the resume or `profile.json` — if unsure, add the field to `missing_information` instead of guessing
3. Keep tone professional and specific to the job description, not generic
4. Flag any screening question that requests information not present in the provided context (e.g., a specific certification) rather than fabricating an answer

---

## 7. Workflow Stages

```
Scrape → Normalize → Select Resume (auto-match + user override) → Build Prompt
   → Call DeepSeek → Validate JSON → Review UI → User edits → Fill Form
   → User reviews on-page → User clicks Submit → Save to Application Store
```

Each stage should be independently testable — e.g., you can unit test the normalizer against saved HTML fixtures without ever calling the API.

---

## 8. Security & Privacy Notes

- **Data leaves the machine now.** Unlike the local-Ollama version, resume content and job descriptions are sent to DeepSeek's servers on every generation call. Review DeepSeek's API data-retention terms if this matters to you, and avoid putting highly sensitive personal data (SSN, government ID numbers) into `profile.json` or the resume text sent to the API.
- Store `LLM_API_KEY` in a `.env` file excluded from version control, never in the extension's client-side code.
- The local backend should only bind to `localhost` — no need to expose it on the network.
- Consider a per-request cost/token log so a runaway loop (e.g., accidental retry storm) doesn't produce a surprise bill.

---

## 9. Terms of Service Note

Most job boards' terms restrict automated interaction with their pages, including automated form-filling, independent of whether a human ultimately clicks submit. This tool minimizes risk by keeping every meaningful action (form submission) manual, but automated scraping and field-filling may still be outside a given site's ToS. This is a personal-use tool; treat it accordingly and don't distribute it as a general automation product without re-reading the relevant sites' terms.

---

## 10. Implementation Roadmap

1. **Phase 1 — Core loop, one site, one resume:** Greenhouse adapter → normalize → DeepSeek call → review UI (read-only, no fill) → manual copy-paste
2. **Phase 2 — Multi-resume support:** Add `data/resumes/`, `resume_index.json`, keyword-match selection, and the dropdown override in the Review UI
3. **Phase 3 — Form filling:** Add `fillField` to the adapter, wire up "Fill Form" button
4. **Phase 4 — Application Store:** SQLite persistence (including `resume_version`), status tracking
5. **Phase 5 — More adapters:** Lever, Ashby, LinkedIn, Indeed (roughly in order of HTML stability)
6. **Phase 6 — Job Memory queries:** Natural-language queries over past applications, including resume-vs-outcome comparisons ("which resume version gets the most interview requests")
7. **Phase 7 — Polish:** Prompt versioning, confidence-flagging UI, cost tracking dashboard

---

## 11. Suggested Tech Stack

- **Extension:** Manifest V3, vanilla JS or a light framework (Preact) for the review popup
- **Backend:** FastAPI + Pydantic + httpx (async)
- **DB:** SQLite via `sqlite3` or SQLModel
- **LLM:** DeepSeek API (`deepseek-chat`), OpenAI-compatible client library works fine
- **Config:** `.env` + `python-dotenv`
