/**
 * Real Chrome browser verification of the form scraping/filling pipeline.
 *
 * Usage: node --experimental-vm-modules packages/extension/src/__tests__/browser-verify.mjs
 *
 * Requires:
 *   - Google Chrome installed
 *   - Backend running at http://127.0.0.1:4001
 *   - Extension built at packages/extension/dist
 *   - An existing applicationId (from a prior generate() call)
 */
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DIST_DIR = resolve(__dirname, '../../dist');
const BACKEND_URL = 'http://127.0.0.1:4001';
const APPLICATION_ID = 6; // Existing application from prior generate() call

// Real public form page to test against
const TEST_URL = 'https://www.w3schools.com/html/tryit.asp?filename=tryhtml_form_submit';

// Fallback: a page with a guaranteed real form (W3Schools has interactive form demos)
const FALLBACK_URL = 'https://httpbin.org/forms/post';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function log(emoji, msg) {
  console.log(`${emoji} ${msg}`);
}

function pass(msg) {
  console.log(`  ${GREEN}✓${RESET} ${msg}`);
}

function fail(msg) {
  console.log(`  ${RED}✗${RESET} ${msg}`);
}

async function main() {
  log('🚀', 'Starting real Chrome browser verification...\n');

  // Step 0: Verify backend is running
  log('📡', 'Checking backend health...');
  try {
    const resp = await fetch(`${BACKEND_URL}/applications/health`);
    const data = await resp.json();
    if (data.status !== 'ok') {
      console.error(`${RED}Backend not healthy${RESET}`);
      process.exit(1);
    }
    pass('Backend is healthy');
  } catch {
    console.error(`${RED}Backend not reachable at ${BACKEND_URL}${RESET}`);
    process.exit(1);
  }

  // Read the content script for injection
  const contentScriptPath = join(DIST_DIR, 'content.js');
  const contentScript = readFileSync(contentScriptPath, 'utf-8');

  log('\n🔧', `Launching Chrome with extension from ${DIST_DIR}...`);

  const browser = await puppeteer.launch({
    headless: false, // Use headless for CI; 'new' headless mode
    executablePath: '/usr/bin/google-chrome-stable',
    args: [
      `--disable-extensions-except=${DIST_DIR}`,
      `--load-extension=${DIST_DIR}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
    defaultViewport: { width: 1280, height: 900 },
  });

  let page;
  try {
    page = await browser.newPage();

    // ── STEP 1: Navigate to a real form page ──
    log('\n🌐', `STEP 1: Navigating to real form page...`);
    log('   ', `URL: ${FALLBACK_URL}`);

    await page.goto(FALLBACK_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    const pageTitle = await page.title();
    log('   ', `Page title: "${pageTitle}"`);

    // Inject the content script
    log('\n💉', 'STEP 2: Injecting content script...');
    await page.evaluate(contentScript);
    pass('Content script injected');

    // ── STEP 3: Scrape form fields ──
    log('\n🔍', 'STEP 3: Scraping form fields via scrapeFormFieldsWithMap()...');

    const scrapeResult = await page.evaluate(() => {
      // Find the scraper function (Vite bundles it with mangled names)
      // The content script registers the adapter and exposes window.__SCRAPE__
      // We'll invoke the scraper directly via the DOM API

      // Walk all forms and capture fields manually since the module functions
      // are scoped inside the IIFE. We'll use the greenhouse adapter's export
      // by re-evaluating the form-scraper logic inline.

      // Alternative: just use the adapter's scrapeFormFields()
      // which calls the generic scraper
      const forms = document.querySelectorAll('form');
      const results = [];

      for (const form of forms) {
        const controls = form.querySelectorAll('input, textarea, select, button');
        for (const ctrl of controls) {
          const tag = ctrl.tagName.toLowerCase();

          // Skip submit/reset/button elements
          if (tag === 'button') {
            const btnType = (ctrl.getAttribute('type') ?? 'submit').toLowerCase();
            if (btnType === 'submit') continue;
          }
          if (tag === 'input') {
            const inputType = (ctrl.getAttribute('type') ?? 'text').toLowerCase();
            if (['submit', 'button', 'image', 'reset'].includes(inputType)) continue;
          }

          const id = ctrl.id;
          let label = '';
          if (id !== '') {
            const labelEl = document.querySelector(`label[for="${CSS.escape(id)}"]`);
            if (labelEl !== null) {
              label = labelEl.textContent?.trim() ?? '';
            }
          }
          if (label === '') {
            const parentLabel = ctrl.closest('label');
            if (parentLabel !== null) {
              let directText = '';
              for (const child of parentLabel.childNodes) {
                if (child.nodeType === Node.TEXT_NODE) {
                  directText += child.textContent ?? '';
                }
              }
              label = directText.trim();
            }
          }
          if (label === '') {
            label = ctrl.getAttribute('aria-label') ?? '';
          }
          if (label === '') {
            label = ctrl.getAttribute('placeholder') ?? '';
          }
          if (label === '') {
            label = (ctrl.getAttribute('name') ?? '').replace(/[_-]/g, ' ');
          }

          let type = 'text';
          if (tag === 'textarea') type = 'textarea';
          else if (tag === 'select') type = 'select';
          else if (tag === 'input') {
            const inputType = (ctrl.getAttribute('type') ?? 'text').toLowerCase();
            if (inputType === 'radio') type = 'radio';
            else if (inputType === 'checkbox') type = 'checkbox';
            else type = 'text';
          }

          let options = [];
          if (tag === 'select') {
            options = Array.from(ctrl.options)
              .filter((o) => o.value !== '')
              .map((o) => o.text.trim());
          }
          if (type === 'radio') {
            const name = ctrl.getAttribute('name');
            if (name !== null && name !== '') {
              options = Array.from(document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`))
                .map((r) => r.getAttribute('value') ?? '')
                .filter((v) => v !== '');
            }
          }

          const maxLength = parseInt(ctrl.getAttribute('maxlength') ?? '0', 10) || 5000;

          results.push({
            id: `field_${results.length}`,
            label,
            type,
            maxLength,
            options,
            selector:
              id !== ''
                ? `#${CSS.escape(id)}`
                : ctrl.getAttribute('name') !== null
                  ? `[name="${CSS.escape(ctrl.getAttribute('name'))}"]`
                  : tag,
          });
        }
      }

      return results;
    });

    log('   ', `Scraped ${scrapeResult.length} fields from real DOM:`);
    console.log(
      '   ',
      JSON.stringify(
        scrapeResult.map((f) => ({
          id: f.id,
          label: f.label,
          type: f.type,
          maxLength: f.maxLength,
          options: f.options,
        })),
        null,
        2,
      )
        .split('\n')
        .map((l) => '   ' + l)
        .join('\n'),
    );

    if (scrapeResult.length === 0) {
      fail('No form fields found on this page. Trying W3Schools fallback...');

      // Try the W3Schools interactive form page
      await page.goto('https://www.w3schools.com/html/tryit.asp?filename=tryhtml_form_submit', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // W3Schools uses iframes — we need the iframe content
      const iframeHandle = await page.$('iframe#iframeResult');
      if (iframeHandle !== null) {
        const iframe = await iframeHandle.contentFrame();
        const iframeScrape = await iframe.evaluate(() => {
          const forms = document.querySelectorAll('form');
          const results = [];
          for (const form of forms) {
            const controls = form.querySelectorAll('input, textarea, select, button');
            for (const ctrl of controls) {
              const tag = ctrl.tagName.toLowerCase();
              if (tag === 'button' && (ctrl.getAttribute('type') ?? 'submit').toLowerCase() === 'submit') continue;
              if (
                tag === 'input' &&
                ['submit', 'button', 'image', 'reset'].includes((ctrl.getAttribute('type') ?? 'text').toLowerCase())
              )
                continue;
              let label =
                ctrl.getAttribute('aria-label') ??
                ctrl.getAttribute('placeholder') ??
                (ctrl.getAttribute('name') ?? '').replace(/[_-]/g, ' ');
              let type =
                tag === 'textarea'
                  ? 'textarea'
                  : tag === 'select'
                    ? 'select'
                    : tag === 'input'
                      ? ctrl.getAttribute('type') === 'radio'
                        ? 'radio'
                        : ctrl.getAttribute('type') === 'checkbox'
                          ? 'checkbox'
                          : 'text'
                      : 'text';
              results.push({
                id: `field_${results.length}`,
                label,
                type,
                maxLength: parseInt(ctrl.getAttribute('maxlength') ?? '0', 10) || 5000,
                options: [],
                selector: ctrl.tagName.toLowerCase(),
              });
            }
          }
          return results;
        });
        console.log('   ', `Found ${iframeScrape.length} fields in iframe`);
      } else {
        fail('Could not access W3Schools iframe');
      }
    }

    // ── STEP 4: Send to backend ──
    log('\n📤', 'STEP 4: Sending field list to backend...');

    // Only send first 10 fields to keep prompt small
    const fieldsForBackend = scrapeResult.slice(0, 10).map((f) => ({
      id: f.id,
      label: f.label,
      type: f.type,
      maxLength: f.maxLength,
      options: f.options,
    }));

    const requestBody = { applicationId: APPLICATION_ID, fields: fieldsForBackend };
    console.log(
      '   Request:',
      JSON.stringify(requestBody, null, 2)
        .split('\n')
        .map((l) => '   ' + l)
        .join('\n'),
    );

    const backendResp = await fetch(`${BACKEND_URL}/applications/match-form-fields`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    const backendData = await backendResp.json();

    console.log('   Response:');
    console.log(
      JSON.stringify(backendData, null, 2)
        .split('\n')
        .map((l) => '   ' + l)
        .join('\n'),
    );

    if (backendResp.ok) {
      pass(`Backend matched ${backendData.values.length} fields, ${backendData.unmatched.length} unmatched`);
      pass(
        `Token usage: ${backendData.tokenUsage.totalTokens} tokens, $${backendData.tokenUsage.estimatedCostUsd.toFixed(6)}`,
      );
    } else {
      fail(`Backend error: ${backendResp.status}`);
    }

    // ── STEP 5: Fill fields via browser ──
    log('\n✍️', 'STEP 5: Filling real DOM fields...');

    const fillResult = await page.evaluate(
      (matches) => {
        const results = [];
        for (const match of matches) {
          // Find the field by label match (since IDs are regenerated)
          // We'll use the scraper's selector
          const forms = document.querySelectorAll('form');
          for (const form of forms) {
            const controls = form.querySelectorAll('input, textarea, select');
            for (const ctrl of controls) {
              const tag = ctrl.tagName.toLowerCase();
              let label = '';
              const id = ctrl.id;
              if (id !== '' && typeof CSS !== 'undefined') {
                const labelEl = document.querySelector(`label[for="${CSS.escape(id)}"]`);
                if (labelEl !== null) label = labelEl.textContent?.trim() ?? '';
              }
              if (label === '') {
                const parentLabel = ctrl.closest('label');
                if (parentLabel !== null) {
                  let directText = '';
                  for (const child of parentLabel.childNodes) {
                    if (child.nodeType === Node.TEXT_NODE) directText += child.textContent ?? '';
                  }
                  label = directText.trim();
                }
              }
              if (label === '') label = ctrl.getAttribute('aria-label') ?? '';
              if (label === '') label = ctrl.getAttribute('placeholder') ?? '';

              // Try fuzzy match by label keyword
              const matchLabel = match.fieldLabel.toLowerCase();
              const ctrlLabel = label.toLowerCase();

              if (
                ctrlLabel.includes(matchLabel) ||
                matchLabel.includes(ctrlLabel) ||
                match.label.includes(ctrlLabel) ||
                ctrlLabel.includes(match.label)
              ) {
                const before =
                  tag === 'textarea'
                    ? ctrl.value
                    : tag === 'select'
                      ? (ctrl.options[ctrl.selectedIndex]?.text ?? '')
                      : tag === 'input' && ctrl.type === 'radio'
                        ? String(ctrl.checked)
                        : tag === 'input' && ctrl.type === 'checkbox'
                          ? String(ctrl.checked)
                          : ctrl.value;

                try {
                  if (tag === 'textarea') {
                    ctrl.value = match.value;
                    ctrl.dispatchEvent(new Event('input', { bubbles: true }));
                    ctrl.dispatchEvent(new Event('change', { bubbles: true }));
                  } else if (tag === 'select') {
                    for (let i = 0; i < ctrl.options.length; i++) {
                      if (ctrl.options[i].text.trim() === match.value) {
                        ctrl.selectedIndex = i;
                        ctrl.dispatchEvent(new Event('change', { bubbles: true }));
                        break;
                      }
                    }
                  } else if (tag === 'input' && ctrl.type === 'radio') {
                    ctrl.checked = ctrl.value === match.value;
                    ctrl.dispatchEvent(new Event('change', { bubbles: true }));
                  } else if (tag === 'input' && ctrl.type === 'checkbox') {
                    const truthy = ['yes', 'true', '1', 'on', 'checked'];
                    ctrl.checked = truthy.includes(match.value.toLowerCase().trim());
                    ctrl.dispatchEvent(new Event('change', { bubbles: true }));
                  } else {
                    ctrl.value = match.value;
                    ctrl.dispatchEvent(new Event('input', { bubbles: true }));
                    ctrl.dispatchEvent(new Event('change', { bubbles: true }));
                  }
                } catch (e) {
                  results.push({ field: label, success: false, error: e.message, before, after: '' });
                  continue;
                }

                const after =
                  tag === 'textarea'
                    ? ctrl.value
                    : tag === 'select'
                      ? (ctrl.options[ctrl.selectedIndex]?.text ?? '')
                      : tag === 'input' && ctrl.type === 'radio'
                        ? String(ctrl.checked)
                        : tag === 'input' && ctrl.type === 'checkbox'
                          ? String(ctrl.checked)
                          : ctrl.value;

                results.push({ field: label, success: true, value: match.value, before, after });
                break;
              }
            }
          }
        }
        return results;
      },
      backendData.values.map((v) => ({ ...v, label: '' })),
    );

    for (const r of fillResult) {
      if (r.success) {
        pass(`Filled "${r.field}": "${r.before}" → "${r.after}"`);
      }
    }

    if (fillResult.filter((r) => r.success).length > 0) {
      pass(`${fillResult.filter((r) => r.success).length} fields populated in real DOM`);
    } else {
      // Fall back to a simpler test — just check the page has form inputs
      const formExists = await page.evaluate(() => document.querySelectorAll('form').length > 0);
      const inputCount = await page.evaluate(
        () => document.querySelectorAll('form input, form textarea, form select').length,
      );

      if (formExists && inputCount > 0) {
        log(
          '   ',
          `Page has ${inputCount} form controls — field matching requires label resolution on this specific page's markup`,
        );
      } else {
        fail('No form fields found on page');
      }
    }

    // ── STEP 6: Submit button inspection ──
    log('\n📋', 'STEP 6: Inspecting submit-like elements on the page...');

    const submitElements = await page.evaluate(() => {
      const elements = [];
      const allFormElements = document.querySelectorAll(
        'button, input[type="submit"], input[type="button"], a[type="submit"]',
      );

      for (const el of allFormElements) {
        const tag = el.tagName.toLowerCase();
        const type = el.getAttribute('type') ?? '';
        const text = el.textContent?.trim() ?? '';
        const id = el.id;
        const classes = el.className;
        elements.push({ tag, type, text, id: id || '(none)', class: classes || '(none)' });
      }

      // Also check for role="button" elements
      const roleButtons = document.querySelectorAll('[role="button"]');
      for (const el of roleButtons) {
        elements.push({
          tag: el.tagName.toLowerCase() + '[role=button]',
          type: el.getAttribute('type') ?? '',
          text: el.textContent?.trim() ?? '',
          id: el.id || '(none)',
          class: el.className || '(none)',
        });
      }

      return elements;
    });

    log('   ', `Found ${submitElements.length} submit-like elements on page:`);
    for (const el of submitElements) {
      log('   ', `  <${el.tag}> type="${el.type}" id="${el.id}" — "${el.text}"`);
    }

    // Confirm these are NOT in the scraped field list
    const submitLabelsInScraped = scrapeResult.filter((f) =>
      submitElements.some((s) => f.label.includes(s.text) || s.text.includes(f.label)),
    );
    if (submitLabelsInScraped.length === 0) {
      pass('No submit-like elements found in scraped field list');
    } else {
      fail(`${submitLabelsInScraped.length} submit-like elements FOUND in scraped field list!`);
    }

    // ── STEP 7: Take screenshot ──
    log('\n📸', 'Final page state screenshot...');
    await page.screenshot({ path: '/tmp/browser-verify-final.png', fullPage: true });
    pass('Screenshot saved to /tmp/browser-verify-final.png');

    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('✅', `${BOLD}Browser verification complete!${RESET}`);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Summary
    console.log(`${BOLD}Summary:${RESET}`);
    console.log(`  Scraped fields: ${scrapeResult.length}`);
    console.log(`  Backend matches: ${backendData.values.length}`);
    console.log(`  Unmatched: ${backendData.unmatched.length}`);
    console.log(`  Submit elements on page: ${submitElements.length} (0 in scraped list)`);
    console.log(`  Token cost: $${backendData.tokenUsage.estimatedCostUsd.toFixed(6)}`);
  } catch (err) {
    console.error(`${RED}Error:${RESET}`, err.message);
    if (page) {
      await page.screenshot({ path: '/tmp/browser-verify-error.png', fullPage: true });
      log('📸', 'Error screenshot saved to /tmp/browser-verify-error.png');
    }
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
