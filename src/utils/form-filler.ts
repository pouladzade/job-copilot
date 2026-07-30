import type { ScrapedField } from './form-scraper';

export type FillStatus = 'filled' | 'unmatched-radio' | 'unmatched-select' | 'identity-mismatch' | 'not-found';

interface FieldSnapshot {
  readonly selector: string;
  readonly value: string;
  readonly checked: boolean;
  readonly selectedIndex: number;
  readonly selectedRadioValue: string | null;
  readonly radioGroup: string;
}

const MAX_VALUE_LENGTH = 5000;
const TRUNCATION_WARNING_THRESHOLD = 0;

const snapshots = new Map<string, FieldSnapshot>();

function dispatchEvents(element: Element, fieldType: ScrapedField['type']): void {
  const name = fieldType;

  if (name === 'text' || name === 'textarea') {
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function snapshotBeforeFill(selector: string, element: Element, radioGroup: string): void {
  if (snapshots.has(selector)) {
    return;
  }

  const input = element as HTMLInputElement;
  const select = element as HTMLSelectElement;

  snapshots.set(selector, {
    selector,
    value: 'value' in element ? (element as { value: string }).value : '',
    checked: 'checked' in element ? input.checked : false,
    selectedIndex: 'selectedIndex' in element ? select.selectedIndex : -1,
    selectedRadioValue: radioGroup === '' ? null : input.checked ? input.value || null : null,
    radioGroup,
  });
}

function identityKey(f: ScrapedField): string {
  const id = f.identity;
  if (id === undefined) return `${f.id}|${f.label}`;
  return `${id.tag}|${id.inputType}|${id.name}|${id.id}|${id.formKey}|${id.positionInForm}|${f.label}|${f.options.join(',')}`;
}

// Count current same-name controls at inject time. The scraper captured the
// expected count in identity.nameMatchCount; a mismatch means the page state
// has changed since review (e.g. an attacker injected a duplicate control
// between scrape and inject, F-01).
function currentNameMatchCount(f: ScrapedField): number {
  const name = f.identity?.name ?? f.selector.match(/\[name="(.+)"\]/)?.[1] ?? '';
  if (name === '') return 1;

  if (f.type === 'radio') {
    return document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`).length;
  }
  const tag = (f.identity?.tag ?? 'input').toLowerCase();
  return document.querySelectorAll(`${tag}[name="${CSS.escape(name)}"]`).length;
}

function verifyIdentity(f: ScrapedField, element: Element): boolean {
  // Identity is required for safe injection; tests that construct synthetic
  // fields without it skip verification (callers in production always go
  // through scrapeFormFieldsWithMap which populates identity).
  if (f.identity === undefined) return true;
  const tag = element.tagName.toLowerCase();
  if (tag !== f.identity.tag) return false;

  if (f.identity.inputType !== '') {
    const elType = (element as HTMLInputElement).type ?? '';
    if (elType !== f.identity.inputType) return false;
  }

  const elName = element.getAttribute('name') ?? '';
  if (elName !== f.identity.name) return false;

  const elId = element.getAttribute('id') ?? '';
  if (elId !== f.identity.id) return false;

  // F-05: label disambiguates when several controls share a name.
  if (f.identity.label !== '') {
    const liveLabel = resolveLiveLabel(element);
    if (liveLabel !== f.identity.label) return false;
  }

  if (f.identity.options.length > 0) {
    const elementOptions = extractLiveOptions(element);
    if (elementOptions.length !== f.identity.options.length) return false;
    for (let i = 0; i < elementOptions.length; i++) {
      if (elementOptions[i] !== f.identity.options[i]) return false;
    }
  }

  return true;
}

function resolveLiveLabel(element: Element): string {
  const input = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  const id = input.id;
  if (id !== '') {
    const labelEl = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (labelEl !== null) {
      const text = labelEl.textContent?.trim();
      if (text !== undefined && text !== '') return text;
    }
  }
  const parentLabel = element.closest('label');
  if (parentLabel !== null) {
    let text = '';
    for (const child of parentLabel.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) text += child.textContent ?? '';
    }
    text = text.trim();
    if (text !== '') return text;
  }
  const aria = input.getAttribute('aria-label');
  if (aria !== null && aria !== '') return aria;
  // Mirror the scraper's last-resort fallback to the name attribute.
  const name = element.getAttribute('name');
  if (name !== null && name !== '') return name.replace(/[_-]/g, ' ');
  return '';
}

function extractLiveOptions(element: Element): readonly string[] {
  if (element.tagName.toLowerCase() === 'select') {
    const select = element as HTMLSelectElement;
    return Array.from(select.options)
      .filter((o) => o.value !== '')
      .map((o) => o.text.trim());
  }
  if (element.tagName.toLowerCase() === 'input') {
    const input = element as HTMLInputElement;
    if (input.type === 'radio') {
      const radioName = input.getAttribute('name') ?? '';
      if (radioName !== '') {
        const radios = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(radioName)}"]`);
        return Array.from(radios)
          .map((r) => r.getAttribute('value') ?? '')
          .filter((v) => v !== '');
      }
    }
  }
  return [];
}

function snapshotRadioGroup(name: string): void {
  const groupKey = `radio:${CSS.escape(name)}`;
  if (snapshots.has(groupKey)) return;
  const radios = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`);
  // Snapshot the entire group under one key. We restore by setting the original
  // selected value rather than by per-element state, so a preselected non-first
  // radio is correctly restored (F-03).
  let selectedValue: string | null = null;
  for (const r of radios) {
    const ri = r as HTMLInputElement;
    if (ri.checked) {
      selectedValue = ri.value || null;
      break;
    }
  }
  // Synthesize a snapshot element so revertAll() finds an entry under groupKey.
  const firstRadio = radios[0] as HTMLInputElement | undefined;
  if (firstRadio === undefined) return;
  snapshots.set(groupKey, {
    selector: groupKey,
    value: '',
    checked: selectedValue !== null,
    selectedIndex: -1,
    selectedRadioValue: selectedValue,
    radioGroup: name,
  });
}

export function fillField(field: ScrapedField, value: string): FillStatus {
  const selectors = getActiveSelectorMap();
  const selector = selectors[field.id];

  if (selector === undefined) {
    console.warn(`No selector found for field: ${field.id}`);

    return 'not-found';
  }

  let elements: NodeListOf<Element>;

  if (field.type === 'radio') {
    const nameMatch = /\[name="(.+)"\]/.exec(selector);
    const nameFromSelector = nameMatch?.[1];
    let radioName = '';

    if (nameFromSelector !== undefined) {
      radioName = nameFromSelector;
    } else {
      const firstElement = document.querySelector(selector);
      if (firstElement !== null) {
        radioName = (firstElement as HTMLInputElement).getAttribute('name') ?? '';
      }
    }

    if (radioName === '') {
      console.warn(`Radio field has no resolvable name: ${field.id}`);
      return 'not-found';
    }

    // F-02: Validate the value is one of the live options before mutating anything.
    const liveOptions = extractLiveOptionsByName(radioName);
    if (liveOptions.length === 0 || !liveOptions.includes(value)) {
      console.warn(`Radio value "${value}" not in options [${liveOptions.join(', ')}] for ${field.id}`);
      return 'unmatched-radio';
    }

    snapshotRadioGroup(radioName);

    const radios = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(radioName)}"]`);
    for (const radio of radios) {
      const radioInput = radio as HTMLInputElement;
      radioInput.checked = radioInput.value === value;
      dispatchEvents(radio, 'radio');
    }
    return 'filled';
  }

  // For non-radio fields, build the candidate list by selector. The selector may
  // resolve to multiple nodes when the name is shared (F-05); we use identity
  // matching (F-01) to pick the right one and reject if none match.
  elements = document.querySelectorAll(selector);

  // F-01: detect page-state drift between scrape and fill. If the number of
  // same-named controls has changed since scraping, refuse — an attacker may
  // have injected a duplicate control to capture the value.
  if (field.identity !== undefined) {
    const liveCount = currentNameMatchCount(field);
    if (liveCount !== field.identity.nameMatchCount) {
      console.warn(
        `Name match count changed for ${field.id}: scraped=${field.identity.nameMatchCount}, live=${liveCount}`,
      );
      return 'identity-mismatch';
    }
  }

  if (elements.length === 0) {
    console.warn(`Element not found for selector: ${selector}`);
    return 'not-found';
  }

  if (elements.length > 1) {
    // Disambiguate by identity.
    const match = Array.from(elements).find((el) => verifyIdentity(field, el));
    if (match === undefined) {
      console.warn(`Identity mismatch for ${field.id} (${identityKey(field)})`);
      return 'identity-mismatch';
    }
    elements = [match] as unknown as NodeListOf<Element>;
  }

  const element = elements[0];
  if (element === undefined) return 'not-found';

  if (!verifyIdentity(field, element)) {
    console.warn(`Identity mismatch for ${field.id} (${identityKey(field)})`);
    return 'identity-mismatch';
  }

  snapshotBeforeFill(selector, element, '');

  let finalValue = value;
  if (field.maxLength > TRUNCATION_WARNING_THRESHOLD && value.length > field.maxLength) {
    finalValue = value.slice(0, field.maxLength);
    console.warn(`Value truncated for field "${field.label}" (maxLength: ${field.maxLength})`);
  }

  if (finalValue.length > MAX_VALUE_LENGTH) {
    finalValue = finalValue.slice(0, MAX_VALUE_LENGTH);
  }

  switch (field.type) {
    case 'text':
    case 'textarea': {
      const input = element as HTMLInputElement | HTMLTextAreaElement;
      input.value = finalValue;
      dispatchEvents(element, field.type);
      return 'filled';
    }

    case 'select': {
      const select = element as HTMLSelectElement;
      const fv = finalValue.toLowerCase().trim();

      // F-06: only match exact or unambiguous option; never pick an arbitrary fallback.
      const exactIndex = Array.from(select.options).findIndex((o) => {
        const text = o.text.trim().toLowerCase();
        const val = o.value.toLowerCase();
        return (text === fv || val === fv) && o.value !== '';
      });

      if (exactIndex >= 0) {
        select.selectedIndex = exactIndex;
        dispatchEvents(element, 'select');
        return 'filled';
      }
      console.warn(`No exact select match for "${value}" in ${field.id}`);
      return 'unmatched-select';
    }

    case 'checkbox': {
      const checkbox = element as HTMLInputElement;
      const truthyValues = ['yes', 'true', '1', 'on', 'checked'];
      checkbox.checked = truthyValues.includes(finalValue.toLowerCase().trim());
      dispatchEvents(element, 'checkbox');
      return 'filled';
    }
  }
}

function extractLiveOptionsByName(name: string): readonly string[] {
  const radios = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`);
  return Array.from(radios)
    .map((r) => (r as HTMLInputElement).value)
    .filter((v) => v !== '');
}

export function revertAll(): number {
  let reverted = 0;

  for (const [key, snapshot] of snapshots) {
    if (snapshot.radioGroup !== '') {
      // Restore radio group by setting the originally-selected value (F-03).
      const radios = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(snapshot.radioGroup)}"]`);
      const target = snapshot.selectedRadioValue;
      for (const radio of radios) {
        const ri = radio as HTMLInputElement;
        ri.checked = target !== null && ri.value === target;
        dispatchEvents(radio, 'radio');
        reverted++;
      }
      continue;
    }

    const elements = document.querySelectorAll(key);

    for (const element of elements) {
      if (element instanceof HTMLInputElement) {
        if (element.type === 'radio' || element.type === 'checkbox') {
          element.checked = snapshot.checked;
        } else {
          element.value = snapshot.value;
        }
        dispatchEvents(element, element.type as ScrapedField['type']);
        reverted++;
      } else if (element instanceof HTMLTextAreaElement) {
        element.value = snapshot.value;
        dispatchEvents(element, 'textarea');
        reverted++;
      } else if (element instanceof HTMLSelectElement) {
        element.selectedIndex = snapshot.selectedIndex;
        dispatchEvents(element, 'select');
        reverted++;
      }
    }
  }

  snapshots.clear();

  return reverted;
}

// Module-internal selector map — set by content.ts after scraping, cleared on refill
let activeSelectorMap: Record<string, string> = {};

export function setActiveSelectorMap(map: Record<string, string>): void {
  activeSelectorMap = { ...map };
  snapshots.clear();
}

function getActiveSelectorMap(): Record<string, string> {
  return activeSelectorMap;
}
