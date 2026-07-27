import { render } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import type { JSX as _JSX } from 'preact';
import { LinkedInSearch } from './LinkedInSearch';
import { colors, radii, shadows, fontFamily, inputStyle, fieldLabel, sectionTitle, tabBar, tabBtn } from './theme';
import { DEFAULT_PROMPTS } from '../utils/prompt-templates';
import {
  LLM_DEFAULTS,
  PROFILE_DEFAULTS,
  PROFILE_FIELDS,
  PROMPT_SLOTS,
  createResumeEntry,
  type LlmConfig,
  type ProfileData,
  type ResumeEntry,
} from '../utils/settings-schema';

const PROMPT_LABEL: Record<keyof LlmConfig, { readonly label: string; readonly description: string }> = {
  apiUrl: { label: '', description: '' },
  apiKey: { label: '', description: '' },
  model: { label: '', description: '' },
  activeResumeId: { label: '', description: '' },
  resumes: { label: '', description: '' },
  prmExtractAdd: {
    label: 'Job Extraction',
    description: 'Pulls title, company, location, and full description from the job page.',
  },
  prmSummaryAdd: {
    label: 'Resume Summary',
    description: 'Writes a 3–5 sentence professional summary tailored to the job.',
  },
  prmCoverAdd: {
    label: 'Cover Letter',
    description: 'Writes a tailored cover letter grounded in the resume.',
  },
  prmQuickAdd: {
    label: 'Quick Match',
    description: 'Scores the candidate vs the job 0–10 with grounded reasons.',
  },
  prmFormAdd: {
    label: 'Form Matching',
    description: 'Maps candidate profile to arbitrary form fields, including screening questions.',
  },
  prmReplyAdd: {
    label: 'Message Reply',
    description: 'Drafts a reply to a recruiter or hiring team message.',
  },
};

const PROMPT_BASE_KEY: { [K in keyof LlmConfig]?: keyof typeof DEFAULT_PROMPTS } = {
  prmExtractAdd: 'prmExtract',
  prmSummaryAdd: 'prmSummary',
  prmCoverAdd: 'prmCover',
  prmQuickAdd: 'prmQuick',
  prmFormAdd: 'prmForm',
  prmReplyAdd: 'prmReply',
};

const promptReadonly={width:'100%',padding:'10px 12px',fontSize:'11px',border:`1px solid ${colors.border}`,borderRadius:radii.sm,backgroundColor:colors.surfaceHover,color:colors.textSecondary,fontFamily:'"JetBrains Mono",monospace',boxSizing:'border-box'as const,lineHeight:1.5,whiteSpace:'pre-wrap'as const,overflowY:'auto'as const,maxHeight:'220px'};
const customArea={width:'100%',height:'80px',padding:'8px 10px',fontSize:'12px',border:`1px solid ${colors.accentBorder}`,borderRadius:radii.sm,backgroundColor:colors.accentBg,resize:'vertical',fontFamily,boxSizing:'border-box'as const,lineHeight:1.4,outline:'none',color:colors.textPrimary};
const slotCard={padding:'14px',border:`1px solid ${colors.border}`,borderRadius:radii.md,marginBottom:'14px',backgroundColor:colors.surface};
const slotHeader={display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:'4px'};
const slotTitle={fontSize:'13px',fontWeight:700,color:colors.accent};
const slotDesc={fontSize:'11px',color:colors.textMuted,marginBottom:'10px'};
const slotTag={fontSize:'10px',fontWeight:600,color:colors.textMuted,textTransform:'uppercase'as const,letterSpacing:'0.04em'};

type SettingsTab = 'llm' | 'profile' | 'prompts' | 'presets';
type PromptSlotKey = {
  readonly key: keyof LlmConfig;
  readonly label: string;
  readonly description: string;
  readonly base: string;
};

const SLOTS: readonly PromptSlotKey[] = PROMPT_SLOTS.map((slot) => {
  const baseKey = PROMPT_BASE_KEY[slot.key];
  return {
    key: slot.key,
    label: PROMPT_LABEL[slot.key].label,
    description: PROMPT_LABEL[slot.key].description,
    base: baseKey === undefined ? '' : DEFAULT_PROMPTS[baseKey],
  };
});

export function OptionsApp(): _JSX.Element {
  const [llm,setLlm]=useState<LlmConfig>(LLM_DEFAULTS);
  const [saveStatus,setSaveStatus]=useState('');
  const [expandedSlot,setExpandedSlot]=useState<keyof LlmConfig | null>(null);
  const [parseStatus,setParseStatus]=useState<'idle'|'parsing'|'success'|'error'>('idle');
  const [parseError,setParseError]=useState('');
  const [settingsTab,setSettingsTab]=useState<SettingsTab>('llm');

  // Resume editing state
  const [resumes, setResumes] = useState<readonly ResumeEntry[]>([]);
  const [activeResumeId, setActiveResumeId] = useState('');
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [resumeName, setResumeName] = useState('');
  const [resumeContent, setResumeContent] = useState('');
  const [resumeProfile, setResumeProfile] = useState<ProfileData>(PROFILE_DEFAULTS);

  useEffect(()=>{
    browser.storage.local.get(['llmConfig'],(r)=>{
      const s=r as Record<string,unknown>;
      if(s.llmConfig&&typeof s.llmConfig==='object'&&s.llmConfig!==null){
        const stored=s.llmConfig as Record<string,unknown>;
        const LEGACY_KEYS=['prmExtract','prmTailor','prmSummary','prmCover','prmScreening','prmQuick','prmForm'] as const;
        const cleaned:Record<string,unknown>={...LLM_DEFAULTS,...stored};
        let stripped=false;

        // Migrate legacy single-resume + profile to ResumeEntry
        const legacyResume=stored['resume'];
        const legacyProfile=stored['profile'];
        const hasResumes=Array.isArray(stored['resumes'])&&stored['resumes'].length>0;
        if(!hasResumes&&(typeof legacyResume==='string'||legacyResume==='')&&(typeof legacyProfile==='object'&&legacyProfile!==null)){
          const entry=createResumeEntry('Default',String(legacyResume||''),{...PROFILE_DEFAULTS,...(legacyProfile as Partial<ProfileData>)});
          cleaned['resumes']=[entry];
          cleaned['activeResumeId']=entry.id;
          stripped=true;
        }

        for(const k of LEGACY_KEYS){
          if(k in cleaned){
            delete cleaned[k];
            stripped=true;
          }
        }
        // Also strip legacy resume/profile after migration
        if('resume' in cleaned){
          delete cleaned['resume'];
          stripped=true;
        }
        if('profile' in cleaned){
          delete cleaned['profile'];
          stripped=true;
        }

        const cfg={...LLM_DEFAULTS,...(cleaned as Partial<LlmConfig>)};
        setLlm(cfg);
        setResumes(cfg.resumes);
        setActiveResumeId(cfg.activeResumeId);
        const active=cfg.resumes.find((e)=>e.id===cfg.activeResumeId)??cfg.resumes[0];
        if(active){
          setSelectedResumeId(active.id);
          setResumeName(active.name);
          setResumeContent(active.content);
          setResumeProfile(active.profile);
        }
        if(stripped)browser.storage.local.set({llmConfig:cleaned});
      }
    });
  },[]);

  const persistLlm = useCallback((nextLlm: LlmConfig) => {
    setLlm(nextLlm);
    browser.storage.local.set({ llmConfig: nextLlm }, () => {
      setSaveStatus('✓ Saved');
      setTimeout(() => { setSaveStatus(''); }, 2500);
    });
  }, []);

  const updateLlm=useCallback((k:keyof LlmConfig,v:string)=>{
    const next={...llm,[k]:v};
    persistLlm(next);
  },[llm,persistLlm]);

  const switchResume = useCallback((id: string) => {
    const entry = resumes.find((r) => r.id === id);
    if (!entry) return;
    setSelectedResumeId(id);
    setResumeName(entry.name);
    setResumeContent(entry.content);
    setResumeProfile(entry.profile);
  }, [resumes]);

  const updateResumeName = useCallback((name: string) => {
    setResumeName(name);
    const nextResumes = resumes.map((r) =>
      r.id === selectedResumeId ? { ...r, name, updatedAt: Date.now() } : r,
    );
    setResumes(nextResumes);
    persistLlm({ ...llm, resumes: nextResumes });
  }, [resumes, selectedResumeId, llm, persistLlm]);

  const updateResumeContent = useCallback((content: string) => {
    setResumeContent(content);
    const nextResumes = resumes.map((r) =>
      r.id === selectedResumeId ? { ...r, content, updatedAt: Date.now() } : r,
    );
    setResumes(nextResumes);
    persistLlm({ ...llm, resumes: nextResumes });
  }, [resumes, selectedResumeId, llm, persistLlm]);

  const updateResumeProfile = useCallback((k: keyof ProfileData, v: string | number) => {
    setResumeProfile((p) => {
      const next = { ...p, [k]: v };
      const nextResumes = resumes.map((r) =>
        r.id === selectedResumeId ? { ...r, profile: next, updatedAt: Date.now() } : r,
      );
      setResumes(nextResumes);
      persistLlm({ ...llm, resumes: nextResumes });
      return next;
    });
  }, [resumes, selectedResumeId, llm, persistLlm]);

  const addResume = useCallback(() => {
    const entry = createResumeEntry('New Resume', '', PROFILE_DEFAULTS);
    const nextResumes = [...resumes, entry];
    setResumes(nextResumes);
    setSelectedResumeId(entry.id);
    setResumeName(entry.name);
    setResumeContent('');
    setResumeProfile(PROFILE_DEFAULTS);
    const nextLlm = { ...llm, resumes: nextResumes, activeResumeId: entry.id };
    setActiveResumeId(entry.id);
    persistLlm(nextLlm);
  }, [resumes, llm, persistLlm]);

  const deleteResume = useCallback(() => {
    if (resumes.length <= 1) return;
    const nextResumes = resumes.filter((r) => r.id !== selectedResumeId);
    setResumes(nextResumes);
    const nextActive = nextResumes[0]?.id ?? '';
    setActiveResumeId(nextActive);
    const fallback = nextResumes[0];
    if (fallback) {
      setSelectedResumeId(fallback.id);
      setResumeName(fallback.name);
      setResumeContent(fallback.content);
      setResumeProfile(fallback.profile);
    }
    persistLlm({ ...llm, resumes: nextResumes, activeResumeId: nextActive });
  }, [resumes, selectedResumeId, llm, persistLlm]);

  const setAsDefault = useCallback(() => {
    setActiveResumeId(selectedResumeId);
    persistLlm({ ...llm, activeResumeId: selectedResumeId });
  }, [selectedResumeId, llm, persistLlm]);

  const doParseResume=useCallback(()=>{
    if(!resumeContent.trim()){setParseStatus('error');setParseError('Paste a resume first');return;}
    setParseStatus('parsing');setParseError('');
    // Temporarily set this resume as active so parseResume targets it
    browser.storage.local.get(['llmConfig'],(r)=>{
      const cfg=(r as Record<string,unknown>).llmConfig as Record<string,unknown>;
      const originalActive=typeof cfg.activeResumeId==='string'?cfg.activeResumeId:'';
      browser.storage.local.set({llmConfig:{...cfg,activeResumeId:selectedResumeId}},()=>{
        browser.runtime.sendMessage({type:'backend:parseResume'},(res:{success:boolean;data?:{profile:Partial<ProfileData>;tokenUsage:{totalTokens:number;estimatedCostUsd:number}};error?:string})=>{
          // Restore original active
          browser.storage.local.set({llmConfig:{...cfg,activeResumeId:originalActive}});
          if(!res.success||!res.data){setParseStatus('error');setParseError(res.error??'Parsing failed');return}
          const pp=res.data.profile;
          setResumeProfile((current)=>{
            const next={...current};
            for(const f of PROFILE_FIELDS){
              const val=pp[f.key];
              if(val===undefined||val===null||val==='')continue;
              if(f.type==='number'&&typeof val==='number'){(next as Record<string,unknown>)[f.key]=val}
              else if(typeof val==='string'){(next as Record<string,unknown>)[f.key]=val}
            }
            const nextResumes = resumes.map((r) =>
              r.id === selectedResumeId ? { ...r, profile: next, updatedAt: Date.now() } : r,
            );
            setResumes(nextResumes);
            persistLlm({ ...llm, resumes: nextResumes });
            return next;
          });
          setParseStatus('success');
          setTimeout(()=>{setParseStatus('idle');setParseError('')},4000);
        });
      });
    });
  },[resumeContent,selectedResumeId,resumes,llm,persistLlm]);

  const activeResume = resumes.find((r) => r.id === activeResumeId);

  return(
    <div style={{fontFamily:fontFamily,fontSize:'15px',width:'100%',minHeight:'100vh',padding:'30px 40px',color:colors.textPrimary,backgroundColor:'#FFFFFF',boxSizing:'border-box'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
        <h1 style={{margin:0,fontSize:'24px',fontWeight:800,color:colors.accent,letterSpacing:'-0.02em'}}>⚙️ Settings</h1>
        <span style={{fontSize:'14px',fontWeight:600,color:saveStatus.startsWith('✓')?colors.green:colors.textMuted}}>{saveStatus}</span>
      </div>

      {/* ── Settings Tabs ── */}
      <div style={tabBar}>
        <button onClick={()=>{ setSettingsTab('llm'); }} style={tabBtn(settingsTab==='llm')}>🤖 LLM</button>
        <button onClick={()=>{ setSettingsTab('profile'); }} style={tabBtn(settingsTab==='profile')}>📄 Resume</button>
        <button onClick={()=>{ setSettingsTab('prompts'); }} style={tabBtn(settingsTab==='prompts')}>📝 Prompts</button>
        <button onClick={()=>{ setSettingsTab('presets'); }} style={tabBtn(settingsTab==='presets')}>🔎 Presets</button>
      </div>

      {/* ── Tab: LLM Provider ── */}
      {settingsTab==='llm'&&<div>
        <div style={{marginBottom:'12px'}}><label style={fieldLabel}>API URL</label><input type="text" value={llm.apiUrl} onInput={(e)=>{ updateLlm('apiUrl',(e.target as HTMLInputElement).value); }} placeholder="https://api.deepseek.com" style={inputStyle}/></div>
        <div style={{marginBottom:'12px'}}><label style={fieldLabel}>API Key</label><input type="password" value={llm.apiKey} onInput={(e)=>{ updateLlm('apiKey',(e.target as HTMLInputElement).value); }} placeholder="sk-..." style={inputStyle}/></div>
        <div style={{marginBottom:'12px'}}><label style={fieldLabel}>Model</label><input type="text" value={llm.model} onInput={(e)=>{ updateLlm('model',(e.target as HTMLInputElement).value); }} placeholder="deepseek-chat" style={inputStyle}/></div>
      </div>}

      {/* ── Tab: Resume & Profile ── */}
      {settingsTab==='profile'&&<div>
        {/* Resume selector row */}
        <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'14px',flexWrap:'wrap'}}>
          <select
            value={selectedResumeId}
            onChange={(e)=>{ switchResume((e.target as HTMLSelectElement).value); }}
            style={{...inputStyle,width:'auto',minWidth:'200px',padding:'8px 12px'}}
          >
            {resumes.map((r)=>(
              <option key={r.id} value={r.id}>
                {r.name}{r.id===activeResumeId?' (default)':''}
              </option>
            ))}
          </select>
          <button onClick={addResume} style={{padding:'6px 12px',fontSize:'12px',fontWeight:600,backgroundColor:colors.accent,color:colors.textWhite,border:'none',borderRadius:radii.sm,cursor:'pointer'}}>
            + New Resume
          </button>
          {resumes.length>1&&(
            <button onClick={deleteResume} style={{padding:'6px 12px',fontSize:'12px',fontWeight:600,backgroundColor:colors.surface,color:colors.destructive,border:`1px solid ${colors.destructiveBorder}`,borderRadius:radii.sm,cursor:'pointer'}}>
              Delete
            </button>
          )}
          {selectedResumeId!==activeResumeId&&(
            <button onClick={setAsDefault} style={{padding:'6px 12px',fontSize:'12px',fontWeight:600,backgroundColor:colors.greenBg,color:colors.green,border:`1px solid ${colors.greenBorder}`,borderRadius:radii.sm,cursor:'pointer'}}>
              Set as Default
            </button>
          )}
        </div>

        {/* Resume name */}
        <div style={{marginBottom:'12px'}}>
          <label style={fieldLabel}>Resume Name</label>
          <input
            type="text"
            value={resumeName}
            onInput={(e)=>{ updateResumeName((e.target as HTMLInputElement).value); }}
            placeholder="Backend Engineer"
            style={inputStyle}
          />
        </div>

        {/* Resume content */}
        <div style={sectionTitle}>📄 Resume (Markdown)</div>
        <textarea
          value={resumeContent}
          onInput={(e)=>{ updateResumeContent((e.target as HTMLTextAreaElement).value); }}
          placeholder="Paste your full resume in markdown here..."
          style={{width:'100%',height:'150px',padding:'10px 12px',fontSize:'12px',border:`1px solid ${colors.border}`,borderRadius:radii.sm,resize:'vertical',fontFamily:'"JetBrains Mono",monospace',boxSizing:'border-box',outline:'none',color:colors.textPrimary,backgroundColor:colors.surface}}
        />
        <div style={{marginTop:'8px',display:'flex',gap:'8px',alignItems:'center',marginBottom:'20px'}}>
          <button onClick={doParseResume} disabled={parseStatus==='parsing'} style={{padding:'6px 14px',fontSize:'12px',fontWeight:600,backgroundColor:parseStatus==='parsing'?colors.accentHover:colors.accent,color:colors.textWhite,border:'none',borderRadius:radii.sm,cursor:parseStatus==='parsing'?'not-allowed':'pointer',transition:'all 150ms'}}>
            {parseStatus==='parsing'?'Parsing resume...':'Auto-fill Profile'}
          </button>
          {parseStatus==='error'&&<span style={{fontSize:'12px',color:colors.destructive}}>{parseError}</span>}
          {parseStatus==='success'&&<span style={{fontSize:'12px',color:colors.green,fontWeight:600}}>Profile filled</span>}
        </div>

        {/* Profile fields for this resume */}
        <div style={sectionTitle}>👤 Profile Fields</div>
        <div style={{maxHeight:'none'}}>
          {PROFILE_FIELDS.map((f)=>{
            const v = resumeProfile[f.key];
            const str = typeof v === 'number' ? String(v) : v;
            return (
              <div key={f.key} style={{marginBottom:'10px'}}>
                <label style={fieldLabel}>{f.label}</label>
                <input
                  type={typeof v === 'number' ? 'number' : 'text'}
                  value={str}
                  onInput={(e)=>{
                    const raw = (e.target as HTMLInputElement).value;
                    if (typeof v === 'number') updateResumeProfile(f.key, raw === '' ? 0 : (parseInt(raw, 10) || 0));
                    else updateResumeProfile(f.key, raw);
                  }}
                  placeholder={f.placeholder ?? ''}
                  style={inputStyle}
                />
              </div>
            );
          })}
        </div>
      </div>}

      {/* ── Tab: Prompts ── */}
      {settingsTab==='prompts'&&<div>
        <p style={{fontSize:'11px',color:colors.textSecondary,margin:'0 0 12px',lineHeight:1.5}}>
          Base prompts are locked to keep the JSON output structure stable. You can add short guidance per template (tone, emphasis, length, things to avoid). The runner injects your text into a fixed <code style={{backgroundColor:colors.accentBg,color:colors.textPrimary,padding:'0 4px',borderRadius:'3px',fontSize:'11px'}}>User Custom Instructions</code> slot before the data section.
        </p>
        {SLOTS.map((slot)=>{
          const isOpen=expandedSlot===slot.key;
          const addValue=llm[slot.key];
          return(
            <div key={slot.key} style={slotCard}>
              <div style={slotHeader}>
                <span style={slotTitle}>{slot.label}</span>
                <button onClick={()=>{ setExpandedSlot(isOpen?null:slot.key); }} style={{padding:'2px 10px',fontSize:'11px',fontWeight:600,backgroundColor:isOpen?colors.accent:colors.surface,color:isOpen?colors.textWhite:colors.accent,border:`1px solid ${colors.accent}`,borderRadius:radii.sm,transition:'all 150ms',cursor:'pointer'}}>{isOpen?'Hide base prompt':'View base prompt'}</button>
              </div>
              <div style={slotDesc}>{slot.description}</div>
              {isOpen&&<pre style={promptReadonly}>{slot.base}</pre>}
              <div style={{marginTop:'8px'}}>
                <label style={{...fieldLabel,fontSize:'11px',display:'flex',justifyContent:'space-between'}}>
                  <span>Custom instructions <span style={slotTag}>(appended only)</span></span>
                  <span style={{fontSize:'10px',fontWeight:400,color:colors.textMuted}}>{(addValue as string).length}/2000</span>
                </label>
                <textarea value={addValue as string} onInput={(e)=>{const v=(e.target as HTMLTextAreaElement).value;if(v.length<=2000)updateLlm(slot.key,v)}} placeholder={`Optional. Example: "Keep the summary under 80 words and avoid the word 'passionate'."`} style={customArea}/>
              </div>
            </div>
          );
        })}
      </div>}

      {/* ── Tab: Presets ──────────────────────────────────────── */}
      {settingsTab==='presets'&&<LinkedInSearch />}
    </div>
  );
}

render(<OptionsApp/>,document.getElementById('app')!);