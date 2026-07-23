import { scrapeFormFieldsWithMap } from './utils/form-scraper';
import { fillField, revertAll, setActiveSelectorMap } from './utils/form-filler';
import {
  extractPage,
  type ExtractionResult,
} from './utils/page-extract';

interface FormMatchValue {
  readonly fieldId: string;
  readonly value: string;
  readonly confidence: number;
}

type BackendResponse =
  | { readonly success: true; readonly data: unknown }
  | { readonly success: false; readonly error: string; readonly details?: string };

interface ScrapeSuccessResponse { readonly success: true; readonly data: unknown; }
interface ScrapeErrorResponse { readonly success: false; readonly error: string; readonly details?: string; readonly debug?: string; }
type ScrapeResponse = ScrapeSuccessResponse | ScrapeErrorResponse;

interface ScrapeFormFieldsResponse {
  readonly fields: readonly { readonly id: string; readonly label: string; readonly type: string; readonly maxLength: number; readonly options: readonly string[] }[];
  readonly fieldCount: number;
  readonly debug?: string;
}
interface FillMatchedResponse { readonly filled: number; readonly unmatched: number; }
interface RevertResponse { readonly reverted: number; }

browser.runtime.onMessage.addListener(
  (message: { readonly type: 'ping' | 'scrape' | 'fillForm' | 'scrapeFormFields' | 'fillFormMatched' | 'revertForm'; readonly answers?: readonly { readonly label: string; readonly value: string }[]; readonly matches?: readonly FormMatchValue[]; readonly kind?: 'summary' | 'coverLetter'; readonly quickMatch?: boolean }, _sender, sendResponse: (response: ScrapeResponse | { readonly filled: number } | { readonly pong: true } | ScrapeFormFieldsResponse | FillMatchedResponse | RevertResponse) => void): boolean => {
    if (message.type === 'ping') { sendResponse({ pong: true }); return false; }
    if (message.type === 'scrape') {
      const m = message as Record<string, unknown>;
      handleScrape(sendResponse, m.kind as 'summary' | 'coverLetter' | undefined, m.quickMatch as boolean, m.reply as boolean, m.replyPrompt as string);
      return true;
    }
    if (message.type === 'fillForm') { handleFillForm(message.answers ?? [], sendResponse); return true; }
    if (message.type === 'scrapeFormFields') { handleScrapeFormFields(sendResponse); return true; }
    if (message.type === 'fillFormMatched') { handleFillFormMatched(message.matches ?? [], sendResponse); return true; }
    if (message.type === 'revertForm') { handleRevertForm(sendResponse); return true; }
    return false;
  },
);

function deriveSourceSite(url: string): string {
  try { const h = new URL(url).hostname; const p = h.split('.'); return p.length >= 2 ? p.slice(-2).join('.') : h; } catch { return 'unknown'; }
}

async function handleScrape(sendResponse: (response: ScrapeResponse) => void, kind: 'summary' | 'coverLetter' | undefined = 'summary', quickMatch = false, reply = false, replyPrompt = ''): Promise<void> {
  const currentUrl = window.location.href;
  const sourceSite = deriveSourceSite(currentUrl);
  const extraction: ExtractionResult = await extractPage(document, currentUrl);
  if (extraction.rawText.length === 0 && extraction.description.length === 0) {
    sendResponse({ success: false, error: 'No text found on this page.', debug: `URL: ${currentUrl}` });
    return;
  }

  if (reply) {
    browser.runtime.sendMessage({ type: 'backend:reply', payload: { pageText: extraction.rawText.slice(0, 8000), replyPrompt } }, (r: BackendResponse) => {
      if (browser.runtime.lastError) { sendResponse({ success: false, error: browser.runtime.lastError.message ?? 'BG error' }); return; }
      if (!r.success) { sendResponse({ success: false, error: r.error, details: r.details, debug: `Source: ${sourceSite}\nExtraction: ${extraction.source}\nChars: ${extraction.rawText.length}` }); return; }
      sendResponse({ success: true, data: r.data });
    });
    return;
  }

  if (quickMatch) {
    browser.runtime.sendMessage({ type: 'backend:quickMatch', payload: { pageText: extraction.rawText, sourceUrl: currentUrl } }, (r: BackendResponse) => {
      if (browser.runtime.lastError) { sendResponse({ success: false, error: browser.runtime.lastError.message ?? 'BG error' }); return; }
      if (!r.success) { sendResponse({ success: false, error: r.error, details: r.details, debug: `Source: ${sourceSite}\nExtraction: ${extraction.source}\nChars: ${extraction.rawText.length}` }); return; }
      sendResponse({ success: true, data: r.data });
    });
    return;
  }

  const bgType = kind === 'coverLetter' ? 'backend:coverLetter' : 'backend:summary';
  browser.runtime.sendMessage({ type: bgType, payload: { extraction } }, (r: BackendResponse) => {
    if (browser.runtime.lastError) { sendResponse({ success: false, error: browser.runtime.lastError.message ?? 'BG error', debug: `Source: ${sourceSite}\nExtraction: ${extraction.source}\nChars: ${extraction.rawText.length}` }); return; }
    if (!r.success) { sendResponse({ success: false, error: r.error, details: r.details, debug: `Source: ${sourceSite}\nExtraction: ${extraction.source}\nChars: ${extraction.rawText.length}` }); return; }
    sendResponse({ success: true, data: { ...(r.data as Record<string, unknown>), sourceUrl: currentUrl, sourceSite, extractionSource: extraction.source } });
  });
}

function handleFillForm(answers: readonly { readonly label: string; readonly value: string }[], sendResponse: (response: { readonly filled: number }) => void): void {
  const r = scrapeFormFieldsWithMap(); setActiveSelectorMap(r.selectorMap);
  let filled = 0;
  for (const a of answers) { const f = r.fields.find((x) => x.label.toLowerCase() === a.label.toLowerCase()); if (f) { fillField(f, a.value); filled++; } }
  sendResponse({ filled });
}

function handleScrapeFormFields(sendResponse: (response: ScrapeFormFieldsResponse) => void): void {
  const r = scrapeFormFieldsWithMap(); setActiveSelectorMap(r.selectorMap);
  const fields = r.fields.map((f) => ({ id: f.id, label: f.label, type: f.type, maxLength: f.maxLength, options: f.options }));
  sendResponse({ fields, fieldCount: fields.length, debug: r.debug });
}

function handleFillFormMatched(matches: readonly FormMatchValue[], sendResponse: (response: FillMatchedResponse) => void): void {
  const r = scrapeFormFieldsWithMap(); setActiveSelectorMap(r.selectorMap);
  let filled = 0; let unmatched = 0;
  for (const m of matches) { const f = r.fields.find((x) => x.id === m.fieldId); if (f) { fillField(f, m.value); filled++; } else { unmatched++; } }
  sendResponse({ filled, unmatched });
}

function handleRevertForm(sendResponse: (response: RevertResponse) => void): void { sendResponse({ reverted: revertAll() }); }