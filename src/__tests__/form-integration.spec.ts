/**
 * Browser verification — loads a real form fixture, scrapes it, fills values,
 * verifies DOM population, and reverts.
 *
 * This is the closest equivalent to a real Chrome browser since:
 *   - jest-environment-jsdom provides a full DOM
 *   - CSS.escape is polyfilled via jest.setup.ts
 *   - The same scrapeFormFieldsWithMap(), fillField(), revertAll() are called
 */
import { scrapeFormFieldsWithMap } from '../utils/form-scraper';
import { fillField, revertAll, setActiveSelectorMap } from '../utils/form-filler';
import type { ScrapedField } from '../utils/form-scraper';

const FIXTURE = `
<!DOCTYPE html>
<html>
<head><title>Job Application Form — Test Page</title></head>
<body>
  <h1>Acme Corp — Senior Backend Engineer Application</h1>
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
      <label for="phone">Phone Number</label>
      <input id="phone" name="phone" type="text" maxlength="20" />
    </div>
    <div class="form-group">
      <label>Work Authorization</label>
      <input type="radio" name="work_auth" value="us_citizen" id="auth_citizen" />
      <label for="auth_citizen">US Citizen</label>
      <input type="radio" name="work_auth" value="green_card" id="auth_gc" />
      <label for="auth_gc">Green Card Holder</label>
      <input type="radio" name="work_auth" value="visa" id="auth_visa" />
      <label for="auth_visa">Visa Holder</label>
    </div>
    <div class="form-group">
      <label for="yearsExp">Years of Professional Experience</label>
      <input id="yearsExp" name="yearsExp" type="text" maxlength="2" aria-label="Years of experience" />
    </div>
    <div class="form-group">
      <label for="linkedin">LinkedIn Profile URL</label>
      <input id="linkedin" name="linkedin" type="text" maxlength="300" />
    </div>
    <div class="form-group">
      <label for="github">GitHub Profile URL</label>
      <input id="github" name="github" type="text" maxlength="300" />
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
    <div class="form-group">
      <label for="salary">Salary Expectations</label>
      <input id="salary" name="salary" type="text" maxlength="100" placeholder="$XX,XXX — $XX,XXX" />
    </div>
    <div class="form-group">
      <label for="bio">Tell us about yourself</label>
      <textarea id="bio" name="bio" maxlength="2000" rows="4"></textarea>
    </div>
    <div class="form-group">
      <label><input type="checkbox" name="agree_terms" id="terms" /> I agree to the terms</label>
    </div>
    <div class="form-actions">
      <button type="submit" id="submit-btn">Submit Application</button>
      <input type="reset" value="Clear Form" />
      <a href="/cancel" style="display:inline-block;padding:8px 16px;background:#eee;border:1px solid #ccc;">Cancel</a>
    </div>
  </form>
</body>
</html>
`;

function loadFixture(): void {
  document.documentElement.innerHTML = FIXTURE;
}

// Simulated LLM response values for the fields
const MOCK_MATCHES: ReadonlyArray<{ readonly fieldId: string; readonly value: string }> = [
  { fieldId: 'field_0', value: 'Ahmad Pouladzade' },
  { fieldId: 'field_1', value: 'user@example.com' },
  { fieldId: 'field_2', value: '+1-555-0123' },
  { fieldId: 'field_3', value: 'us_citizen' }, // radio group — value matches
  { fieldId: 'field_4', value: '7' }, // years of experience
  { fieldId: 'field_5', value: 'https://linkedin.com/in/user' },
  { fieldId: 'field_6', value: 'https://github.com/user' },
  { fieldId: 'field_7', value: 'Yes' }, // select
  { fieldId: 'field_8', value: '$150,000' }, // salary
  { fieldId: 'field_9', value: 'I am a software engineer with 7 years of experience.' },
  { fieldId: 'field_10', value: 'true' }, // checkbox — truthy
];

describe('form-fill integration (browser simulation)', () => {
  it('step 1 — scrapeFormFieldsWithMap returns real fields matching the fixture', () => {
    loadFixture();

    const result = scrapeFormFieldsWithMap();
    setActiveSelectorMap(result.selectorMap);

    // Check: we expect 11 real fields (not counting submit/reset elements)
    expect(result.fields.length).toBe(11);

    // Check: submit button NOT in field list
    const labels = result.fields.map((f) => f.label);
    expect(labels).not.toContain('Submit Application');
    expect(labels).not.toContain('Clear Form');
    expect(labels).not.toContain('Cancel');

    // Verify specific fields exist
    const fullNameField = result.fields.find((f) => f.label === 'Full Name');
    expect(fullNameField?.type).toBe('text');
    expect(fullNameField?.maxLength).toBe(100);

    const workAuthField = result.fields.find((f) => f.type === 'radio');
    expect(workAuthField?.options).toEqual(['us_citizen', 'green_card', 'visa']);

    const relocateField = result.fields.find((f) => f.label === 'Willing to Relocate');
    expect(relocateField?.type).toBe('select');
    expect(relocateField?.options).toEqual(['Yes', 'No', 'Maybe']);

    const checkboxField = result.fields.find((f) => f.type === 'checkbox');
    expect(checkboxField?.label).toBe('I agree to the terms');
  });

  it('step 2 — fillField() populates real DOM fields', () => {
    loadFixture();

    const result = scrapeFormFieldsWithMap();
    setActiveSelectorMap(result.selectorMap);

    // Fill each matched value
    for (const match of MOCK_MATCHES) {
      const field = result.fields.find((f) => f.id === match.fieldId);
      if (field !== undefined) {
        fillField(field, match.value);
      }
    }

    // Verify DOM values
    const nameInput = document.querySelector('#fullName') as HTMLInputElement;
    expect(nameInput.value).toBe('Ahmad Pouladzade');

    const emailInput = document.querySelector('#email') as HTMLInputElement;
    expect(emailInput.value).toBe('user@example.com');

    // Radio group — us_citizen should be checked
    const usCitizenRadio = document.querySelector('#auth_citizen') as HTMLInputElement;
    expect(usCitizenRadio.checked).toBe(true);
    const gcRadio = document.querySelector('#auth_gc') as HTMLInputElement;
    expect(gcRadio.checked).toBe(false);

    // Select element
    const relocateSelect = document.querySelector('#relocate') as HTMLSelectElement;
    expect(relocateSelect.options[relocateSelect.selectedIndex]?.text).toBe('Yes');

    // Checkbox
    const termsCheckbox = document.querySelector('#terms') as HTMLInputElement;
    expect(termsCheckbox.checked).toBe(true);

    // Textarea
    const bioTextarea = document.querySelector('#bio') as HTMLTextAreaElement;
    expect(bioTextarea.value).toBe('I am a software engineer with 7 years of experience.');
  });

  it('step 3 — revertAll() restores original values', () => {
    loadFixture();

    const result = scrapeFormFieldsWithMap();
    setActiveSelectorMap(result.selectorMap);

    // Record original values before fill
    const nameInput = document.querySelector('#fullName') as HTMLInputElement;
    const originalName = nameInput.value;
    expect(originalName).toBe('');

    // Fill everything
    for (const match of MOCK_MATCHES) {
      const field = result.fields.find((f) => f.id === match.fieldId);
      if (field !== undefined) {
        fillField(field, match.value);
      }
    }

    // Confirm values were set
    expect(nameInput.value).toBe('Ahmad Pouladzade');

    // Revert
    const reverted = revertAll();

    // Verify reverted
    expect(reverted).toBeGreaterThan(0);
    expect(nameInput.value).toBe('');

    const usCitizenRadio = document.querySelector('#auth_citizen') as HTMLInputElement;
    expect(usCitizenRadio.checked).toBe(false);

    const termsCheckbox = document.querySelector('#terms') as HTMLInputElement;
    expect(termsCheckbox.checked).toBe(false);

    const bioTextarea = document.querySelector('#bio') as HTMLTextAreaElement;
    expect(bioTextarea.value).toBe('');
  });

  it('step 4 — submit-type elements confirmed absent from field list', () => {
    loadFixture();

    const result = scrapeFormFieldsWithMap();

    const labels = result.fields.map((f) => f.label);
    const ids = result.fields.map((f) => f.id);

    // The page has <button type="submit">, <input type="reset">, and a cancel <a>
    // None should appear
    expect(labels).not.toContain('Submit Application');
    expect(labels).not.toContain('Clear Form');
    expect(labels).not.toContain('Cancel');

    // Check: no element with id="submit-btn" should appear
    const submitButtonInFields = result.fields.some((f) => f.id === 'submit-btn' || f.label === 'Submit Application');
    expect(submitButtonInFields).toBe(false);
  });
});
