# Suggestions on the AI Job Copilot Spec

**Review date:** 2026-07-18
**Source:** `docs/idea/raw-idea.md`

---

## 1. Architecture & Data Flow Clarifications

### 1.1 Duplicate normalization concern

The extension already normalizes raw scraped fields into a `JobPosting` JSON (Section 3.1), yet the backend exposes a `POST /jobs/normalize` endpoint (Section 3.2 table). It's unclear what the backend normalizer adds beyond what the adapter already produced. Either:

- **Option A:** Drop the backend endpoint. The extension owns normalization; the backend only receives already-valid `JobPosting` objects and validates them with Pydantic.
- **Option B:** The extension sends raw, un-normalized data to `/jobs/normalize`, and all normalization logic lives server-side. This keeps adapters thin but means every new site requires a backend deploy.

**Recommendation:** Go with Option A. Keep the adapter logic in the extension where it belongs. The backend validates, it doesn't re-normalize.

### 1.2 Communication security (localhost)

Even on localhost, browser extensions hitting `http://localhost:8787` will face CORS restrictions. The backend must explicitly allow the extension's origin (e.g., `chrome-extension://<id>`). This isn't mentioned anywhere.

### 1.3 Error handling flow is underspecified

The spec mentions "retry-once-then-fail" but never defines:

- What does the UI show when DeepSeek is down, rate-limited, or times out?
- What happens when JSON validation fails after retry? Is the raw response shown to the user so they can salvage it manually?
- Is there a "regenerate" button in the UI, or does the user have to re-scrape the page?

**Recommendation:** Define three error states for the Review UI: (a) API unreachable — retry button with countdown, (b) bad JSON — show raw output + manual edit option, (c) timeout — offer to retry with higher timeout.

### 1.4 Idempotency / duplicate scraping

What happens when the user scrapes the same job URL twice? The current flow would generate a new `ApplicationDraft` each time, burning API credits. The backend should check `source_url` against existing applications before calling DeepSeek, and offer to either reuse the existing draft or regenerate.

---

## 2. Schema Design Issues

### 2.1 `JobPosting.description` vs `requirements`

The schema splits these into two fields, but most job boards don't separate them. Adapters will have to arbitrarily decide what counts as "requirements" vs "description." This adds complexity with no clear benefit — the LLM is perfectly capable of extracting requirements from a single text blob. Drop `requirements` and keep only `description`.

### 2.2 Hardcoded `source_site` enum

```json
"source_site": "linkedin | indeed | greenhouse | lever | ashby | other"
```

Every new adapter requires a schema change. Instead, use the adapter's `id` field directly as a free-form string. Validation can check that it matches a known adapter ID, but the enum shouldn't be baked into the JSON schema.

### 2.3 `ApplicationDraft` missing fields

- **No `id` field on `screening_answers` entries.** If a job posting has two similar questions (rare but possible), the UI can't distinguish them for the fill-field mapping. Add a `question_id` (generated from the form field label hash).
- **No `generated_at` timestamp.** Useful for the UI to show "generated 3 minutes ago" and for debugging stale responses.
- **No `token_usage` field.** The spec says to log token usage per request, but the draft itself should carry this so the user can see the cost of this specific generation.

### 2.4 Confidence scoring needs tiers, not raw floats

A float like `0.73` is not actionable for a user. Map to tiers:

| Range | Label | UI treatment |
|-------|-------|-------------|
| 0.0–0.3 | Low | Red flag, strong "review required" indicator |
| 0.3–0.7 | Medium | Yellow warning |
| 0.7–1.0 | High | Green check, but still editable |

The raw float can be stored for queries, but the UI should show labels.

### 2.5 Schema versioning

As the system evolves, old application records in SQLite will have different shapes. Add a `schema_version` field to both `JobPosting` and `ApplicationDraft`, and a migration strategy (even if it's just "re-scrape to upgrade").

---

## 3. Resume Management Gaps

### 3.1 Manual tag drift

`resume_index.json` tags are manually maintained. Within a week, someone will update `backend.md` and forget to update the tags. The match quality degrades silently.

**Recommendation:** On first run (or on a "refresh index" command), pass each resume through DeepSeek once with a simple prompt: "Extract 5–10 keyword tags from this resume" — and write the result to `resume_index.json`. Cache this; it doesn't need to run every time.

### 3.2 No resume editing inside the tool

The spec assumes resumes are edited externally and dropped into `data/resumes/`. That's fine for v1, but at minimum the Review UI should have a "open resume file" link that opens it in the system editor. A full in-app resume editor is out of scope; just don't make the user hunt for the file.

### 3.3 `profile.json` merge strategy undefined

If `profile.json` says `years_python: 5` but `profiles/backend.json` says `years_python: 7`, which wins? The spec says variant profiles "override fields that genuinely differ" but doesn't define the merge behavior (shallow merge? deep merge? error on conflict?). Define this explicitly.

---

## 4. Prompt Design — Missing Evaluation Framework

The spec says to version prompts as files (good) but never defines how to evaluate whether `tailor_v2.md` is better than `tailor_v1.md`. Without an eval framework, prompt versioning is just renaming files.

**Recommendation:** Add a lightweight eval to Phase 7 (or earlier):
- Save 5–10 real job postings as test fixtures
- Run both prompt versions against each
- Store the outputs side-by-side with a simple rating (1–5) on relevance, specificity, and hallucination rate
- Re-run evals before promoting a new prompt version

This doesn't need to be automated at first — a manual review checklist suffices.

---

## 5. UI/UX — Missing States

### 5.1 Loading state

The spec never describes what the user sees during the DeepSeek API call, which could take 5–30 seconds. A spinner with "Tailoring your application..." is the minimum. Better: show a skeleton of the Review UI with placeholder text, so the user knows what's coming.

### 5.2 Progressive rendering

All content (summary + cover letter + screening answers) arrives at once because the API call is a single request. If screening answers are slow to generate, consider splitting into two calls: one for summary + cover letter (fast, shown immediately), one for screening answers (slower, fills in below). This gives the user something to read while waiting.

### 5.3 No "undo fill" mechanism

After clicking "Fill Form," the user may realize the wrong resume was selected or the generated content is wrong. There's no way to revert the form to its pre-fill state except manually clearing fields or reloading the page. The extension should snapshot the form state before filling and offer "Revert to original."

### 5.4 Form field mismatch handling

The `fillField` adapter maps generated answers to form fields by label matching. What if the label changed between scrape and fill (dynamic form)? Or what if the generated answer exceeds the field's `maxlength`? Define fallback behavior: skip the field and flag it in the UI, rather than silently truncating or failing.

---

## 6. Security Hardening

### 6.1 "Avoid putting sensitive data" is a hand-wave

The spec says "avoid putting highly sensitive personal data (SSN, government ID numbers) into profile.json." This is a policy, not a control. Policies fail.

**Recommendation:** Add a server-side PII filter that runs on all text before it's sent to DeepSeek. A simple regex for SSN patterns, credit card numbers, and government ID formats. If a match is found, redact it and log a warning. This is cheap to implement and catches accidents.

### 6.2 Extension-to-backend input sanitization

The backend receives JSON from a browser extension. A compromised or buggy extension could send arbitrarily large payloads, malicious strings, or malformed JSON. Add request size limits (e.g., 50KB for job description) and Pydantic validation with strict mode.

### 6.3 Accidental PII scraping from job pages

If the user is logged into LinkedIn, the DOM may contain their name, profile photo URL, or other personal data in the header/nav. The adapter's `scrapeJobPosting` function should be scoped to the job description container only, never the full page DOM.

---

## 7. Implementation Roadmap Feedback

### 7.1 Phase ordering issue

Phase 4 (Application Store) should come before Phase 3 (Form filling). Reason: you want to record the application as "draft" before filling the form, so there's an audit trail even if the browser crashes mid-fill. Swap Phase 3 and 4.

### 7.2 Phase 6 is over-scoped

"Natural-language queries over past applications" requires either another LLM call per query or a locally running model. That's a separate feature from "which resume gets the most interviews," which is just a SQL query. Split Phase 6:

- **Phase 6a:** Structured queries — pre-built dashboard showing interview rate by resume version, response rate by company, etc. SQL only.
- **Phase 6b (defer):** Natural-language queries — wire up a local model or another DeepSeek call for ad-hoc questions.

### 7.3 Missing Phase: Adapter testing harness

Between Phase 5 (more adapters) and the rest of development, there should be a phase dedicated to adapter health monitoring. Job boards change their HTML frequently. Without automated adapter tests that run against saved HTML fixtures, you'll only discover a broken adapter when you try to use it.

---

## 8. Edge Cases Not Addressed

| Scenario | Current handling | Suggested handling |
|----------|-----------------|-------------------|
| Non-English job posting | Not mentioned | Detect language; if not English, either skip or flag prominently in UI |
| Resume in different language than job | Not mentioned | LLM can handle this but the prompt should explicitly allow it |
| Image-only job posting (no text to scrape) | Not mentioned | Adapter should detect this and show "No text content found" in UI |
| Job posting removed between scrape and submit | Not mentioned | This is fine — the form fill might just fail gracefully; no special handling needed |
| Form field `maxlength` shorter than generated answer | Not mentioned | Truncate with ellipsis, flag field in UI so user knows to review |
| Multiple form pages (Greenhouse multi-step) | Not mentioned | Adapter needs to track "current step" and fill incrementally |
| User has no `profile.json` set up | Not mentioned | Backend should detect missing config and guide user through first-time setup in the UI |

---

## 9. Naming Consistencies

- **"Job Memory" vs "Application Store":** These refer to the same thing. Pick one and use it everywhere. "Application Store" is clearer; "Job Memory" is used once in Section 3.5 and then in the roadmap.
- **"Review UI" vs "review popup" vs "review panel":** Standardize on "Review UI" or "Review Panel."

---

## 10. Summary — Priority Fixes

If you only address three things before implementation, make it these:

1. **Resolve the duplicate normalization question** (1.1) — this affects the entire data flow.
2. **Add loading and error states to the UI specification** (5.1, 1.3) — a spec without error handling is incomplete.
3. **Swap Phase 3 and 4 in the roadmap** (7.1) — persistence before mutation is a basic safety principle.