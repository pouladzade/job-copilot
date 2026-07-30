import { Readability } from '@mozilla/readability';

export type ExtractionSource = 'jsonld' | 'readability' | 'treewalker';

export interface ExtractionResult {
  source: ExtractionSource;
  title: string;
  company: string;
  location: string;
  description: string;
  rawText: string;
  url: string;
  ts: number;
}

export const EXTRACTION_CACHE_PREFIX = 'extract:v1:';
export const extractionCacheKey = (url: string): string => `${EXTRACTION_CACHE_PREFIX}${url}`;

function stripHtml(html: string): string {
  return html
    .replace(/<\/(p|div|li|h[1-6]|br|tr|td|th|article|section|header|footer|main|aside)\s*>/gi, '\n')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#?\w+;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function flattenAddress(addr: unknown): string {
  if (!addr || typeof addr !== 'object') return '';
  const a = addr as Record<string, unknown>;
  const parts = [
    asString(a.addressLocality),
    asString(a.addressRegion),
    asString(a.addressCountry),
    asString((a.address as Record<string, unknown> | undefined)?.addressCountry),
  ].filter((s) => s.length > 0);
  return parts.join(', ');
}

function flattenJobLocation(loc: unknown): string {
  if (!loc) return '';
  if (typeof loc === 'string') return loc;
  if (Array.isArray(loc)) {
    return loc
      .map(flattenJobLocation)
      .filter((s) => s.length > 0)
      .join(' | ');
  }
  if (typeof loc === 'object') {
    const o = loc as Record<string, unknown>;
    const place = asString(o.name) || flattenAddress(o.address);
    if (place) return place;
  }
  return '';
}

function flattenHiringOrganization(org: unknown): string {
  if (!org) return '';
  if (typeof org === 'string') return org;
  if (Array.isArray(org))
    return org
      .map(flattenHiringOrganization)
      .filter((s) => s.length > 0)
      .join(', ');
  if (typeof org === 'object') return asString((org as Record<string, unknown>).name);
  return '';
}

function findJobPostingNode(parsed: unknown): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  const type = obj['@type'];
  const isJobPosting = type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'));
  if (isJobPosting) return obj;
  const graph = obj['@graph'];
  if (Array.isArray(graph)) {
    for (const node of graph) {
      const found = findJobPostingNode(node);
      if (found) return found;
    }
  }
  return null;
}

export function extractJsonLd(
  doc: Document,
): { title: string; company: string; location: string; description: string } | null {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const script of Array.from(scripts)) {
    const text = script.textContent;
    if (!text) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      continue;
    }
    const node = findJobPostingNode(parsed);
    if (!node) continue;
    const title = asString(node.title);
    const company = flattenHiringOrganization(node.hiringOrganization);
    const location = flattenJobLocation(node.jobLocation);
    const rawDesc = node.description;
    const description = stripHtml(typeof rawDesc === 'string' ? rawDesc : '');
    if (!title || !description) continue;
    return { title, company, location, description };
  }
  return null;
}

export function extractWithReadability(doc: Document): { title: string; text: string } | null {
  try {
    const clone = doc.cloneNode(true) as Document;
    const parsed = new Readability(clone).parse();
    const text = parsed?.textContent?.trim() ?? '';
    if (text.length <= 200) return null;
    return { title: parsed?.title?.trim() ?? '', text };
  } catch {
    return null;
  }
}

export function cleanTextForLlm(raw: string): string {
  return raw
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#?\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[{}[\]()]/g, '')
    .replace(/[|>]+/g, ' ')
    .trim();
}

export function extractWithTreeWalker(doc: Document): string {
  const containers = ['main', 'article', '[role="main"]', '#main-content', '#content'];
  for (const sel of containers) {
    const el = doc.querySelector(sel);
    if (el) {
      const t = el.textContent?.trim() ?? '';
      if (t.length > 500) return t.slice(0, 50000);
    }
  }
  let bestEl: Element | null = null;
  let bestLen = 0;
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  let node: Node | null = walker.nextNode();
  while (node) {
    const el = node as Element;
    if (
      ['script', 'style', 'nav', 'footer', 'header', 'noscript', 'svg', 'iframe'].includes(el.tagName.toLowerCase())
    ) {
      node = walker.nextNode();
      continue;
    }
    const text = el.textContent?.trim() ?? '';
    if (text.length > bestLen && text.length <= 100000) {
      let d = 0;
      for (const c of el.childNodes) {
        if (c.nodeType === Node.TEXT_NODE) d += (c.textContent ?? '').length;
      }
      if (d > 100 || text.length > bestLen + 1000) {
        bestLen = text.length;
        bestEl = el;
      }
    }
    node = walker.nextNode();
  }
  if (bestEl) return (bestEl.textContent ?? '').trim().slice(0, 50000);
  return (doc.body?.textContent ?? '').trim().slice(0, 50000);
}

export async function getCachedExtraction(url: string): Promise<ExtractionResult | null> {
  try {
    const key = extractionCacheKey(url);
    const stored = await browser.storage.session.get(key);
    const v = stored?.[key];
    if (v && typeof v === 'object') return v as ExtractionResult;
  } catch {
    /* fall through */
  }
  return null;
}

export async function setCachedExtraction(result: ExtractionResult): Promise<void> {
  try {
    await browser.storage.session.set({ [extractionCacheKey(result.url)]: result });
  } catch {
    /* quota errors must not break extraction */
  }
}

export async function extractPage(doc: Document, url: string): Promise<ExtractionResult> {
  const cached = await getCachedExtraction(url);
  if (cached) return cached;

  const jsonld = extractJsonLd(doc);
  if (jsonld) {
    const r: ExtractionResult = {
      source: 'jsonld',
      title: jsonld.title,
      company: jsonld.company,
      location: jsonld.location,
      description: jsonld.description,
      rawText: jsonld.description,
      url,
      ts: Date.now(),
    };
    await setCachedExtraction(r);
    return r;
  }

  const read = extractWithReadability(doc);
  if (read) {
    const description = cleanTextForLlm(read.text);
    const r: ExtractionResult = {
      source: 'readability',
      title: read.title,
      company: '',
      location: '',
      description,
      rawText: read.text,
      url,
      ts: Date.now(),
    };
    await setCachedExtraction(r);
    return r;
  }

  const raw = extractWithTreeWalker(doc);
  const cleaned = cleanTextForLlm(raw);
  const r: ExtractionResult = {
    source: 'treewalker',
    title: '',
    company: '',
    location: '',
    description: cleaned,
    rawText: cleaned,
    url,
    ts: Date.now(),
  };
  await setCachedExtraction(r);
  return r;
}
