import { render } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import type { JSX } from "preact";

const c = { primary:'#007ACC',primaryLight:'#1A8CD9',primaryBg:'rgba(0,122,204,0.08)',primaryBorder:'rgba(0,122,204,0.2)',primaryFg:'#1E1E1E',accent:'#007ACC',purple:'#5C6BC0',purpleBg:'rgba(92,107,192,0.08)',purpleBorder:'rgba(92,107,192,0.2)',green:'#40A860',greenBg:'rgba(64,168,96,0.08)',greenBorder:'rgba(64,168,96,0.2)',destructive:'#D65757',destructiveBg:'rgba(214,87,87,0.08)',destructiveBorder:'rgba(214,87,87,0.2)',surface:'#F3F3F3',surfaceHover:'#E8E8E8',surfaceBorder:'rgba(0,0,0,0.08)',textPrimary:'#1E1E1E',textSecondary:'#616161',textMuted:'#8E8E90',textWhite:'#FFFFFF', } as const;
const t = { radiusSm:'6px',radiusMd:'8px',radiusLg:'12px',shadowSm:'0 1px 2px rgba(0,0,0,0.06)',fontFamily:'"Inter",system-ui,-apple-system,sans-serif', } as const;

interface ProfileData { readonly fullName: string; readonly contactEmail: string; readonly contactPhone: string; readonly city: string; readonly state: string; readonly linkedin: string; readonly portfolioUrl: string; readonly githubUrl: string; readonly workAuthorization: string; readonly salaryExpectations: string; readonly noticePeriod: string; readonly willingToRelocate: string; readonly yearsOfExperience: number; readonly currentTitle: string; readonly currentCompany: string; readonly highestDegree: string; readonly university: string; readonly fieldOfStudy: string; readonly desiredRole: string; readonly preferredLocation: string; readonly remotePreference: string; }
interface LlmConfig { readonly apiUrl: string; readonly apiKey: string; readonly model: string; readonly resume: string; readonly prmExtractAdd: string; readonly prmTailorAdd: string; readonly prmCoverAdd: string; readonly prmScreeningAdd: string; readonly prmQuickAdd: string; readonly prmFormAdd: string; }

const PROFILE_DEFAULTS: ProfileData = { fullName:'',contactEmail:'',contactPhone:'',city:'',state:'',linkedin:'',portfolioUrl:'',githubUrl:'',workAuthorization:'',salaryExpectations:'',noticePeriod:'',willingToRelocate:'',yearsOfExperience:0,currentTitle:'',currentCompany:'',highestDegree:'',university:'',fieldOfStudy:'',desiredRole:'',preferredLocation:'',remotePreference:'' };

// ── Default prompt templates ─────────────────────────────────────────
// These are the BASE prompts the extension always uses. They are
// intentionally not editable in the UI — only the `*Add` custom
// instructions below each base prompt can be edited by the user.
// {{customInstructions}} is a fixed slot the runner fills with the
// user's additions. Do not rename it.

const PRM_JOB_EXTRACT_DEFAULT = `## System
You are a job posting extractor. Read the page text and pull the structured job data the user applied for.

## Rules
1. Return ONLY a valid JSON object — no markdown fences, no commentary.
2. Use the EXACT keys in the schema. Do not add or rename fields.
3. "title" must be the specific role name (e.g. "Senior Backend Engineer"), not a generic page heading.
4. "company" is the hiring company / employer, not the recruiting agency.
5. "location" should be a single string: "City, Country" or "Remote" — fall back to "Unknown" if you cannot determine it.
6. "description" must be the FULL job description body, preserving bullet points as newline-separated lines.
7. If the page text does not appear to be a job posting, return all-empty strings.
8. Never invent data. If a field cannot be determined, set it to "".

## Schema
{"title":"string","company":"string","location":"string","description":"string"}

## User Custom Instructions (optional)
{{customInstructions}}

## Page Text
{{pageText}}`;

const PRM_TAILOR_DEFAULT = `## System
You are an expert resume tailoring assistant. Produce a 3–5 sentence professional summary that positions the candidate for the target role.

## Rules
1. NEVER invent facts, skills, achievements, certifications, or experience not present in the resume.
2. Lead with the candidate's current title, years of experience, and one quantified achievement from the resume.
3. Weave in 1–2 named skills or technologies the job description emphasises, but only if the resume already shows them.
4. Mention the company name and the specific role title in the summary.
5. Keep it 3–5 sentences, roughly 70–110 words. Recruiters skim.
6. Return ONLY valid JSON — no markdown fences, no commentary.
7. Use the EXACT keys in the schema. Do not add or rename fields.
8. "confidence" reflects how well the resume supports the summary: 0.85–0.95 when direct matches, 0.6–0.8 when light inference, ≤0.5 if the resume is weak for the role.

## Schema
{"resumeSummary":"string","confidence":0.0-1.0}

## User Custom Instructions (optional)
{{customInstructions}}

## Job Description
{{jobDescription}}

## Resume
{{resumeContent}}`;

const PRM_COVER_DEFAULT = `## System
You are an expert cover letter writer. Write a tailored, human-sounding cover letter for the target role.

## Rules
1. 3 short paragraphs: (1) role + why this company, (2) the most relevant 1–2 resume experiences with metrics, (3) availability + close.
2. NEVER invent facts, skills, or experience not present in the resume.
3. Reference the actual company name and the specific job title.
4. Address the cover letter to "Hiring Team" unless the job description names a recruiter.
5. Keep it 250–350 words. No filler ("I am writing to express my interest", "great culture", "passionate about innovation").
6. Return ONLY valid JSON — no markdown fences, no commentary.
7. Use the EXACT keys in the schema. Do not add or rename fields.
8. "confidence" reflects how well the resume supports the letter: 0.85–0.95 when direct matches, 0.6–0.8 when light inference, ≤0.5 if the resume is weak for the role.

## Schema
{"coverLetter":"string","confidence":0.0-1.0}

## User Custom Instructions (optional)
{{customInstructions}}

## Job Description
{{jobDescription}}

## Resume
{{resumeContent}}`;

const PRM_SCREENING_DEFAULT = `## System
You are a job application screening-question assistant. The candidate is filling out an automated application form. Generate concise, specific, candidate-friendly answers that reference the actual job posting, the candidate's resume, and their profile. The user reviews and edits everything before submit.

## Question Categories — Use These Strategies
**"Why this company / Why us / What attracted you"**: Pick 2-3 SPECIFIC things mentioned in the job description — product, tech stack, market, customer segment, mission, team structure, recent growth. Connect to one concrete thing from the candidate's resume. NEVER use generic phrases like "great culture", "exciting opportunity", "passionate about innovation".
**"Why this role / Why this position"**: Reference the specific job title. Connect the candidate's current title, years of experience, and one or two named skills or technologies from the requirements. Show you read the posting.
**"Tell us about yourself / Walk us through your background"**: 3 sentences max. (1) Current role + years of experience. (2) One quantified achievement or specialty from the resume. (3) Why this transition makes sense for the candidate's career.
**"Salary expectations"**: Use profile.salaryExpectations if present, else "Open to discussion based on total compensation, scope, and equity".
**"Notice period / Availability / When can you start"**: Use profile.noticePeriod if present, else "Two weeks, negotiable".
**"Willing to relocate"**: Use profile.willingToRelocate if present, else infer from preferredLocation vs jobLocation.
**"Years of experience with X"**: Use profile.yearsOfExperience or count from resume dates. Match the technology in the question.
**"Authorized to work / Visa / Sponsorship"**: Use profile.workAuthorization verbatim.
**Other open-ended**: 1-3 sentences grounded in resume and the specific job posting. No generic platitudes.

## Rules
1. Every answer must reference something concrete from the job description OR the candidate's resume or profile. If you cannot ground an answer, list it in missingInformation.
2. Keep each answer to 1-4 sentences. Recruiters scan.
3. NEVER fabricate experience, skills, achievements, or interests not in the resume or profile.
4. For yes/no fields, give a single word or short phrase.
5. Confidence: 0.9 when directly grounded in resume/profile, 0.6-0.8 when reasonable inference, 0.3-0.5 when best guess.
6. Return ONLY valid JSON — no markdown fences, no commentary.
7. Use the EXACT keys in the schema. Do not add or rename fields.

## Schema
{"screeningAnswers":[{"questionId":"string","question":"string","answer":"string","confidence":0.0-1.0}],"missingInformation":["string"]}

## User Custom Instructions (optional)
{{customInstructions}}

## Job
Title: {{jobTitle}}
Company: {{jobCompany}}
Location: {{jobLocation}}
Description:
{{jobDescription}}

## Candidate Profile
{{candidateProfile}}

## Resume
{{resumeContent}}`;

const PRM_QUICK_DEFAULT = `## System
You are a job suitability evaluator. Score how well the candidate's resume fits the job description.

## Rules
1. "score" is an integer 0–10:
   - 9–10: very strong fit; the resume already names 3+ required skills and the experience level matches.
   - 6–8:  moderate fit; missing 1–2 requirements but adjacent skills are present.
   - 3–5:  weak fit; large skill or seniority gap.
   - 0–2:  not a fit; the role targets a different domain or level.
2. "verdict" must be EXACTLY one of: "Strong Match" | "Moderate Match" | "Weak Match".
   - score >= 8 → "Strong Match"
   - score 5–7 → "Moderate Match"
   - score <= 4 → "Weak Match"
3. "reasons" lists 2–4 SHORT, EVIDENCE-GROUNDED bullets — each one cites something from the resume AND something from the job description. Avoid generic phrases.
4. Return ONLY valid JSON — no markdown fences, no commentary.
5. Use the EXACT keys in the schema. Do not add or rename fields.

## Schema
{"score":0-10,"verdict":"Strong Match"|"Moderate Match"|"Weak Match","reasons":["string"]}

## User Custom Instructions (optional)
{{customInstructions}}

## Job Description
{{jobDescription}}

## Resume
{{resumeContent}}`;

const PRM_FORM_DEFAULT = `## System
You are a form-filling assistant. Given the candidate's profile, resume, and a list of form fields, return values to fill. Return ONLY valid JSON.

## Rules
1. ALWAYS fill fields when a reasonable answer exists in the profile or resume. The user reviews everything before submit.
2. For select fields with listed options, return a value that exactly matches one of the provided options. If none fits, list the fieldId in unmatched.
3. Set confidence by source: 0.85-0.95 when profile provides it directly, 0.6-0.8 when inferred from resume, 0.3-0.5 when guessing.
4. For fields asking about demographics, identity, or sensitive info not in the profile, fill with "Prefer not to say" at low confidence (0.3).
5. For yes/no questions, default to the most candidate-friendly answer supported by the profile (e.g. willing to relocate when preferredLocation differs from jobLocation).
6. Only list fieldId in unmatched when there is genuinely no defensible answer.
7. Many application forms include screening-style open-ended questions (textareas). Use these strategies:
   - "Why this company / Why us / What attracted you": 2-3 SPECIFIC things from the job description or company background; connect to one concrete thing from the resume. NEVER "great culture", "exciting opportunity", "passionate about innovation".
   - "Why this role / Why this position": reference the job title, the candidate's current title + years, 1-2 named skills from requirements.
   - "Tell us about yourself / your background": 3 sentences — current role + years + 1 quantified achievement + why this transition.
   - "Tell us about <specific topic>": 1-4 sentences grounded in resume content. No generic platitudes.
   - "How would you describe your experience with X": name the technologies from resume, quantify years, give one concrete project example.
   - "Anything else you'd like us to know": one or two sentences — what makes you a strong fit that hasn't been covered.
8. Return ONLY valid JSON — no markdown fences, no commentary.
9. Use the EXACT keys in the schema. Do not add or rename fields.

## Schema
{"values":[{"fieldId":"string","value":"string","confidence":0.0-1.0}],"unmatched":["fieldId"]}

## User Custom Instructions (optional)
{{customInstructions}}

## Candidate Profile
{{candidateContext}}

## Form Fields
{{fieldsJson}}`;

const LLM_DEFAULTS: LlmConfig = {
  apiUrl:'https://api.deepseek.com/v1',apiKey:'',model:'deepseek-chat',resume:'',
  prmExtractAdd:'',prmTailorAdd:'',prmCoverAdd:'',prmScreeningAdd:'',prmQuickAdd:'',prmFormAdd:'',
};

interface PromptSlot { readonly key: keyof LlmConfig; readonly label: string; readonly description: string; readonly base: string; }

const PROMPT_SLOTS: ReadonlyArray<PromptSlot> = [
  { key:'prmExtractAdd', label:'Job Extraction', description:'Pulls title, company, location, and full description from the job page.', base:PRM_JOB_EXTRACT_DEFAULT },
  { key:'prmTailorAdd', label:'Resume Tailoring (Summary)', description:'Writes a 3–5 sentence professional summary tailored to the job.', base:PRM_TAILOR_DEFAULT },
  { key:'prmCoverAdd', label:'Cover Letter', description:'Writes a tailored cover letter grounded in the resume.', base:PRM_COVER_DEFAULT },
  { key:'prmScreeningAdd', label:'Screening Answers', description:'Answers free-form and yes/no application questions.', base:PRM_SCREENING_DEFAULT },
  { key:'prmQuickAdd', label:'Quick Match', description:'Scores the candidate vs the job 0–10 with grounded reasons.', base:PRM_QUICK_DEFAULT },
  { key:'prmFormAdd', label:'Form Matching', description:'Maps candidate profile to arbitrary form fields, including screening questions.', base:PRM_FORM_DEFAULT },
];

const PROFILE_FIELDS: ReadonlyArray<{key:keyof ProfileData;label:string;type:string;placeholder:string}> = [
  {key:'fullName',label:'Full Name',type:'text',placeholder:'Ahmad Pouladzade'},
  {key:'contactEmail',label:'Email',type:'email',placeholder:'you@example.com'},
  {key:'contactPhone',label:'Phone',type:'tel',placeholder:'+49 123 456789'},
  {key:'city',label:'City',type:'text',placeholder:'Berlin'},
  {key:'state',label:'State / Region',type:'text',placeholder:'Berlin'},
  {key:'linkedin',label:'LinkedIn URL',type:'url',placeholder:'https://linkedin.com/in/...'},
  {key:'portfolioUrl',label:'Portfolio / Website',type:'url',placeholder:'https://...'},
  {key:'githubUrl',label:'GitHub URL',type:'url',placeholder:'https://github.com/...'},
  {key:'workAuthorization',label:'Work Authorization',type:'text',placeholder:'EU Blue Card / Citizen'},
  {key:'salaryExpectations',label:'Salary Expectations',type:'text',placeholder:'€90,000 – €110,000'},
  {key:'noticePeriod',label:'Notice Period',type:'text',placeholder:'2 weeks / 3 months'},
  {key:'willingToRelocate',label:'Willing to Relocate?',type:'text',placeholder:'Yes / No / Within EU'},
  {key:'yearsOfExperience',label:'Years of Experience',type:'number',placeholder:'7'},
  {key:'currentTitle',label:'Current Job Title',type:'text',placeholder:'Senior Software Engineer'},
  {key:'currentCompany',label:'Current Company',type:'text',placeholder:'Company GmbH'},
  {key:'highestDegree',label:'Highest Degree',type:'text',placeholder:'M.S. Computer Science'},
  {key:'university',label:'University',type:'text',placeholder:'University of ...'},
  {key:'fieldOfStudy',label:'Field of Study',type:'text',placeholder:'Computer Science'},
  {key:'desiredRole',label:'Desired Role',type:'text',placeholder:'Senior Backend Engineer'},
  {key:'preferredLocation',label:'Preferred Location',type:'text',placeholder:'Berlin'},
  {key:'remotePreference',label:'Remote Preference',type:'text',placeholder:'Remote / Hybrid / On-site'},
];

const inputS={width:'100%',padding:'10px 12px',fontSize:'14px',border:`1px solid ${c.surfaceBorder}`,borderRadius:t.radiusSm,boxSizing:'border-box'as const,fontFamily:t.fontFamily,outline:'none',transition:'border-color 150ms',backgroundColor:c.surface,color:c.textPrimary} as const;
const fieldLabel={fontSize:'13px',fontWeight:600,color:c.textSecondary,marginBottom:'4px',display:'block'};
const sectionTitle={fontSize:'16px',fontWeight:700,color:c.textPrimary,marginBottom:'14px',marginTop:'28px',borderBottom:`1px solid ${c.surfaceBorder}`,paddingBottom:'10px'};
const promptReadonly={width:'100%',padding:'10px 12px',fontSize:'11px',border:`1px solid ${c.surfaceBorder}`,borderRadius:t.radiusSm,backgroundColor:c.surfaceHover,color:c.textSecondary,fontFamily:'"JetBrains Mono",monospace',boxSizing:'border-box'as const,lineHeight:1.5,whiteSpace:'pre-wrap'as const,overflowY:'auto'as const,maxHeight:'220px'};
const customArea={width:'100%',height:'80px',padding:'8px 10px',fontSize:'12px',border:`1px solid ${c.primaryBorder}`,borderRadius:t.radiusSm,backgroundColor:c.primaryBg,resize:'vertical',fontFamily:t.fontFamily,boxSizing:'border-box'as const,lineHeight:1.4,outline:'none',color:c.textPrimary};
const slotCard={padding:'14px',border:`1px solid ${c.surfaceBorder}`,borderRadius:t.radiusMd,marginBottom:'14px',backgroundColor:c.surface};
const slotHeader={display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:'4px'};
const slotTitle={fontSize:'13px',fontWeight:700,color:c.primary};
const slotDesc={fontSize:'11px',color:c.textMuted,marginBottom:'10px'};
const slotTag={fontSize:'10px',fontWeight:600,color:c.textMuted,textTransform:'uppercase'as const,letterSpacing:'0.04em'};

export function OptionsApp(): preact.JSX.Element {
  const [profile,setProfile]=useState(PROFILE_DEFAULTS);
  const [llm,setLlm]=useState(LLM_DEFAULTS);
  const [saveStatus,setSaveStatus]=useState('');
  const [importJson,setImportJson]=useState('');
  const [importStatus,setImportStatus]=useState('');
  const [showPrompts,setShowPrompts]=useState(false);
  const [expandedSlot,setExpandedSlot]=useState<keyof LlmConfig | null>(null);
  const [parseStatus,setParseStatus]=useState<'idle'|'parsing'|'success'|'error'>('idle');
  const [parseError,setParseError]=useState('');

  useEffect(()=>{
    chrome.storage.local.get(['profile','llmConfig'],(r)=>{
      const s=r as Record<string,unknown>;
      if(s['profile']&&typeof s['profile']==='object'&&s['profile']!==null)setProfile({...PROFILE_DEFAULTS,...(s['profile']as Partial<ProfileData>)});
      if(s['llmConfig']&&typeof s['llmConfig']==='object'&&s['llmConfig']!==null){
        const stored=s['llmConfig']as Record<string,unknown>;
        // Legacy storage may still carry the old editable `prm*` fields. We
        // strip them on load and persist the cleaned config so the old keys
        // are gone from storage. The base prompts are now code-owned, and
        // the user's only editable channel is `prm*Add` custom instructions.
        const LEGACY_KEYS=['prmExtract','prmTailor','prmCover','prmScreening','prmQuick','prmForm'] as const;
        const cleaned:Record<string,unknown>={...LLM_DEFAULTS,...stored};
        let stripped=false;
        for(const k of LEGACY_KEYS){if(k in cleaned){delete cleaned[k];stripped=true}}
        setLlm(p=>({...p,...(cleaned as Partial<LlmConfig>)}));
        if(stripped)chrome.storage.local.set({llmConfig:cleaned});
      }
    });
  },[]);

  const [saving,setSaving]=useState(false);
  const updateP=useCallback((k:keyof ProfileData,v:string|number)=>setProfile(p=>({...p,[k]:v})),[]);
  const updateLlm=useCallback((k:keyof LlmConfig,v:string)=>setLlm(l=>({...l,[k]:v})),[]);
  const doSave=useCallback(()=>{
    setSaving(true);
    chrome.storage.local.set({profile,llmConfig:llm},()=>{
      setSaving(false);
      setSaveStatus('✓ Saved');
      setTimeout(()=>setSaveStatus(''),3000);
    });
  },[profile,llm]);

  const doImport=useCallback(()=>{
    if(importJson.trim()==='')return;let parsed:unknown;try{parsed=JSON.parse(importJson)}catch{setImportStatus('Invalid JSON');return}
    if(typeof parsed!=='object'||parsed===null){setImportStatus('Must be a JSON object');return}
    const obj=parsed as Record<string,unknown>;let count=0;
    for(const f of PROFILE_FIELDS){const val=obj[f.key];if(val!==undefined){if(f.type==='number'&&typeof val==='number'){updateP(f.key,val);count++}else if(f.type!=='number'&&typeof val==='string'){updateP(f.key,val as string);count++}}}
    setImportStatus(`✓ Imported ${count} fields`);setImportJson('');setTimeout(()=>setImportStatus(''),2500);
  },[importJson,updateP]);

  const doParseResume=useCallback(()=>{
    setParseStatus('parsing');setParseError('');
    chrome.runtime.sendMessage({type:'backend:parseResume'},(r:{success:boolean;data?:{profile:Partial<ProfileData>;tokenUsage:{totalTokens:number;estimatedCostUsd:number}};error?:string})=>{
      if(!r.success||!r.data){setParseStatus('error');setParseError(r.error??'Parsing failed');return}
      const pp=r.data.profile;
      for(const f of PROFILE_FIELDS){
        const val=pp[f.key];
        if(val===undefined||val===null||val==='')continue;
        if(f.type==='number'&&typeof val==='number')updateP(f.key,val);
        else if(typeof val==='string')updateP(f.key,val);
      }
      setParseStatus('success');
      setTimeout(()=>{setParseStatus('idle');setParseError('')},4000);
    });
  },[updateP]);

  return(
    <div style={{fontFamily:t.fontFamily,fontSize:'15px',maxWidth:'860px',margin:'0 auto',padding:'30px 24px',color:c.textPrimary,backgroundColor:'#FFFFFF'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
        <h1 style={{margin:0,fontSize:'24px',fontWeight:800,color:c.primary,letterSpacing:'-0.02em'}}>⚙️ Settings</h1>
        <span style={{fontSize:'14px',fontWeight:600,color:saveStatus.startsWith('✓')?c.green:c.textMuted}}>{saveStatus}</span>
      </div>

      {/* LLM Config */}
      <div style={sectionTitle}>🤖 LLM Provider</div>
      <div style={{marginBottom:'12px'}}><label style={fieldLabel}>API URL</label><input type="text" value={llm.apiUrl} onInput={e=>updateLlm('apiUrl',(e.target as HTMLInputElement).value)} placeholder="https://api.deepseek.com/v1" style={inputS}/></div>
      <div style={{marginBottom:'12px'}}><label style={fieldLabel}>API Key</label><input type="password" value={llm.apiKey} onInput={e=>updateLlm('apiKey',(e.target as HTMLInputElement).value)} placeholder="sk-..." style={inputS}/></div>
      <div style={{marginBottom:'12px'}}><label style={fieldLabel}>Model</label><input type="text" value={llm.model} onInput={e=>updateLlm('model',(e.target as HTMLInputElement).value)} placeholder="deepseek-chat" style={inputS}/></div>

      {/* Resume */}
      <div style={sectionTitle}>📄 Resume (Markdown)</div>
      <textarea value={llm.resume} onInput={e=>updateLlm('resume',(e.target as HTMLTextAreaElement).value)} placeholder="Paste your full resume in markdown here..." style={{width:'100%',height:'150px',padding:'10px 12px',fontSize:'12px',border:`1px solid ${c.surfaceBorder}`,borderRadius:t.radiusSm,resize:'vertical',fontFamily:'"JetBrains Mono",monospace',boxSizing:'border-box',outline:'none',color:c.textPrimary,backgroundColor:c.surface}}/>
      <div style={{marginTop:'8px',display:'flex',gap:'8px',alignItems:'center'}}>
        <button onClick={doParseResume} disabled={parseStatus==='parsing'} style={{padding:'6px 14px',fontSize:'12px',fontWeight:600,backgroundColor:parseStatus==='parsing'?c.primaryLight:c.primary,color:c.textWhite,border:'none',borderRadius:t.radiusSm,cursor:parseStatus==='parsing'?'not-allowed':'pointer',transition:'all 150ms'}}>
          {parseStatus==='parsing'?'Parsing resume...':'Auto-fill Profile'}
        </button>
        {parseStatus==='error'&&<span style={{fontSize:'12px',color:c.destructive}}>{parseError}</span>}
        {parseStatus==='success'&&<span style={{fontSize:'12px',color:c.green,fontWeight:600}}>Profile filled</span>}
      </div>

      {/* Prompt Templates — collapsible */}
      <div style={{...sectionTitle,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}} onClick={()=>setShowPrompts(!showPrompts)}>
        <span>📝 Prompt Templates</span>
        <span style={{fontSize:'11px',fontWeight:400,color:c.textMuted}}>{showPrompts?'🔽':'▶'} Customize</span>
      </div>
      {showPrompts&&<div>
        <p style={{fontSize:'11px',color:c.textSecondary,margin:'0 0 12px',lineHeight:1.5}}>
          Base prompts are locked to keep the JSON output structure stable. You can add short guidance per template (tone, emphasis, length, things to avoid). The runner injects your text into a fixed <code style={{backgroundColor:c.primaryBg,color:c.primaryFg,padding:'0 4px',borderRadius:'3px',fontSize:'11px'}}>User Custom Instructions</code> slot before the data section.
        </p>
        {PROMPT_SLOTS.map(slot=>{
          const isOpen=expandedSlot===slot.key;
          const addValue=llm[slot.key];
          return(
            <div key={slot.key} style={slotCard}>
              <div style={slotHeader}>
                <span style={slotTitle}>{slot.label}</span>
                <button onClick={()=>setExpandedSlot(isOpen?null:slot.key)} style={{padding:'2px 10px',fontSize:'11px',fontWeight:600,backgroundColor:isOpen?c.primary:c.surface,color:isOpen?c.textWhite:c.primary,border:`1px solid ${c.primary}`,borderRadius:t.radiusSm,transition:'all 150ms',cursor:'pointer'}}>{isOpen?'Hide base prompt':'View base prompt'}</button>
              </div>
              <div style={slotDesc}>{slot.description}</div>
              {isOpen&&<pre style={promptReadonly}>{slot.base}</pre>}
              <div style={{marginTop:'8px'}}>
                <label style={{...fieldLabel,fontSize:'11px',display:'flex',justifyContent:'space-between'}}>
                  <span>Custom instructions <span style={slotTag}>(appended only)</span></span>
                  <span style={{fontSize:'10px',fontWeight:400,color:c.textMuted}}>{addValue.length}/2000</span>
                </label>
                <textarea value={addValue} onInput={e=>{const v=(e.target as HTMLTextAreaElement).value;if(v.length<=2000)updateLlm(slot.key,v)}} placeholder={`Optional. Example: "Keep the summary under 80 words and avoid the word 'passionate'."`} style={customArea}/>
              </div>
            </div>
          );
        })}
      </div>}

      {/* JSON Import */}
      <div style={sectionTitle}>📥 Quick Import (Profile JSON)</div>
      <textarea value={importJson} onInput={e=>setImportJson((e.target as HTMLTextAreaElement).value)} placeholder='Paste JSON (e.g. {"fullName":"John","contactEmail":"john@example.com",...})' style={{width:'100%',height:'56px',padding:'8px 10px',fontSize:'11px',border:`1px solid ${c.surfaceBorder}`,borderRadius:t.radiusSm,resize:'vertical',fontFamily:'"JetBrains Mono",monospace',boxSizing:'border-box',outline:'none',color:c.textPrimary,backgroundColor:c.surface}}/>
      <div style={{display:'flex',gap:'8px',alignItems:'center',marginTop:'6px',marginBottom:'10px'}}>
        <button onClick={doImport} style={{padding:'6px 16px',fontSize:'12px',fontWeight:600,backgroundColor:c.accent,color:'#fff',border:'none',borderRadius:'4px',cursor:'pointer'}}>📥 Import</button>
        {importStatus!==''&&<span style={{fontSize:'12px',color:importStatus.startsWith('✓')?c.green:c.destructive}}>{importStatus}</span>}
      </div>

      {/* Profile Fields */}
      <div style={sectionTitle}>👤 Profile Fields</div>
      <div style={{maxHeight:'none'}}>
        {PROFILE_FIELDS.map(f=>(<div key={f.key} style={{marginBottom:'10px'}}><label style={fieldLabel}>{f.label}</label><input type={f.type} value={profile[f.key]} onInput={e=>{const v=(e.target as HTMLInputElement).value;updateP(f.key,f.type==='number'?(v===''?0:parseInt(v,10)||0):v)}} placeholder={f.placeholder} style={inputS}/></div>))}
      </div>
      <button onClick={doSave} disabled={saving} style={{width:'100%',padding:'14px',fontSize:'16px',fontWeight:700,backgroundColor:saving?c.primaryLight:c.primary,color:c.textWhite,border:'none',borderRadius:t.radiusSm,cursor:saving?'not-allowed':'pointer',marginTop:'24px',transition:'all 150ms',boxShadow:t.shadowSm}}>{saving?'⏳ Saving...':'💾 Save All Settings'}</button>
    </div>
  );
}

render(<OptionsApp/>,document.getElementById('app')as HTMLElement);
