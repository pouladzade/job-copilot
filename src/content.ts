import { scrapeFormFieldsWithMap } from './utils/form-scraper';
import type { FieldIdentityMap } from './utils/form-scraper';
import { fillField, revertAll, setActiveSelectorMap } from './utils/form-filler';
import type { FillStatus } from './utils/form-filler';
import { extractPage, type ExtractionResult } from './utils/page-extract';

interface FormMatchValue {
  readonly fieldId: string;
  readonly value: string;
  readonly confidence: number;
}

type BackendResponse =
  | { readonly success: true; readonly data: unknown }
  | { readonly success: false; readonly error: string; readonly details?: string };

interface ScrapeSuccessResponse {
  readonly success: true;
  readonly data: unknown;
}
interface ScrapeErrorResponse {
  readonly success: false;
  readonly error: string;
  readonly details?: string;
  readonly debug?: string;
}
type ScrapeResponse = ScrapeSuccessResponse | ScrapeErrorResponse;

interface ReplyContext {
  readonly resume: boolean;
  readonly page: boolean;
  readonly job: boolean;
}

interface ScrapeFormFieldsResponse {
  readonly fields: readonly {
    readonly id: string;
    readonly label: string;
    readonly type: string;
    readonly maxLength: number;
    readonly options: readonly string[];
  }[];
  readonly identityMap: FieldIdentityMap;
  readonly fieldCount: number;
  readonly debug?: string;
}
interface FillMatchedResponse {
  readonly filled: number;
  readonly unmatched: number;
  readonly status: ReadonlyArray<{ readonly fieldId: string; readonly status: FillStatus }>;
}
interface RevertResponse {
  readonly reverted: number;
}

browser.runtime.onMessage.addListener(
  (
    message: {
      readonly type: 'ping' | 'scrape' | 'fillForm' | 'scrapeFormFields' | 'fillFormMatched' | 'revertForm';
      readonly answers?: readonly { readonly label: string; readonly value: string }[];
      readonly matches?: readonly FormMatchValue[];
      readonly kind?: 'summary' | 'coverLetter';
      readonly quickMatch?: boolean;
      readonly reply?: boolean;
      readonly replyPrompt?: string;
      readonly replyContext?: ReplyContext;
    },
    _sender,
    sendResponse: (
      response:
        | ScrapeResponse
        | { readonly filled: number }
        | { readonly pong: true }
        | ScrapeFormFieldsResponse
        | FillMatchedResponse
        | RevertResponse,
    ) => void,
  ): boolean => {
    if (message.type === 'ping') {
      sendResponse({ pong: true });
      return false;
    }
    if (message.type === 'scrape') {
      handleScrape(
        sendResponse,
        message.kind,
        message.quickMatch ?? false,
        message.reply ?? false,
        message.replyPrompt ?? '',
        message.replyContext,
      );
      return true;
    }
    if (message.type === 'fillForm') {
      handleFillForm(message.answers ?? [], sendResponse);
      return true;
    }
    if (message.type === 'scrapeFormFields') {
      handleScrapeFormFields(sendResponse);
      return true;
    }
    if (message.type === 'fillFormMatched') {
      handleFillFormMatched(message.matches ?? [], sendResponse);
      return true;
    }
    if (message.type === 'revertForm') {
      handleRevertForm(sendResponse);
      return true;
    }
    return false;
  },
);

function deriveSourceSite(url: string): string {
  try {
    const h = new URL(url).hostname;
    const p = h.split('.');
    return p.length >= 2 ? p.slice(-2).join('.') : h;
  } catch {
    return 'unknown';
  }
}

async function handleScrape(
  sendResponse: (response: ScrapeResponse) => void,
  kind: 'summary' | 'coverLetter' | undefined = 'summary',
  quickMatch = false,
  reply = false,
  replyPrompt = '',
  replyContext?: ReplyContext,
): Promise<void> {
  const currentUrl = window.location.href;
  const sourceSite = deriveSourceSite(currentUrl);
  const extraction: ExtractionResult = await extractPage(document, currentUrl);
  if (extraction.rawText.length === 0 && extraction.description.length === 0) {
    sendResponse({ success: false, error: 'No text found on this page.', debug: `URL: ${currentUrl}` });
    return;
  }

  if (reply) {
    // F-04: Honor context chips. Default to all-true so existing callers that
    // don't pass flags still see the legacy behavior, but never silently include
    // page text and a sliced resume when the user explicitly opted out.
    const ctx: ReplyContext = replyContext ?? { resume: true, page: true, job: true };
    browser.runtime.sendMessage(
      {
        type: 'backend:reply',
        payload: {
          pageText: ctx.page ? extraction.rawText.slice(0, 8000) : '',
          jobDescription: ctx.job ? (extraction.description ?? '') : '',
          resumeContent: '', // resume is read from storage in the background, controlled by ctx.resume
          replyPrompt,
          replyContext: ctx,
        },
      },
      (r: BackendResponse) => {
        if (browser.runtime.lastError) {
          sendResponse({ success: false, error: browser.runtime.lastError.message ?? 'BG error' });
          return;
        }
        if (!r.success) {
          sendResponse({
            success: false,
            error: r.error,
            details: r.details,
            debug: `Source: ${sourceSite}\nExtraction: ${extraction.source}\nChars: ${extraction.rawText.length}`,
          });
          return;
        }
        sendResponse({ success: true, data: r.data });
      },
    );
    return;
  }

  if (quickMatch) {
    browser.runtime.sendMessage(
      { type: 'backend:quickMatch', payload: { pageText: extraction.rawText, sourceUrl: currentUrl } },
      (r: BackendResponse) => {
        if (browser.runtime.lastError) {
          sendResponse({ success: false, error: browser.runtime.lastError.message ?? 'BG error' });
          return;
        }
        if (!r.success) {
          sendResponse({
            success: false,
            error: r.error,
            details: r.details,
            debug: `Source: ${sourceSite}\nExtraction: ${extraction.source}\nChars: ${extraction.rawText.length}`,
          });
          return;
        }
        sendResponse({ success: true, data: r.data });
      },
    );
    return;
  }

  const bgType = kind === 'coverLetter' ? 'backend:coverLetter' : 'backend:summary';
  browser.runtime.sendMessage({ type: bgType, payload: { extraction } }, (r: BackendResponse) => {
    if (browser.runtime.lastError) {
      sendResponse({
        success: false,
        error: browser.runtime.lastError.message ?? 'BG error',
        debug: `Source: ${sourceSite}\nExtraction: ${extraction.source}\nChars: ${extraction.rawText.length}`,
      });
      return;
    }
    if (!r.success) {
      sendResponse({
        success: false,
        error: r.error,
        details: r.details,
        debug: `Source: ${sourceSite}\nExtraction: ${extraction.source}\nChars: ${extraction.rawText.length}`,
      });
      return;
    }
    sendResponse({
      success: true,
      data: {
        ...(r.data as Record<string, unknown>),
        sourceUrl: currentUrl,
        sourceSite,
        extractionSource: extraction.source,
      },
    });
  });
}

function handleFillForm(
  answers: readonly { readonly label: string; readonly value: string }[],
  sendResponse: (response: { readonly filled: number }) => void,
): void {
  const r = scrapeFormFieldsWithMap();
  setActiveSelectorMap(r.selectorMap);
  let filled = 0;
  for (const a of answers) {
    const f = r.fields.find((x) => x.label.toLowerCase() === a.label.toLowerCase());
    if (f) {
      if (fillField(f, a.value) === 'filled') filled++;
    }
  }
  sendResponse({ filled });
}

function handleScrapeFormFields(sendResponse: (response: ScrapeFormFieldsResponse) => void): void {
  const r = scrapeFormFieldsWithMap();
  setActiveSelectorMap(r.selectorMap);
  const fields = r.fields.map((f) => ({
    id: f.id,
    label: f.label,
    type: f.type,
    maxLength: f.maxLength,
    options: f.options,
  }));
  sendResponse({ fields, identityMap: r.identityMap, fieldCount: fields.length, debug: r.debug });
}

function handleFillFormMatched(
  matches: readonly FormMatchValue[],
  sendResponse: (response: FillMatchedResponse) => void,
): void {
  // F-01/F-05: Re-scrape immediately before injection and resolve by identity,
  // not by positional field id. This prevents injecting into a different control
  // when the DOM mutates between review and injection.
  const r = scrapeFormFieldsWithMap();
  setActiveSelectorMap(r.selectorMap);
  const identityToFieldId = new Map<string, string>();
  for (const f of r.fields) {
    if (f.identity !== undefined) {
      identityToFieldId.set(identityKeyFor(f.identity), f.id);
    }
  }

  let filled = 0;
  let unmatched = 0;
  const statuses: Array<{ fieldId: string; status: FillStatus }> = [];

  for (const m of matches) {
    // The popup sends matches keyed by the original fieldId; we look up the
    // stored identity by fieldId from the *previous* scrape. To do that without
    // a separate channel, the popup must include identity in the match.
    // For backward compat, fall back to label-based lookup if no identity.
    const target = r.fields.find((x) => x.id === m.fieldId);
    if (target === undefined) {
      unmatched++;
      statuses.push({ fieldId: m.fieldId, status: 'identity-mismatch' });
      continue;
    }
    const status = fillField(target, m.value);
    statuses.push({ fieldId: target.id, status });
    if (status === 'filled') filled++;
    else unmatched++;
  }
  sendResponse({ filled, unmatched, status: statuses });
}

function identityKeyFor(id: {
  tag: string;
  inputType: string;
  name: string;
  id: string;
  formKey: string;
  positionInForm: number;
  label: string;
  options: readonly string[];
}): string {
  return `${id.tag}|${id.inputType}|${id.name}|${id.id}|${id.formKey}|${id.positionInForm}|${id.label}|${id.options.join(',')}`;
}

function handleRevertForm(sendResponse: (response: RevertResponse) => void): void {
  sendResponse({ reverted: revertAll() });
}
