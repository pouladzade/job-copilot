export interface ScrapedField {
  readonly id: string;
  readonly label: string;
  readonly type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox';
  readonly selector: string;
  readonly maxLength: number;
  readonly options: readonly string[];
}

export type FieldSelectorMap = Record<string, string>;

const MAX_FIELD_ID = 500;

const SUBMIT_INPUT_TYPES = new Set(['submit', 'button', 'image', 'reset']);

const PLACEHOLDER_BLACKLIST = new Set([
  'start typing...',
  'type here...',
  'enter text...',
  'enter your response...',
  'your answer...',
  'write here...',
  'click to add...',
  'search...',
]);

type FieldType = ScrapedField['type'];

interface ScrapeResult {
  readonly fields: ScrapedField[];
  readonly selectorMap: FieldSelectorMap;
  readonly debug: string;
}

function isVisible(element: Element): boolean {
  if (element.getAttribute('type') === 'hidden') return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;
  if (element.hasAttribute('hidden')) return false;
  const style = (element as HTMLElement).style;
  if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
  return true;
}

function findFormContainers(): readonly Element[] {
  const containers: Element[] = Array.from(document.querySelectorAll('form'));
  if (containers.length > 0) return containers;
  const roleForms = document.querySelectorAll('[role="form"]');
  if (roleForms.length > 0) return Array.from(roleForms);
  // Fallback: formless pages (AshbyHQ, custom React forms, etc.) — scan body directly.
  return document.body ? [document.body] : [];
}

function resolveFieldsetLegend(input: Element): string {
  const fieldset = input.closest('fieldset');
  if (fieldset === null) return '';
  const legend = fieldset.querySelector('legend');
  if (legend !== null) {
    const t = legend.textContent?.trim();
    if (t !== undefined && t !== '') return t;
  }
  const ariaLabel = fieldset.getAttribute('aria-label');
  if (ariaLabel !== null && ariaLabel !== '') return ariaLabel;
  const ariaLabelledBy = fieldset.getAttribute('aria-labelledby');
  if (ariaLabelledBy !== null && ariaLabelledBy !== '') {
    const ref = document.getElementById(ariaLabelledBy);
    if (ref !== null) {
      const t = ref.textContent?.trim();
      if (t !== undefined && t !== '') return t;
    }
  }
  return '';
}

function resolveRadiogroupLabel(input: Element): string {
  const group = input.closest('[role="radiogroup"], [role="group"]');
  if (group === null) return '';
  const ariaLabel = group.getAttribute('aria-label');
  if (ariaLabel !== null && ariaLabel !== '') return ariaLabel;
  const ariaLabelledBy = group.getAttribute('aria-labelledby');
  if (ariaLabelledBy !== null && ariaLabelledBy !== '') {
    const ref = document.getElementById(ariaLabelledBy);
    if (ref !== null) {
      const t = ref.textContent?.trim();
      if (t !== undefined && t !== '') return t;
    }
  }
  return '';
}

function resolveAdjacentLabelText(input: Element): string {
  // Walk previous siblings + walk up to parent's previous siblings.
  let cur: ChildNode | null = input;
  for (let i = 0; i < 3 && cur !== null; i++) {
    cur = cur.previousSibling;
    if (cur === null) break;
    if (cur.nodeType === Node.TEXT_NODE) {
      const t = (cur.textContent ?? '').trim();
      if (t.length > 3) return t;
    } else if (cur.nodeType === Node.ELEMENT_NODE) {
      const t = (cur.textContent ?? '').trim();
      if (t.length > 3 && t.length < 200) return t;
    }
  }
  const parent = input.parentElement;
  if (parent !== null) {
    const ps = parent.previousElementSibling;
    if (ps !== null) {
      const t = (ps.textContent ?? '').trim();
      if (t.length > 3 && t.length < 200) return t;
    }
  }
  return '';
}

function getDirectTextContent(element: Element): string {
  let text = '';
  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent ?? '';
    }
  }

  return text.trim();
}

function resolveLabel(element: Element): string {
  const input = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  const id = input.id;

  if (id !== '') {
    const labelEl = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (labelEl !== null) {
      const text = labelEl.textContent?.trim();
      if (text !== undefined && text !== '') return text;
    }
  }

  // Radio buttons: prefer the parent fieldset's <legend> / role="radiogroup" / adjacent label
  // over the sibling text label, which usually contains the option value (e.g. "Yes, no problem").
  if (input.type === 'radio') {
    const fsLabel = resolveFieldsetLegend(input);
    if (fsLabel !== '') return fsLabel;
    const rgLabel = resolveRadiogroupLabel(input);
    if (rgLabel !== '') return rgLabel;
    const adjLabel = resolveAdjacentLabelText(input);
    if (adjLabel !== '') return adjLabel;
    // For radios, do NOT fall back to parent <label> text — that's the option, not the question.
    const ariaLabel = input.getAttribute('aria-label');
    if (ariaLabel !== null && ariaLabel !== '') return ariaLabel;
    const name = input.getAttribute('name');
    if (name !== null && name !== '') return name.replace(/[_-]/g, ' ');
    return '';
  }

  const parentLabel = input.closest('label');
  if (parentLabel !== null) {
    const text = getDirectTextContent(parentLabel);
    if (text !== '') return text;
  }

  const ariaLabel = input.getAttribute('aria-label');
  if (ariaLabel !== null && ariaLabel !== '') return ariaLabel;

  const ariaLabelledBy = input.getAttribute('aria-labelledby');
  if (ariaLabelledBy !== null && ariaLabelledBy !== '') {
    const ref = document.getElementById(ariaLabelledBy);
    if (ref !== null) {
      const t = ref.textContent?.trim();
      if (t !== undefined && t !== '') return t;
    }
  }

  const placeholder = input.getAttribute('placeholder');
  if (placeholder !== null && placeholder !== '' && !PLACEHOLDER_BLACKLIST.has(placeholder.toLowerCase().trim())) {
    return placeholder;
  }

  const name = input.getAttribute('name');
  if (name !== null && name !== '') {
    return name.replace(/[_-]/g, ' ');
  }

  return '';
}

function isSubmitElement(element: Element): boolean {
  const tag = element.tagName.toLowerCase();

  if (tag === 'button') {
    const button = element as HTMLButtonElement;
    const type = (button.getAttribute('type') ?? 'submit').toLowerCase();

    return type === 'submit';
  }

  if (tag === 'input') {
    const input = element as HTMLInputElement;
    const type = (input.getAttribute('type') ?? 'text').toLowerCase();

    return SUBMIT_INPUT_TYPES.has(type);
  }

  return false;
}

function classifyFieldType(element: Element): FieldType {
  const tag = element.tagName.toLowerCase();

  if (tag === 'textarea') {
    return 'textarea';
  }

  if (tag === 'select') {
    return 'select';
  }

  if (tag === 'input') {
    const input = element as HTMLInputElement;
    const type = (input.getAttribute('type') ?? 'text').toLowerCase();

    if (type === 'radio') {
      return 'radio';
    }

    if (type === 'checkbox') {
      return 'checkbox';
    }

    return 'text';
  }

  return 'text';
}

function extractOptions(element: Element): readonly string[] {
  if (element.tagName.toLowerCase() === 'select') {
    const select = element as HTMLSelectElement;

    return Array.from(select.options)
      .filter((opt) => opt.value !== '')
      .map((opt) => opt.text.trim());
  }

  if (element.tagName.toLowerCase() === 'input') {
    const input = element as HTMLInputElement;
    const type = (input.getAttribute('type') ?? 'text').toLowerCase();

    if (type === 'radio') {
      const name = input.getAttribute('name');
      if (name !== null && name !== '') {
        const radios = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`);

        return Array.from(radios)
          .map((r) => {
            const value = r.getAttribute('value');

            return value ?? '';
          })
          .filter((v) => v !== '');
      }
    }
  }

  return [];
}

function buildSelector(element: Element): string {
  const id = element.id;
  if (id !== '') {
    return `#${CSS.escape(id)}`;
  }

  const name = (element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).getAttribute('name');
  if (name !== null && name !== '') {
    return `[name="${CSS.escape(name)}"]`;
  }

  const tag = element.tagName.toLowerCase();
  const classes = element.className && typeof element.className === 'string'
    ? `.${element.className.toString().trim().split(/\s+/).join('.')}`
    : '';

  return `${tag}${classes}`;
}

export function scrapeFormFields(): ScrapedField[] {
  return scrapeFormFieldsWithMap().fields;
}

export function scrapeFormFieldsWithMap(): ScrapeResult {
  const forms = findFormContainers();
  const isBodyFallback = forms.length === 1 && forms[0] === document.body;
  const debug = `forms=${forms.length}${isBodyFallback ? ' (body-fallback)' : ` (${forms[0]?.tagName.toLowerCase() ?? '?'})`}`;

  if (forms.length === 0 || (isBodyFallback && !document.body.querySelector('input, textarea, select'))) {
    return { fields: [], selectorMap: {}, debug: `${debug} — no controls found` };
  }

  const seenRadios = new Set<string>();
  const seenControls = new WeakSet<Element>();
  const fields: ScrapedField[] = [];
  const selectorMap: FieldSelectorMap = {};
  let fieldCounter = 0;

  for (const form of forms) {
    const controls = form.querySelectorAll('input, textarea, select, button');

    for (const control of controls) {
      if (seenControls.has(control)) continue;
      seenControls.add(control);

      if (isSubmitElement(control)) continue;
      if (!isVisible(control)) continue;

      // Skip file uploads — these need real files, not text matching.
      if (control.tagName.toLowerCase() === 'input' && (control as HTMLInputElement).type === 'file') continue;

      const type = classifyFieldType(control);

      // Deduplicate radio groups: only capture the first radio in a named group
      if (type === 'radio') {
        const radioName = (control as HTMLInputElement).getAttribute('name') ?? '';
        if (radioName !== '' && seenRadios.has(radioName)) {
          continue;
        }
        if (radioName !== '') {
          seenRadios.add(radioName);
        }
      }

      if (fieldCounter >= MAX_FIELD_ID) {
        break;
      }

      const fieldId = `field_${fieldCounter}`;
      const label = resolveLabel(control);
      const maxLength = parseInt((control as HTMLInputElement).getAttribute('maxlength') ?? '0', 10) || 5000;
      const options = extractOptions(control);
      const selector = buildSelector(control);

      fields.push({
        id: fieldId,
        label,
        type,
        selector,
        maxLength,
        options,
      });

      selectorMap[fieldId] = selector;
      fieldCounter++;
    }

    if (fieldCounter >= MAX_FIELD_ID) {
      break;
    }
  }

  return { fields, selectorMap, debug: `${debug} — ${fields.length} fields` };
}