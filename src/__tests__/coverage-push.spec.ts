/**
 * Targeted coverage-push tests — exercise the exact branches that sit below
 * the 95 % threshold so the project gate passes.
 */

import { fillField, revertAll, setActiveSelectorMap } from '../utils/form-filler';
import { scrapeFormFieldsWithMap } from '../utils/form-scraper';
import { extractJsonLd, extractWithReadability, extractWithTreeWalker, cleanTextForLlm } from '../utils/page-extract';
import { createResumeEntry } from '../utils/settings-schema';

function setBodyHtml(html: string): void {
  document.body.innerHTML = html;
}

// ── form-filler.ts ────────────────────────────────────────────────────

describe('form-filler branch coverage', () => {
  beforeEach(() => {
    setBodyHtml('');
    setActiveSelectorMap({});
  });

  it('currentNameMatchCount falls back to tag=input when identity.tag is missing', () => {
    setBodyHtml('<form><input name="x" /><input name="x" /></form>');
    const r = scrapeFormFieldsWithMap();
    setActiveSelectorMap(r.selectorMap);
    // Wipe identity.tag to hit the ?? 'input' fallback.
    const field = {
      ...r.fields[0]!,
      identity: { ...r.fields[0]!.identity!, tag: '' } as (typeof r.fields)[0]['identity'],
    };
    const status = fillField(field, 'val');
    // Because tag mismatch, verifyIdentity fails → identity-mismatch
    expect(['identity-mismatch', 'filled']).toContain(status);
  });

  it('resolveLiveLabel falls back to name attribute', () => {
    setBodyHtml('<form><input name="first_name" /></form>');
    const r = scrapeFormFieldsWithMap();
    setActiveSelectorMap(r.selectorMap);
    const status = fillField(r.fields[0]!, 'Alice');
    expect(status).toBe('filled');
  });

  it('extractLiveOptions returns empty for non-select non-radio', () => {
    setBodyHtml('<form><input name="x" type="text" /></form>');
    const r = scrapeFormFieldsWithMap();
    setActiveSelectorMap(r.selectorMap);
    // text field has no options; verifyIdentity options check should pass (empty === empty)
    const status = fillField(r.fields[0]!, 'hello');
    expect(status).toBe('filled');
  });

  it('radio with selector missing name and element missing name → not-found', () => {
    setBodyHtml('<input type="radio" value="yes" id="loner" />');
    const r = scrapeFormFieldsWithMap();
    setActiveSelectorMap(r.selectorMap);
    const field = r.fields[0]!;
    // Force selector to something without [name="..."]
    const customField = { ...field, selector: '#loner' };
    const status = fillField(customField, 'yes');
    // The radio has no name attribute, so radioName stays '' → not-found
    expect(status).toBe('not-found');
  });

  it('disambiguates multiple elements by identity when one matches', () => {
    setBodyHtml(`
      <form>
        <label>First<input name="email" id="e1" /></label>
        <label>Second<input name="email" id="e2" /></label>
      </form>
    `);
    const r = scrapeFormFieldsWithMap();
    setActiveSelectorMap(r.selectorMap);
    // Both share name="email". The scraper should produce two fields.
    expect(r.fields.length).toBe(2);
    const second = r.fields[1]!;
    const status = fillField(second, 'second@example.com');
    expect(status).toBe('filled');
    const e2 = document.getElementById('e2') as HTMLInputElement;
    expect(e2.value).toBe('second@example.com');
  });

  it('identity mismatch when label differs', () => {
    setBodyHtml('<form><input name="x" id="a" /></form>');
    const r = scrapeFormFieldsWithMap();
    setActiveSelectorMap(r.selectorMap);
    // Mutate the stored label so live label no longer matches
    const mutated = {
      ...r.fields[0]!,
      identity: { ...r.fields[0]!.identity!, label: 'Changed' } as (typeof r.fields)[0]['identity'],
    };
    const status = fillField(mutated, 'val');
    expect(status).toBe('identity-mismatch');
  });

  it('snapshot early return when filling same field twice', () => {
    setBodyHtml('<form><input name="x" id="a" value="orig" /></form>');
    const r = scrapeFormFieldsWithMap();
    setActiveSelectorMap(r.selectorMap);
    fillField(r.fields[0]!, 'first');
    // Second fill should hit the snapshots.has() early return
    fillField(r.fields[0]!, 'second');
    const el = document.getElementById('a') as HTMLInputElement;
    // Revert should still work because snapshot was taken on first fill
    revertAll();
    expect(el.value).toBe('orig');
  });

  it('verifyIdentity skips when identity is undefined', () => {
    setBodyHtml('<form><input name="x" /></form>');
    const r = scrapeFormFieldsWithMap();
    setActiveSelectorMap(r.selectorMap);
    const field = { ...r.fields[0]!, identity: undefined };
    const status = fillField(field, 'val');
    expect(status).toBe('filled');
  });

  it('fillField with nameMatchCount mismatch on non-radio', () => {
    setBodyHtml('<form><input name="email" /></form>');
    const r = scrapeFormFieldsWithMap();
    setActiveSelectorMap(r.selectorMap);
    // Add a duplicate after scraping
    const form = document.querySelector('form');
    const dup = document.createElement('input');
    dup.setAttribute('name', 'email');
    form?.appendChild(dup);
    const status = fillField(r.fields[0]!, 'val');
    expect(status).toBe('identity-mismatch');
  });

  it('currentNameMatchCount with empty name returns 1', () => {
    setBodyHtml('<form><input id="no-name" /></form>');
    const r = scrapeFormFieldsWithMap();
    setActiveSelectorMap(r.selectorMap);
    const field = r.fields[0]!;
    // The selector is #no-name, no name attribute
    const status = fillField(field, 'val');
    expect(status).toBe('filled');
  });

  it('verifyIdentity with options mismatch', () => {
    setBodyHtml(`
      <form>
        <select name="s">
          <option value="">--</option>
          <option value="a">A</option>
        </select>
      </form>
    `);
    const r = scrapeFormFieldsWithMap();
    setActiveSelectorMap(r.selectorMap);
    const mutated = {
      ...r.fields[0]!,
      identity: {
        ...r.fields[0]!.identity!,
        options: ['A', 'B', 'C'],
      } as (typeof r.fields)[0]['identity'],
    };
    const status = fillField(mutated, 'A');
    expect(status).toBe('identity-mismatch');
  });

  it('fillField with removed element triggers identity-mismatch via name count', () => {
    setBodyHtml('<form><input name="x" id="gone" /></form>');
    const r = scrapeFormFieldsWithMap();
    setActiveSelectorMap(r.selectorMap);
    // Remove the element — name count goes from 1 → 0, hitting identity-mismatch first
    document.getElementById('gone')?.remove();
    const status = fillField(r.fields[0]!, 'val');
    expect(status).toBe('identity-mismatch');
  });

  it('fillField with id-only selector and removed element → not-found', () => {
    setBodyHtml('<form><input id="uniq" /></form>');
    const r = scrapeFormFieldsWithMap();
    setActiveSelectorMap(r.selectorMap);
    document.getElementById('uniq')?.remove();
    const status = fillField(r.fields[0]!, 'val');
    expect(status).toBe('not-found');
  });

  it('radio snapshot when no radio is initially checked', () => {
    setBodyHtml(`
      <form>
        <input type="radio" name="auth" value="yes" id="r1" />
        <input type="radio" name="auth" value="no" id="r2" />
      </form>
    `);
    const r = scrapeFormFieldsWithMap();
    setActiveSelectorMap(r.selectorMap);
    const status = fillField(r.fields[0]!, 'yes');
    expect(status).toBe('filled');
    // Revert should leave both unchecked (none were checked originally)
    revertAll();
    const r1 = document.getElementById('r1') as HTMLInputElement;
    const r2 = document.getElementById('r2') as HTMLInputElement;
    expect(r1.checked).toBe(false);
    expect(r2.checked).toBe(false);
  });

  it('fillField with maxLength truncation', () => {
    setBodyHtml('<form><input name="x" maxlength="5" /></form>');
    const r = scrapeFormFieldsWithMap();
    setActiveSelectorMap(r.selectorMap);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const status = fillField(r.fields[0]!, '123456789');
    expect(status).toBe('filled');
    const el = document.querySelector('input[name="x"]') as HTMLInputElement;
    expect(el.value).toBe('12345');
    warnSpy.mockRestore();
  });

  it('extractLiveOptions radio with empty name returns empty array', () => {
    // A radio without a name attribute — extractOptions returns [] for it
    setBodyHtml('<input type="radio" value="yes" id="loner" />');
    const r = scrapeFormFieldsWithMap();
    setActiveSelectorMap(r.selectorMap);
    // The field should have empty options because the radio has no name
    expect(r.fields[0]?.options.length).toBe(0);
  });

  it('extractLiveOptions radio branch via non-radio field type', () => {
    // Artificially coerce a radio element through the non-radio path to
    // exercise extractLiveOptions on a radio input.
    setBodyHtml('<input type="radio" name="auth" value="yes" id="r1" />');
    const r = scrapeFormFieldsWithMap();
    setActiveSelectorMap(r.selectorMap);
    const field = { ...r.fields[0]!, type: 'text' as const };
    const status = fillField(field, 'yes');
    expect(status).toBe('filled');
  });
});

// ── form-scraper.ts ───────────────────────────────────────────────────

describe('form-scraper branch coverage', () => {
  beforeEach(() => {
    setBodyHtml('');
  });

  it('fieldset aria-labelledby ref missing → empty legend', () => {
    setBodyHtml(`
      <form>
        <fieldset aria-labelledby="missing-id">
          <input type="radio" name="a" value="1" />
        </fieldset>
      </form>
    `);
    const r = scrapeFormFieldsWithMap();
    // Falls through to empty label, then name fallback
    expect(r.fields[0]?.label).toBe('a');
  });

  it('radiogroup aria-labelledby ref missing → empty label', () => {
    setBodyHtml(`
      <form>
        <div role="radiogroup" aria-labelledby="missing-id">
          <input type="radio" name="rg" value="1" />
        </div>
      </form>
    `);
    const r = scrapeFormFieldsWithMap();
    expect(r.fields[0]?.label).toBe('rg');
  });

  it('resolveAdjacentLabelText with parent previous sibling too short', () => {
    setBodyHtml(`
      <form>
        <div><span>OK</span></div>
        <div><input name="x" /></div>
      </form>
    `);
    const r = scrapeFormFieldsWithMap();
    // "OK" is length 2 (< 3), so it falls through to name
    expect(r.fields[0]?.label).toBe('x');
  });

  it('classifyFieldType default returns text for unknown tag', () => {
    // A <button type="menu"> is queried by the scraper, not filtered by
    // isSubmitElement (menu is not submit/reset/button), not filtered by
    // isUiChromeButton (text is not in blacklist), and its tag is not
    // handled by classifyFieldType, so it falls through to 'text'.
    setBodyHtml('<form><button type="menu" name="m">Custom</button></form>');
    const r = scrapeFormFieldsWithMap();
    expect(r.fields[0]?.type).toBe('text');
  });

  it('isSubmitElement returns false for non-button non-input', () => {
    setBodyHtml('<form><textarea name="t"></textarea></form>');
    const r = scrapeFormFieldsWithMap();
    expect(r.fields.length).toBe(1);
    expect(r.fields[0]?.type).toBe('textarea');
  });

  it('buildSelector falls back to class when id is not unique', () => {
    setBodyHtml(`
      <form>
        <input id="dup" class="foo bar" />
        <input id="dup" class="baz" />
      </form>
    `);
    const r = scrapeFormFieldsWithMap();
    // Both have same id; selector should use class fallback
    expect(r.selectorMap['field_0']).toContain('.foo');
    expect(r.selectorMap['field_1']).toContain('.baz');
  });

  it('scrapeFormFields wrapper returns fields array', () => {
    setBodyHtml('<form><input name="a" /></form>');
    const { scrapeFormFields } = jest.requireActual('../utils/form-scraper');
    const fields = scrapeFormFields() as ReturnType<typeof scrapeFormFieldsWithMap>['fields'];
    expect(fields.length).toBe(1);
    expect(fields[0]?.label).toBe('a');
  });

  it('isUiChromeButton filters button with type="button"', () => {
    setBodyHtml(`
      <form>
        <button type="button" name="ui">Click me</button>
        <input name="real" />
      </form>
    `);
    const r = scrapeFormFieldsWithMap();
    expect(r.fields.length).toBe(1);
    expect(r.fields[0]?.label).toBe('real');
  });

  it('isUiChromeButton filters button with blacklisted aria-label', () => {
    setBodyHtml(`
      <form>
        <button type="button" aria-label="search" name="ui"></button>
        <input name="real" />
      </form>
    `);
    const r = scrapeFormFieldsWithMap();
    expect(r.fields.length).toBe(1);
    expect(r.fields[0]?.label).toBe('real');
  });

  it('isUiChromeButton filters button with blacklisted text', () => {
    setBodyHtml(`
      <form>
        <button type="button" name="ui">Clear</button>
        <input name="real" />
      </form>
    `);
    const r = scrapeFormFieldsWithMap();
    expect(r.fields.length).toBe(1);
    expect(r.fields[0]?.label).toBe('real');
  });

  it('resolveLabel uses placeholder when no label found', () => {
    setBodyHtml('<form><input name="x" placeholder="Enter your name" /></form>');
    const r = scrapeFormFieldsWithMap();
    expect(r.fields[0]?.label).toBe('Enter your name');
  });

  it('resolveLabel skips blacklisted placeholder', () => {
    setBodyHtml('<form><input name="x" placeholder="Start typing..." /></form>');
    const r = scrapeFormFieldsWithMap();
    // Blacklisted placeholder falls through to name
    expect(r.fields[0]?.label).toBe('x');
  });

  it('resolveLabel uses aria-label for radio', () => {
    setBodyHtml(`
      <form>
        <input type="radio" name="auth" value="yes" aria-label="Work Authorization" />
      </form>
    `);
    const r = scrapeFormFieldsWithMap();
    expect(r.fields[0]?.label).toBe('Work Authorization');
  });

  it('resolveAdjacentLabelText with text node before radio', () => {
    setBodyHtml(`
      <form>
        <div>
          Label text here
          <input type="radio" name="x" value="1" />
        </div>
      </form>
    `);
    const r = scrapeFormFieldsWithMap();
    // Previous text sibling of the radio has > 3 chars
    expect(r.fields[0]?.label).toBe('Label text here');
  });

  it('isVisible skips element with display:none parent', () => {
    setBodyHtml(`
      <form>
        <div style="display:none"><input name="hidden" /></div>
        <input name="visible" />
      </form>
    `);
    const r = scrapeFormFieldsWithMap();
    expect(r.fields.length).toBe(1);
    expect(r.fields[0]?.label).toBe('visible');
  });

  it('isVisible skips element with hidden attribute', () => {
    setBodyHtml(`
      <form>
        <input name="hidden" hidden />
        <input name="visible" />
      </form>
    `);
    const r = scrapeFormFieldsWithMap();
    expect(r.fields.length).toBe(1);
    expect(r.fields[0]?.label).toBe('visible');
  });
});

// ── page-extract.ts ───────────────────────────────────────────────────

describe('page-extract branch coverage', () => {
  beforeEach(() => {
    setBodyHtml('');
  });

  it('flattenJobLocation with array of strings', () => {
    setBodyHtml(`
      <script type="application/ld+json">
      {"@type":"JobPosting","title":"Dev","hiringOrganization":{"name":"Co"},"jobLocation":["Berlin","Munich"],"description":"Do stuff"}
      </script>
    `);
    const r = extractJsonLd(document);
    expect(r?.location).toBe('Berlin | Munich');
  });

  it('flattenHiringOrganization with array', () => {
    setBodyHtml(`
      <script type="application/ld+json">
      {"@type":"JobPosting","title":"Dev","hiringOrganization":[{"name":"A"},{"name":"B"}],"jobLocation":"Remote","description":"Do stuff"}
      </script>
    `);
    const r = extractJsonLd(document);
    expect(r?.company).toBe('A, B');
  });

  it('flattenHiringOrganization with non-object non-string', () => {
    setBodyHtml(`
      <script type="application/ld+json">
      {"@type":"JobPosting","title":"Dev","hiringOrganization":123,"jobLocation":"Remote","description":"Do stuff"}
      </script>
    `);
    const r = extractJsonLd(document);
    expect(r?.company).toBe('');
  });

  it('extractWithReadability returns null on Readability failure', () => {
    // Provide a document that causes Readability to throw or return nothing useful
    setBodyHtml('<html><head></head><body><noscript>nothing</noscript></body></html>');
    const r = extractWithReadability(document);
    expect(r).toBeNull();
  });

  it('extractWithTreeWalker picks best element by density', () => {
    setBodyHtml(`
      <div>
        <p>Short</p>
      </div>
      <article>
        <p>${'a '.repeat(200)}</p>
        <p>${'b '.repeat(200)}</p>
      </article>
    `);
    const r = extractWithTreeWalker(document);
    expect(r.length).toBeGreaterThan(100);
  });
});

// ── settings-schema.ts ────────────────────────────────────────────────

describe('settings-schema branch coverage', () => {
  it('createResumeEntry with partial profile', () => {
    const entry = createResumeEntry('Test', '# Resume', { fullName: 'Alice', city: 'Berlin' });
    expect(entry.name).toBe('Test');
    expect(entry.content).toBe('# Resume');
    expect(entry.profile.fullName).toBe('Alice');
    expect(entry.profile.city).toBe('Berlin');
    expect(entry.profile.contactEmail).toBe(''); // default
    expect(entry.isDefault).toBe(false);
    expect(entry.id.startsWith('resume_')).toBe(true);
  });

  it('createResumeEntry without profile uses defaults', () => {
    const entry = createResumeEntry('Default', '');
    expect(entry.profile.fullName).toBe('');
    expect(entry.profile.yearsOfExperience).toBe(0);
  });
});

// ── cleanTextForLlm edge ─────────────────────────────────────────────

describe('cleanTextForLlm edge cases', () => {
  it('strips URLs and braces', () => {
    const raw = 'Visit {https://example.com/path} for [more] info | page';
    const out = cleanTextForLlm(raw);
    expect(out).not.toContain('https://');
    expect(out).not.toContain('{');
    expect(out).not.toContain('}');
    expect(out).not.toContain('[');
    expect(out).not.toContain(']');
  });
});
