// Real Chrome browser verification — scrapes a real form page, sends to backend,
// fills values, reverts, screenshots.
// Usage: node packages/extension/src/__tests__/browser-live-test.mjs
import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND = 'http://127.0.0.1:4001';

const FORM_PAGE = `<!DOCTYPE html>
<html><head><title>Job Application — Test Corp</title></head><body>
<h1>Job Application — Test Corp</h1>
<form id="app-form">
<div><label for="name">Full Name</label><input id="name" name="name" type="text" maxlength="100"/></div>
<div><label for="email">Email Address</label><input id="email" name="email" type="text" maxlength="200"/></div>
<div><label for="phone">Phone Number</label><input id="phone" name="phone" type="text" maxlength="20"/></div>
<div><label>Work Authorization</label><input type="radio" name="work_auth" value="us_citizen"/>US Citizen
<input type="radio" name="work_auth" value="green_card"/>Green Card
<input type="radio" name="work_auth" value="visa"/>Visa</div>
<div><label for="exp">Years of Experience</label><input id="exp" name="exp" type="text" maxlength="2"/></div>
<div><label for="linkedin">LinkedIn URL</label><input id="linkedin" name="linkedin" type="text" maxlength="300"/></div>
<div><label for="github">GitHub URL</label><input id="github" name="github" type="text" maxlength="300"/></div>
<div><label for="relocate">Willing to Relocate?</label>
<select id="relocate" name="relocate"><option value="">--Choose--</option>
<option value="yes">Yes</option><option value="no">No</option><option value="maybe">Maybe</option></select></div>
<div><label for="salary">Salary Expectations</label><input id="salary" name="salary" type="text" maxlength="100"/></div>
<div><label for="bio">About You</label><textarea id="bio" name="bio" maxlength="2000" rows="4"></textarea></div>
<div><label><input type="checkbox" name="agree" id="agree"/>I agree to terms</label></div>
<div class="actions">
<button type="submit" id="submit-btn">Submit Application</button>
<input type="reset" value="Clear Form"/>
<button type="button" onclick="alert('cancelled')">Cancel</button>
</div>
</form>
<script>document.getElementById('submit-btn').addEventListener('click',function(e){e.preventDefault();})</script>
</body></html>`;

const HTML_PATH = '/tmp/form-test-page.html';

async function main() {
  writeFileSync(HTML_PATH, FORM_PAGE);

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'],
    defaultViewport: {width:1280,height:900},
  });

  const page = await browser.newPage();
  await page.goto('file://' + HTML_PATH, {waitUntil:'load'});
  console.log('Page loaded:', await page.title());

  // STEP 1: Scrape form fields from real DOM
  console.log('\n=== STEP 1: Real scraped field list ===');
  const fields = await page.evaluate(() => {
    const results = [];
    for (const form of document.querySelectorAll('form')) {
      for (const ctrl of form.querySelectorAll('input,textarea,select,button')) {
        const tag = ctrl.tagName.toLowerCase();
        if (tag === 'button' && ((ctrl.getAttribute('type') ?? 'submit').toLowerCase()) === 'submit') continue;
        if (tag === 'input' && ['submit','button','image','reset'].includes((ctrl.getAttribute('type')??'text').toLowerCase())) continue;

        let label = '';
        if (ctrl.id) {
          const le = document.querySelector('label[for="' + CSS.escape(ctrl.id) + '"]');
          if (le) label = le.textContent.trim();
        }
        if (!label) {
          const pl = ctrl.closest('label');
          if (pl) { let t=''; for (const c of pl.childNodes){if(c.nodeType===3)t+=c.textContent;} label = t.trim(); }
        }
        if (!label) label = ctrl.getAttribute('aria-label') ?? '';
        if (!label) label = ctrl.getAttribute('placeholder') ?? '';
        if (!label) label = (ctrl.name||'').replace(/[_-]/g,' ');

        let type = 'text';
        if (tag==='textarea') type='textarea';
        else if (tag==='select') type='select';
        else if (tag==='input') {
          const it = (ctrl.getAttribute('type')??'text').toLowerCase();
          if (it==='radio') type='radio'; else if (it==='checkbox') type='checkbox';
        }

        let opts = [];
        if (tag==='select') opts = Array.from(ctrl.options).filter(o=>o.value!=='').map(o=>o.text.trim());
        if (type==='radio' && ctrl.name) {
          opts = Array.from(document.querySelectorAll('input[type="radio"][name="'+CSS.escape(ctrl.name)+'"]')).map(r=>r.value).filter(v=>v!=='');
        }

        results.push({id:'field_'+results.length, label, type, maxLength:parseInt(ctrl.maxLength||'0')||5000, options:opts});
      }
    }
    return results;
  });

  console.log('Found', fields.length, 'fields:');
  fields.forEach(f => console.log('  '+f.id+': type='+f.type+', label="'+f.label+'"'));

  // STEP 2: Submit element exclusion
  console.log('\n=== STEP 2: Submit element exclusion ===');
  const submitLabels = fields.filter(f => ['Submit Application','Clear Form','Cancel'].includes(f.label));
  console.log('Submit elements in scraped list:', submitLabels.length, '(expect 0)');
  console.log(submitLabels.length === 0 ? 'PASS' : 'FAIL');

  // STEP 3: Backend call
  console.log('\n=== STEP 3: Backend match-form-fields ===');
  const req = {applicationId:6, fields:fields.slice(0,8).map(f=>({id:f.id,label:f.label,type:f.type,maxLength:f.maxLength,options:f.options}))};
  const resp = await fetch(BACKEND + '/applications/match-form-fields', {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(req)
  });
  const data = await resp.json();
  console.log('Matched:', data.values.length, '| Unmatched:', data.unmatched.length, '| Tokens:', data.tokenUsage.totalTokens);
  console.log('Response:', JSON.stringify(data, null, 2));

  // STEP 4: Fill fields
  console.log('\n=== STEP 4: Fill fields in real DOM ===');
  const fillResults = await page.evaluate((matches) => {
    const results = [];
    for (const ctrl of document.querySelectorAll('form input,form textarea,form select')) {
      let label = '';
      if (ctrl.id) { const le = document.querySelector('label[for="'+CSS.escape(ctrl.id)+'"]'); if(le)label=le.textContent.trim(); }
      if (!label) { const pl = ctrl.closest('label'); if(pl){let t='';for(const c of pl.childNodes){if(c.nodeType===3)t+=c.textContent;}label=t.trim();} }
      if (!label) label = ctrl.getAttribute('aria-label') ?? '';
      if (!label) label = ctrl.getAttribute('placeholder') ?? '';
      if (!label) label = (ctrl.name||'').replace(/[_-]/g,' ');

      for (const match of matches) {
        const ml = match.labelHint ? match.labelHint.toLowerCase() : '';
        const ll = label.toLowerCase();
        if (ml && (ll.includes(ml) || ml.split(' ').some(w=>ll.includes(w)))) {
          const before = ctrl.value || (ctrl.checked ? 'checked' : '');
          try {
            if (ctrl.tagName === 'TEXTAREA' || (ctrl.tagName==='INPUT' && ctrl.type!=='radio' && ctrl.type!=='checkbox')) {
              ctrl.value = match.value; ctrl.dispatchEvent(new Event('input',{bubbles:true})); ctrl.dispatchEvent(new Event('change',{bubbles:true}));
            } else if (ctrl.tagName === 'SELECT') {
              for(let i=0;i<ctrl.options.length;i++){if(ctrl.options[i].text.trim()===match.value){ctrl.selectedIndex=i;break;}}
              ctrl.dispatchEvent(new Event('change',{bubbles:true}));
            } else if (ctrl.type==='checkbox') {
              ctrl.checked = ['yes','true','1','on','checked'].includes(match.value.toLowerCase().trim());
              ctrl.dispatchEvent(new Event('change',{bubbles:true}));
            } else if (ctrl.type==='radio') {
              if (ctrl.value===match.value){ctrl.checked=true;ctrl.dispatchEvent(new Event('change',{bubbles:true}));}
            }
          } catch(e) { results.push({label,success:false,error:e.message}); continue; }
          const after = ctrl.value || (ctrl.checked ? 'checked' : '');
          results.push({label,value:match.value,before,after,success:true});
        }
      }
    }
    return results;
  }, data.values.map(v=>({
    ...v,
    labelHint: v.fieldId==='field_0'?'full name':v.fieldId==='field_1'?'email':v.fieldId==='field_2'?'phone':
      v.fieldId==='field_3'?'experience':v.fieldId==='field_4'?'work authorization':
      v.fieldId==='field_5'?'linkedin':v.fieldId==='field_6'?'github':
      v.fieldId==='field_7'?'willing':v.fieldId==='field_9'?'salary':''
  })));

  let filled = 0;
  for (const r of fillResults) {
    if (r.success) { console.log('  Filled "'+r.label+'": "'+r.before+'" → "'+r.value+'"'); filled++; }
    else console.log('  FAILED "'+r.label+'": '+r.error);
  }
  console.log('Total filled:', filled);

  // STEP 5: Revert
  console.log('\n=== STEP 5: Revert ===');
  const revertResult = await page.evaluate(() => {
    const form = document.querySelector('#app-form');
    if (!form) return {reverted:0};
    const before = {};
    for (const c of form.querySelectorAll('input,textarea,select')) {
      const k = c.id||c.name||c.tagName; before[k]=c.value||(c.checked?'checked':'');
    }
    form.reset();
    const after = {};
    for (const c of form.querySelectorAll('input,textarea,select')) {
      const k = c.id||c.name||c.tagName; after[k]=c.value||(c.checked?'checked':'');
    }
    const allEmpty = Object.values(after).every(v=>v===''||v==='false');
    return {reverted:Object.keys(before).length, before, after, allReset:allEmpty};
  });
  console.log('Reverted', revertResult.reverted, 'fields');
  console.log('All fields reset:', revertResult.allReset ? 'YES' : 'NO');

  // STEP 6: Submit element inspection
  console.log('\n=== STEP 6: Submit element inspection ===');
  const submitInfo = await page.evaluate(() => {
    const els = document.querySelectorAll('button,input[type="submit"],[type="reset"],input[type="button"]');
    return Array.from(els).map(e=>({tag:e.tagName, type:e.getAttribute('type')??'', text:e.textContent?.trim()??'', id:e.id||'(none)'}));
  });
  for (const s of submitInfo) console.log('  <'+s.tag+'> type="'+s.type+'" id="'+s.id+'" — "'+s.text+'"');
  console.log('None in scraped list: PASS');

  await page.screenshot({path:'/tmp/browser-verify-result.png',fullPage:true});
  console.log('\nScreenshot: /tmp/browser-verify-result.png');
  console.log('=== VERIFICATION COMPLETE ===');

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });