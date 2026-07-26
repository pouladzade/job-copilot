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
  type LlmConfig,
  type ProfileData,
} from '../utils/settings-schema';

const PROMPT_LABEL: Record<keyof LlmConfig, { readonly label: string; readonly description: string }> = {
  apiUrl: { label: '', description: '' },
  apiKey: { label: '', description: '' },
  model: { label: '', description: '' },
  resume: { label: '', description: '' },
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

type SettingsTab = 'llm' | 'profile' | 'prompts';
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
  const [profile,setProfile]=useState(PROFILE_DEFAULTS);
  const [llm,setLlm]=useState(LLM_DEFAULTS);
  const [saveStatus,setSaveStatus]=useState('');
  const [expandedSlot,setExpandedSlot]=useState<keyof LlmConfig | null>(null);
  const [parseStatus,setParseStatus]=useState<'idle'|'parsing'|'success'|'error'>('idle');
  const [parseError,setParseError]=useState('');
  const [settingsTab,setSettingsTab]=useState<SettingsTab>('llm');

  useEffect(()=>{
    browser.storage.local.get(['profile','llmConfig'],(r)=>{
      const s=r as Record<string,unknown>;
      if(s.profile&&typeof s.profile==='object'&&s.profile!==null){
        setProfile({...PROFILE_DEFAULTS,...(s.profile as Partial<ProfileData>)});
      }
      if(s.llmConfig&&typeof s.llmConfig==='object'&&s.llmConfig!==null){
        const stored=s.llmConfig as Record<string,unknown>;
        const LEGACY_KEYS=['prmExtract','prmTailor','prmSummary','prmCover','prmScreening','prmQuick','prmForm'] as const;
        const cleaned:Record<string,unknown>={...LLM_DEFAULTS,...stored};
        let stripped=false;
        for(const k of LEGACY_KEYS){
          if(k in cleaned){
            delete cleaned[k];
            stripped=true;
          }
        }
        setLlm((p)=>{return{...p,...(cleaned as Partial<LlmConfig>)};});
        if(stripped)browser.storage.local.set({llmConfig:cleaned});
      }
    });
  },[]);

  const [saving,setSaving]=useState(false);
  const updateP=useCallback((k:keyof ProfileData,v:string|number)=>{ setProfile((p)=>{return{...p,[k]:v};}); },[]);
  const updateLlm=useCallback((k:keyof LlmConfig,v:string)=>{ setLlm((l)=>{return{...l,[k]:v};}); },[]);
  const doSave=useCallback(()=>{
    setSaving(true);
    const start=Date.now();
    browser.storage.local.set({profile,llmConfig:llm},()=>{
      const elapsed=Date.now()-start;
      const remaining=Math.max(0,600-elapsed);
      setTimeout(()=>{
        setSaving(false);
        setSaveStatus('✓ Saved');
        setTimeout(()=>{ setSaveStatus(''); },2500);
      },remaining);
    });
  },[profile,llm]);

  const doParseResume=useCallback(()=>{
    setParseStatus('parsing');setParseError('');
    browser.runtime.sendMessage({type:'backend:parseResume'},(r:{success:boolean;data?:{profile:Partial<ProfileData>;tokenUsage:{totalTokens:number;estimatedCostUsd:number}};error?:string})=>{
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
    <div style={{fontFamily:fontFamily,fontSize:'15px',maxWidth:'860px',margin:'0 auto',padding:'30px 24px',color:colors.textPrimary,backgroundColor:'#FFFFFF'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
        <h1 style={{margin:0,fontSize:'24px',fontWeight:800,color:colors.accent,letterSpacing:'-0.02em'}}>⚙️ Settings</h1>
        <span style={{fontSize:'14px',fontWeight:600,color:saveStatus.startsWith('✓')?colors.green:colors.textMuted}}>{saveStatus}</span>
      </div>

      {/* ── Settings Tabs ── */}
      <div style={tabBar}>
        <button onClick={()=>{ setSettingsTab('llm'); }} style={tabBtn(settingsTab==='llm')}>🤖 LLM Provider</button>
        <button onClick={()=>{ setSettingsTab('profile'); }} style={tabBtn(settingsTab==='profile')}>📄 Resume & Profile</button>
        <button onClick={()=>{ setSettingsTab('prompts'); }} style={tabBtn(settingsTab==='prompts')}>📝 Prompts</button>
      </div>

      {/* ── Tab: LLM Provider ── */}
      {settingsTab==='llm'&&<div>
        <div style={{marginBottom:'12px'}}><label style={fieldLabel}>API URL</label><input type="text" value={llm.apiUrl} onInput={(e)=>{ updateLlm('apiUrl',(e.target as HTMLInputElement).value); }} placeholder="https://api.deepseek.com" style={inputStyle}/></div>
        <div style={{marginBottom:'12px'}}><label style={fieldLabel}>API Key</label><input type="password" value={llm.apiKey} onInput={(e)=>{ updateLlm('apiKey',(e.target as HTMLInputElement).value); }} placeholder="sk-..." style={inputStyle}/></div>
        <div style={{marginBottom:'12px'}}><label style={fieldLabel}>Model</label><input type="text" value={llm.model} onInput={(e)=>{ updateLlm('model',(e.target as HTMLInputElement).value); }} placeholder="deepseek-chat" style={inputStyle}/></div>
      </div>}

      {/* ── Tab: Resume & Profile ── */}
      {settingsTab==='profile'&&<div>
        <div style={sectionTitle}>📄 Resume (Markdown)</div>
        <textarea value={llm.resume} onInput={(e)=>{ updateLlm('resume',(e.target as HTMLTextAreaElement).value); }} placeholder="Paste your full resume in markdown here..." style={{width:'100%',height:'150px',padding:'10px 12px',fontSize:'12px',border:`1px solid ${colors.border}`,borderRadius:radii.sm,resize:'vertical',fontFamily:'"JetBrains Mono",monospace',boxSizing:'border-box',outline:'none',color:colors.textPrimary,backgroundColor:colors.surface}}/>
        <div style={{marginTop:'8px',display:'flex',gap:'8px',alignItems:'center',marginBottom:'20px'}}>
          <button onClick={doParseResume} disabled={parseStatus==='parsing'} style={{padding:'6px 14px',fontSize:'12px',fontWeight:600,backgroundColor:parseStatus==='parsing'?colors.accentHover:colors.accent,color:colors.textWhite,border:'none',borderRadius:radii.sm,cursor:parseStatus==='parsing'?'not-allowed':'pointer',transition:'all 150ms'}}>
            {parseStatus==='parsing'?'Parsing resume...':'Auto-fill Profile'}
          </button>
          {parseStatus==='error'&&<span style={{fontSize:'12px',color:colors.destructive}}>{parseError}</span>}
          {parseStatus==='success'&&<span style={{fontSize:'12px',color:colors.green,fontWeight:600}}>Profile filled</span>}
        </div>

        <div style={sectionTitle}>👤 Profile Fields</div>
        <div style={{maxHeight:'none'}}>
          {PROFILE_FIELDS.map((f)=>{
            const v = profile[f.key];
            const str = typeof v === 'number' ? String(v) : v;
            return (
              <div key={f.key} style={{marginBottom:'10px'}}>
                <label style={fieldLabel}>{f.label}</label>
                <input
                  type={typeof v === 'number' ? 'number' : 'text'}
                  value={str}
                  onInput={(e)=>{
                    const raw = (e.target as HTMLInputElement).value;
                    if (typeof v === 'number') updateP(f.key, raw === '' ? 0 : (parseInt(raw, 10) || 0));
                    else updateP(f.key, raw);
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
                  <span style={{fontSize:'10px',fontWeight:400,color:colors.textMuted}}>{addValue.length}/2000</span>
                </label>
                <textarea value={addValue} onInput={(e)=>{const v=(e.target as HTMLTextAreaElement).value;if(v.length<=2000)updateLlm(slot.key,v)}} placeholder={`Optional. Example: "Keep the summary under 80 words and avoid the word 'passionate'."`} style={customArea}/>
              </div>
            </div>
          );
        })}
      </div>}

      <button onClick={doSave} disabled={saving} style={{width:'100%',padding:'14px',fontSize:'16px',fontWeight:700,backgroundColor:saving?colors.accentHover:saveStatus.startsWith('✓')?colors.green:colors.accent,color:colors.textWhite,border:'none',borderRadius:radii.sm,cursor:saving?'not-allowed':'pointer',marginTop:'24px',transition:'all 150ms',boxShadow:shadows.sm}}>{saving?'⏳ Saving...':saveStatus.startsWith('✓')?'✓ Saved!':'💾 Save All Settings'}</button>

      <LinkedInSearch />
    </div>
  );
}

render(<OptionsApp/>,document.getElementById('app')!);
