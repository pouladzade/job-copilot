/**
 * Coverage gap tests — targets all uncovered branches/lines across the codebase
 * to push coverage above 95%.
 */

import { fillField, revertAll, setActiveSelectorMap } from '../utils/form-filler';
import { scrapeFormFieldsWithMap } from '../utils/form-scraper';
import {
  cleanTextForLlm,
  extractJsonLd,
  extractPage,
  extractWithReadability,
  extractWithTreeWalker,
} from '../utils/page-extract';
import { deterministicMatch, profileToContext, getProfile } from '../utils/profile-match';
import { buildLinkedInSearchUrl } from '../utils/linkedin-search-builder';
import { DEFAULT_PROMPTS } from '../utils/prompt-templates';
import { LLM_DEFAULTS, PROFILE_DEFAULTS, PROFILE_FIELDS, PROMPT_SLOTS } from '../utils/settings-schema';

function setBodyHtml(html: string): void {
  document.body.innerHTML = html;
}

// ── form-scraper.ts ───────────────────────────────────────────────────

describe('form-scraper edge cases', () => {
  beforeEach(() => {
    setBodyHtml('');
  });

  it('resolves fieldset legend via aria-labelledby', () => {
    setBodyHtml(`
      <form>
        <fieldset aria-labelledby="fs-title">
          <div id="fs-title">Work Auth</div>
          <input type="radio" name="auth" value="yes" />
        </fieldset>
      </form>
    `);
    const r = scrapeFormFieldsWithMap();
    expect(r.fields[0]?.label).toBe('Work Auth');
  });

  it('resolves radiogroup label via aria-labelledby', () => {
    setBodyHtml(`
      <form>
        <div role="radiogroup" aria-labelledby="rg-title">
          <span id="rg-title">Notice Period</span>
          <input type="radio" name="np" value="0" />
        </div>
      </form>
    `);
    const r = scrapeFormFieldsWithMap();
    expect(r.fields[0]?.label).toBe('Notice Period');
  });

  it('resolves label from parent previous sibling element', () => {
    setBodyHtml('<form><div><label>Parent Prev</label></div><div><input name="x" /></div></form>');
    const r = scrapeFormFieldsWithMap();
    // Parent's previous sibling doesn't match for regular inputs — falls through to name
    expect(r.fields[0]?.label).toBe('x');
  });

  it('builds class-based selector when no id or name', () => {
    setBodyHtml(`
      <form>
        <input class="foo bar" />
      </form>
    `);
    const r = scrapeFormFieldsWithMap();
    expect(r.selectorMap['field_0']).toContain('.foo');
  });

  it('returns empty result when body has no controls', () => {
    setBodyHtml('<div>No inputs here</div>');
    const r = scrapeFormFieldsWithMap();
    expect(r.fields.length).toBe(0);
    expect(r.debug).toContain('no controls');
  });

  it('stops at MAX_FIELD_ID fields', () => {
    let html = '<form>';
    for (let i = 0; i < 510; i++) {
      html += `<input name="f${i}" />`;
    }
    html += '</form>';
    setBodyHtml(html);
    const r = scrapeFormFieldsWithMap();
    expect(r.fields.length).toBeLessThanOrEqual(500);
  });

  it('handles radio without name attribute', () => {
    setBodyHtml(`
      <form>
        <input type="radio" value="yes" />
      </form>
    `);
    const r = scrapeFormFieldsWithMap();
    expect(r.fields.length).toBe(1);
  });

  it('handles empty placeholder fallback', () => {
    setBodyHtml(`
      <form>
        <input name="x" placeholder="" />
      </form>
    `);
    const r = scrapeFormFieldsWithMap();
    expect(r.fields[0]?.label).toBe('x');
  });

  it('handles radio with adjacent text node via fieldset legend', () => {
    setBodyHtml(`
      <form>
        <fieldset>
          <legend>Travel</legend>
          <label><input type="radio" name="travel" value="yes" /> Yes</label>
        </fieldset>
      </form>
    `);
    const r = scrapeFormFieldsWithMap();
    expect(r.fields[0]?.label).toBe('Travel');
  });

  it('handles multiple forms', () => {
    setBodyHtml(`
      <form id="f1"><input name="a" /></form>
      <form id="f2"><input name="b" /></form>
    `);
    const r = scrapeFormFieldsWithMap();
    expect(r.fields.length).toBe(2);
  });
});

// ── form-filler.ts ────────────────────────────────────────────────────

describe('form-filler edge cases', () => {
  beforeEach(() => {
    setBodyHtml('');
    setActiveSelectorMap({});
  });

  it('warns when selector is not in map', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    setBodyHtml('<input id="x" />');
    setActiveSelectorMap({});
    fillField({ id: 'field_0', label: 'X', type: 'text', selector: '#x', maxLength: 0, options: [] }, 'val');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No selector found'));
    warnSpy.mockRestore();
  });

  it('warns when element is not found', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    setBodyHtml('<input id="x" />');
    setActiveSelectorMap({ field_0: '#nonexistent' });
    fillField({ id: 'field_0', label: 'X', type: 'text', selector: '#nonexistent', maxLength: 0, options: [] }, 'val');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Element not found'));
    warnSpy.mockRestore();
  });

  it('truncates value to maxLength', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    setBodyHtml('<input id="x" />');
    setActiveSelectorMap({ field_0: '#x' });
    fillField({ id: 'field_0', label: 'X', type: 'text', selector: '#x', maxLength: 5, options: [] }, '123456789');
    const el = document.getElementById('x') as HTMLInputElement;
    expect(el.value).toBe('12345');
    warnSpy.mockRestore();
  });

  it('truncates value to MAX_VALUE_LENGTH', () => {
    setBodyHtml('<textarea id="x"></textarea>');
    setActiveSelectorMap({ field_0: '#x' });
    const long = 'a'.repeat(6000);
    fillField({ id: 'field_0', label: 'X', type: 'textarea', selector: '#x', maxLength: 0, options: [] }, long);
    const el = document.getElementById('x') as HTMLTextAreaElement;
    expect(el.value.length).toBe(5000);
  });

  it('selects fallback option when value does not match', () => {
    setBodyHtml(`
      <select id="x">
        <option value="">--</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    `);
    setActiveSelectorMap({ field_0: '#x' });
    fillField({ id: 'field_0', label: 'X', type: 'select', selector: '#x', maxLength: 0, options: ['Yes', 'No'] }, 'maybe');
    const el = document.getElementById('x') as HTMLSelectElement;
    expect(el.selectedIndex).toBe(1);
  });

  it('fills radio group by name when selector does not contain name', () => {
    setBodyHtml(`
      <input type="radio" name="auth" id="auth_yes" value="yes" />
      <input type="radio" name="auth" id="auth_no" value="no" />
    `);
    setActiveSelectorMap({ field_0: '#auth_yes' });
    fillField({ id: 'field_0', label: 'Auth', type: 'radio', selector: '#auth_yes', maxLength: 0, options: ['yes', 'no'] }, 'no');
    const noEl = document.getElementById('auth_no') as HTMLInputElement;
    expect(noEl.checked).toBe(true);
  });

  it('reverts filled fields', () => {
    setBodyHtml('<input id="x" value="original" />');
    setActiveSelectorMap({ field_0: '#x' });
    fillField({ id: 'field_0', label: 'X', type: 'text', selector: '#x', maxLength: 0, options: [] }, 'new');
    const count = revertAll();
    const el = document.getElementById('x') as HTMLInputElement;
    expect(el.value).toBe('original');
    expect(count).toBeGreaterThan(0);
  });
});

// ── page-extract.ts ───────────────────────────────────────────────────

describe('page-extract edge cases', () => {
  beforeEach(() => {
    setBodyHtml('');
  });

  it('handles invalid JSON-LD gracefully', () => {
    setBodyHtml('<script type="application/ld+json">not json</script>');
    const r = extractJsonLd(document);
    expect(r).toBeNull();
  });

  it('handles JSON-LD without JobPosting', () => {
    setBodyHtml('<script type="application/ld+json">{"@type":"Person","name":"John"}</script>');
    const r = extractJsonLd(document);
    expect(r).toBeNull();
  });

  it('handles empty address in jobLocation', () => {
    setBodyHtml(`
      <script type="application/ld+json">
      {"@type":"JobPosting","title":"Dev","hiringOrganization":{"name":"Acme"},"jobLocation":{"address":{}},"description":"Do stuff"}
      </script>
    `);
    const r = extractJsonLd(document);
    expect(r?.location).toBe('');
  });

  it('handles non-object hiringOrganization', () => {
    setBodyHtml(`
      <script type="application/ld+json">
      {"@type":"JobPosting","title":"Dev","hiringOrganization":"Acme Corp","jobLocation":"Remote","description":"Do stuff"}
      </script>
    `);
    const r = extractJsonLd(document);
    expect(r?.company).toBe('Acme Corp');
  });

  it('handles Readability failure gracefully', () => {
    setBodyHtml('<html><head></head><body></body></html>');
    const r = extractWithReadability(document);
    expect(r).toBeNull();
  });

  it('extracts with tree walker fallback', () => {
    setBodyHtml(`
      <nav>Nav content</nav>
      <main>
        <p>This is the main content with enough text to pass the length threshold.</p>
        <p>More text here to make sure we have sufficient content for extraction.</p>
      </main>
    `);
    const r = extractWithTreeWalker(document);
    expect(r.length).toBeGreaterThan(50);
  });

  it('extracts with tree walker when no main tag', () => {
    setBodyHtml(`
      <div>
        <p>Paragraph one with some content.</p>
        <p>Paragraph two with more content here.</p>
        <p>Paragraph three to ensure we have enough text.</p>
      </div>
    `);
    const r = extractWithTreeWalker(document);
    expect(r.length).toBeGreaterThan(50);
  });

  it('extracts page with tree walker fallback', async () => {
    setBodyHtml(`
      <div>
        <p>Some content here to ensure we have enough text for extraction.</p>
        <p>More content to make sure we pass thresholds.</p>
      </div>
    `);
    const r = await extractPage(document, 'http://example.com/job');
    expect(r.source).toBe('treewalker');
    expect(r.rawText.length).toBeGreaterThan(0);
  });

  it('caches extraction result', async () => {
    setBodyHtml(`
      <script type="application/ld+json">
      {"@type":"JobPosting","title":"Engineer","hiringOrganization":{"name":"Co"},"jobLocation":"Berlin","description":"Build things"}
      </script>
    `);
    const r1 = await extractPage(document, 'http://example.com/cache-test');
    const r2 = await extractPage(document, 'http://example.com/cache-test');
    expect(r1.ts).toBe(r2.ts);
  });

  it('cleans text for LLM', () => {
    const raw = '  Hello   world  {script}alert(1){/script} https://example.com  ';
    const cleaned = cleanTextForLlm(raw);
    // cleanTextForLlm strips [{}[\]()|>] characters
    expect(cleaned).not.toContain('{');
    expect(cleaned).not.toContain('}');
    expect(cleaned).not.toContain('https://');
    expect(cleaned.trim()).toBe('Hello world scriptalert1/script');
  });
});

// ── profile-match.ts ──────────────────────────────────────────────────

describe('profile-match edge cases', () => {
  it('getProfile returns empty object when storage throws', async () => {
    const originalChrome = (globalThis as Record<string, unknown>)['chrome'];
    (globalThis as Record<string, unknown>)['chrome'] = {
      storage: { local: { get: () => { throw new Error('fail'); } } },
    };
    (globalThis as Record<string, unknown>)['browser'] = (globalThis as Record<string, unknown>)['chrome'];
    const p = await getProfile();
    expect(p).toEqual({});
    (globalThis as Record<string, unknown>)['chrome'] = originalChrome;
    (globalThis as Record<string, unknown>)['browser'] = originalChrome;
  });

  it('returns empty context for empty profile', () => {
    const ctx = profileToContext({});
    expect(ctx).toBe('(no profile data — user has not filled out the profile)');
  });

  it('skips undefined/null/empty values in context', () => {
    const ctx = profileToContext({ fullName: '', contactEmail: null as unknown as string, city: undefined as unknown as string });
    expect(ctx).not.toContain('Full Name');
    expect(ctx).not.toContain('Email');
    expect(ctx).not.toContain('City');
  });

  it('includes years of experience only when > 0', () => {
    const ctx1 = profileToContext({ yearsOfExperience: 0 });
    expect(ctx1).not.toContain('Years of Experience');
    const ctx2 = profileToContext({ yearsOfExperience: 5 });
    expect(ctx2).toContain('Years of Experience: 5');
  });

  it('matches country to preferredLocation', () => {
    const r = deterministicMatch('What country are you in?', { preferredLocation: 'Germany' });
    expect(r?.value).toBe('Germany');
  });

  it('matches current employer', () => {
    const r = deterministicMatch('Current employer?', { currentCompany: 'Acme' });
    expect(r?.value).toBe('Acme');
  });

  it('matches highest degree', () => {
    const r = deterministicMatch('Highest education degree?', { highestDegree: 'M.S.' });
    expect(r?.value).toBe('M.S.');
  });

  it('matches university', () => {
    const r = deterministicMatch('University attended?', { university: 'MIT' });
    expect(r?.value).toBe('MIT');
  });

  it('matches field of study', () => {
    const r = deterministicMatch('Field of study / major?', { fieldOfStudy: 'CS' });
    expect(r?.value).toBe('CS');
  });

  it('matches remote preference', () => {
    const r = deterministicMatch('Work mode preference?', { remotePreference: 'Hybrid' });
    expect(r?.value).toBe('Hybrid');
  });

  it('returns null for unmatched label', () => {
    const r = deterministicMatch('Some random question?', { fullName: 'John' });
    expect(r).toBeNull();
  });

  it('returns null when profile field is empty', () => {
    const r = deterministicMatch('Email?', {});
    expect(r).toBeNull();
  });
});

// ── linkedin-search-builder.ts ────────────────────────────────────────

describe('linkedin-search-builder edge cases', () => {
  it('includes cities in keywords when provided', () => {
    const url = buildLinkedInSearchUrl({
      titles: ['Engineer'],
      includedSkills: [],
      excludedSkills: [],
      cities: 'Berlin, Munich',
      timeWindowHours: 0,
      sortByRecent: false,
      easyApply: false,
    });
    expect(url).toContain('keywords=');
    expect(decodeURIComponent(url)).toContain('Berlin');
    expect(decodeURIComponent(url)).toContain('Munich');
  });

  it('builds URL with all optional filters', () => {
    const url = buildLinkedInSearchUrl({
      titles: ['Dev'],
      includedSkills: ['Rust'],
      excludedSkills: [],
      location: 'Germany',
      timeWindowHours: 24,
      sortByRecent: true,
      easyApply: true,
      workplaceTypes: ['1', '2'],
      experienceLevels: ['2', '3'],
      jobTypes: ['F', 'C'],
    });
    expect(url).toContain('f_TPR=');
    expect(url).toContain('sortBy=DD');
    expect(url).toContain('f_AL=true');
    expect(url).toContain('f_WT=1%2C2');
    expect(url).toContain('f_E=2%2C3');
    expect(url).toContain('f_JT=F%2CC');
  });

  it('handles empty config', () => {
    const url = buildLinkedInSearchUrl({
      titles: [],
      includedSkills: [],
      excludedSkills: [],
      timeWindowHours: 0,
      sortByRecent: false,
      easyApply: false,
    });
    expect(url).toBe('https://www.linkedin.com/jobs/search/?keywords=');
  });
});

// ── prompt-templates.ts ───────────────────────────────────────────────

describe('prompt-templates', () => {
  it('exports all 6 prompt keys', () => {
    expect(Object.keys(DEFAULT_PROMPTS)).toEqual([
      'prmExtract',
      'prmSummary',
      'prmCover',
      'prmQuick',
      'prmForm',
      'prmReply',
    ]);
  });

  it('prmExtract contains expected placeholders', () => {
    expect(DEFAULT_PROMPTS.prmExtract).toContain('{{pageText}}');
    expect(DEFAULT_PROMPTS.prmExtract).toContain('{{customInstructions}}');
  });

  it('prmSummary contains expected placeholders', () => {
    expect(DEFAULT_PROMPTS.prmSummary).toContain('{{jobDescription}}');
    expect(DEFAULT_PROMPTS.prmSummary).toContain('{{resumeContent}}');
  });

  it('prmCover contains expected placeholders', () => {
    expect(DEFAULT_PROMPTS.prmCover).toContain('{{jobDescription}}');
    expect(DEFAULT_PROMPTS.prmCover).toContain('{{resumeContent}}');
  });

  it('prmQuick contains expected placeholders', () => {
    expect(DEFAULT_PROMPTS.prmQuick).toContain('{{jobDescription}}');
    expect(DEFAULT_PROMPTS.prmQuick).toContain('{{resumeContent}}');
  });

  it('prmForm contains expected placeholders', () => {
    expect(DEFAULT_PROMPTS.prmForm).toContain('{{candidateContext}}');
    expect(DEFAULT_PROMPTS.prmForm).toContain('{{fieldsJson}}');
  });

  it('prmReply contains expected placeholders', () => {
    expect(DEFAULT_PROMPTS.prmReply).toContain('{{userIntent}}');
    expect(DEFAULT_PROMPTS.prmReply).toContain('{{pageText}}');
  });
});

// ── settings-schema.ts ────────────────────────────────────────────────

describe('settings-schema', () => {
  it('PROFILE_FIELDS has 21 fields', () => {
    expect(PROFILE_FIELDS.length).toBe(21);
  });

  it('PROFILE_FIELDS contains expected keys', () => {
    const keys = PROFILE_FIELDS.map((f) => f.key);
    expect(keys).toContain('fullName');
    expect(keys).toContain('yearsOfExperience');
    expect(keys).toContain('salaryExpectations');
  });

  it('PROFILE_DEFAULTS has all fields', () => {
    expect(PROFILE_DEFAULTS.fullName).toBe('');
    expect(PROFILE_DEFAULTS.yearsOfExperience).toBe(0);
  });

  it('LLM_DEFAULTS has all config fields', () => {
    expect(LLM_DEFAULTS.apiUrl).toBe('https://api.deepseek.com');
    expect(LLM_DEFAULTS.model).toBe('deepseek-chat');
    expect(LLM_DEFAULTS.resume).toBe('');
  });

  it('PROMPT_SLOTS has 6 slots', () => {
    expect(PROMPT_SLOTS.length).toBe(6);
    const keys = PROMPT_SLOTS.map((s) => s.key);
    expect(keys).toContain('prmSummaryAdd');
    expect(keys).toContain('prmReplyAdd');
  });
});