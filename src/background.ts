// ── Base prompt templates ─────────────────────────────────────────────
// These are the immutable base prompts. They define the role, the rules,
// and the JSON schema. The user's only editable channel is the matching
// `prm*Add` custom-instructions field, which the runner injects into the
// `{{customInstructions}}` slot below.
import { getProfile, profileToContext, deterministicMatch } from './utils/profile-match';
import { DEFAULT_PROMPTS } from './utils/prompt-templates';
import { LLM_DEFAULTS, type LlmConfig } from './utils/settings-schema';

const EMPTY_CUSTOM = '(none)';

// ── Helpers ───────────────────────────────────────────────────────────

function estimateCost(model:string,promptTokens:number,completionTokens:number):number{
  const rates:Record<string,{p:number;c:number}>={'deepseek-chat':{p:0.14,c:0.28},'deepseek-reasoner':{p:0.55,c:2.19}};
  const r=rates[model]??rates['deepseek-chat']!;
  return (promptTokens/1_000_000)*r.p+(completionTokens/1_000_000)*r.c;
}

async function getLlmConfig():Promise<LlmConfig>{
  const r=await browser.storage.local.get('llmConfig');
  const s=r as Record<string,unknown>;
  const c=s.llmConfig;
  const pick=(k:keyof LlmConfig,d:string):string=>{
    if(c&&typeof c==='object'&&c!==null){
      const v=(c as Record<string,unknown>)[k];
      return typeof v==='string'?v:d;
    }
    return d;
  };
  return {
    apiUrl:pick('apiUrl',LLM_DEFAULTS.apiUrl),
    apiKey:pick('apiKey',LLM_DEFAULTS.apiKey),
    model:pick('model',LLM_DEFAULTS.model),
    resume:pick('resume',LLM_DEFAULTS.resume),
    prmExtractAdd:pick('prmExtractAdd',LLM_DEFAULTS.prmExtractAdd),
    prmSummaryAdd:pick('prmSummaryAdd',LLM_DEFAULTS.prmSummaryAdd),
    prmCoverAdd:pick('prmCoverAdd',LLM_DEFAULTS.prmCoverAdd),
    prmQuickAdd:pick('prmQuickAdd',LLM_DEFAULTS.prmQuickAdd),
    prmFormAdd:pick('prmFormAdd',LLM_DEFAULTS.prmFormAdd),
    prmReplyAdd:pick('prmReplyAdd',LLM_DEFAULTS.prmReplyAdd),
  };
}

function isLocalUrl(url:string):boolean{
  const lower = url.toLowerCase();
  return lower.includes('localhost')||lower.includes('127.0.0.1')||lower.includes('0.0.0.0')||lower.includes(':11434');
}

async function callLlm(prompt:string):Promise<{data:Record<string,unknown>;usage:{promptTokens:number;completionTokens:number;totalTokens:number;estimatedCostUsd:number}}>{
  const cfg=await getLlmConfig();
  const local=isLocalUrl(cfg.apiUrl);

  if(!local&&cfg.apiKey==='')return Promise.reject(new Error('LLM API key not configured. Go to Options (right-click extension → Options).'));

  const headers:Record<string,string>={'Content-Type':'application/json'};
  if(!local)headers.Authorization=`Bearer ${cfg.apiKey}`;

  const bodyObj:Record<string,unknown>={
    model:cfg.model,
    messages:[{role:'user',content:prompt}],
    temperature:0.4,
    max_tokens:1800,
  };

  // Ollama/open-webui don't support response_format
  if(!local)bodyObj.response_format={type:'json_object'};
  // For Ollama, add format instruction to the prompt itself instead
  if(local)bodyObj.messages=[{role:'user',content:prompt+'\n\nIMPORTANT: Return ONLY valid JSON. No markdown fences, no extra text.'}];

  const resp=await fetch(`${cfg.apiUrl}/chat/completions`,{
    method:'POST',
    headers,
    body:JSON.stringify(bodyObj),
  });

  let errorBody='';
  if(!resp.ok){
    errorBody=await resp.text().catch(()=>'No body');
    throw new Error(`LLM API error ${resp.status} from ${cfg.apiUrl}\nModel: ${cfg.model}\nResponse: ${errorBody.slice(0,1000)}`);
  }

  const j=await resp.json() as Record<string,unknown>;
  const usage=j.usage as Record<string,number>|undefined;
  const pt=usage?.prompt_tokens??0;
  const ct=usage?.completion_tokens??0;
  const tt=usage?.total_tokens??0;
  const cost=local?0:estimateCost(cfg.model,pt,ct);

  const choices=j.choices as {message:{content:string}}[]|undefined;
  let content=choices?.[0]?.message?.content??'{}';

  // Ollama sometimes wraps in markdown fences
  content=content.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/\s*```$/,'').trim();

  // Local models sometimes return trailing text after the JSON object
  // Extract just the first complete JSON object
  const firstBrace = content.indexOf('{');
  if (firstBrace > 0) content = content.slice(firstBrace);
  // Try to find matching closing brace
  let depth = 0;
  let endIdx = 0;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '{') depth++;
    if (content[i] === '}') depth--;
    if (depth === 0) { endIdx = i + 1; break; }
  }
  if (endIdx > 0) content = content.slice(0, endIdx);

  const parsed=JSON.parse(content) as Record<string,unknown>;
  return{data:parsed,usage:{promptTokens:pt,completionTokens:ct,totalTokens:tt,estimatedCostUsd:cost}};
}

function fillTemplate(tpl:string,vars:Record<string,string>):string{
  let r=tpl;
  for(const[k,v]of Object.entries(vars))r=r.replaceAll(`{{${k}}}`,v);
  return r;
}

// Compose the final prompt from a base template + the user's custom
// instructions. The base template's structure (role, rules, schema, data
// placeholders) is locked — only the `{{customInstructions}}` slot is
// filled with user text. Whitespace-only additions are treated as empty.
function composePrompt(base:string,customAdd:string):string{
  const trimmed=customAdd.trim();
  return fillTemplate(base,{customInstructions:trimmed===''?EMPTY_CUSTOM:trimmed});
}

// ── Relays ────────────────────────────────────────────────────────────

async function ensureContentScript(tabId:number):Promise<void>{
  try{await browser.tabs.sendMessage(tabId,{type:'ping'})}catch{
    try{await browser.scripting.executeScript({target:{tabId},files:['content-scripts/content.js']});await new Promise(r=>setTimeout(r,50))}catch{throw new Error('Could not inject content script')}
  }
}

async function relayToActiveTab(msg:Record<string,unknown>,sendResponse:(r:unknown)=>void):Promise<void>{
  const tabs=await browser.tabs.query({active:true,currentWindow:true});
  const tid=tabs[0]?.id;if(!tid){sendResponse({success:false,error:'No active tab'});return}
  try{await ensureContentScript(tid)}catch(e:unknown){sendResponse({success:false,error:e instanceof Error?e.message:'Unknown'});return}
  const r=await browser.tabs.sendMessage(tid,msg);sendResponse(r);
}

// ── Focused job-tailor handlers ──────────────────────────────────────
// Each handler resolves the job (using structured extraction when
// possible, otherwise an LLM extraction — cached in session storage by
// URL so the second button doesn't re-extract), then runs ONE focused
// generation. The combined "scrape & tailor" wall (summary + cover +
// screening answers + missing info) was replaced with two discrete
// actions. Screening-style free-form questions are still handled by
// the form-fill path (`backend:matchFormFields` + `prmForm`).

interface ExtractionPayload {
  readonly source: 'jsonld' | 'readability' | 'treewalker';
  readonly title: string;
  readonly company: string;
  readonly location: string;
  readonly description: string;
  readonly rawText: string;
  readonly url: string;
  readonly ts: number;
}

interface ResolvedJob {
  readonly title: string;
  readonly company: string;
  readonly location: string;
  readonly description: string;
  readonly extractionSource: ExtractionPayload['source'];
}

async function resolveJob(ex:ExtractionPayload,cfg:LlmConfig):Promise<{job:ResolvedJob|null;err?:{error:string;debug:string}}>{
  const cacheKey=`extract:v1:${ex.url}`;
  try{
    const cached=await browser.storage.session.get(cacheKey);
    const v=cached?.[cacheKey] as Record<string,unknown>|undefined;
    if(v&&typeof v==='object'&&typeof v.title==='string'&&(v.title).length>0&&typeof v.description==='string'){
      return{job:{
        title:v.title,
        company:typeof v.company==='string'?v.company:'',
        location:typeof v.location==='string'?v.location:'',
        description:v.description,
        extractionSource:typeof v.source==='string'?v.source as ExtractionPayload['source']:ex.source,
      }};
    }
  }catch{/* fall through */}

  const hasStructured=ex.source==='jsonld'||(ex.source==='readability'&&ex.title.length>0);
  let title='';let company='';let location='';let description='';
  if(hasStructured){
    title=ex.title;company=ex.company;location=ex.location;description=ex.description;
  }else{
    const extr=await callLlm(composePrompt(DEFAULT_PROMPTS.prmExtract,cfg.prmExtractAdd).replace('{{pageText}}',ex.rawText.slice(0,30000)));
    title=typeof extr.data.title==='string'?extr.data.title:'';
    company=typeof extr.data.company==='string'?extr.data.company:'';
    location=typeof extr.data.location==='string'?extr.data.location:'';
    description=typeof extr.data.description==='string'?extr.data.description:'';
  }
  if(!title||!description)return{job:null,err:{error:'Could not extract job details from page.',debug:`source=${ex.source} title="${title}" company="${company}" descLen=${description.length}`}};
  const job:ResolvedJob={title,company,location,description,extractionSource:ex.source};
  try{await browser.storage.session.set({[cacheKey]:{...job,source:ex.source}})}catch{/* best effort */}
  return{job};
}

async function handleSummary(payload:{extraction:ExtractionPayload},sendResponse:(r:unknown)=>void):Promise<void>{
  const cfg=await getLlmConfig();
  if(!isLocalUrl(cfg.apiUrl)&&cfg.apiKey===''){sendResponse({success:false,error:'LLM API key not configured. Go to Options (right-click extension → Options).'});return}
  if(cfg.resume===''){sendResponse({success:false,error:'Resume not configured. Go to Options (right-click extension → Options).'});return}
  try{
    const{job,err}=await resolveJob(payload.extraction,cfg);
    if(!job){sendResponse({success:false,...(err??{error:'No job data',debug:''})});return}
    const r=await callLlm(composePrompt(DEFAULT_PROMPTS.prmSummary,cfg.prmSummaryAdd).replace('{{jobDescription}}',job.description).replace('{{resumeContent}}',cfg.resume));
    const summary=typeof r.data.resumeSummary==='string'?r.data.resumeSummary:'';
    if(summary===''){sendResponse({success:false,error:'Model returned an empty summary.'});return}
    sendResponse({success:true,data:{
      kind:'summary' as const,
      title:job.title,company:job.company,location:job.location,
      summary,confidence:typeof r.data.confidence==='number'?r.data.confidence:null,
      tokenUsage:r.usage,
    }});
  }catch(e:unknown){
    sendResponse({success:false,error:e instanceof Error?e.message:'Summary generation failed'});
  }
}

async function handleCoverLetter(payload:{extraction:ExtractionPayload},sendResponse:(r:unknown)=>void):Promise<void>{
  const cfg=await getLlmConfig();
  if(!isLocalUrl(cfg.apiUrl)&&cfg.apiKey===''){sendResponse({success:false,error:'LLM API key not configured. Go to Options (right-click extension → Options).'});return}
  if(cfg.resume===''){sendResponse({success:false,error:'Resume not configured. Go to Options (right-click extension → Options).'});return}
  try{
    const{job,err}=await resolveJob(payload.extraction,cfg);
    if(!job){sendResponse({success:false,...(err??{error:'No job data',debug:''})});return}
    const r=await callLlm(composePrompt(DEFAULT_PROMPTS.prmCover,cfg.prmCoverAdd).replace('{{jobDescription}}',job.description).replace('{{resumeContent}}',cfg.resume));
    const cover=typeof r.data.coverLetter==='string'?r.data.coverLetter:'';
    if(cover===''){sendResponse({success:false,error:'Model returned an empty cover letter.'});return}
    sendResponse({success:true,data:{
      kind:'coverLetter' as const,
      title:job.title,company:job.company,location:job.location,
      coverLetter:cover,confidence:typeof r.data.confidence==='number'?r.data.confidence:null,
      tokenUsage:r.usage,
    }});
  }catch(e:unknown){
    sendResponse({success:false,error:e instanceof Error?e.message:'Cover letter generation failed'});
  }
}

async function handleQuickMatch(pageText:string,sendResponse:(r:unknown)=>void):Promise<void>{
  const cfg=await getLlmConfig();
  if(!isLocalUrl(cfg.apiUrl)&&cfg.apiKey===''){sendResponse({success:false,error:'API key not configured.'});return}
  if(cfg.resume===''){sendResponse({success:false,error:'Resume not configured.'});return}
  try{
    const r=await callLlm(composePrompt(DEFAULT_PROMPTS.prmQuick,cfg.prmQuickAdd).replace('{{jobDescription}}',pageText.slice(0,10000)).replace('{{resumeContent}}',cfg.resume));
    sendResponse({success:true,data:{
      score:typeof r.data.score==='number'?r.data.score:5,
      verdict:typeof r.data.verdict==='string'?r.data.verdict:'Moderate Match',
      reasons:Array.isArray(r.data.reasons)?r.data.reasons.filter((x:unknown):x is string=>typeof x==='string'):[],
      tokenUsage:r.usage,
    }});
  }catch(e:unknown){sendResponse({success:false,error:e instanceof Error?e.message:'Quick match failed'})}
}

async function handleFormMatch(payload:{fields:{id:string;label:string;type:string;maxLength:number;options:readonly string[]}[];sourceUrl?:string},sendResponse:(r:unknown)=>void):Promise<void>{
  const fields = payload.fields;
  const sourceUrl = payload.sourceUrl ?? '';
  const cfg=await getLlmConfig();
  if(!isLocalUrl(cfg.apiUrl)&&cfg.apiKey===''){sendResponse({success:false,error:'API key not configured.'});return}
  const profile = await getProfile();

  let jobTitle = '';
  let jobCompany = '';
  if (sourceUrl !== '') {
    try {
      const key = `extract:v1:${sourceUrl}`;
      const stored = await browser.storage.session.get(key);
      const v = stored?.[key] as Record<string, unknown> | undefined;
      if (v && typeof v === 'object') {
        jobTitle = typeof v.title === 'string' ? (v.title) : '';
        jobCompany = typeof v.company === 'string' ? (v.company) : '';
      }
    } catch { /* fall through */ }
  }

  const values:{fieldId:string;value:string;confidence:number;source:'profile'|'llm'}[] = [];
  const unmatched: string[] = [];
  const llmFields: {id:string;label:string;type:string;maxLength:number;options:readonly string[]}[] = [];

  for (const f of fields) {
    const det = deterministicMatch(f.label, profile);
    if (det) {
      if (f.type === 'select' && f.options.length > 0) {
        const matched = f.options.find((o) => o.toLowerCase() === det.value.toLowerCase());
        if (matched) {
          values.push({ fieldId: f.id, value: matched, confidence: det.confidence, source: 'profile' });
          continue;
        }
        llmFields.push(f);
        continue;
      }
      values.push({ fieldId: f.id, value: det.value, confidence: det.confidence, source: 'profile' });
      continue;
    }
    llmFields.push(f);
  }

  if (llmFields.length > 0) {
    try {
      const ctx = `## Candidate Profile\n${profileToContext(profile)}\n\n## Job\nTitle: ${jobTitle}\nCompany: ${jobCompany}\nPage URL: ${sourceUrl}\n\n## Resume\n${cfg.resume.slice(0, 3000)}`;
      const r = await callLlm(composePrompt(DEFAULT_PROMPTS.prmForm,cfg.prmFormAdd).replace('{{candidateContext}}',ctx).replace('{{fieldsJson}}',JSON.stringify(llmFields, null, 2)));
      const valuesRaw = r.data.values;
      if (Array.isArray(valuesRaw)) {
        for (const item of valuesRaw) {
          const o = item as Record<string, unknown>;
          const fid = typeof o.fieldId === 'string' ? o.fieldId : '';
          const val = typeof o.value === 'string' ? o.value : '';
          const conf = typeof o.confidence === 'number' ? o.confidence : 0.5;
          if (fid !== '' && val !== '') {
            const target = llmFields.find((x) => x.id === fid);
            if (target?.type === 'select' && target.options.length > 0) {
              const matched = target.options.find((o) => o.toLowerCase() === val.toLowerCase());
              if (matched) { values.push({ fieldId: fid, value: matched, confidence: conf, source: 'llm' }); continue; }
              unmatched.push(fid); continue;
            }
            values.push({ fieldId: fid, value: val, confidence: conf, source: 'llm' });
          } else {
            unmatched.push(fid);
          }
        }
      }
      const unmatchedRaw = r.data.unmatched;
      const llmUnmatched: string[] = Array.isArray(unmatchedRaw) ? unmatchedRaw.filter((x: unknown): x is string => typeof x === 'string') : [];
      for (const fid of llmUnmatched) if (!unmatched.includes(fid)) unmatched.push(fid);
    } catch (_e: unknown) {
      for (const f of llmFields) if (!unmatched.includes(f.id)) unmatched.push(f.id);
    }
  }

  for (const f of llmFields) {
    if (!values.find((v) => v.fieldId === f.id) && !unmatched.includes(f.id)) unmatched.push(f.id);
  }

  sendResponse({ success: true, data: { values, unmatched, tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 } } });
}

async function handleReply(pageText:string,replyPrompt:string,sendResponse:(r:unknown)=>void):Promise<void>{
  const cfg=await getLlmConfig();
  if(!isLocalUrl(cfg.apiUrl)&&cfg.apiKey===''){sendResponse({success:false,error:'API key not configured.'});return}
  if(cfg.resume===''){sendResponse({success:false,error:'Resume not configured.'});return}
  try{
    const prompt=composePrompt(DEFAULT_PROMPTS.prmReply,cfg.prmReplyAdd)
      .replace('{{userIntent}}',replyPrompt)
      .replace('{{pageText}}',pageText.slice(0,5000))
      .replace('{{jobDescription}}','')
      .replace('{{resumeContent}}',cfg.resume.slice(0,2000));
    const r=await callLlm(prompt);
    let reply=typeof r.data.reply==='string'?r.data.reply:'';
    if(reply==='')reply=typeof r.data.response==='string'?r.data.response:'';
    if(reply==='')reply=typeof r.data.message==='string'?r.data.message:'';
    if(reply==='')reply=typeof r.data.content==='string'?r.data.content:'';
    if(reply==='')reply=typeof r.data.text==='string'?r.data.text:'';
    sendResponse({success:true,data:{reply,tokenUsage:r.usage}});
  }catch(e:unknown){sendResponse({success:false,error:e instanceof Error?e.message:'Reply generation failed'})}
}


async function handleParseResume(sendResponse:(r:unknown)=>void):Promise<void>{
  const cfg=await getLlmConfig();
  if(!isLocalUrl(cfg.apiUrl)&&cfg.apiKey===''){sendResponse({success:false,error:'API key not configured.'});return}
  if(cfg.resume===''){sendResponse({success:false,error:'Resume not configured. Paste your resume first.'});return}
  const profileFields=['fullName','contactEmail','contactPhone','city','state','linkedin','portfolioUrl','githubUrl','workAuthorization','salaryExpectations','noticePeriod','willingToRelocate','yearsOfExperience','currentTitle','currentCompany','highestDegree','university','fieldOfStudy','desiredRole','preferredLocation','remotePreference'];
  try{
    const prompt=`## System
You are a resume parser. Extract structured profile fields from the candidate's resume. Return ONLY valid JSON.

## Rules
1. Use the EXACT keys in the schema. Do not add or rename fields.
2. Infer values from the resume text where possible. If a field cannot be determined, set it to "".
3. "yearsOfExperience" must be a number. Count from the earliest job or education date mentioned. If unclear, set to 0.
4. "willingToRelocate" should be "Yes", "No", or "Open" based on any relocation mentions.
5. "remotePreference" should be "Remote", "Hybrid", or "On-site" based on any remote work mentions.
6. "workAuthorization" should reflect any visa/citizenship mentions. If not found, set to "".
7. NEVER invent facts not present in the resume.
8. For URL fields (linkedin, portfolioUrl, githubUrl), always output the FULL standard URL (e.g., "https://www.linkedin.com/in/username", "https://www.github.com/username"). Never output shorthand like "linkedin.com/in/username" or "github.com/username".

## Schema
{"fullName":"string","contactEmail":"string","contactPhone":"string","city":"string","state":"string","linkedin":"string","portfolioUrl":"string","githubUrl":"string","workAuthorization":"string","salaryExpectations":"string","noticePeriod":"string","willingToRelocate":"string","yearsOfExperience":0,"currentTitle":"string","currentCompany":"string","highestDegree":"string","university":"string","fieldOfStudy":"string","desiredRole":"string","preferredLocation":"string","remotePreference":"string"}

## Resume
${cfg.resume.slice(0, 8000)}`;
    const r=await callLlm(prompt);
    const profile:Record<string,unknown>={};
    for(const f of profileFields){
      const val=r.data[f];
      if(f==='yearsOfExperience'){profile[f]=typeof val==='number'?val:typeof val==='string'?parseInt(val,10)||0:0}
      else{profile[f]=typeof val==='string'?val:''}
    }
    sendResponse({success:true,data:{profile,tokenUsage:r.usage}});
  }catch(e:unknown){sendResponse({success:false,error:e instanceof Error?e.message:'Resume parsing failed'})}
}

// ── Router ────────────────────────────────────────────────────────────

browser.runtime.onMessage.addListener((msg:Record<string,unknown>,_sender:unknown,sendResponse:(r:unknown)=>void):boolean=>{
  if(msg.type==='backend:summary'){handleSummary(msg.payload as Parameters<typeof handleSummary>[0],sendResponse);return true}
  if(msg.type==='backend:coverLetter'){handleCoverLetter(msg.payload as Parameters<typeof handleCoverLetter>[0],sendResponse);return true}
  if(msg.type==='backend:quickMatch'){handleQuickMatch((msg.payload as Record<string,unknown>)?.pageText as string??'',sendResponse);return true}
  if(msg.type==='backend:matchFormFields'){handleFormMatch(msg.payload as Parameters<typeof handleFormMatch>[0],sendResponse);return true}
  if(msg.type==='backend:reply'){handleReply((msg.payload as Record<string,unknown>)?.pageText as string??'',(msg.payload as Record<string,unknown>)?.replyPrompt as string??'',sendResponse);return true}
  if(msg.type==='backend:parseResume'){handleParseResume(sendResponse);return true}
  if(msg.type==='scrape'){relayToActiveTab({type:'scrape',kind:msg.kind,quickMatch:msg.quickMatch,reply:msg.reply,replyPrompt:msg.replyPrompt},sendResponse);return true}
  if(msg.type==='scrapeFormFields'){relayToActiveTab({type:'scrapeFormFields'},sendResponse);return true}
  if(msg.type==='fillForm'){relayToActiveTab({type:'fillForm',answers:msg.answers},sendResponse);return true}
  if(msg.type==='fillFormMatched'){relayToActiveTab({type:'fillFormMatched',matches:msg.matches},sendResponse);return true}
  if(msg.type==='revertForm'){relayToActiveTab({type:'revertForm'},sendResponse);return true}
  return false;
});
