import type { ScrapedField } from './form-scraper';

interface FieldSnapshot {
  readonly selector: string;
  readonly value: string;
  readonly checked: boolean;
  readonly selectedIndex: number;
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

function snapshotBeforeFill(selector: string, element: Element): void {
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
  });
}

export function fillField(field: ScrapedField, value: string): void {
  const selectors = getActiveSelectorMap();
  const selector = selectors[field.id];

  if (selector === undefined) {
    console.warn(`No selector found for field: ${field.id}`);

    return;
  }

  let element: Element | null;

  // For radio groups, use the name to find all options
  if (field.type === 'radio') {
    // Try selector-based name extraction first (e.g., [name="work_auth"])
    const nameMatch = /\[name="(.+)"\]/.exec(selector);
    let radioName = nameMatch?.[1] !== undefined ? nameMatch[1] : '';

    // Fallback: try extracting name from the matched element itself (e.g., #auth_citizen)
    if (radioName === '') {
      const firstElement = document.querySelector(selector);
      if (firstElement !== null) {
        radioName = (firstElement as HTMLInputElement).getAttribute('name') ?? '';
      }
    }

    if (radioName !== '') {
      const radios = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(radioName)}"]`);

      for (const radio of radios) {
        const radioInput = radio as HTMLInputElement;
        snapshotBeforeFill(`[name="${CSS.escape(radioName)}"]`, radio);

        const radioValue = radioInput.value;
        radioInput.checked = radioValue === value;

        dispatchEvents(radio, 'radio');
      }

      return;
    }

    element = document.querySelector(selector);
  } else {
    element = document.querySelector(selector);
  }

  if (element === null) {
    console.warn(`Element not found for selector: ${selector}`);

    return;
  }

  snapshotBeforeFill(selector, element);

  // Truncate value if it exceeds maxLength
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
      break;
    }

    case 'select': {
      const select = element as HTMLSelectElement;
      const fv = finalValue.toLowerCase().trim();
      let bestIndex = -1;
      let bestScore = 0;

      for (let i = 0; i < select.options.length; i++) {
        const option = select.options[i];
        if (option === undefined) continue;
        const text = option.text.trim().toLowerCase();
        const val = option.value.toLowerCase();

        // Exact match
        if (text === fv || val === fv) {
          bestIndex = i;
          bestScore = 100;
          break;
        }

        // Contains match (e.g. "Germany (+49)" contains "germany")
        if (text.includes(fv) || fv.includes(text)) {
          const score = 80;
          if (score > bestScore) {
            bestScore = score;
            bestIndex = i;
          }
        }

        // Word-start match (e.g. "DE" matches "Germany" via country code — not great but better than nothing)
        const words = text.split(/\s+/);
        for (const w of words) {
          if (w === fv || w.startsWith(fv) || fv.startsWith(w)) {
            const score = 60;
            if (score > bestScore) {
              bestScore = score;
              bestIndex = i;
            }
          }
        }
      }

      if (bestIndex >= 0) {
        select.selectedIndex = bestIndex;
        dispatchEvents(element, 'select');
      } else if (select.options.length > 0 && fv !== '') {
        // Last resort: pick first non-empty, non-placeholder option
        for (let i = 0; i < select.options.length; i++) {
          const option = select.options[i];
          if (option !== undefined && option.value !== '' && option.text.trim() !== '') {
            select.selectedIndex = i;
            dispatchEvents(element, 'select');
            break;
          }
        }
      }
      break;
    }

    case 'checkbox': {
      const checkbox = element as HTMLInputElement;
      const truthyValues = ['yes', 'true', '1', 'on', 'checked'];
      checkbox.checked = truthyValues.includes(finalValue.toLowerCase().trim());
      dispatchEvents(element, 'checkbox');
      break;
    }

    case 'radio': {
      // Radio groups handled above via name-based iteration
      break;
    }
  }
}

export function revertAll(): number {
  let reverted = 0;

  for (const [key, snapshot] of snapshots) {
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