/**
 * Unit tests for form-scraper.ts
 *
 * Uses jsdom to create real DOM fixtures, then runs scrapeFormFieldsWithMap()
 * and asserts expected behavior.
 */
import { scrapeFormFieldsWithMap } from '../utils/form-scraper';

function setBodyHtml(html: string): void {
  document.body.innerHTML = html;
}

describe('scrapeFormFieldsWithMap', () => {
  describe('submit element exclusion', () => {
    it('excludes <button type="submit">', () => {
      setBodyHtml(`
        <form>
          <input name="name" placeholder="Full Name" />
          <button type="submit">Apply</button>
        </form>
      `);

      const result = scrapeFormFieldsWithMap();

      expect(result.fields.length).toBe(1);
      expect(result.fields[0]?.label).toBe('Full Name');
    });

    it('excludes <input type="submit">', () => {
      setBodyHtml(`
        <form>
          <input name="email" placeholder="Email" />
          <input type="submit" value="Send" />
        </form>
      `);

      const result = scrapeFormFieldsWithMap();

      expect(result.fields.length).toBe(1);
      expect(result.fields[0]?.label).toBe('Email');
    });

    it('excludes <input type="button">', () => {
      setBodyHtml(`
        <form>
          <input name="phone" placeholder="Phone" />
          <input type="button" value="Cancel" />
        </form>
      `);

      const result = scrapeFormFieldsWithMap();

      expect(result.fields.length).toBe(1);
      expect(result.fields[0]?.label).toBe('Phone');
    });

    it('excludes <input type="reset">', () => {
      setBodyHtml(`
        <form>
          <input name="address" placeholder="Address" />
          <input type="reset" value="Clear" />
        </form>
      `);

      const result = scrapeFormFieldsWithMap();

      expect(result.fields.length).toBe(1);
      expect(result.fields[0]?.label).toBe('Address');
    });

    it('excludes <input type="image">', () => {
      setBodyHtml(`
        <form>
          <input name="username" placeholder="Username" />
          <input type="image" src="btn.png" alt="Go" />
        </form>
      `);

      const result = scrapeFormFieldsWithMap();

      expect(result.fields.length).toBe(1);
      expect(result.fields[0]?.label).toBe('Username');
    });

    it('excludes all submit-type elements alongside normal fields', () => {
      setBodyHtml(`
        <form>
          <input name="name" placeholder="Full Name" />
          <input name="email" placeholder="Email" />
          <textarea name="bio" placeholder="About you"></textarea>
          <select name="country">
            <option value="">--</option>
            <option value="US">United States</option>
          </select>
          <input type="submit" value="Submit" />
          <button type="submit">Apply Now</button>
          <input type="button" value="Cancel" />
          <input type="reset" value="Reset" />
        </form>
      `);

      const result = scrapeFormFieldsWithMap();

      expect(result.fields.length).toBe(4);
      const labels = result.fields.map((f) => f.label);
      expect(labels).not.toContain('Submit');
      expect(labels).not.toContain('Apply Now');
      expect(labels).not.toContain('Cancel');
      expect(labels).not.toContain('Reset');
    });
  });

  describe('classification by type', () => {
    it('classifies <input type="text"> as text', () => {
      setBodyHtml('<form><input name="a" /></form>');

      const result = scrapeFormFieldsWithMap();

      expect(result.fields[0]?.type).toBe('text');
    });

    it('classifies <textarea> as textarea', () => {
      setBodyHtml('<form><textarea name="a"></textarea></form>');

      const result = scrapeFormFieldsWithMap();

      expect(result.fields[0]?.type).toBe('textarea');
    });

    it('classifies <select> as select', () => {
      setBodyHtml('<form><select name="a"><option value="1">One</option></select></form>');

      const result = scrapeFormFieldsWithMap();

      expect(result.fields[0]?.type).toBe('select');
    });

    it('classifies <input type="radio"> as radio', () => {
      setBodyHtml('<form><input type="radio" name="a" value="1" /></form>');

      const result = scrapeFormFieldsWithMap();

      expect(result.fields[0]?.type).toBe('radio');
    });

    it('classifies <input type="checkbox"> as checkbox', () => {
      setBodyHtml('<form><input type="checkbox" name="a" /></form>');

      const result = scrapeFormFieldsWithMap();

      expect(result.fields[0]?.type).toBe('checkbox');
    });
  });

  describe('label resolution fallback chain', () => {
    it('uses <label for="..."> when present', () => {
      setBodyHtml(`
        <form>
          <label for="fullName">Your Full Name</label>
          <input id="fullName" name="name" />
        </form>
      `);

      const result = scrapeFormFieldsWithMap();

      expect(result.fields[0]?.label).toBe('Your Full Name');
    });

    it('uses parent <label> when no for attribute', () => {
      setBodyHtml(`
        <form>
          <label>
            Email Address
            <input name="email" />
          </label>
        </form>
      `);

      const result = scrapeFormFieldsWithMap();

      expect(result.fields[0]?.label).toBe('Email Address');
    });

    it('falls back to aria-label when no label element', () => {
      setBodyHtml(`
        <form>
          <input name="phone" aria-label="Phone Number" />
        </form>
      `);

      const result = scrapeFormFieldsWithMap();

      expect(result.fields[0]?.label).toBe('Phone Number');
    });

    it('falls back to placeholder when no label or aria-label', () => {
      setBodyHtml(`
        <form>
          <input name="city" placeholder="Enter your city" />
        </form>
      `);

      const result = scrapeFormFieldsWithMap();

      expect(result.fields[0]?.label).toBe('Enter your city');
    });

    it('falls back to name attribute as last resort', () => {
      setBodyHtml(`
        <form>
          <input name="years_of_experience" />
        </form>
      `);

      const result = scrapeFormFieldsWithMap();

      expect(result.fields[0]?.label).toBe('years of experience');
    });
  });

  describe('radio group deduplication', () => {
    it('returns one field for a radio group with 3+ options, containing all options', () => {
      setBodyHtml(`
        <form>
          <label>Work Authorization</label>
          <input type="radio" name="work_auth" value="us_citizen" /> US Citizen
          <input type="radio" name="work_auth" value="green_card" /> Green Card
          <input type="radio" name="work_auth" value="visa" /> Visa Holder
        </form>
      `);

      const result = scrapeFormFieldsWithMap();

      expect(result.fields.length).toBe(1);
      expect(result.fields[0]?.type).toBe('radio');
      expect(result.fields[0]?.options).toEqual(['us_citizen', 'green_card', 'visa']);
    });
  });

  describe('select options extraction', () => {
    it('extracts options from <select>', () => {
      setBodyHtml(`
        <form>
          <label for="country">Country</label>
          <select id="country" name="country">
            <option value="">-- Select --</option>
            <option value="US">United States</option>
            <option value="CA">Canada</option>
          </select>
        </form>
      `);

      const result = scrapeFormFieldsWithMap();

      expect(result.fields[0]?.type).toBe('select');
      expect(result.fields[0]?.options).toEqual(['United States', 'Canada']);
    });
  });

  describe('selector map', () => {
    it('returns a selector map with field_id → CSS selector', () => {
      setBodyHtml(`
        <form>
          <input id="email" name="email" placeholder="Email" />
        </form>
      `);

      const result = scrapeFormFieldsWithMap();

      expect(result.fields[0]?.id).toBe('field_0');
      // Selectors prefer name so the filler can detect duplicate-name injection (F-01).
      expect(result.selectorMap['field_0']).toBe('input[name="email"]');
    });

    it('falls back to name-based selector when no id, disambiguating by identity at fill time (F-05)', () => {
      setBodyHtml(`
        <form>
          <input name="full_name" placeholder="Name" />
        </form>
      `);

      const result = scrapeFormFieldsWithMap();

      // The selector targets the named control; identity disambiguation in
      // fillField() picks the right element when several share a name (F-05).
      expect(result.selectorMap['field_0']).toBe('input[name="full_name"]');
    });

    it('produces an identity that uniquely distinguishes duplicate-name controls (F-05/F-01)', () => {
      setBodyHtml(`
        <form>
          <input name="email" placeholder="Personal" />
          <input name="email" placeholder="Work" />
        </form>
      `);

      const result = scrapeFormFieldsWithMap();
      expect(result.fields.length).toBe(2);
      // Both fields share the same selector but carry different identity
      // signatures (position + label) so the filler can disambiguate.
      expect(result.fields[0]?.selector).toBe(result.fields[1]?.selector);
      expect(result.fields[0]?.identity.positionInForm).not.toBe(result.fields[1]?.identity.positionInForm);
      expect(result.fields[0]?.identity.label).not.toBe(result.fields[1]?.identity.label);
    });
  });

  describe('maxLength', () => {
    it('reads maxLength from the element attribute', () => {
      setBodyHtml(`
        <form>
          <input name="short" maxlength="10" />
        </form>
      `);

      const result = scrapeFormFieldsWithMap();

      expect(result.fields[0]?.maxLength).toBe(10);
    });

    it('defaults to 5000 when no maxLength attribute', () => {
      setBodyHtml(`
        <form>
          <input name="long" />
        </form>
      `);

      const result = scrapeFormFieldsWithMap();

      expect(result.fields[0]?.maxLength).toBe(5000);
    });
  });

  describe('fallback scraping for formless pages', () => {
    it('scans document.body when no <form> element exists', () => {
      setBodyHtml(`
        <div class="application">
          <label>Full Name<input name="fullName" /></label>
          <label>Email<input name="email" type="email" /></label>
          <label>Why us?<textarea name="whyUs"></textarea></label>
          <button type="submit">Apply</button>
        </div>
      `);

      const result = scrapeFormFieldsWithMap();
      expect(result.fields.length).toBe(3);
      expect(result.debug).toContain('body-fallback');
    });

    it('scans [role="form"] containers', () => {
      setBodyHtml(`
        <div role="form">
          <label>City<input name="city" /></label>
          <input type="submit" value="Submit" />
        </div>
      `);

      const result = scrapeFormFieldsWithMap();
      expect(result.fields.length).toBe(1);
      expect(result.fields[0]?.label).toBe('City');
      expect(result.debug).toContain('div');
    });

    it('skips inputs with type="hidden"', () => {
      setBodyHtml(`
        <form>
          <input type="hidden" name="csrf" value="abc" />
          <label>Name<input name="name" /></label>
        </form>
      `);

      const result = scrapeFormFieldsWithMap();
      expect(result.fields.length).toBe(1);
      expect(result.fields[0]?.label).toBe('Name');
    });

    it('skips inputs with aria-hidden="true"', () => {
      setBodyHtml(`
        <form>
          <input name="dummy" aria-hidden="true" />
          <label>Real<input name="real" /></label>
        </form>
      `);

      const result = scrapeFormFieldsWithMap();
      expect(result.fields.length).toBe(1);
      expect(result.fields[0]?.label).toBe('Real');
    });

    it('skips inputs with the hidden attribute', () => {
      setBodyHtml(`
        <form>
          <input name="hidden1" hidden />
          <label>Visible<input name="visible" /></label>
        </form>
      `);

      const result = scrapeFormFieldsWithMap();
      expect(result.fields.length).toBe(1);
    });

    it('skips inputs with inline display:none style', () => {
      setBodyHtml(`
        <form>
          <input name="styled" style="display: none" />
          <label>Real<input name="real" /></label>
        </form>
      `);

      const result = scrapeFormFieldsWithMap();
      expect(result.fields.length).toBe(1);
    });

    it('includes a debug string describing what was found', () => {
      setBodyHtml(`<form><input name="x" /></form>`);
      const result = scrapeFormFieldsWithMap();
      expect(result.debug).toContain('forms=');
      expect(result.debug).toContain('1 fields');
    });

    it('skips file inputs', () => {
      setBodyHtml(`
        <form>
          <label>Resume<input type="file" name="resume" /></label>
          <label>Cover<input type="file" name="cover" /></label>
          <label>Name<input name="name" /></label>
        </form>
      `);

      const result = scrapeFormFieldsWithMap();
      expect(result.fields.length).toBe(1);
      expect(result.fields[0]?.label).toBe('Name');
    });

    it('resolves radio labels from <legend> instead of sibling text', () => {
      setBodyHtml(`
        <form>
          <fieldset>
            <legend>Are you willing to travel?</legend>
            <label><input type="radio" name="travel" value="yes" /> Yes, no problem I am open to travel</label>
            <label><input type="radio" name="travel" value="no" /> No</label>
          </fieldset>
        </form>
      `);

      const result = scrapeFormFieldsWithMap();
      expect(result.fields.length).toBe(1);
      expect(result.fields[0]?.label).toBe('Are you willing to travel?');
    });

    it('resolves radio labels from [role="radiogroup"] aria-label', () => {
      setBodyHtml(`
        <form>
          <div role="radiogroup" aria-label="Notice period">
            <label><input type="radio" name="np" value="0" /> Immediately</label>
            <label><input type="radio" name="np" value="30" /> 30 days</label>
          </div>
        </form>
      `);

      const result = scrapeFormFieldsWithMap();
      expect(result.fields[0]?.label).toBe('Notice period');
    });

    it('ignores generic placeholder text like "Start typing..."', () => {
      setBodyHtml(`
        <form>
          <textarea name="motivation" placeholder="Start typing..."></textarea>
          <input name="name" />
        </form>
      `);

      const result = scrapeFormFieldsWithMap();
      expect(result.fields.length).toBe(2);
      const textarea = result.fields.find((f) => f.type === 'textarea');
      expect(textarea?.label).not.toBe('Start typing...');
      expect(textarea?.label).toBe('motivation');
    });
  });
});
