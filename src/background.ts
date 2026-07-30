// ── Base prompt templates ─────────────────────────────────────────────
// These are the immutable base prompts. They define the role, the rules,
// and the JSON schema. The user's only editable channel is the matching
// `prm*Add` custom-instructions field, which the runner injects into the
// `{{customInstructions}}` slot below.
import { profileToContext, deterministicMatch, getProfile } from './utils/profile-match';
import { DEFAULT_PROMPTS } from './utils/prompt-templates';
import {
  LLM_DEFAULTS,
  type LlmConfig,
  type ResumeEntry,
  createResumeEntry,
  PROFILE_DEFAULTS,
} from './utils/settings-schema';

const EMPTY_CUSTOM = '(none)';

// ── Helpers ───────────────────────────────────────────────────────────

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const rates: Record<string, { p: number; c: number }> = {
    'deepseek-chat': { p: 0.14, c: 0.28 },
    'deepseek-reasoner': { p: 0.55, c: 2.19 },
  };
  const r = rates[model] ?? rates['deepseek-chat']!;
  return (promptTokens / 1_000_000) * r.p + (completionTokens / 1_000_000) * r.c;
}

async function getLlmConfig(): Promise<LlmConfig> {
  const r = await browser.storage.local.get(['llmConfig', 'profile']);
  const s = r as Record<string, unknown>;
  const c = s.llmConfig;
  const pickStr = (k: keyof LlmConfig, d: string): string => {
    if (c && typeof c === 'object' && c !== null) {
      const v = (c as Record<string, unknown>)[k];
      return typeof v === 'string' ? v : d;
    }
    return d;
  };
  const pickArr = (k: keyof LlmConfig): readonly ResumeEntry[] => {
    if (c && typeof c === 'object' && c !== null) {
      const v = (c as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v as ResumeEntry[];
    }
    return [];
  };

  // Migration: old schema had `resume` string + separate `profile` object.
  // Convert to new multi-resume schema on first load.
  let resumes = pickArr('resumes');
  let activeResumeId = pickStr('activeResumeId', LLM_DEFAULTS.activeResumeId);
  if (resumes.length === 0) {
    const oldResume =
      typeof (c as Record<string, unknown> | null)?.['resume'] === 'string'
        ? ((c as Record<string, unknown>)['resume'] as string)
        : '';
    const oldProfile =
      s.profile && typeof s.profile === 'object' && s.profile !== null ? (s.profile as Record<string, unknown>) : {};
    const migratedProfile = { ...PROFILE_DEFAULTS };
    for (const k of Object.keys(PROFILE_DEFAULTS)) {
      const v = oldProfile[k];
      if (v !== undefined && v !== null && v !== '') (migratedProfile as Record<string, unknown>)[k] = v;
    }
    const entry = createResumeEntry('Default', oldResume, migratedProfile);
    (entry as unknown as Record<string, unknown>)['isDefault'] = true;
    resumes = [entry];
    activeResumeId = entry.id;
    // Persist migration so it doesn't run again
    const migratedCfg = {
      ...((c as Record<string, unknown>) || {}),
      resume: undefined,
      profile: undefined,
      activeResumeId,
      resumes,
    };
    delete migratedCfg.resume;
    delete migratedCfg.profile;
    browser.storage.local.set({ llmConfig: migratedCfg }).catch(() => {
      /* best effort */
    });
  }

  return {
    apiUrl: pickStr('apiUrl', LLM_DEFAULTS.apiUrl),
    apiKey: pickStr('apiKey', LLM_DEFAULTS.apiKey),
    model: pickStr('model', LLM_DEFAULTS.model),
    activeResumeId,
    resumes,
    prmExtractAdd: pickStr('prmExtractAdd', LLM_DEFAULTS.prmExtractAdd),
    prmSummaryAdd: pickStr('prmSummaryAdd', LLM_DEFAULTS.prmSummaryAdd),
    prmCoverAdd: pickStr('prmCoverAdd', LLM_DEFAULTS.prmCoverAdd),
    prmQuickAdd: pickStr('prmQuickAdd', LLM_DEFAULTS.prmQuickAdd),
    prmFormAdd: pickStr('prmFormAdd', LLM_DEFAULTS.prmFormAdd),
    prmReplyAdd: pickStr('prmReplyAdd', LLM_DEFAULTS.prmReplyAdd),
  };
}

async function getActiveResume(): Promise<{ content: string; profile: Record<string, unknown> } | null> {
  const cfg = await getLlmConfig();
  const entry = cfg.resumes.find((r) => r.id === cfg.activeResumeId);
  if (!entry) return null;
  return { content: entry.content, profile: entry.profile as unknown as Record<string, unknown> };
}

function isLocalUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes('localhost') || lower.includes('127.0.0.1') || lower.includes('0.0.0.0') || lower.includes(':11434')
  );
}

// F-04: Validate the reply context flags. Anything that isn't a boolean is
// treated as false so a malformed or absent payload can't widen the user's
// data-sharing choices.
function normalizeReplyContext(raw: unknown): { resume: boolean; page: boolean; job: boolean } {
  const fallback = { resume: true, page: true, job: true };
  if (raw === null || typeof raw !== 'object') return fallback;
  const o = raw as Record<string, unknown>;
  return {
    resume: typeof o.resume === 'boolean' ? o.resume : fallback.resume,
    page: typeof o.page === 'boolean' ? o.page : fallback.page,
    job: typeof o.job === 'boolean' ? o.job : fallback.job,
  };
}

async function callLlm(prompt: string): Promise<{
  data: Record<string, unknown>;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number; estimatedCostUsd: number };
}> {
  const cfg = await getLlmConfig();
  const local = isLocalUrl(cfg.apiUrl);

  if (!local && cfg.apiKey === '')
    return Promise.reject(new Error('LLM API key not configured. Go to Options (right-click extension → Options).'));

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!local) headers.Authorization = `Bearer ${cfg.apiKey}`;

  const bodyObj: Record<string, unknown> = {
    model: cfg.model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4,
    max_tokens: 1800,
  };

  // Ollama/open-webui don't support response_format
  if (!local) bodyObj.response_format = { type: 'json_object' };
  // For Ollama, add format instruction to the prompt itself instead
  if (local)
    bodyObj.messages = [
      { role: 'user', content: prompt + '\n\nIMPORTANT: Return ONLY valid JSON. No markdown fences, no extra text.' },
    ];

  const resp = await fetch(`${cfg.apiUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(bodyObj),
  });

  let errorBody = '';
  if (!resp.ok) {
    errorBody = await resp.text().catch(() => 'No body');
    // F-17: Return a concise, provider-safe error to the UI. The full response
    // body (which can contain account/credential details) is logged via
    // console.warn for local debugging, never surfaced in the popup.
    console.warn(`[llm] ${resp.status} from ${cfg.apiUrl} model=${cfg.model} bodyLen=${errorBody.length}`);
    throw new Error(`LLM API error ${resp.status} from ${cfg.apiUrl}`);
  }

  const j = (await resp.json()) as Record<string, unknown>;
  const usage = j.usage as Record<string, number> | undefined;
  const pt = usage?.prompt_tokens ?? 0;
  const ct = usage?.completion_tokens ?? 0;
  const tt = usage?.total_tokens ?? 0;
  const cost = local ? 0 : estimateCost(cfg.model, pt, ct);

  const choices = j.choices as { message: { content: string } }[] | undefined;
  let content = choices?.[0]?.message?.content ?? '{}';

  // F-09: Parse JSON in a quote/escape-aware way. Stripping a complete outer
  // Markdown fence is safe; everything else is delegated to JSON.parse via a
  // depth-aware extractor that respects strings and escapes.
  content = stripCompleteMarkdownFence(content).trim();
  content = extractFirstJsonObject(content);

  const parsed = JSON.parse(content) as Record<string, unknown>;
  return { data: parsed, usage: { promptTokens: pt, completionTokens: ct, totalTokens: tt, estimatedCostUsd: cost } };
}

// Strip a single outer ```json ... ``` (or ``` ... ```) fence only when the
// opening and closing markers balance. Nested fences or stray backticks are
// left intact so JSON.parse can report a clear error.
function stripCompleteMarkdownFence(input: string): string {
  const trimmed = input.trim();
  const openMatch = /^```(?:json)?\s*\n/.exec(trimmed);
  if (openMatch === null) return input;
  const closeIdx = trimmed.lastIndexOf('```');
  if (closeIdx <= openMatch[0].length) return input;
  return trimmed.slice(openMatch[0].length, closeIdx).trimEnd();
}

// Walk the string tracking brace depth while honoring JSON string literals
// (including \" and \\ escapes). Returns the slice up to and including the
// matching closing brace of the first top-level object, or the original string
// if no balanced object is found.
function extractFirstJsonObject(input: string): string {
  const start = input.indexOf('{');
  if (start === -1) return input;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < input.length; i++) {
    const ch = input[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return input.slice(start, i + 1);
    }
  }
  return input.slice(start);
}

function fillTemplate(tpl: string, vars: Record<string, string>): string {
  let r = tpl;
  for (const [k, v] of Object.entries(vars)) r = r.replaceAll(`{{${k}}}`, v);
  return r;
}

// Compose the final prompt from a base template + the user's custom
// instructions. The base template's structure (role, rules, schema, data
// placeholders) is locked — only the `{{customInstructions}}` slot is
// filled with user text. Whitespace-only additions are treated as empty.
function composePrompt(base: string, customAdd: string): string {
  const trimmed = customAdd.trim();
  return fillTemplate(base, { customInstructions: trimmed === '' ? EMPTY_CUSTOM : trimmed });
}

// ── Relays ────────────────────────────────────────────────────────────

async function ensureContentScript(tabId: number): Promise<void> {
  try {
    await browser.tabs.sendMessage(tabId, { type: 'ping' });
  } catch {
    try {
      await browser.scripting.executeScript({ target: { tabId }, files: ['content-scripts/content.js'] });
      await new Promise((r) => setTimeout(r, 50));
    } catch {
      throw new Error('Could not inject content script');
    }
  }
}

async function relayToActiveTab(msg: Record<string, unknown>, sendResponse: (r: unknown) => void): Promise<void> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tid = tabs[0]?.id;
  if (!tid) {
    sendResponse({ success: false, error: 'No active tab' });
    return;
  }
  try {
    await ensureContentScript(tid);
  } catch (e: unknown) {
    sendResponse({ success: false, error: e instanceof Error ? e.message : 'Unknown' });
    return;
  }
  const r = await browser.tabs.sendMessage(tid, msg);
  sendResponse(r);
}

// ── Focused job-tailor handlers ──────────────────────────────────────
// Each handler resolves the job (using structured extraction when
// possible, otherwise an LLM extraction — cached in session storage by
// URL so the second button doesn't re-extract), then runs ONE focused
// generation. The combined "scrape & tailor" wall (summary + cover +
// screening answers + missing info) was replaced with two discrete
// actions. Screening-style free-form questions are still handled by
// the form-fill path (`backend:matchFormFields` + `prmForm`).

interface ExtractionPayload {
  readonly source: 'jsonld' | 'readability' | 'treewalker';
  readonly title: string;
  readonly company: string;
  readonly location: string;
  readonly description: string;
  readonly rawText: string;
  readonly url: string;
  readonly ts: number;
}

interface ResolvedJob {
  readonly title: string;
  readonly company: string;
  readonly location: string;
  readonly description: string;
  readonly extractionSource: ExtractionPayload['source'];
}

async function resolveJob(
  ex: ExtractionPayload,
  cfg: LlmConfig,
): Promise<{ job: ResolvedJob | null; err?: { error: string; debug: string } }> {
  const cacheKey = `extract:v1:${ex.url}`;
  try {
    const cached = await browser.storage.session.get(cacheKey);
    const v = cached?.[cacheKey] as Record<string, unknown> | undefined;
    if (
      v &&
      typeof v === 'object' &&
      typeof v.title === 'string' &&
      v.title.length > 0 &&
      typeof v.description === 'string'
    ) {
      return {
        job: {
          title: v.title,
          company: typeof v.company === 'string' ? v.company : '',
          location: typeof v.location === 'string' ? v.location : '',
          description: v.description,
          extractionSource: typeof v.source === 'string' ? (v.source as ExtractionPayload['source']) : ex.source,
        },
      };
    }
  } catch {
    /* fall through */
  }

  const hasStructured = ex.source === 'jsonld' || (ex.source === 'readability' && ex.title.length > 0);
  let title = '';
  let company = '';
  let location = '';
  let description = '';
  if (hasStructured) {
    title = ex.title;
    company = ex.company;
    location = ex.location;
    description = ex.description;
  } else {
    const extr = await callLlm(
      composePrompt(DEFAULT_PROMPTS.prmExtract, cfg.prmExtractAdd).replace('{{pageText}}', ex.rawText.slice(0, 30000)),
    );
    title = typeof extr.data.title === 'string' ? extr.data.title : '';
    company = typeof extr.data.company === 'string' ? extr.data.company : '';
    location = typeof extr.data.location === 'string' ? extr.data.location : '';
    description = typeof extr.data.description === 'string' ? extr.data.description : '';
  }
  if (!title || !description)
    return {
      job: null,
      err: {
        error: 'Could not extract job details from page.',
        debug: `source=${ex.source} title="${title}" company="${company}" descLen=${description.length}`,
      },
    };
  const job: ResolvedJob = { title, company, location, description, extractionSource: ex.source };
  try {
    await browser.storage.session.set({ [cacheKey]: { ...job, source: ex.source } });
  } catch {
    /* best effort */
  }
  return { job };
}

async function handleSummary(
  payload: { extraction: ExtractionPayload },
  sendResponse: (r: unknown) => void,
): Promise<void> {
  const cfg = await getLlmConfig();
  const active = await getActiveResume();
  const resumeContent = active?.content ?? '';
  if (!isLocalUrl(cfg.apiUrl) && cfg.apiKey === '') {
    sendResponse({
      success: false,
      error: 'LLM API key not configured. Go to Options (right-click extension → Options).',
    });
    return;
  }
  if (resumeContent === '') {
    sendResponse({ success: false, error: 'Resume not configured. Go to Options (right-click extension → Options).' });
    return;
  }
  try {
    const { job, err } = await resolveJob(payload.extraction, cfg);
    if (!job) {
      sendResponse({ success: false, ...(err ?? { error: 'No job data', debug: '' }) });
      return;
    }
    const r = await callLlm(
      composePrompt(DEFAULT_PROMPTS.prmSummary, cfg.prmSummaryAdd)
        .replace('{{jobDescription}}', job.description)
        .replace('{{resumeContent}}', resumeContent),
    );
    const summary = typeof r.data.resumeSummary === 'string' ? r.data.resumeSummary : '';
    if (summary === '') {
      sendResponse({ success: false, error: 'Model returned an empty summary.' });
      return;
    }
    sendResponse({
      success: true,
      data: {
        kind: 'summary' as const,
        title: job.title,
        company: job.company,
        location: job.location,
        summary,
        confidence: typeof r.data.confidence === 'number' ? r.data.confidence : null,
        tokenUsage: r.usage,
      },
    });
  } catch (e: unknown) {
    sendResponse({ success: false, error: e instanceof Error ? e.message : 'Summary generation failed' });
  }
}

async function handleCoverLetter(
  payload: { extraction: ExtractionPayload },
  sendResponse: (r: unknown) => void,
): Promise<void> {
  const cfg = await getLlmConfig();
  const active = await getActiveResume();
  const resumeContent = active?.content ?? '';
  if (!isLocalUrl(cfg.apiUrl) && cfg.apiKey === '') {
    sendResponse({
      success: false,
      error: 'LLM API key not configured. Go to Options (right-click extension → Options).',
    });
    return;
  }
  if (resumeContent === '') {
    sendResponse({ success: false, error: 'Resume not configured. Go to Options (right-click extension → Options).' });
    return;
  }
  try {
    const { job, err } = await resolveJob(payload.extraction, cfg);
    if (!job) {
      sendResponse({ success: false, ...(err ?? { error: 'No job data', debug: '' }) });
      return;
    }
    const r = await callLlm(
      composePrompt(DEFAULT_PROMPTS.prmCover, cfg.prmCoverAdd)
        .replace('{{jobDescription}}', job.description)
        .replace('{{resumeContent}}', resumeContent),
    );
    const cover = typeof r.data.coverLetter === 'string' ? r.data.coverLetter : '';
    if (cover === '') {
      sendResponse({ success: false, error: 'Model returned an empty cover letter.' });
      return;
    }
    sendResponse({
      success: true,
      data: {
        kind: 'coverLetter' as const,
        title: job.title,
        company: job.company,
        location: job.location,
        coverLetter: cover,
        confidence: typeof r.data.confidence === 'number' ? r.data.confidence : null,
        tokenUsage: r.usage,
      },
    });
  } catch (e: unknown) {
    sendResponse({ success: false, error: e instanceof Error ? e.message : 'Cover letter generation failed' });
  }
}

async function handleQuickMatch(pageText: string, sendResponse: (r: unknown) => void): Promise<void> {
  const cfg = await getLlmConfig();
  const active = await getActiveResume();
  const resumeContent = active?.content ?? '';
  if (!isLocalUrl(cfg.apiUrl) && cfg.apiKey === '') {
    sendResponse({ success: false, error: 'API key not configured.' });
    return;
  }
  if (resumeContent === '') {
    sendResponse({ success: false, error: 'Resume not configured.' });
    return;
  }
  try {
    const r = await callLlm(
      composePrompt(DEFAULT_PROMPTS.prmQuick, cfg.prmQuickAdd)
        .replace('{{jobDescription}}', pageText.slice(0, 10000))
        .replace('{{resumeContent}}', resumeContent),
    );
    sendResponse({
      success: true,
      data: {
        score: typeof r.data.score === 'number' ? r.data.score : 5,
        verdict: typeof r.data.verdict === 'string' ? r.data.verdict : 'Moderate Match',
        reasons: Array.isArray(r.data.reasons)
          ? r.data.reasons.filter((x: unknown): x is string => typeof x === 'string')
          : [],
        tokenUsage: r.usage,
      },
    });
  } catch (e: unknown) {
    sendResponse({ success: false, error: e instanceof Error ? e.message : 'Quick match failed' });
  }
}

async function handleFormMatch(
  payload: {
    fields: { id: string; label: string; type: string; maxLength: number; options: readonly string[] }[];
    sourceUrl?: string;
  },
  sendResponse: (r: unknown) => void,
): Promise<void> {
  const fields = payload.fields;
  const sourceUrl = payload.sourceUrl ?? '';
  const cfg = await getLlmConfig();
  const active = await getActiveResume();
  const resumeContent = active?.content ?? '';
  if (!isLocalUrl(cfg.apiUrl) && cfg.apiKey === '') {
    sendResponse({ success: false, error: 'API key not configured.' });
    return;
  }
  const profile = active?.profile ?? (await getProfile());

  let jobTitle = '';
  let jobCompany = '';
  if (sourceUrl !== '') {
    try {
      const key = `extract:v1:${sourceUrl}`;
      const stored = await browser.storage.session.get(key);
      const v = stored?.[key] as Record<string, unknown> | undefined;
      if (v && typeof v === 'object') {
        jobTitle = typeof v.title === 'string' ? v.title : '';
        jobCompany = typeof v.company === 'string' ? v.company : '';
      }
    } catch {
      /* fall through */
    }
  }

  const values: { fieldId: string; value: string; confidence: number; source: 'profile' | 'llm' }[] = [];
  const unmatched: string[] = [];
  const llmFields: { id: string; label: string; type: string; maxLength: number; options: readonly string[] }[] = [];

  for (const f of fields) {
    const det = deterministicMatch(f.label, profile);
    if (det) {
      // F-02: Validate the deterministic match against live field options
      // before it can reach the filler. A radio that doesn't have a matching
      // option is rejected here so the LLM path or unmatched list can take over.
      if ((f.type === 'select' || f.type === 'radio') && f.options.length > 0) {
        const matched = f.options.find((o) => o.toLowerCase() === det.value.toLowerCase());
        if (matched) {
          values.push({ fieldId: f.id, value: matched, confidence: det.confidence, source: 'profile' });
          continue;
        }
        llmFields.push(f);
        continue;
      }
      values.push({ fieldId: f.id, value: det.value, confidence: det.confidence, source: 'profile' });
      continue;
    }
    llmFields.push(f);
  }

  if (llmFields.length > 0) {
    try {
      const ctx = `## Candidate Profile\n${profileToContext(profile)}\n\n## Job\nTitle: ${jobTitle}\nCompany: ${jobCompany}\nPage URL: ${sourceUrl}\n\n## Resume\n${resumeContent.slice(0, 3000)}`;
      const r = await callLlm(
        composePrompt(DEFAULT_PROMPTS.prmForm, cfg.prmFormAdd)
          .replace('{{candidateContext}}', ctx)
          .replace('{{fieldsJson}}', JSON.stringify(llmFields, null, 2)),
      );
      const valuesRaw = r.data.values;
      if (Array.isArray(valuesRaw)) {
        for (const item of valuesRaw) {
          const o = item as Record<string, unknown>;
          const fid = typeof o.fieldId === 'string' ? o.fieldId : '';
          const val = typeof o.value === 'string' ? o.value : '';
          const conf = typeof o.confidence === 'number' ? o.confidence : 0.5;
          if (fid !== '' && val !== '') {
            const target = llmFields.find((x) => x.id === fid);
            if (target?.type === 'select' && target.options.length > 0) {
              const matched = target.options.find((o) => o.toLowerCase() === val.toLowerCase());
              if (matched) {
                values.push({ fieldId: fid, value: matched, confidence: conf, source: 'llm' });
                continue;
              }
              unmatched.push(fid);
              continue;
            }
            values.push({ fieldId: fid, value: val, confidence: conf, source: 'llm' });
          } else {
            unmatched.push(fid);
          }
        }
      }
      const unmatchedRaw = r.data.unmatched;
      const llmUnmatched: string[] = Array.isArray(unmatchedRaw)
        ? unmatchedRaw.filter((x: unknown): x is string => typeof x === 'string')
        : [];
      for (const fid of llmUnmatched) if (!unmatched.includes(fid)) unmatched.push(fid);
    } catch (_e: unknown) {
      for (const f of llmFields) if (!unmatched.includes(f.id)) unmatched.push(f.id);
    }
  }

  for (const f of llmFields) {
    if (!values.find((v) => v.fieldId === f.id) && !unmatched.includes(f.id)) unmatched.push(f.id);
  }

  sendResponse({
    success: true,
    data: {
      values,
      unmatched,
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
    },
  });
}

async function handleReply(
  payload: {
    readonly pageText: string;
    readonly jobDescription: string;
    readonly resumeContent: string;
    readonly replyPrompt: string;
    readonly replyContext: { readonly resume: boolean; readonly page: boolean; readonly job: boolean };
  },
  sendResponse: (r: unknown) => void,
): Promise<void> {
  const cfg = await getLlmConfig();
  const active = await getActiveResume();
  const storedResumeContent = active?.content ?? '';
  if (!isLocalUrl(cfg.apiUrl) && cfg.apiKey === '') {
    sendResponse({ success: false, error: 'API key not configured.' });
    return;
  }
  if (storedResumeContent === '') {
    sendResponse({ success: false, error: 'Resume not configured.' });
    return;
  }
  // F-04: Honor the user's context chip selection. Each source is included
  // only when its flag is true; if none are true, refuse rather than silently
  // sending an empty prompt.
  const ctx = payload.replyContext;
  const anyIncluded = ctx.resume || ctx.page || ctx.job;
  if (!anyIncluded) {
    sendResponse({ success: false, error: 'No context selected. Enable at least one context chip.' });
    return;
  }
  const pageText = ctx.page ? payload.pageText : '';
  const jobDescription = ctx.job ? payload.jobDescription : '';
  const resumeContent = ctx.resume ? storedResumeContent.slice(0, 2000) : '';
  try {
    const prompt = composePrompt(DEFAULT_PROMPTS.prmReply, cfg.prmReplyAdd)
      .replace('{{userIntent}}', payload.replyPrompt)
      .replace('{{pageText}}', pageText.slice(0, 5000))
      .replace('{{jobDescription}}', jobDescription)
      .replace('{{resumeContent}}', resumeContent);
    const r = await callLlm(prompt);
    let reply = typeof r.data.reply === 'string' ? r.data.reply : '';
    if (reply === '') reply = typeof r.data.response === 'string' ? r.data.response : '';
    if (reply === '') reply = typeof r.data.message === 'string' ? r.data.message : '';
    if (reply === '') reply = typeof r.data.content === 'string' ? r.data.content : '';
    if (reply === '') reply = typeof r.data.text === 'string' ? r.data.text : '';
    sendResponse({ success: true, data: { reply, tokenUsage: r.usage } });
  } catch (e: unknown) {
    sendResponse({ success: false, error: e instanceof Error ? e.message : 'Reply generation failed' });
  }
}

async function handleParseResume(sendResponse: (r: unknown) => void): Promise<void> {
  const cfg = await getLlmConfig();
  const active = await getActiveResume();
  const resumeContent = active?.content ?? '';
  if (!isLocalUrl(cfg.apiUrl) && cfg.apiKey === '') {
    sendResponse({ success: false, error: 'API key not configured.' });
    return;
  }
  if (resumeContent === '') {
    sendResponse({ success: false, error: 'Resume not configured. Paste your resume first.' });
    return;
  }
  const profileFields = [
    'fullName',
    'contactEmail',
    'contactPhone',
    'city',
    'state',
    'linkedin',
    'portfolioUrl',
    'githubUrl',
    'workAuthorization',
    'salaryExpectations',
    'noticePeriod',
    'willingToRelocate',
    'yearsOfExperience',
    'currentTitle',
    'currentCompany',
    'highestDegree',
    'university',
    'fieldOfStudy',
    'desiredRole',
    'preferredLocation',
    'remotePreference',
  ];
  try {
    const prompt = `## System
You are a resume parser. Extract structured profile fields from the candidate's resume. Return ONLY valid JSON.

## Rules
1. Use the EXACT keys in the schema. Do not add or rename fields.
2. Infer values from the resume text where possible. If a field cannot be determined, set it to "".
3. "yearsOfExperience" must be a number. Count from the earliest job or education date mentioned. If unclear, set to 0.
4. "willingToRelocate" should be "Yes", "No", or "Open" based on any relocation mentions.
5. "remotePreference" should be "Remote", "Hybrid", or "On-site" based on any remote work mentions.
6. "workAuthorization" should reflect any visa/citizenship mentions. If not found, set to "".
7. NEVER invent facts not present in the resume.
8. For URL fields (linkedin, portfolioUrl, githubUrl), always output the FULL standard URL (e.g., "https://www.linkedin.com/in/username", "https://www.github.com/username"). Never output shorthand like "linkedin.com/in/username" or "github.com/username".

## Schema
{"fullName":"string","contactEmail":"string","contactPhone":"string","city":"string","state":"string","linkedin":"string","portfolioUrl":"string","githubUrl":"string","workAuthorization":"string","salaryExpectations":"string","noticePeriod":"string","willingToRelocate":"string","yearsOfExperience":0,"currentTitle":"string","currentCompany":"string","highestDegree":"string","university":"string","fieldOfStudy":"string","desiredRole":"string","preferredLocation":"string","remotePreference":"string"}

## Resume
${resumeContent.slice(0, 8000)}`;
    const r = await callLlm(prompt);
    const profile: Record<string, unknown> = {};
    for (const f of profileFields) {
      const val = r.data[f];
      if (f === 'yearsOfExperience') {
        profile[f] = typeof val === 'number' ? val : typeof val === 'string' ? parseInt(val, 10) || 0 : 0;
      } else {
        profile[f] = typeof val === 'string' ? val : '';
      }
    }
    // Update the active resume's profile with parsed data
    const updatedResumes = cfg.resumes.map((entry) =>
      entry.id === cfg.activeResumeId
        ? { ...entry, profile: profile as unknown as typeof PROFILE_DEFAULTS, updatedAt: Date.now() }
        : entry,
    );
    browser.storage.local
      .set({
        llmConfig: { ...cfg, resumes: updatedResumes },
      })
      .catch(() => {
        /* best effort */
      });
    sendResponse({ success: true, data: { profile, tokenUsage: r.usage } });
  } catch (e: unknown) {
    sendResponse({ success: false, error: e instanceof Error ? e.message : 'Resume parsing failed' });
  }
}

// ── Router ────────────────────────────────────────────────────────────

browser.runtime.onMessage.addListener(
  (msg: Record<string, unknown>, _sender: unknown, sendResponse: (r: unknown) => void): boolean => {
    if (msg.type === 'backend:summary') {
      handleSummary(msg.payload as Parameters<typeof handleSummary>[0], sendResponse);
      return true;
    }
    if (msg.type === 'backend:coverLetter') {
      handleCoverLetter(msg.payload as Parameters<typeof handleCoverLetter>[0], sendResponse);
      return true;
    }
    if (msg.type === 'backend:quickMatch') {
      handleQuickMatch(((msg.payload as Record<string, unknown>)?.pageText as string) ?? '', sendResponse);
      return true;
    }
    if (msg.type === 'backend:matchFormFields') {
      handleFormMatch(msg.payload as Parameters<typeof handleFormMatch>[0], sendResponse);
      return true;
    }
    if (msg.type === 'backend:reply') {
      const p = (msg.payload as Record<string, unknown>) ?? {};
      handleReply(
        {
          pageText: typeof p.pageText === 'string' ? p.pageText : '',
          jobDescription: typeof p.jobDescription === 'string' ? p.jobDescription : '',
          resumeContent: typeof p.resumeContent === 'string' ? p.resumeContent : '',
          replyPrompt: typeof p.replyPrompt === 'string' ? p.replyPrompt : '',
          replyContext: normalizeReplyContext(p.replyContext),
        },
        sendResponse,
      );
      return true;
    }
    if (msg.type === 'backend:parseResume') {
      handleParseResume(sendResponse);
      return true;
    }
    if (msg.type === 'scrape') {
      relayToActiveTab(
        { type: 'scrape', kind: msg.kind, quickMatch: msg.quickMatch, reply: msg.reply, replyPrompt: msg.replyPrompt },
        sendResponse,
      );
      return true;
    }
    if (msg.type === 'scrapeFormFields') {
      relayToActiveTab({ type: 'scrapeFormFields' }, sendResponse);
      return true;
    }
    if (msg.type === 'fillForm') {
      relayToActiveTab({ type: 'fillForm', answers: msg.answers }, sendResponse);
      return true;
    }
    if (msg.type === 'fillFormMatched') {
      relayToActiveTab({ type: 'fillFormMatched', matches: msg.matches }, sendResponse);
      return true;
    }
    if (msg.type === 'revertForm') {
      relayToActiveTab({ type: 'revertForm' }, sendResponse);
      return true;
    }
    return false;
  },
);
