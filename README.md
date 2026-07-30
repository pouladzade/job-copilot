# Job Copilot

[![CI](https://github.com/pouladzade/job-hunter-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/pouladzade/job-hunter-agent/actions/workflows/ci.yml)
[![codecov](https://codecov.io/github/pouladzade/job-copilot/graph/badge.svg?token=ZPVGLNZQVW)](https://codecov.io/github/pouladzade/job-copilot)
[![Release](https://img.shields.io/github/v/release/pouladzade/job-hunter-agent?color=%238B6DFF)](https://github.com/pouladzade/job-hunter-agent/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-orange)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Chrome](https://img.shields.io/badge/Chrome-MV3-success)](.output/chrome-mv3)
[![Firefox](https://img.shields.io/badge/Firefox-MV3-ff7139)](.output/firefox-mv3)
[![Safari](https://img.shields.io/badge/Safari-MV3-1b88ca)](.output/safari-mv3)
[![License](https://img.shields.io/badge/license-Apache%202.0-%238B6DFF)](LICENSE)

A browser extension that scrapes any job posting, tailors your application with AI, fills web forms, and crafts message replies — all without ever submitting anything automatically.

![Popup with Resume selector](docs/screenshots/copilot-idle.png)

**No backend. No database. No Docker.** Everything runs in your browser. Your API key, resume, and profile stay in the extension's local storage. The extension works on **any job board** — LinkedIn, Greenhouse, Lever, Ashby, Personio, Workday, Indeed, Wellfound, company career pages, etc.

---

## Table of Contents

- [Features](#features)
- [Multi-Browser Support](#multi-browser-support)
- [Install & Build](#install--build)
- [Configuration](#configuration)
- [Settings Reference](#settings-reference)
- [Using the Extension](#using-the-extension)
- [Permissions](#permissions)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)

---

## Features

### 🔍 Summary — Professional Resume Summary

Click **Summary** on any job posting to generate a 3–5 sentence professional summary paragraph tailored to the role. The prompt:

- Leads with your current title, years of experience, and one quantified achievement from your resume
- Weaves in 1–2 named skills the job description emphasises (only if your resume already shows them)
- Names the company and the specific role title
- Returns a confidence score (0.0–1.0) indicating how well your resume supports the summary

Use it as the **Professional Summary** section at the top of your resume. The result is shown inline with copy-to-clipboard.

### ✍️ Cover Letter

Click **Cover Letter** on any job posting to generate a tailored 250–350 word cover letter:

- 3 paragraphs: (1) role + why this company, (2) the most relevant 1–2 resume experiences with metrics, (3) availability + close
- Never invents facts not in your resume
- Addresses "Hiring Team" unless the job description names a recruiter
- Returns a confidence score reflecting resume fit

### ⚡ Quick Match — Suitability Score

Click **Quick Match** on any job posting to get a fast 0–10 fit score before spending tokens on a full generation:

| Score | Verdict                                                                         |
| ----- | ------------------------------------------------------------------------------- |
| 9–10  | **Strong Match** — resume names 3+ required skills and experience level matches |
| 6–8   | **Moderate Match** — missing 1–2 requirements but adjacent skills are present   |
| 3–5   | **Weak Match** — large skill or seniority gap                                   |
| 0–2   | Not a fit                                                                       |

The result also includes 2–4 short, evidence-grounded reasons — each citing something from your resume AND something from the job description.

### ✏️ Fill Form

Open any web form (job application, contact form, etc.) and click **Fill Form** in the popup. The extension:

1. Scrapes every visible form field (input, select, textarea)
2. Sends the field list + your profile + resume to the LLM
3. Receives `{ value, confidence }` for each field plus an `unmatched` list
4. Fills the fields by setting their DOM `value` (or `checked`/`selectedIndex`) and then dispatching `input` + `change` events so any framework listeners attached to the element run. Note: React tracks input values through its own value setter — for React-controlled inputs the fill writes the property first and then dispatches the native event. Verify behavior on the target site; the extension does not attempt to bypass React's synthetic event system.
5. **Leaves submission entirely up to you** — no auto-submit, ever

The Fill Form prompt is tuned to handle screening-style open-ended questions ("Why this company?", "Tell us about yourself", "Anything else?"), drawing specifics from your resume + the job description rather than generic platitudes.

### 💬 Message Reply

Type your intent (e.g. _"I'm interested but the salary is below my range"_) and click **Reply**. The extension:

- Reads the page context (the message being replied to) via a content script
- Drafts a 2–5 sentence reply grounded in your resume, profile, and the page context
- Mirrors tone: formal for HR, casual for engineering teams, warm for founders
- Uses profile values verbatim when salary, notice period, work auth, or location are mentioned

Three optional context chips:

- 📄 **Resume** — include your resume in the reply context
- 💬 **Page** — include the page text (the message being replied to)
- 💼 **Job** — include the job description (auto-disabled if no scrapeable page is open)

Reply generation flushes your latest custom-instructions edit before requesting the LLM, so changes apply immediately.

### 🔎 LinkedIn Search Builder

Build LinkedIn job search URLs from a structured form instead of hand-typing Boolean queries. Open the Options page → **LinkedIn Search Builder**. Configure:

- **Job titles** — comma-separated, joined with `OR`
- **Included skills** — AND-joined keywords
- **Excluded skills** — excluded with `NOT`
- **Location / Cities** — comma-separated, AND-joined
- **Time posted** — 24h / 1 week / 1 month
- **Workplace type** — On-site / Hybrid / Remote
- **Experience level** — Internship / Entry / Associate / Mid-Senior / Director / Executive
- **Job type** — Full-time / Part-time / Contract / Temporary / Volunteer / Internship
- **Easy Apply** — toggle
- **Sort by** — relevance / date posted

Click **🔍 Search on LinkedIn** to open the search in a new tab.

### 💾 Saved Presets

Name and save multiple search configs (e.g. _"Backend Remote Germany"_, _"Senior iOS Berlin"_) for quick reuse. Presets are stored in `chrome.storage.local` and sync between the Options page builder and the popup's Presets view. The popup's Copilot tab also shows a quick "Search LinkedIn · &lt;preset name&gt;" button that opens the first saved preset's search in one click.

---

## Multi-Browser Support

The extension is built with [WXT](https://wxt.dev/), which produces separate MV3 builds for each browser:

| Browser                             | Build target                              | Build script         |
| ----------------------------------- | ----------------------------------------- | -------------------- |
| Chrome / Edge / Brave / Arc / Opera | `chrome-mv3`                              | `pnpm build:chrome`  |
| Firefox 128+                        | `firefox-mv3`                             | `pnpm build:firefox` |
| Safari 17+                          | `safari-mv3`                              | `pnpm build:safari`  |
| **All three**                       | `chrome-mv3`, `firefox-mv3`, `safari-mv3` | `pnpm build`         |

Each target emits to `.output/<browser>-mv3/` with a browser-specific `manifest.json`. Differences are minimal — for example, Firefox uses `background.scripts` (event pages) while Chrome uses `background.service_worker`. The application logic, UI, settings schema, and prompt templates are identical across browsers.

---

## Install & Build

### Prerequisites

- Node.js 20+
- pnpm 9+

### Build

```bash
pnpm install
pnpm build               # builds all three browser targets
# or individually:
pnpm build:chrome
pnpm build:firefox
pnpm build:safari
```

### Development

```bash
pnpm dev                 # default browser, hot reload
pnpm dev --browser firefox
```

### Run tests

```bash
pnpm test
pnpm test:ci             # with coverage
```

---

## Loading the Extension

### Chrome / Edge / Brave / Arc / Opera

1. Build: `pnpm build:chrome`
2. Open `chrome://extensions` (or `edge://extensions`, etc.)
3. Enable **Developer mode** (toggle top-right)
4. Click **Load unpacked** → select the `.output/chrome-mv3/` directory
5. Pin the extension for easy access

Updates: click **Reload** on the extension card after each `pnpm build`.

### Firefox 128+

1. Build: `pnpm build:firefox`
2. Open `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on…**
4. Navigate into `.output/firefox-mv3/` and select `manifest.json`

Firefox loads extensions unsigned this way; the extension stays active until Firefox restarts. For persistent installation, submit to AMO for signing, or use Firefox Developer Edition / Nightly (signature enforcement disabled by default).

### Safari 17+

1. Build: `pnpm build:safari`
2. Open the extension via Xcode's Safari Extension converter or load the `.output/safari-mv3/` directory through Safari's Develop menu

---

## Configuration

### First-time setup

1. Right-click the extension icon → **Options** (or open `chrome://extensions` → AI Job Copilot → **Extension options**)
2. Click the **🤖 LLM Provider** tab and enter:
   - **API URL** — see [Supported LLM Providers](#supported-llm-providers)
   - **API Key** — your secret; stored in `chrome.storage.local`, never sent anywhere except the API URL you configured
   - **Model** — the model identifier (e.g. `deepseek-chat`, `llama3.1:8b`, `gpt-4o-mini`)
3. Click the **📄 Resume & Profile** tab:
   - Paste your full resume in Markdown
   - Either fill in the 21 profile fields by hand, or click **Auto-fill Profile** to have the LLM extract them from your resume
4. Click **💾 Save All Settings**

You can revisit the Options page any time to edit.

### Supported LLM Providers

Any OpenAI-compatible chat-completions endpoint works:

| Provider              | API URL                       | API Key Required |
| --------------------- | ----------------------------- | ---------------- |
| DeepSeek              | `https://api.deepseek.com`    | Yes (`sk-...`)   |
| OpenAI                | `https://api.openai.com`      | Yes (`sk-...`)   |
| Groq                  | `https://api.groq.com/openai` | Yes              |
| Ollama (local)        | `http://localhost:11434`      | No               |
| LM Studio (local)     | `http://localhost:1234`       | No               |
| Any OpenAI-compatible | Custom                        | Depends          |

Local providers (`localhost` / `127.0.0.1`) automatically skip API key checks and the JSON response-format header.

---

## Settings Reference

The Options page has three tabs and an additional **LinkedIn Search Builder** panel.

### Tab 1: 🤖 LLM Provider

| Field       | Description                                                         |
| ----------- | ------------------------------------------------------------------- |
| **API URL** | The chat-completions endpoint of your LLM provider                  |
| **API Key** | Bearer token sent as `Authorization: Bearer ...` (masked in the UI) |
| **Model**   | The model identifier passed in the request body                     |

### Tab 2: 📄 Resume & Profile

**Multiple Resumes** — You can maintain several resume variants (e.g., _Backend-Focused_, _Frontend-Focused_, _General_). Each resume has its own content, profile, and metadata. The dropdown at the top of the tab lets you switch between them.

- **+ New Resume** — Create a blank resume entry
- **Delete** — Remove the selected resume (hidden when only one exists)
- **Set as Default** — Mark which resume is pre-selected in the popup

**Resume Name** — A display label like "Backend Engineer" or "Staff Platform"

**Resume (Markdown)** — A multiline textarea for your full resume in Markdown. Used by all generation prompts as the source of truth. **Do not invent experience** — the prompts strictly forbid fabrication.

**Auto-fill Profile** — Click to have the LLM extract structured fields from the current resume and populate its profile form. Uses `backend:parseResume` and requires an API key. The parsed profile is saved to the _current_ resume only, not all resumes.

**Profile Fields** — 21 structured fields per resume, used for form matching, message replies, and quick-match scoring:

| Field               | Type   | Used For                               |
| ------------------- | ------ | -------------------------------------- |
| Full Name           | text   | Form fill                              |
| Email               | text   | Form fill, contact recognition         |
| Phone               | text   | Form fill                              |
| City                | text   | Form fill, location questions          |
| State / Region      | text   | Form fill                              |
| LinkedIn            | text   | Form fill                              |
| Portfolio           | text   | Form fill                              |
| GitHub              | text   | Form fill                              |
| Work Auth           | text   | Form fill (sponsorship/visa questions) |
| Years Exp.          | number | Form fill, Quick Match scoring         |
| Current Title       | text   | Form fill, message reply context       |
| Current Company     | text   | Form fill                              |
| Highest Degree      | text   | Form fill                              |
| University          | text   | Form fill                              |
| Field of Study      | text   | Form fill                              |
| Desired Role        | text   | Quick Match                            |
| Preferred Loc.      | text   | Form fill, message reply               |
| Remote Pref.        | text   | Form fill                              |
| Salary              | text   | Form fill, message reply (verbatim)    |
| Notice Period       | text   | Form fill, message reply (verbatim)    |
| Willing to Relocate | text   | Form fill                              |

### Tab 3: 📝 Prompts

The extension uses **6 base prompts**, one per feature. Each has a fixed JSON schema (locked — to keep output structure stable) and an editable **Custom Instructions** field (appended to the prompt at run time).

| Slot               | What it generates                  | Output schema                               |
| ------------------ | ---------------------------------- | ------------------------------------------- |
| **Job Extract**    | Structured job data from a page    | `{ title, company, location, description }` |
| **Resume Summary** | 3–5 sentence professional summary  | `{ resumeSummary, confidence }`             |
| **Cover Letter**   | 250–350 word tailored cover letter | `{ coverLetter, confidence }`               |
| **Quick Match**    | 0–10 suitability score             | `{ score, verdict, reasons[] }`             |
| **Form Fill**      | Values for arbitrary form fields   | `{ values[], unmatched[] }`                 |
| **Message Reply**  | 2–5 sentence message reply         | `{ reply }`                                 |

The **Custom Instructions** field is your only editable channel — the base prompt is locked. Use it for tone, emphasis, length, or things to avoid. The runner injects your text into a fixed `User Custom Instructions` slot before the data section.

Click **View base prompt** to read the locked system prompt (handy when debugging).

### LinkedIn Search Builder (separate panel on the Options page)

| Field             | Description                                                           |
| ----------------- | --------------------------------------------------------------------- |
| Name              | Display name for the preset                                           |
| Job titles        | Comma-separated, OR-joined                                            |
| Included skills   | Comma-separated, AND-joined keywords                                  |
| Excluded skills   | Comma-separated, NOT-joined                                           |
| Location / Cities | Comma-separated, AND-joined                                           |
| Time posted       | 24h / 1 week / 1 month filter                                         |
| Workplace type    | On-site / Hybrid / Remote                                             |
| Experience level  | Internship / Entry / Associate / Mid-Senior / Director / Executive    |
| Job type          | Full-time / Part-time / Contract / Temporary / Volunteer / Internship |
| Easy Apply        | Toggle                                                                |
| Sort by           | Relevance / Date posted                                               |

Click **🔍 Search on LinkedIn** to open the search.

---

## Using the Extension

The popup has three top-level tabs: **✦ Copilot**, **◐ Presets**, **⚙ Settings**. A **Resume** selector sits at the very top — visible on every tab when you have multiple resumes.

![Popup with Resume selector](docs/screenshots/copilot-idle.png)

---

### ✦ Copilot — the main workflow

On any scrapable page (`http://` or `https://`), the Copilot tab shows the LinkedIn search bar, four primary action buttons, and a Reply section.

#### Idle state — action buttons

| Button           | When to click                                                    |
| ---------------- | ---------------------------------------------------------------- |
| **Summary**      | Generate a 3–5 sentence professional summary tailored to the job |
| **Cover Letter** | Generate a tailored 250–350 word cover letter                    |
| **Quick Match**  | Get a 0–10 fit score before spending tokens on a full generation |
| **Fill Form**    | Auto-fill visible form fields on the current page                |

#### Summary result

![Summary result](docs/screenshots/copilot-summary.png)

Shows the generated professional summary with:

- **Copy** — copies the text to clipboard
- **Regenerate** — re-runs the prompt with the same job
- **Token badge** — shows tokens used and estimated cost

#### Cover Letter result

![Cover Letter result](docs/screenshots/copilot-cover.png)

Same pattern as Summary — Copy, Regenerate, Clear. The cover letter is grounded in your resume and addresses the specific company and role.

#### Quick Match result

![Quick Match result](docs/screenshots/copilot-quickmatch.png)

| Score | Verdict            |
| ----- | ------------------ |
| 9–10  | **Strong Match**   |
| 6–8   | **Moderate Match** |
| 3–5   | **Weak Match**     |
| 0–2   | Not a fit          |

Each reason cites something from your resume AND the job description.

#### Message Reply

Type your intent (e.g. _"I'm interested but the salary is below my range"_) and click **Craft Reply**. Three context chips control what the AI sees:

- 📄 **Resume** — include your resume in the reply context
- 💬 **Page** — include the page text (the message being replied to)
- 💼 **Job** — include the job description (auto-disabled if no scrapeable page is open)

---

### ◐ Presets — saved LinkedIn searches

Build and save LinkedIn job search configs. Each preset stores filters like workplace type, experience level, job type, and Easy Apply.

![Presets tab](docs/screenshots/presets-tab.png)

- Toggle filters with chip buttons
- **Save Changes** — stores the preset
- **Delete** — removes the preset
- **🔍 Search on LinkedIn** — opens the search URL in a new tab

Saved presets also appear in the Copilot tab's LinkedIn search dropdown for quick access.

---

### ⚙ Settings — quick access to Options

A condensed version of the Options page with manual Save. Changes are **not** auto-saved — click **Save** when done.

#### AI tab

![Settings AI tab](docs/screenshots/settings-ai.png)

| Field       | Description                                   |
| ----------- | --------------------------------------------- |
| **API URL** | Your LLM provider's chat-completions endpoint |
| **API Key** | Bearer token (masked in the UI)               |
| **Model**   | Model identifier passed in the request body   |

#### Profile tab

![Settings Profile tab](docs/screenshots/settings-profile.png)

**Resume selector** — Switch between saved resumes. The ★ marks the default.

**+ New** — Create a blank resume entry  
**Delete** — Remove the selected resume (hidden when only one exists)  
**Set as Default** — Marks which resume is pre-selected in the popup

**Resume (Markdown)** — Your full resume text. Used by all AI prompts.  
**Auto-fill Profile** — LLM extracts structured fields from your resume text.

**Profile Fields** — 21 structured fields per resume. Edit by hand or auto-fill.

#### Prompts tab

![Settings Prompts tab](docs/screenshots/settings-prompts.png)

Add short guidance per template (tone, emphasis, things to avoid). Base prompts are locked to keep JSON output stable.

#### Unsaved changes guard

If you try to switch Settings sub-tabs (AI → Profile → Prompts) with unsaved changes, a dialog asks **Stay** or **Discard**. Click **Open Options →** to open the full Options page in a dedicated browser tab.

---

## Permissions

Declared in `manifest.json`:

| Permission                     | Why                                                             |
| ------------------------------ | --------------------------------------------------------------- |
| `<all_urls>` (host permission) | Inject the content script on any job board or application form  |
| `activeTab`                    | Read the current tab's URL when generating                      |
| `storage`                      | Persist settings, drafts, and presets in `chrome.storage.local` |
| `scripting`                    | Inject the content script on demand                             |

The extension never sends your API key, resume, or profile anywhere except the API URL you configure.

---

## Architecture

```
Popup (Preact)  ←→  Background Service Worker  ←→  LLM API
       ↕                       ↕
   Storage                Content Script
                          (runs on every page)
```

- **Popup** — Main UI. Preact app with three tabs (Copilot / Presets / Settings).
- **Background Service Worker** — All LLM API calls, message routing, prompt composition. Persists to `chrome.storage.session` and `chrome.storage.local`.
- **Content Script** — Injected into every page. Scrapes page text (via [@mozilla/readability](https://github.com/mozilla/readability)) and form fields. Sets each control's DOM `value` (or `checked`/`selectedIndex`) and dispatches `input` + `change` events.
- **Options Page** — Full settings UI (LLM / Resume & Profile / Prompts) plus the LinkedIn Search Builder.
- **Storage** — `chrome.storage.local` for everything; `chrome.storage.session` for per-tab cache (extraction results, resolved job metadata). No external database.

### Build pipeline

WXT 0.20 + Vite + `@preact/preset-vite`. Three separate MV3 outputs under `.output/`. TypeScript 5.7 strict mode with `noUncheckedIndexedAccess`. ESLint 10 with `typescript-eslint` and `eslint-config-prettier`. Pre-commit hooks via Husky + lint-staged. Commit messages linted via commitlint (Conventional Commits).

---

## Tech Stack

- TypeScript 5.7 (strict, `noUncheckedIndexedAccess`)
- Preact 10 + `@preact/preset-vite`
- WXT 0.20 (multi-browser MV3 framework)
- Vite
- Jest 29 + ts-jest ESM (167 tests across 8 suites)
- ESLint 10 + Prettier
- Husky + lint-staged + commitlint
- @mozilla/readability for page text extraction

---

## License

Apache 2.0 — see [LICENSE](LICENSE) for details.

---

## Ollama Setup (macOS, Windows, & Linux)

If you encounter **`403 Forbidden`**, **`CORS policy`**, or **`Failed to fetch`** errors when using this tool with your local Ollama instance, you need to update Ollama's allowed origins setting.

### Why & When Is This Needed?

By default, Ollama only accepts API calls sent directly from `localhost`. However, when this extension's service worker makes the API call from a `chrome-extension://` or `moz-extension://` origin, Ollama sees a cross-origin request and blocks it under the browser's CORS rules unless that origin is explicitly allowlisted.

### ⚠️ Scope the origin list to this extension only

Do **not** use `OLLAMA_ORIGINS="*"`. That allowlists every web origin and exposes your local Ollama to any site you visit. Use a narrow list scoped to browser extensions:

- Chrome / Edge / Brave: `chrome-extension://*`
- Firefox: `moz-extension://*`
- Both: `chrome-extension://*,moz-extension://*`

If you want to lock it down further, replace `*` with your specific extension ID — find it at `chrome://extensions` (enable Developer mode → ID column) or `about:debugging#/runtime/this-firefox` on Firefox.

---

### Step-by-Step Configuration

#### 🍎 macOS

Run the following command in your Terminal:

```bash
launchctl setenv OLLAMA_ORIGINS "chrome-extension://*,moz-extension://*"
```

_Next, click the Ollama icon in your macOS menu bar (top right) -> **Quit Ollama**, then reopen the app._

#### 🪟 Windows

1. Right-click the Ollama icon in your system tray (bottom-right taskbar) and click **Quit**.
2. Open the Start Menu, search for **"Environment Variables"**, and select **Edit environment variables for your account**.
3. Click **New...** under User variables (or edit it if it already exists):

- **Variable name:** `OLLAMA_ORIGINS`
- **Variable value:** `chrome-extension://*,moz-extension://*`

4. Click **OK** to save, then restart Ollama from your Start Menu.

#### 🐧 Linux (systemd)

1. Open a terminal and run:

```bash
sudo systemctl edit ollama.service
```

2. Add the environment setting under the `[Service]` section:

```ini
[Service]
Environment="OLLAMA_ORIGINS=chrome-extension://*,moz-extension://*"
```

3. Save, close the editor, and apply the changes:

```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```
