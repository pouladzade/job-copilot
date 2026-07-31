/**
 * Regression tests for the audit findings (F-01 through F-08). Each test pins
 * down the exact failure mode the audit flagged so future refactors cannot
 * silently reintroduce it.
 */
import { scrapeFormFieldsWithMap } from '../utils/form-scraper';
import { fillField, revertAll, setActiveSelectorMap } from '../utils/form-filler';
import type { ScrapedField } from '../utils/form-scraper';

function setBodyHtml(html: string): void {
  document.body.innerHTML = html;
}

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

function loadFixture(): void {
  setBodyHtml(`
    <form id="application-form">
      <div class="form-group">
        <label for="fullName">Full Name</label>
        <input id="fullName" name="fullName" type="text" maxlength="100" />
      </div>
      <div class="form-group">
        <label for="email">Email Address</label>
        <input id="email" name="email" type="text" maxlength="200" />
      </div>
      <div class="form-group">
        <label>Work Authorization</label>
        <input type="radio" name="work_auth" value="us_citizen" id="auth_citizen" checked />
        <label for="auth_citizen">US Citizen</label>
        <input type="radio" name="work_auth" value="green_card" id="auth_gc" />
        <label for="auth_gc">Green Card Holder</label>
        <input type="radio" name="work_auth" value="visa" id="auth_visa" />
        <label for="auth_visa">Visa Holder</label>
      </div>
      <div class="form-group">
        <label for="relocate">Willing to Relocate</label>
        <select id="relocate" name="relocate">
          <option value="">-- Select --</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
          <option value="maybe">Maybe</option>
        </select>
      </div>
    </form>
  `);
}

// ── F-01: review-to-inject stability ───────────────────────────────

describe('F-01: stable field identity across review-to-inject', () => {
  it('rejects injection when the labeled control was swapped for another (insert a duplicate field between match and inject)', () => {
    loadFixture();
    const before = scrapeFormFieldsWithMap();
    setActiveSelectorMap(before.selectorMap);

    const emailField = before.fields.find((f) => f.label === 'Email Address');
    expect(emailField).toBeDefined();

    // Simulate the page adding a new "Email Address" control between review
    // and injection. Use insertAdjacentHTML to avoid jsdom parent-lookup
    // edge cases when the element is referenced from multiple parents.
    document
      .querySelector('form')
      ?.insertAdjacentHTML('afterbegin', '<input id="email2" name="email" aria-label="Email Address" />');

    const status = fillField(emailField!, 'attacker@example.com');

    expect(status).toBe('identity-mismatch');
    // The original email control must remain unchanged.
    const original = document.getElementById('email') as HTMLInputElement;
    expect(original.value).toBe('');
    // The injected control must not have the attacker value either.
    const inserted = document.getElementById('email2') as HTMLInputElement;
    expect(inserted.value).toBe('');
  });
});

// ── F-02: invalid deterministic radio value must not clear the group ──

describe('F-02: invalid radio option must not mutate the group', () => {
  it('leaves preselected radio intact when the supplied value is not in the option set', () => {
    loadFixture();
    const r = scrapeFormFieldsWithMap();
    setActiveSelectorMap(r.selectorMap);

    const workAuth = r.fields.find((f) => f.type === 'radio')!;
    // Snapshot the original checked state — us_citizen starts selected.
    const usCitizen = document.getElementById('auth_citizen') as HTMLInputElement;
    const greenCard = document.getElementById('auth_gc') as HTMLInputElement;
    expect(usCitizen.checked).toBe(true);

    const status = fillField(workAuth, 'EU Blue Card');

    // F-02: refuse the value, don't touch the group.
    expect(status).toBe('unmatched-radio');
    expect(usCitizen.checked).toBe(true);
    expect(greenCard.checked).toBe(false);
  });
});

// ── F-03: revert must restore the originally-selected radio ─────────

describe('F-03: revert restores the originally-selected radio in a group', () => {
  it('reverts to green_card when that was the preselected radio and the filler set us_citizen', () => {
    setBodyHtml(`
      <form>
        <label>Work Authorization</label>
        <input type="radio" name="work_auth" value="us_citizen" id="auth_citizen" />
        <input type="radio" name="work_auth" value="green_card" id="auth_gc" checked />
        <input type="radio" name="work_auth" value="visa" id="auth_visa" />
      </form>
    `);
    const r = scrapeFormFieldsWithMap();
    setActiveSelectorMap(r.selectorMap);

    const workAuth = r.fields.find((f) => f.type === 'radio')!;
    const status = fillField(workAuth, 'us_citizen');
    expect(status).toBe('filled');
    const usCitizen = document.getElementById('auth_citizen') as HTMLInputElement;
    expect(usCitizen.checked).toBe(true);

    // Now revert — F-03 requires restoring the originally-selected radio.
    revertAll();

    const greenCard = document.getElementById('auth_gc') as HTMLInputElement;
    expect(greenCard.checked).toBe(true);
    expect(usCitizen.checked).toBe(false);
  });
});

// ── F-05: duplicate-name selectors ─────────────────────────────────

describe('F-05: selectors disambiguate duplicate names', () => {
  it('does not fill the wrong control when several inputs share a name', () => {
    setBodyHtml(`
      <form>
        <label>Personal<input name="email" placeholder="Personal" /></label>
        <label>Work<input name="email" placeholder="Work" /></label>
      </form>
    `);
    const r = scrapeFormFieldsWithMap();
    setActiveSelectorMap(r.selectorMap);

    // Find the second field (Work) and fill it.
    const workField = r.fields.find((f) => f.identity.label.toLowerCase().includes('work'))!;
    expect(workField).toBeDefined();

    const status = fillField(workField, 'work@example.com');
    expect(status).toBe('filled');

    const inputs = Array.from(document.querySelectorAll('input[name="email"]')) as HTMLInputElement[];
    expect(inputs[0]?.value).toBe(''); // Personal untouched
    expect(inputs[1]?.value).toBe('work@example.com'); // Work filled
  });
});

// ── F-06: no arbitrary select fallback ─────────────────────────────

describe('F-06: no arbitrary fallback for selects', () => {
  it('returns unmatched-select and does not mutate the select when no option matches', () => {
    loadFixture();
    const r = scrapeFormFieldsWithMap();
    setActiveSelectorMap(r.selectorMap);

    const relocate = r.fields.find((f) => f.label === 'Willing to Relocate')!;
    const status = fillField(relocate, 'Definitely');
    expect(status).toBe('unmatched-select');

    const select = document.getElementById('relocate') as HTMLSelectElement;
    expect(select.selectedIndex).toBe(0); // unchanged
  });

  it('returns unmatched-select even when the field has no human label (name-only)', () => {
    setBodyHtml(`
      <form>
        <select name="c">
          <option value="">--</option>
          <option value="yes">Yes</option>
        </select>
      </form>
    `);
    const r = scrapeFormFieldsWithMap();
    setActiveSelectorMap(r.selectorMap);
    const status = fillField(r.fields[0]!, 'maybe');
    expect(status).toBe('unmatched-select');
  });
});

// ── F-08: visibility / disabled controls ───────────────────────────

describe('F-08: ineligible controls are excluded', () => {
  it('skips inputs whose fieldset is disabled', () => {
    setBodyHtml(`
      <form>
        <fieldset disabled>
          <input name="locked" />
        </fieldset>
        <input name="open" placeholder="Open field" />
      </form>
    `);
    const r = scrapeFormFieldsWithMap();
    const labels = r.fields.map((f) => f.label);
    expect(labels).not.toContain('locked');
    expect(labels).toContain('Open field');
  });

  it('skips inputs inside an element with aria-hidden="true"', () => {
    setBodyHtml(`
      <form>
        <div aria-hidden="true">
          <input name="hidden-input" />
        </div>
        <input name="visible-input" placeholder="Visible field" />
      </form>
    `);
    const r = scrapeFormFieldsWithMap();
    const labels = r.fields.map((f) => f.label);
    expect(labels).not.toContain('hidden-input');
    expect(labels).toContain('Visible field');
  });
});
