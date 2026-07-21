import { render } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';

// ── Types ────────────────────────────────────────────────────────────
interface TokenUsage { readonly promptTokens: number; readonly completionTokens: number; readonly totalTokens: number; readonly estimatedCostUsd: number; }
interface SummaryResult { readonly kind: 'summary'; readonly title: string; readonly company: string; readonly location: string; readonly summary: string; readonly confidence: number | null; readonly tokenUsage: TokenUsage; readonly sourceUrl: string; readonly sourceSite: string; }
interface CoverLetterResult { readonly kind: 'coverLetter'; readonly title: string; readonly company: string; readonly location: string; readonly coverLetter: string; readonly confidence: number | null; readonly tokenUsage: TokenUsage; readonly sourceUrl: string; readonly sourceSite: string; }
type GenerationResult = SummaryResult | CoverLetterResult;
interface QuickMatchResult { readonly score: number; readonly verdict: string; readonly reasons: readonly string[]; readonly tokenUsage: TokenUsage; }
interface FormField { readonly id: string; readonly label: string; readonly type: string; readonly maxLength: number; readonly options: readonly string[]; }
interface MatchedField { readonly fieldId: string; readonly value: string; readonly confidence: number; }
interface ReplyResult { readonly reply: string; readonly tokenUsage: TokenUsage; }

async function copyToClipboard(text:string):Promise<boolean>{try{await navigator.clipboard.writeText(text);return true}catch{return false}}
const btnPrimary=(bg='#1976d2'):Record<string,string|number>=>({width:'100%',padding:'10px',fontSize:'14px',fontWeight:600,backgroundColor:bg,color:'#fff',border:'none',borderRadius:'6px',cursor:'pointer'});
const btnSm=(bg='#fff',fg='#1976d2'):Record<string,string|number>=>({flex:1,padding:'6px 8px',fontSize:'12px',fontWeight:600,backgroundColor:bg,color:fg,border:`1px solid ${fg}`,borderRadius:'4px',cursor:'pointer'});
const btnCopy={marginLeft:'auto',padding:'2px 8px',fontSize:'11px',border:'1px solid #ccc',borderRadius:'4px',backgroundColor:'#fff',cursor:'pointer',color:'#666'};
const textareaS={width:'100%',height:'56px',padding:'6px 8px',fontSize:'12px',border:'1px solid #ccc',borderRadius:'4px',resize:'vertical',fontFamily:'inherit',boxSizing:'border-box'as const};
const SK_RESULT='lastGeneration';
const SK_QUICK='lastQuick';
const SK_FIELDS='lastFields';
const SK_MATCHES='lastMatches';

type AppPhase =
  | { phase: 'idle' }
  | { phase: 'generating'; kind: 'summary' | 'coverLetter' }
  | { phase: 'error'; message: string; details?: string; debug?: string }
  | { phase: 'generated'; result: GenerationResult }
  | { phase: 'quick-match'; result: QuickMatchResult }
  | { phase: 'reply'; result: ReplyResult }
  | { phase: 'filling' }
  | { phase: 'matched'; fields: readonly FormField[]; matches: readonly MatchedField[]; unmatched: readonly string[] };

export function App(): preact.JSX.Element {
  const [state, setState] = useState<AppPhase>({ phase: 'idle' });
  const [replyPrompt, setReplyPrompt] = useState('');

  useEffect(() => {
    chrome.storage.local.get([SK_RESULT, SK_QUICK, SK_FIELDS, SK_MATCHES], (r) => {
      const s = r as Record<string, unknown>;
      if (s[SK_RESULT]) setState({ phase: 'generated', result: s[SK_RESULT] as GenerationResult });
      else if (s[SK_QUICK]) setState({ phase: 'quick-match', result: s[SK_QUICK] as QuickMatchResult });
      else if (s[SK_FIELDS] && s[SK_MATCHES]) setState({ phase: 'matched', fields: s[SK_FIELDS] as readonly FormField[], matches: s[SK_MATCHES] as readonly MatchedField[], unmatched: [] });
    });
  }, []);

  const clearResult = useCallback(() => { chrome.storage.local.remove([SK_RESULT]); setState({ phase: 'idle' }); }, []);
  const clearQuick = useCallback(() => { chrome.storage.local.remove([SK_QUICK]); setState({ phase: 'idle' }); }, []);
  const clearReply = useCallback(() => { chrome.storage.local.remove(['lastReply']); setState({ phase: 'idle' }); }, []);
  const clearMatched = useCallback(() => { chrome.storage.local.remove([SK_FIELDS, SK_MATCHES]); setState({ phase: 'idle' }); }, []);

  const generate = useCallback((kind: 'summary' | 'coverLetter') => {
    setState({ phase: 'generating', kind });
    chrome.runtime.sendMessage({ type: 'scrape', kind }, (r: { success: boolean; data?: unknown; error?: string; details?: string; debug?: string }) => {
      if (chrome.runtime.lastError) { setState({ phase: 'error', message: chrome.runtime.lastError.message ?? 'Unknown runtime error' }); return; }
      if (!r.success || !r.data) { setState({ phase: 'error', message: r.error ?? 'Unknown error', details: r.details, debug: r.debug }); return; }
      const result = r.data as GenerationResult;
      chrome.storage.local.set({ [SK_RESULT]: result });
      setState({ phase: 'generated', result });
    });
  }, []);

  const quickMatch = useCallback(() => {
    setState({ phase: 'generating', kind: 'summary' });
    chrome.runtime.sendMessage({ type: 'scrape', quickMatch: true }, (r: { success: boolean; data?: unknown; error?: string; details?: string; debug?: string }) => {
      if (chrome.runtime.lastError) { setState({ phase: 'error', message: chrome.runtime.lastError.message ?? 'Unknown runtime error' }); return; }
      if (!r.success || !r.data) { setState({ phase: 'error', message: r.error ?? 'Unknown error', details: r.details, debug: r.debug }); return; }
      const result = r.data as QuickMatchResult;
      chrome.storage.local.set({ [SK_QUICK]: result });
      setState({ phase: 'quick-match', result });
    });
  }, []);

  const craftReply = useCallback(() => {
    if (replyPrompt.trim() === '') return;
    setState({ phase: 'generating', kind: 'summary' });
    chrome.runtime.sendMessage({ type: 'scrape', reply: true, replyPrompt }, (r: { success: boolean; data?: unknown; error?: string; details?: string; debug?: string }) => {
      if (chrome.runtime.lastError) { setState({ phase: 'error', message: chrome.runtime.lastError.message ?? 'Unknown runtime error' }); return; }
      if (!r.success || !r.data) { setState({ phase: 'error', message: r.error ?? 'Unknown error', details: r.details, debug: r.debug }); return; }
      const result = r.data as ReplyResult;
      chrome.storage.local.set({ lastReply: result });
      setState({ phase: 'reply', result });
    });
  }, [replyPrompt]);

  const fillFormOnly = useCallback(() => {
    setState({ phase: 'filling' });
    (async () => {
      try {
        const fr = await new Promise<{ fields: readonly FormField[] }>((res, rej) => {
          chrome.runtime.sendMessage({ type: 'scrapeFormFields' }, (r: { fields?: readonly FormField[]; fieldCount?: number; error?: string }) => {
            if (chrome.runtime.lastError) { rej(new Error(chrome.runtime.lastError.message)); return; }
            if (r.fields && r.fields.length > 0) { res({ fields: r.fields }); return; }
            rej(new Error(r.error ?? `No form fields (${r.fieldCount ?? 0})`));
          });
        });
        const fields = fr.fields;
        const mr = await new Promise<{ values: readonly MatchedField[]; unmatched: readonly string[] }>((res, rej) => {
          chrome.runtime.sendMessage({ type: 'backend:matchFormFields', payload: { fields: fields.map((f) => ({ id: f.id, label: f.label, type: f.type, maxLength: f.maxLength, options: f.options })), sourceUrl: window.location.href } }, (r: { success: boolean; data?: { values: readonly MatchedField[]; unmatched: readonly string[] }; error?: string }) => {
            if (chrome.runtime.lastError) { rej(new Error(chrome.runtime.lastError.message)); return; }
            if (!r.success || !r.data) { rej(new Error(r.error ?? 'Matching failed')); return; }
            res(r.data);
          });
        });
        chrome.storage.local.set({ [SK_FIELDS]: fields, [SK_MATCHES]: mr.values });
        setState({ phase: 'matched', fields, matches: mr.values, unmatched: mr.unmatched });
      } catch (e: unknown) { setState({ phase: 'error', message: e instanceof Error ? e.message : 'Unknown error', debug: 'Fill form failed. Check a form is visible.' }); }
    })();
  }, []);

  const inject = useCallback(() => {
    if (state.phase !== 'matched') return;
    chrome.runtime.sendMessage({ type: 'fillFormMatched', matches: state.matches.map((m) => ({ fieldId: m.fieldId, value: m.value })) }, () => { });
  }, [state]);

  return (
    <div style={{ width: '100%', maxWidth: '560px', fontFamily: 'system-ui, sans-serif', fontSize: '13px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px 4px', borderBottom: '1px solid #e8e8e8' }}>
        <img src="assets/logo.png" alt="AI Job Copilot" style={{ width: '24px', height: '24px', flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: '14px', color: '#1976d2' }}>AI Job Copilot</span>
      </div>
      <div style={{ padding: '8px 12px 12px', maxHeight: '600px', overflowY: 'auto' }}>
        {(() => {
          switch (state.phase) {
            case 'idle':
              return <IdlePanel replyPrompt={replyPrompt} onReplyChange={setReplyPrompt} onSummary={() => generate('summary')} onCover={() => generate('coverLetter')} onQuickMatch={quickMatch} onFillOnly={fillFormOnly} onReply={craftReply} />;
            case 'generating':
              return <Spinner text={state.kind === 'coverLetter' ? 'Writing cover letter…' : state.kind === 'summary' ? 'Writing summary…' : 'Working…'} />;
            case 'error':
              return <ErrorPanel state={state} onRetry={() => setState({ phase: 'idle' })} />;
            case 'generated':
              return <GeneratedPanel result={state.result} onRegen={() => generate(state.result.kind)} onClear={clearResult} />;
            case 'quick-match':
              return <QuickMatchPanel result={state.result} onClear={clearQuick} />;
            case 'reply':
              return <ReplyPanel result={state.result} onClear={clearReply} />;
            case 'filling':
              return <Spinner text="Matching form fields…" />;
            case 'matched':
              return <MatchedPanel fields={state.fields} matches={state.matches} unmatched={state.unmatched} onInject={inject} onClear={clearMatched} />;
            default:
              return <div />;
          }
        })()}
      </div>
    </div>
  );
}

function IdlePanel(p: { replyPrompt: string; onReplyChange: (v: string) => void; onSummary: () => void; onCover: () => void; onQuickMatch: () => void; onFillOnly: () => void; onReply: () => void }): preact.JSX.Element {
  return (
    <div>
      <p style={{ fontSize: '11px', color: '#888', margin: '0 0 8px' }}>Open a job posting, then pick what you need:</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <button onClick={p.onSummary} style={btnPrimary('#1976d2')}>📝 Summary</button>
        <button onClick={p.onCover} style={btnPrimary('#6a1b9a')}>✉️ Cover Letter</button>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button onClick={p.onQuickMatch} style={{ flex: 1, ...btnPrimary('#ff9800') }}>⚡ Quick Match</button>
        <button onClick={p.onFillOnly} style={{ flex: 1, ...btnPrimary('#4caf50') }}>✍️ Fill Form</button>
      </div>
      <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: '12px', marginTop: '4px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#444', marginBottom: '6px' }}>💬 Message Reply</div>
        <textarea value={p.replyPrompt} onInput={(e) => p.onReplyChange((e.target as HTMLTextAreaElement).value)} placeholder='What should the reply say? (e.g. "I am interested but my salary expectation is 90k")' style={textareaS} />
        <button onClick={p.onReply} disabled={p.replyPrompt.trim() === ''} style={{ ...btnPrimary('#8e24aa'), marginTop: '6px', opacity: p.replyPrompt.trim() === '' ? 0.5 : 1 }}>✉️ Craft Reply</button>
      </div>
    </div>
  );
}

function Spinner(p: { text: string }): preact.JSX.Element {
  return (
    <div style={{ padding: '30px 0', textAlign: 'center', color: '#666' }}>
      <div style={{ width: '28px', height: '28px', border: '3px solid #e0e0e0', borderTopColor: '#1976d2', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
      <p style={{ margin: 0, fontSize: '13px' }}>{p.text}</p>
      <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#999' }}>This may take 15–30 seconds</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function ErrorPanel(p: { state: { message: string; details?: string; debug?: string }; onRetry: () => void }): preact.JSX.Element {
  const [dbg, setDbg] = useState(false);
  return (
    <div>
      <div style={{ padding: '10px', backgroundColor: '#ffebee', borderRadius: '6px', marginBottom: '10px', border: '1px solid #ef9a9a' }}>
        <p style={{ margin: '0 0 4px', color: '#c62828', fontWeight: 600, fontSize: '13px' }}>Error</p>
        <p style={{ margin: 0, color: '#b71c1c', fontSize: '12px' }}>{p.state.message}</p>
        {p.state.details && <pre style={{ margin: '6px 0 0', fontSize: '11px', color: '#666', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{p.state.details}</pre>}
        {p.state.debug && (
          <div>
            <button onClick={() => setDbg(!dbg)} style={{ marginTop: '6px', padding: '3px 8px', fontSize: '10px', backgroundColor: '#fff', color: '#c62828', border: '1px solid #c62828', borderRadius: '3px', cursor: 'pointer' }}>{dbg ? 'Hide' : 'Debug'}</button>
            {dbg && <pre style={{ margin: '6px 0 0', padding: '6px', fontSize: '10px', color: '#333', backgroundColor: '#fafafa', border: '1px solid #e0e0e0', borderRadius: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '300px', overflowY: 'auto', fontFamily: 'monospace', lineHeight: 1.3 }}>{p.state.debug}</pre>}
          </div>
        )}
      </div>
      <button onClick={p.onRetry} style={btnSm()}>← Back</button>
    </div>
  );
}

function GeneratedPanel(p: { result: GenerationResult; onRegen: () => void; onClear: () => void }): preact.JSX.Element {
  const r = p.result;
  const isSummary = r.kind === 'summary';
  const [copied, setCopied] = useState(false);
  const text = isSummary ? r.summary : r.coverLetter;
  const copy = useCallback(async () => { if (await copyToClipboard(text)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } }, [text]);
  const headerBg = isSummary ? '#e3f2fd' : '#f3e5f5';
  const headerBd = isSummary ? '#90caf9' : '#ce93d8';
  const headerFg = isSummary ? '#0d47a1' : '#6a1b9a';
  const title = isSummary ? '📝 Professional Summary' : '✉️ Cover Letter';
  const tokenLabel = `${r.tokenUsage.totalTokens.toLocaleString()} tokens (~$${r.tokenUsage.estimatedCostUsd.toFixed(4)})`;
  return (
    <div>
      <div style={{ padding: '8px 10px', backgroundColor: '#f5f5f5', borderRadius: '6px', marginBottom: '10px', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span><strong>{r.title || 'Job'}</strong>{r.company ? ` · ${r.company}` : ''}{r.location ? ` · ${r.location}` : ''}</span>
        <span style={{ color: '#999' }}>{tokenLabel}</span>
      </div>
      <div style={{ padding: '10px', backgroundColor: headerBg, borderRadius: '6px', marginBottom: '10px', border: `1px solid ${headerBd}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: headerFg }}>{title}</span>
          <button onClick={copy} style={btnCopy}>{copied ? '✓ Copied' : '📋 Copy'}</button>
        </div>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '12px', lineHeight: 1.5, color: '#333', maxHeight: isSummary ? '320px' : '420px', overflowY: 'auto', wordBreak: 'break-word' }}>{text}</pre>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={p.onRegen} style={btnSm()}>🔄 Regenerate</button>
        <button onClick={p.onClear} style={btnSm('#fff', '#c62828')}>✕ Clear</button>
      </div>
    </div>
  );
}

function QuickMatchPanel(p: { result: QuickMatchResult; onClear: () => void }): preact.JSX.Element {
  const r = p.result;
  const c = r.score >= 7 ? '#2e7d32' : r.score >= 4 ? '#f9a825' : '#c62828';
  const e = r.score >= 7 ? '🟢' : r.score >= 4 ? '🟡' : '🔴';
  return (
    <div>
      <div style={{ padding: '12px', backgroundColor: `${c}15`, borderRadius: '6px', marginBottom: '10px', border: `1px solid ${c}40` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '18px', fontWeight: 700, color: c }}>{e} {r.score}/10</span>
          <span style={{ fontSize: '14px', fontWeight: 600, color: c }}>{r.verdict}</span>
        </div>
        <ul style={{ margin: '0 0 0 16px', padding: 0, fontSize: '12px', color: '#444' }}>{r.reasons.map((x, i) => <li key={i} style={{ marginBottom: '4px' }}>{x}</li>)}</ul>
        <div style={{ marginTop: '8px', fontSize: '10px', color: '#999' }}>{r.tokenUsage.totalTokens.toLocaleString()} tokens (~${r.tokenUsage.estimatedCostUsd.toFixed(4)})</div>
      </div>
      <button onClick={p.onClear} style={btnSm('#fff', '#666')}>✕ Clear</button>
    </div>
  );
}

function ReplyPanel(p: { result: ReplyResult; onClear: () => void }): preact.JSX.Element {
  const [copied, setCopied] = useState(false);
  const hc = useCallback(async () => { if (await copyToClipboard(p.result.reply)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } }, [p.result.reply]);
  return (
    <div>
      <div style={{ padding: '10px', backgroundColor: '#f3e5f5', borderRadius: '6px', marginBottom: '10px', border: '1px solid #ce93d8' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#6a1b9a' }}>✉️ AI Reply</span>
          <span style={{ fontSize: '10px', color: '#999' }}>{p.result.tokenUsage.totalTokens.toLocaleString()} tokens</span>
        </div>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '12px', lineHeight: 1.5, color: '#333', maxHeight: '250px', overflowY: 'auto', wordBreak: 'break-word' }}>{p.result.reply}</pre>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <button onClick={hc} style={btnSm('#6a1b9a', '#fff')}>{copied ? '✓ Copied' : '📋 Copy'}</button>
        <button onClick={p.onClear} style={btnSm('#fff', '#666')}>✕ Clear</button>
      </div>
    </div>
  );
}

function MatchedPanel(p: { fields: readonly FormField[]; matches: readonly MatchedField[]; unmatched: readonly string[]; onInject: () => void; onClear: () => void }): preact.JSX.Element {
  const [inj, setInj] = useState(false);
  const fl: Record<string, string> = {};
  for (const f of p.fields) fl[f.id] = f.label;
  return (
    <div>
      <div style={{ padding: '6px 10px', backgroundColor: '#e8f5e9', borderRadius: '6px', marginBottom: '10px', fontSize: '12px' }}>
        <strong>{p.matches.length} fields matched</strong> · {p.unmatched.length} need manual input
      </div>
      <div style={{ maxHeight: '280px', overflowY: 'auto', marginBottom: '10px' }}>
        {p.matches.map((m, i) => {
          const l = fl[m.fieldId] ?? m.fieldId;
          const e = m.confidence > 0.7 ? '🟢' : m.confidence > 0.4 ? '🟡' : '🔴';
          return (
            <div key={i} style={{ padding: '6px 8px', border: '1px solid #e0e0e0', borderRadius: '4px', marginBottom: '4px', fontSize: '11px' }}>
              <div style={{ fontWeight: 600, color: '#333', marginBottom: '1px' }}>{l}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#555' }}>{m.value.length > 60 ? `${m.value.slice(0, 60)}…` : m.value}</span>
                <span style={{ color: '#888', fontSize: '10px' }}>{e} {Math.round(m.confidence * 100)}%</span>
              </div>
            </div>
          );
        })}
      </div>
      {p.unmatched.length > 0 && <p style={{ fontSize: '11px', color: '#c62828', marginBottom: '8px' }}>⚠️ Needs manual: {p.unmatched.map((id) => fl[id] ?? id).join(', ')}</p>}
      <div style={{ display: 'flex', gap: '8px' }}>
        {!inj ? <button onClick={() => { p.onInject(); setInj(true); }} style={btnPrimary('#4caf50')}>💉 Inject into Form</button> : <div style={{ flex: 1, padding: '8px', textAlign: 'center', backgroundColor: '#c8e6c9', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: '#2e7d32' }}>✓ Injected — review & submit manually</div>}
        <button onClick={p.onClear} style={btnSm()}>✕ Clear</button>
      </div>
    </div>
  );
}

render(<App />, document.getElementById('app') as HTMLElement);
