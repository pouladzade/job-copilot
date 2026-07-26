import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { colors, radii, fontFamily } from '../theme';
import {
  LLM_DEFAULTS,
  PROFILE_DEFAULTS,
  PROFILE_FIELDS,
  PROMPT_SLOTS,
  type LlmConfig,
  type ProfileData,
} from '../../utils/settings-schema';

// ── Shared Style Factories ──────────────────────────────────────────

const labelStyle = {
  fontSize: '10px',
  fontWeight: 600,
  color: colors.textMuted,
  marginBottom: '4px',
  display: 'block',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
};

const inputStyle = {
  width: '100%',
  padding: '7px 10px',
  fontSize: '12px',
  border: `1px solid ${colors.border}`,
  borderRadius: radii.sm,
  backgroundColor: colors.surface,
  color: colors.textPrimary,
  fontFamily,
  boxSizing: 'border-box' as const,
  outline: 'none',
  transition: 'border-color 150ms',
};

// ── Field Row ───────────────────────────────────────────────────────

function Field(p: {
  readonly label: string;
  readonly value: string;
  readonly type: 'text' | 'number' | 'password';
  readonly placeholder?: string;
  readonly onChange: (v: string) => void;
}): JSX.Element {
  return (
    <div style={{ marginBottom: '8px' }}>
      <label style={labelStyle}>{p.label}</label>
      <input
        type={p.type}
        value={p.value}
        placeholder={p.placeholder ?? ''}
        onInput={(e) => {
          p.onChange((e.target as HTMLInputElement).value);
        }}
        style={inputStyle}
      />
    </div>
  );
}

// ── Settings View ───────────────────────────────────────────────────

type SettingsTab = 'ai' | 'profile' | 'prompts';

const SETTINGS_TABS: readonly { readonly key: SettingsTab; readonly label: string }[] = [
  { key: 'ai', label: 'AI' },
  { key: 'profile', label: 'Profile' },
  { key: 'prompts', label: 'Prompts' },
];

export function SettingsView(): JSX.Element {
  const [profile, setProfile] = useState<ProfileData>(PROFILE_DEFAULTS);
  const [llm, setLlm] = useState<LlmConfig>(LLM_DEFAULTS);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [parseStatus, setParseStatus] = useState<'idle' | 'parsing' | 'success' | 'error'>('idle');
  const [parseError, setParseError] = useState('');
  const [tab, setTab] = useState<SettingsTab>('ai');

  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    browser.storage.local.get(['profile', 'llmConfig'], (r) => {
      const s = r as Record<string, unknown>;
      if (s.profile && typeof s.profile === 'object' && s.profile !== null) {
        setProfile({ ...PROFILE_DEFAULTS, ...(s.profile as Partial<ProfileData>) });
      }
      if (s.llmConfig && typeof s.llmConfig === 'object' && s.llmConfig !== null) {
        setLlm({ ...LLM_DEFAULTS, ...(s.llmConfig as Partial<LlmConfig>) });
      }
    });
  }, []);

  const showSavedStatus = useCallback(() => {
    setSaveStatus('saved');
    if (statusTimerRef.current !== null) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => {
      setSaveStatus('idle');
    }, 2000);
  }, []);

  const persist = useCallback(
    (nextProfile: ProfileData, nextLlm: LlmConfig) => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
      setSaveStatus('saving');
      debounceRef.current = setTimeout(() => {
        browser.storage.local.set({ profile: nextProfile, llmConfig: nextLlm }, () => {
          showSavedStatus();
        });
      }, 300);
    },
    [showSavedStatus],
  );

  const updateProfile = useCallback(
    (k: keyof ProfileData, v: string) => {
      setProfile((p) => {
        const next = { ...p, [k]: k === 'yearsOfExperience' ? (parseInt(v, 10) || 0) : v };
        persist(next, llm);
        return next;
      });
    },
    [llm, persist],
  );

  const updateLlm = useCallback(
    (k: keyof LlmConfig, v: string) => {
      setLlm((l) => {
        const next = { ...l, [k]: v };
        persist(profile, next);
        return next;
      });
    },
    [profile, persist],
  );

  const parseResume = useCallback(() => {
    setParseStatus('parsing');
    setParseError('');
    browser.runtime.sendMessage(
      { type: 'backend:parseResume' },
      (
        r: {
          success: boolean;
          data?: { profile: Partial<ProfileData> };
          error?: string;
        },
      ) => {
        if (!r.success || !r.data) {
          setParseStatus('error');
          setParseError(r.error ?? 'Parsing failed');
          return;
        }
        const pp = r.data.profile;
        setProfile((current) => {
          const next = { ...current };
          for (const f of PROFILE_FIELDS) {
            const val = pp[f.key];
            if (val === undefined || val === null || val === '') continue;
            if (f.type === 'number' && typeof val === 'number') {
              (next as Record<string, unknown>)[f.key] = val;
            } else if (typeof val === 'string') {
              (next as Record<string, unknown>)[f.key] = val;
            }
          }
          persist(next, llm);
          return next;
        });
        setParseStatus('success');
        setTimeout(() => {
          setParseStatus('idle');
          setParseError('');
        }, 3500);
      },
    );
  }, [llm, persist]);

  const statusText = (() => {
    switch (saveStatus) {
      case 'saving':
        return 'Saving…';
      case 'saved':
        return '✓ Saved';
      default:
        return '';
    }
  })();

  return (
    <div>
      {/* ── Header row ─────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '11px',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontWeight: 600,
          }}
        >
          Settings
        </p>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: saveStatus === 'saved' ? colors.green : colors.textMuted,
            transition: 'opacity 200ms',
            opacity: saveStatus === 'idle' ? 0 : 1,
          }}
        >
          {statusText}
        </span>
      </div>

      {/* ── Sub-tab bar ────────────────────────────────────────── */}
      <div
        role="tablist"
        style={{
          display: 'flex',
          backgroundColor: colors.card,
          border: `1px solid ${colors.border}`,
          borderRadius: radii.sm,
          padding: '2px',
          marginBottom: '14px',
        }}
      >
        {SETTINGS_TABS.map((t) => {
          const isActive = t.key === tab;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setTab(t.key);
              }}
              style={{
                flex: 1,
                padding: '6px 0',
                fontSize: '11px',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? colors.textPrimary : colors.textMuted,
                backgroundColor: isActive ? colors.accent : 'transparent',
                border: 'none',
                borderRadius: radii.xs,
                cursor: 'pointer',
                transition: 'all 150ms',
                fontFamily,
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.target as HTMLElement).style.color = colors.textSecondary;
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.target as HTMLElement).style.color = colors.textMuted;
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab: AI ────────────────────────────────────────────── */}
      {tab === 'ai' && (
        <div>
          <p
            style={{
              margin: '0 0 10px',
              fontSize: '11px',
              color: colors.textSecondary,
              lineHeight: 1.5,
            }}
          >
            Configure your LLM provider. You only need to set this once.
          </p>
          <Field
            label="API URL"
            value={llm.apiUrl}
            type="text"
            placeholder="https://api.deepseek.com"
            onChange={(v) => {
              updateLlm('apiUrl', v);
            }}
          />
          <Field
            label="API Key"
            value={llm.apiKey}
            type="password"
            placeholder="sk-..."
            onChange={(v) => {
              updateLlm('apiKey', v);
            }}
          />
          <Field
            label="Model"
            value={llm.model}
            type="text"
            placeholder="deepseek-chat"
            onChange={(v) => {
              updateLlm('model', v);
            }}
          />
        </div>
      )}

      {/* ── Tab: Profile ───────────────────────────────────────── */}
      {tab === 'profile' && (
        <div>
          <p
            style={{
              margin: '0 0 10px',
              fontSize: '11px',
              color: colors.textSecondary,
              lineHeight: 1.5,
            }}
          >
            Paste your resume, then auto-fill the fields below.
          </p>

          <label style={labelStyle}>Resume (Markdown)</label>
          <textarea
            value={llm.resume}
            onInput={(e) => {
              updateLlm('resume', (e.target as HTMLTextAreaElement).value);
            }}
            placeholder="Paste your full resume in markdown here…"
            style={{
              ...inputStyle,
              height: '110px',
              resize: 'vertical' as const,
              fontFamily: '"JetBrains Mono", monospace',
              marginBottom: '8px',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <button
              onClick={parseResume}
              disabled={parseStatus === 'parsing'}
              style={{
                padding: '5px 12px',
                fontSize: '11px',
                fontWeight: 600,
                backgroundColor: parseStatus === 'parsing' ? colors.accentHover : colors.accent,
                color: colors.textWhite,
                border: 'none',
                borderRadius: radii.xs,
                cursor: parseStatus === 'parsing' ? 'not-allowed' : 'pointer',
              }}
            >
              {parseStatus === 'parsing' ? 'Parsing…' : 'Auto-fill Profile'}
            </button>
            {parseStatus === 'success' && (
              <span style={{ fontSize: '11px', color: colors.green, fontWeight: 600 }}>
                Profile filled
              </span>
            )}
            {parseStatus === 'error' && (
              <span style={{ fontSize: '11px', color: colors.destructive }}>{parseError}</span>
            )}
          </div>

          <label style={{ ...labelStyle, marginTop: '4px' }}>Profile Fields</label>
          {PROFILE_FIELDS.map((f) => (
            <Field
              key={f.key}
              label={f.label}
              value={String(profile[f.key])}
              type={f.type}
              placeholder={f.placeholder}
              onChange={(v) => {
                updateProfile(f.key, v);
              }}
            />
          ))}
        </div>
      )}

      {/* ── Tab: Prompts ──────────────────────────────────────── */}
      {tab === 'prompts' && (
        <div>
          <p
            style={{
              margin: '0 0 10px',
              fontSize: '11px',
              color: colors.textSecondary,
              lineHeight: 1.5,
            }}
          >
            Add short guidance per template. Base prompts are locked to keep the JSON output
            structure stable.
          </p>
          {PROMPT_SLOTS.map((slot) => (
            <div key={slot.key} style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>{slot.label}</label>
              <p
                style={{
                  margin: '0 0 4px',
                  fontSize: '10px',
                  color: colors.textMuted,
                  lineHeight: 1.4,
                }}
              >
                {slot.description}
              </p>
              <textarea
                value={llm[slot.key]}
                onInput={(e) => {
                  updateLlm(slot.key, (e.target as HTMLTextAreaElement).value);
                }}
                placeholder="Optional: tone, emphasis, things to avoid…"
                style={{
                  ...inputStyle,
                  height: '52px',
                  resize: 'vertical' as const,
                  fontFamily: '"JetBrains Mono", monospace',
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}