import { render } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';

import type { JSX } from 'preact';
import { buildLinkedInSearchUrl } from '../utils/linkedin-search-builder';
import { colors, radii, fontFamily } from "./theme";
import type { LinkedInSearchConfig } from '../utils/linkedin-search-builder';


// ── Types ────────────────────────────────────────────────────────────
interface TokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly estimatedCostUsd: number;
}
interface SummaryResult {
  readonly kind: 'summary';
  readonly title: string;
  readonly company: string;
  readonly location: string;
  readonly summary: string;
  readonly confidence: number | null;
  readonly tokenUsage: TokenUsage;
  readonly sourceUrl: string;
  readonly sourceSite: string;
}
interface CoverLetterResult {
  readonly kind: 'coverLetter';
  readonly title: string;
  readonly company: string;
  readonly location: string;
  readonly coverLetter: string;
  readonly confidence: number | null;
  readonly tokenUsage: TokenUsage;
  readonly sourceUrl: string;
  readonly sourceSite: string;
}
type GenerationResult = SummaryResult | CoverLetterResult;
interface QuickMatchResult {
  readonly score: number;
  readonly verdict: string;
  readonly reasons: readonly string[];
  readonly tokenUsage: TokenUsage;
}
interface FormField {
  readonly id: string;
  readonly label: string;
  readonly type: string;
  readonly maxLength: number;
  readonly options: readonly string[];
}
interface MatchedField {
  readonly fieldId: string;
  readonly value: string;
  readonly confidence: number;
}
interface ReplyResult {
  readonly reply: string;
  readonly tokenUsage: TokenUsage;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);

    return true;
  } catch {
    return false;
  }
}

const SK_RESULT = 'lastGeneration';
const SK_QUICK = 'lastQuick';
const SK_FIELDS = 'lastFields';
const SK_MATCHES = 'lastMatches';

type AppPhase =
  | { readonly phase: 'idle' }
  | { readonly phase: 'generating'; readonly kind: 'summary' | 'coverLetter' }
  | { readonly phase: 'error'; readonly message: string; readonly details?: string; readonly debug?: string }
  | { readonly phase: 'generated'; readonly result: GenerationResult }
  | { readonly phase: 'quick-match'; readonly result: QuickMatchResult }
  | { readonly phase: 'reply'; readonly result: ReplyResult }
  | { readonly phase: 'filling' }
  | { readonly phase: 'matched'; readonly fields: readonly FormField[]; readonly matches: readonly MatchedField[]; readonly unmatched: readonly string[] };

// ── Shared Components ─────────────────────────────────────────────────

function Container(p: { readonly children: preact.ComponentChildren }): JSX.Element {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: '520px',
        minHeight: '280px',
        fontFamily,
        fontSize: '13px',
        lineHeight: 1.5,
        color: colors.textPrimary,
        backgroundColor: colors.bg,
        borderRadius: '18px',
        border: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}
    >
      {p.children}
    </div>
  );
}

function Header(_p: Record<string, never>): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 14px',
        backgroundColor: colors.card,
      }}
    >
      <img
        src="assets/logo.png"
        alt="AI Job Copilot"
        style={{ width: '20px', height: '20px', flexShrink: 0 }}
      />
      <span style={{ fontWeight: 600, fontSize: '12px', color: colors.textSecondary, letterSpacing: '-0.01em' }}>
        AI Job Copilot
      </span>
    </div>
  );
}

function Spinner(p: { readonly text: string }): JSX.Element {
  return (
    <div style={{ padding: '36px 0', textAlign: 'center' }}>
      <div
        style={{
          width: '32px',
          height: '32px',
          border: `3px solid ${colors.accentBorder}`,
          borderTopColor: colors.accent,
          borderRadius: '50%',
          animation: 'jhs-spin 0.7s linear infinite',
          margin: '0 auto 12px',
        }}
      />
      <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: colors.textPrimary }}>
        {p.text}
      </p>
      <p style={{ margin: '6px 0 0', fontSize: '11px', color: colors.textMuted }}>
        This may take 15–30 seconds
      </p>
      <style>{`@keyframes jhs-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function ErrorPanel(p: {
  readonly state: { readonly message: string; readonly details?: string; readonly debug?: string };
  readonly onRetry: () => void;
}): JSX.Element {
  const [dbg, setDbg] = useState(false);

  return (
    <div>
      <div
        style={{
          padding: '12px',
          backgroundColor: colors.destructiveBg,
          borderRadius: radii.md,
          marginBottom: '12px',
          border: `1px solid ${colors.destructiveBorder}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <span style={{ fontSize: '16px' }}>&#9888;</span>
          <span style={{ fontWeight: 700, color: colors.destructive, fontSize: '13px' }}>
            Error
          </span>
        </div>
        <p style={{ margin: 0, color: '#F48771', fontSize: '12px' }}>{p.state.message}</p>
        {p.state.details && (
          <pre
            style={{
              margin: '8px 0 0',
              fontSize: '11px',
              color: colors.textSecondary,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: 1.4,
            }}
          >
            {p.state.details}
          </pre>
        )}
        {p.state.debug && (
          <div>
            <button
              onClick={() => { setDbg(!dbg); }}
              style={{
                marginTop: '8px',
                padding: '4px 10px',
                fontSize: '10px',
                fontWeight: 600,
                backgroundColor: colors.surface,
                color: colors.destructive,
                border: `1px solid ${colors.destructiveBorder}`,
                borderRadius: radii.sm,
                cursor: 'pointer',
              }}
            >
              {dbg ? 'Hide debug' : 'Show debug'}
            </button>
            {dbg && (
              <pre
                style={{
                  margin: '8px 0 0',
                  padding: '8px',
                  fontSize: '10px',
                  color: colors.textPrimary,
                  backgroundColor: colors.surfaceHover,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radii.sm,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  fontFamily: '"JetBrains Mono", monospace',
                  lineHeight: 1.3,
                }}
              >
                {p.state.debug}
              </pre>
            )}
          </div>
        )}
      </div>
      <BackButton onClick={p.onRetry} />
    </div>
  );
}

function TokenBadge(p: { readonly usage: TokenUsage }): JSX.Element {
  return (
    <span
      style={{
        fontSize: '10px',
        fontWeight: 500,
        color: colors.textMuted,
        backgroundColor: colors.surface,
        padding: '2px 8px',
        borderRadius: '99px',
        border: `1px solid ${colors.border}`,
      }}
    >
      {p.usage.totalTokens.toLocaleString()} tokens (~${p.usage.estimatedCostUsd.toFixed(4)})
    </span>
  );
}

function BackButton(p: { readonly onClick: () => void }): JSX.Element {
  return (
    <button
      onClick={p.onClick}
      style={{
        padding: '8px 16px',
        fontSize: '12px',
        fontWeight: 600,
        backgroundColor: colors.surface,
        color: colors.textSecondary,
        border: `1px solid ${colors.border}`,
        borderRadius: radii.sm,
        cursor: 'pointer',
        transition: 'all 150ms',
      }}
      onMouseEnter={(e) => {
        (e.target as HTMLElement).style.backgroundColor = colors.surfaceHover;
      }}
      onMouseLeave={(e) => {
        (e.target as HTMLElement).style.backgroundColor = colors.surface;
      }}
    >
      &#8592; Back
    </button>
  );
}

function CopyButton(p: { readonly text: string; readonly label?: string }): JSX.Element {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    if (await copyToClipboard(p.text)) {
      setCopied(true);
      setTimeout(() => { setCopied(false); }, 1800);
    }
  }, [p.text]);

  const bg = copied ? colors.greenBg : colors.surface;
  const fg = copied ? colors.green : colors.textMuted;
  const bd = copied ? colors.greenBorder : colors.border;

  return (
    <button
      onClick={copy}
      style={{
        padding: '4px 10px',
        fontSize: '11px',
        fontWeight: 500,
        backgroundColor: bg,
        color: fg,
        border: `1px solid ${bd}`,
        borderRadius: radii.sm,
        cursor: 'pointer',
        transition: 'all 150ms',
        whiteSpace: 'nowrap',
      }}
    >
      {copied ? '&#10003; Copied' : p.label ?? 'Copy'}
    </button>
  );
}

// ── Popup App ─────────────────────────────────────────────────────────

export function App(): JSX.Element {
  const [state, setState] = useState<AppPhase>({ phase: 'idle' });
  const [replyPrompt, setReplyPrompt] = useState('');

  useEffect(() => {
    browser.storage.local.get([SK_RESULT, SK_QUICK, SK_FIELDS, SK_MATCHES], (r) => {
      const s = r as Record<string, unknown>;
      if (s[SK_RESULT]) setState({ phase: 'generated', result: s[SK_RESULT] as GenerationResult });
      else if (s[SK_QUICK]) setState({ phase: 'quick-match', result: s[SK_QUICK] as QuickMatchResult });
      else if (s[SK_FIELDS] && s[SK_MATCHES]) {
        setState({
          phase: 'matched',
          fields: s[SK_FIELDS] as readonly FormField[],
          matches: s[SK_MATCHES] as readonly MatchedField[],
          unmatched: [],
        });
      }
    });
  }, []);

  const clearResult = useCallback(() => {
    browser.storage.local.remove([SK_RESULT]);
    setState({ phase: 'idle' });
  }, []);
  const clearQuick = useCallback(() => {
    browser.storage.local.remove([SK_QUICK]);
    setState({ phase: 'idle' });
  }, []);
  const clearReply = useCallback(() => {
    browser.storage.local.remove(['lastReply']);
    setState({ phase: 'idle' });
  }, []);
  const clearMatched = useCallback(() => {
    browser.storage.local.remove([SK_FIELDS, SK_MATCHES]);
    setState({ phase: 'idle' });
  }, []);

  const generate = useCallback((kind: 'summary' | 'coverLetter') => {
    setState({ phase: 'generating', kind });
    browser.runtime.sendMessage(
      { type: 'scrape', kind },
      (r: { success: boolean; data?: unknown; error?: string; details?: string; debug?: string }) => {
        if (browser.runtime.lastError) {
          setState({ phase: 'error', message: browser.runtime.lastError.message ?? 'Unknown runtime error' });
          return;
        }
        if (!r.success || !r.data) {
          setState({ phase: 'error', message: r.error ?? 'Unknown error', details: r.details, debug: r.debug });
          return;
        }
        const result = r.data as GenerationResult;
        browser.storage.local.set({ [SK_RESULT]: result });
        setState({ phase: 'generated', result });
      },
    );
  }, []);

  const quickMatch = useCallback(() => {
    setState({ phase: 'generating', kind: 'summary' });
    browser.runtime.sendMessage(
      { type: 'scrape', quickMatch: true },
      (r: { success: boolean; data?: unknown; error?: string; details?: string; debug?: string }) => {
        if (browser.runtime.lastError) {
          setState({ phase: 'error', message: browser.runtime.lastError.message ?? 'Unknown runtime error' });
          return;
        }
        if (!r.success || !r.data) {
          setState({ phase: 'error', message: r.error ?? 'Unknown error', details: r.details, debug: r.debug });
          return;
        }
        const result = r.data as QuickMatchResult;
        browser.storage.local.set({ [SK_QUICK]: result });
        setState({ phase: 'quick-match', result });
      },
    );
  }, []);

  const craftReply = useCallback(() => {
    if (replyPrompt.trim() === '') return;
    setState({ phase: 'generating', kind: 'summary' });
    browser.runtime.sendMessage(
      { type: 'scrape', reply: true, replyPrompt },
      (r: { success: boolean; data?: unknown; error?: string; details?: string; debug?: string }) => {
        if (browser.runtime.lastError) {
          setState({ phase: 'error', message: browser.runtime.lastError.message ?? 'Unknown runtime error' });
          return;
        }
        if (!r.success || !r.data) {
          setState({ phase: 'error', message: r.error ?? 'Unknown error', details: r.details, debug: r.debug });
          return;
        }
        const result = r.data as ReplyResult;
        browser.storage.local.set({ lastReply: result });
        setState({ phase: 'reply', result });
      },
    );
  }, [replyPrompt]);

  const fillFormOnly = useCallback(() => {
    setState({ phase: 'filling' });
    (async () => {
      try {
        const fr = await new Promise<{ readonly fields: readonly FormField[] }>((res, rej) => {
          browser.runtime.sendMessage(
            { type: 'scrapeFormFields' },
            (r: { fields?: readonly FormField[]; fieldCount?: number; error?: string }) => {
              if (browser.runtime.lastError) {
                rej(new Error(browser.runtime.lastError.message));
                return;
              }
              if (r.fields && r.fields.length > 0) {
                res({ fields: r.fields });
                return;
              }
              rej(new Error(r.error ?? `No form fields found (${r.fieldCount ?? 0})`));
            },
          );
        });
        const fields = fr.fields;

        const mr = await new Promise<{ readonly values: readonly MatchedField[]; readonly unmatched: readonly string[] }>(
          (res, rej) => {
            browser.runtime.sendMessage(
              {
                type: 'backend:matchFormFields',
                payload: {
                  fields: fields.map((f) => ({
                    id: f.id,
                    label: f.label,
                    type: f.type,
                    maxLength: f.maxLength,
                    options: f.options,
                  })),
                  sourceUrl: window.location.href,
                },
              },
              (r: { success: boolean; data?: { values: readonly MatchedField[]; unmatched: readonly string[] }; error?: string }) => {
                if (browser.runtime.lastError) {
                  rej(new Error(browser.runtime.lastError.message));
                  return;
                }
                if (!r.success || !r.data) {
                  rej(new Error(r.error ?? 'Matching failed'));
                  return;
                }
                res(r.data);
              },
            );
          },
        );
        browser.storage.local.set({ [SK_FIELDS]: fields, [SK_MATCHES]: mr.values });
        setState({ phase: 'matched', fields, matches: mr.values, unmatched: mr.unmatched });
      } catch (e: unknown) {
        setState({
          phase: 'error',
          message: e instanceof Error ? e.message : 'Unknown error',
          debug: 'Fill form failed. Check a form is visible on the page.',
        });
      }
    })();
  }, []);

  const inject = useCallback(() => {
    if (state.phase !== 'matched') return;
    browser.runtime.sendMessage(
      {
        type: 'fillFormMatched',
        matches: state.matches.map((m: MatchedField) => ({ fieldId: m.fieldId, value: m.value })),
      },
      () => {},
    );
  }, [state]);

  return (
    <Container>
      <Header />
      <div style={{ padding: '14px 16px 16px' }}>
        {(() => {
          switch (state.phase) {
            case 'idle':
              return (
                <IdlePanel
                  replyPrompt={replyPrompt}
                  onReplyChange={setReplyPrompt}
                  onSummary={() => { generate('summary'); }}
                  onCover={() => { generate('coverLetter'); }}
                  onQuickMatch={quickMatch}
                  onFillOnly={fillFormOnly}
                  onReply={craftReply}
                />
              );
            case 'generating':
              return (
                <Spinner
                  text={
                    state.kind === 'coverLetter'
                      ? 'Writing cover letter...'
                      : 'Analysing job posting...'
                  }
                />
              );
            case 'error':
              return <ErrorPanel state={state} onRetry={() => { setState({ phase: 'idle' }); }} />;
            case 'generated':
              return (
                <GeneratedPanel
                  result={state.result}
                  onRegen={() => { generate(state.result.kind); }}
                  onClear={clearResult}
                />
              );
            case 'quick-match':
              return <QuickMatchPanel result={state.result} onClear={clearQuick} />;
            case 'reply':
              return <ReplyPanel result={state.result} onClear={clearReply} />;
            case 'filling':
              return <Spinner text="Matching form fields..." />;
            case 'matched':
              return (
                <MatchedPanel
                  fields={state.fields}
                  matches={state.matches}
                  unmatched={state.unmatched}
                  onInject={inject}
                  onClear={clearMatched}
                />
              );
            default:
              return <div />;
          }
        })()}
      </div>
    </Container>
  );
}

// ── Idle Panel ────────────────────────────────────────────────────────

interface Preset {
  readonly name: string;
  readonly config: LinkedInSearchConfig;
}

function LinkedInSearchBar(): JSX.Element {
  const [presets, setPresets] = useState<readonly Preset[]>([]);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    browser.storage.local.get(['linkedInSearchPresets'], (result) => {
      const stored = result.linkedInSearchPresets;
      if (Array.isArray(stored)) {
        const typed: Preset[] = stored.filter(
          (p): p is Preset =>
            typeof p === 'object' &&
            p !== null &&
            typeof (p as Preset).name === 'string' &&
            typeof (p as Preset).config === 'object',
        );
        setPresets(typed);
        if (typed.length > 0 && selected === '') {
          setSelected(typed[0]?.name ?? '');
        }
      }
    });
  }, []);

  const handleSearch = useCallback(() => {
    const preset = presets.find((p) => p.name === selected);
    if (preset === undefined) return;

    const url = buildLinkedInSearchUrl(preset.config);
    browser.tabs.create({ url });
  }, [selected, presets]);

  return (
    <div
      style={{
        display: 'flex',
        gap: '6px',
        alignItems: 'center',
        marginBottom: '10px',
        padding: '8px 10px',
        backgroundColor: colors.surface,
        borderRadius: radii.sm,
        border: `1px solid ${colors.border}`,
      }}
    >
      <select
        value={selected}
        onChange={(e) => { setSelected((e.target as HTMLSelectElement).value); }}
        style={{
          flex: 1,
          padding: '6px 8px',
          fontSize: '12px',
          border: `1px solid ${colors.border}`,
          borderRadius: radii.sm,
          backgroundColor: colors.bg,
          color: colors.textPrimary,
          fontFamily: fontFamily,
          outline: 'none',
          minWidth: 0,
        }}
      >
        {presets.length === 0 && <option value="">No saved presets</option>}
        {presets.map((p) => (
          <option key={p.name} value={p.name}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        onClick={handleSearch}
        disabled={selected === ''}
        style={{
          padding: '6px 12px',
          fontSize: '12px',
          fontWeight: 600,
          backgroundColor: selected === '' ? colors.surfaceHover : colors.accent,
          color: selected === '' ? colors.textMuted : colors.textWhite,
          border: 'none',
          borderRadius: radii.sm,
          cursor: selected === '' ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 150ms',
        }}
        title="Search LinkedIn with saved preset"
      >
        🔍 Search LinkedIn
      </button>
    </div>
  );
}

function IdlePanel(p: {
  readonly replyPrompt: string;
  readonly onReplyChange: (v: string) => void;
  readonly onSummary: () => void;
  readonly onCover: () => void;
  readonly onQuickMatch: () => void;
  readonly onFillOnly: () => void;
  readonly onReply: () => void;
}): JSX.Element {
  const neutralBtn: Record<string, string | number> = {
    width: '100%',
    padding: '12px 14px',
    fontSize: '13px',
    fontWeight: 500,
    backgroundColor: colors.surface,
    color: colors.textSecondary,
    border: `1px solid ${colors.border}`,
    borderRadius: radii.sm,
    cursor: 'pointer',
    transition: 'all 150ms',
  };

  const accentBtn: Record<string, string | number> = {
    ...neutralBtn,
    fontWeight: 600,
    backgroundColor: colors.accent,
    color: colors.textWhite,
    border: 'none',
    boxShadow: '0 0 20px rgba(139,109,255,0.25)',
  };

  return (
    <div>
      <LinkedInSearchBar />
      <p style={{ fontSize: '11px', color: colors.textMuted, margin: '0 0 12px' }}>
        Open a job posting, then choose an action:
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        <button
          onClick={p.onSummary}
          style={neutralBtn}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.backgroundColor = colors.surfaceHover;
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.backgroundColor = colors.surface;
          }}
        >
          Summary
        </button>
        <button
          onClick={p.onCover}
          style={neutralBtn}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.backgroundColor = colors.surfaceHover;
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.backgroundColor = colors.surface;
          }}
        >
          Cover Letter
        </button>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={p.onQuickMatch}
          style={{ flex: 1, ...neutralBtn }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.backgroundColor = colors.surfaceHover;
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.backgroundColor = colors.surface;
          }}
        >
          Quick Match
        </button>
        <button
          onClick={p.onFillOnly}
          style={{ flex: 1, ...accentBtn }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.backgroundColor = colors.accentHover;
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.backgroundColor = colors.accent;
          }}
        >
          Fill Form
        </button>
      </div>
      <div
        style={{
          borderTop: `1px solid ${colors.border}`,
          paddingTop: '16px',
          marginTop: '8px',
        }}
      >
        <div
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: colors.textSecondary,
            marginBottom: '10px',
          }}
        >
          Message Reply
        </div>
        <textarea
          value={p.replyPrompt}
          onInput={(e) => { p.onReplyChange((e.target as HTMLTextAreaElement).value); }}
          placeholder={`What should the reply say? (e.g. "I'm interested but my salary expectation is 90k")`}
          style={{
            width: '100%',
            height: '72px',
            padding: '12px 14px',
            fontSize: '12px',
            backgroundColor: colors.surface,
            color: colors.textPrimary,
            border: `1px solid ${colors.border}`,
            borderRadius: '14px',
            resize: 'vertical',
            fontFamily,
            boxSizing: 'border-box' as const,
            lineHeight: 1.5,
            transition: 'border-color 150ms',
            outline: 'none',
          }}
        />
        <button
          onClick={p.onReply}
          disabled={p.replyPrompt.trim() === ''}
          style={{
            ...accentBtn,
            width: '100%',
            marginTop: '10px',
            opacity: p.replyPrompt.trim() === '' ? 0.45 : 1,
            cursor: p.replyPrompt.trim() === '' ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={(e) => {
            if (p.replyPrompt.trim() !== '')
              (e.target as HTMLElement).style.backgroundColor = colors.accentHover;
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.backgroundColor = colors.accent;
          }}
        >
          Craft Reply
        </button>
      </div>
    </div>
  );
}

// ── Result Panels ─────────────────────────────────────────────────────

function GeneratedPanel(p: {
  readonly result: GenerationResult;
  readonly onRegen: () => void;
  readonly onClear: () => void;
}): JSX.Element {
  const r = p.result;
  const isSummary = r.kind === 'summary';
  const text = isSummary ? r.summary : r.coverLetter;
  const headerBg = isSummary ? colors.accentBg : colors.accentBg;
  const headerBd = isSummary ? colors.accentBorder : colors.accentBorder;
  const headerFg = isSummary ? colors.textPrimary : colors.accent;
  const title = isSummary ? 'Professional Summary' : 'Cover Letter';

  return (
    <div>
      <div
        style={{
          padding: '8px 12px',
          backgroundColor: colors.surfaceHover,
          borderRadius: radii.md,
          marginBottom: '10px',
          fontSize: '11px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          border: `1px solid ${colors.border}`,
        }}
      >
        <span style={{ fontWeight: 600, color: colors.textPrimary }}>
          {r.title || 'Job'}
          {r.company ? ` \u00B7 ${r.company}` : ''}
          {r.location ? ` \u00B7 ${r.location}` : ''}
        </span>
        <TokenBadge usage={r.tokenUsage} />
      </div>
      <div
        style={{
          padding: '12px',
          backgroundColor: headerBg,
          borderRadius: radii.md,
          marginBottom: '12px',
          border: `1px solid ${headerBd}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 700, color: headerFg }}>
            {title}
          </span>
          <CopyButton text={text} />
        </div>
        <pre
          style={{
            margin: 0,
            whiteSpace: 'pre-wrap',
            fontFamily: fontFamily,
            fontSize: '12px',
            lineHeight: 1.6,
            color: colors.textPrimary,
            maxHeight: isSummary ? '280px' : '360px',
            overflowY: 'auto',
            wordBreak: 'break-word',
          }}
        >
          {text}
        </pre>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={p.onRegen}
          style={{
            padding: '8px 14px',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor: colors.surface,
            color: colors.accent,
            border: `1px solid ${colors.accentBorder}`,
            borderRadius: radii.sm,
            cursor: 'pointer',
          }}
        >
          Regenerate
        </button>
        <button
          onClick={p.onClear}
          style={{
            padding: '8px 14px',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor: colors.surface,
            color: colors.textMuted,
            border: `1px solid ${colors.border}`,
            borderRadius: radii.sm,
            cursor: 'pointer',
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function QuickMatchPanel(p: { readonly result: QuickMatchResult; readonly onClear: () => void }): JSX.Element {
  const r = p.result;
  const scoreColor = r.score >= 7 ? colors.green : r.score >= 4 ? colors.orange : colors.destructive;
  const scoreBg =
    r.score >= 7 ? colors.greenBg : r.score >= 4 ? colors.orangeBg : colors.destructiveBg;
  const scoreBorder =
    r.score >= 7 ? colors.greenBorder : r.score >= 4 ? '#FED7AA' : colors.destructiveBorder;

  return (
    <div>
      <div
        style={{
          padding: '14px',
          backgroundColor: scoreBg,
          borderRadius: radii.md,
          marginBottom: '12px',
          border: `1px solid ${scoreBorder}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '28px', fontWeight: 800, color: scoreColor, lineHeight: 1 }}>
              {r.score}/10
            </span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: scoreColor }}>
              {r.verdict}
            </span>
          </div>
        </div>
        <ul
          style={{
            margin: '0 0 0 18px',
            padding: 0,
            fontSize: '12px',
            color: colors.textPrimary,
            lineHeight: 1.6,
          }}
        >
          {r.reasons.map((x, i) => (
            <li key={i} style={{ marginBottom: '4px' }}>
              {x}
            </li>
          ))}
        </ul>
        <div style={{ marginTop: '10px' }}>
          <TokenBadge usage={r.tokenUsage} />
        </div>
      </div>
      <button
        onClick={p.onClear}
        style={{
          padding: '8px 14px',
          fontSize: '12px',
          fontWeight: 600,
          backgroundColor: colors.surface,
          color: colors.textMuted,
          border: `1px solid ${colors.border}`,
          borderRadius: radii.sm,
          cursor: 'pointer',
        }}
      >
        Clear
      </button>
    </div>
  );
}

function ReplyPanel(p: { readonly result: ReplyResult; readonly onClear: () => void }): JSX.Element {
  return (
    <div>
      <div
        style={{
          padding: '12px',
          backgroundColor: colors.accentBg,
          borderRadius: radii.md,
          marginBottom: '12px',
          border: `1px solid ${colors.accentBorder}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 700, color: colors.accent }}>
            AI Reply
          </span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <TokenBadge usage={p.result.tokenUsage} />
            <CopyButton text={p.result.reply} />
          </div>
        </div>
        <pre
          style={{
            margin: 0,
            whiteSpace: 'pre-wrap',
            fontFamily: fontFamily,
            fontSize: '12px',
            lineHeight: 1.6,
            color: colors.textPrimary,
            maxHeight: '200px',
            overflowY: 'auto',
            wordBreak: 'break-word',
          }}
        >
          {p.result.reply}
        </pre>
      </div>
      <button
        onClick={p.onClear}
        style={{
          padding: '8px 14px',
          fontSize: '12px',
          fontWeight: 600,
          backgroundColor: colors.surface,
          color: colors.textMuted,
          border: `1px solid ${colors.border}`,
          borderRadius: radii.sm,
          cursor: 'pointer',
        }}
      >
        Clear
      </button>
    </div>
  );
}

function MatchedPanel(p: {
  readonly fields: readonly FormField[];
  readonly matches: readonly MatchedField[];
  readonly unmatched: readonly string[];
  readonly onInject: () => void;
  readonly onClear: () => void;
}): JSX.Element {
  const [inj, setInj] = useState(false);
  const fl: Record<string, string> = {};
  for (const f of p.fields) fl[f.id] = f.label;

  return (
    <div>
      <div
        style={{
          padding: '10px 12px',
          backgroundColor: colors.greenBg,
          borderRadius: radii.md,
          marginBottom: '10px',
          fontSize: '12px',
          fontWeight: 600,
          color: colors.green,
          border: `1px solid ${colors.greenBorder}`,
        }}
      >
        {p.matches.length} fields matched &middot; {p.unmatched.length} need manual input
      </div>
      <div style={{ marginBottom: '12px' }}>
        {p.matches.map((m, i) => {
          const label = fl[m.fieldId] ?? m.fieldId;
          const confColor = m.confidence > 0.7 ? colors.green : m.confidence > 0.4 ? colors.orange : colors.destructive;
          const confBg = m.confidence > 0.7 ? colors.greenBg : m.confidence > 0.4 ? colors.orangeBg : colors.destructiveBg;

          return (
            <div
              key={i}
              style={{
                padding: '8px 10px',
                border: `1px solid ${colors.border}`,
                borderRadius: radii.sm,
                marginBottom: '6px',
                fontSize: '11px',
                backgroundColor: colors.surface,
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  color: colors.textPrimary,
                  marginBottom: '3px',
                  fontSize: '12px',
                }}
              >
                {label}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: colors.textSecondary }}>
                  {m.value.length > 60 ? `${m.value.slice(0, 60)}\u2026` : m.value}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: confColor,
                    backgroundColor: confBg,
                    padding: '1px 6px',
                    borderRadius: '99px',
                  }}
                >
                  {Math.round(m.confidence * 100)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {p.unmatched.length > 0 && (
        <p
          style={{
            fontSize: '11px',
            color: colors.destructive,
            marginBottom: '10px',
            fontWeight: 500,
          }}
        >
          Needs manual input: {p.unmatched.map((id) => fl[id] ?? id).join(', ')}
        </p>
      )}
      <div style={{ display: 'flex', gap: '8px' }}>
        {!inj ? (
          <button
            onClick={() => {
              p.onInject();
              setInj(true);
            }}
            style={{
              flex: 1,
              padding: '10px',
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: colors.green,
              color: colors.textWhite,
              border: 'none',
              borderRadius: radii.sm,
              cursor: 'pointer',
              transition: 'all 150ms',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.backgroundColor = colors.green;
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.backgroundColor = colors.green;
            }}
          >
            Inject into Form
          </button>
        ) : (
          <div
            style={{
              flex: 1,
              padding: '10px',
              textAlign: 'center',
              backgroundColor: colors.greenBg,
              borderRadius: radii.sm,
              fontSize: '12px',
              fontWeight: 600,
              color: colors.green,
              border: `1px solid ${colors.greenBorder}`,
            }}
          >
            Injected &mdash; review &#38; submit manually
          </div>
        )}
        <button
          onClick={p.onClear}
          style={{
            padding: '8px 14px',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor: colors.surface,
            color: colors.textMuted,
            border: `1px solid ${colors.border}`,
            borderRadius: radii.sm,
            cursor: 'pointer',
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

render(<App />, document.getElementById('app')!);