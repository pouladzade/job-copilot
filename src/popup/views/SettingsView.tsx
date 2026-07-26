import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { colors, radii, fontFamily } from '../theme';
import {
  LLM_DEFAULTS,
  PROFILE_DEFAULTS,
  PROFILE_FIELDS,
  PROMPT_SLOTS,
  createResumeEntry,
  type LlmConfig,
  type ProfileData,
  type ResumeEntry,
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

const smallBtn = (bg: string, fg: string, bd?: string): Record<string, string | number> => ({
  padding: '5px 10px',
  fontSize: '11px',
  fontWeight: 600,
  backgroundColor: bg,
  color: fg,
  border: bd ? `1px solid ${bd}` : 'none',
  borderRadius: radii.xs,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
});

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

// ── Unsaved Changes Dialog ──────────────────────────────────────────

function UnsavedDialog(p: {
  readonly onStay: () => void;
  readonly onDiscard: () => void;
}): JSX.Element {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: colors.bg,
          border: `1px solid ${colors.border}`,
          borderRadius: radii.md,
          padding: '16px',
          width: '100%',
          maxWidth: '280px',
        }}
      >
        <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 600, color: colors.textPrimary }}>
          Unsaved Changes
        </p>
        <p style={{ margin: '0 0 16px', fontSize: '12px', color: colors.textSecondary, lineHeight: 1.5 }}>
          You have unsaved changes. Save before leaving or discard them.
        </p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={p.onStay}
            style={smallBtn(colors.surface, colors.textSecondary, colors.border)}
          >
            Stay
          </button>
          <button
            onClick={p.onDiscard}
            style={smallBtn(colors.destructiveBg, colors.destructive, colors.destructiveBorder)}
          >
            Discard
          </button>
        </div>
      </div>
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
  // Stored (saved) state
  const [savedLlm, setSavedLlm] = useState<LlmConfig>(LLM_DEFAULTS);
  const [savedResumes, setSavedResumes] = useState<readonly ResumeEntry[]>([]);
  const [savedActiveId, setSavedActiveId] = useState('');

  // Local (dirty) state
  const [llm, setLlm] = useState<LlmConfig>(LLM_DEFAULTS);
  const [resumes, setResumes] = useState<readonly ResumeEntry[]>([]);
  const [activeResumeId, setActiveResumeId] = useState('');
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [resumeName, setResumeName] = useState('');
  const [resumeContent, setResumeContent] = useState('');
  const [resumeProfile, setResumeProfile] = useState<ProfileData>(PROFILE_DEFAULTS);

  const [tab, setTab] = useState<SettingsTab>('ai');
  const [pendingTab, setPendingTab] = useState<SettingsTab | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [parseStatus, setParseStatus] = useState<'idle' | 'parsing' | 'success' | 'error'>('idle');
  const [parseError, setParseError] = useState('');

  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from storage once
  useEffect(() => {
    browser.storage.local.get(['llmConfig'], (r) => {
      const s = r as Record<string, unknown>;
      if (s.llmConfig && typeof s.llmConfig === 'object' && s.llmConfig !== null) {
        const cfg = { ...LLM_DEFAULTS, ...(s.llmConfig as Partial<LlmConfig>) };
        setSavedLlm(cfg);
        setSavedResumes(cfg.resumes);
        setSavedActiveId(cfg.activeResumeId);
        setLlm(cfg);
        setResumes(cfg.resumes);
        setActiveResumeId(cfg.activeResumeId);
        const active = cfg.resumes.find((e) => e.id === cfg.activeResumeId) ?? cfg.resumes[0];
        if (active) {
          setSelectedResumeId(active.id);
          setResumeName(active.name);
          setResumeContent(active.content);
          setResumeProfile(active.profile);
        }
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

  const save = useCallback(() => {
    const nextLlm: LlmConfig = {
      ...llm,
      resumes,
      activeResumeId,
    };
    browser.storage.local.set({ llmConfig: nextLlm }, () => {
      setSavedLlm(nextLlm);
      setSavedResumes(resumes);
      setSavedActiveId(activeResumeId);
      showSavedStatus();
    });
  }, [llm, resumes, activeResumeId, showSavedStatus]);

  // ── Dirty detection ──
  const isDirty = (() => {
    if (llm.apiUrl !== savedLlm.apiUrl) return true;
    if (llm.apiKey !== savedLlm.apiKey) return true;
    if (llm.model !== savedLlm.model) return true;
    if (activeResumeId !== savedActiveId) return true;
    if (resumes.length !== savedResumes.length) return true;
    for (let i = 0; i < resumes.length; i++) {
      const r = resumes[i];
      const s = savedResumes[i];
      if (r === undefined) continue;
      if (!s || r.id !== s.id || r.name !== s.name || r.content !== s.content) return true;
      const rp = r.profile;
      const sp = s.profile;
      for (const f of PROFILE_FIELDS) {
        const rk = rp[f.key];
        const sk = sp[f.key];
        if (rk !== sk) return true;
      }
    }
    for (const slot of PROMPT_SLOTS) {
      if (llm[slot.key] !== savedLlm[slot.key]) return true;
    }
    return false;
  })();

  // ── LLM tab helpers ──
  const updateLlm = useCallback((k: keyof LlmConfig, v: string) => {
    setLlm((l) => ({ ...l, [k]: v }));
  }, []);

  // ── Resume helpers ──
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
    setResumes((prev) =>
      prev.map((r) => (r.id === selectedResumeId ? { ...r, name, updatedAt: Date.now() } : r)),
    );
  }, [selectedResumeId]);

  const updateResumeContent = useCallback((content: string) => {
    setResumeContent(content);
    setResumes((prev) =>
      prev.map((r) => (r.id === selectedResumeId ? { ...r, content, updatedAt: Date.now() } : r)),
    );
  }, [selectedResumeId]);

  const updateResumeProfile = useCallback((k: keyof ProfileData, v: string | number) => {
    setResumeProfile((p) => {
      const next = { ...p, [k]: v };
      setResumes((prev) =>
        prev.map((r) => (r.id === selectedResumeId ? { ...r, profile: next, updatedAt: Date.now() } : r)),
      );
      return next;
    });
  }, [selectedResumeId]);

  const addResume = useCallback(() => {
    const entry = createResumeEntry('New Resume', '', PROFILE_DEFAULTS);
    setResumes((prev) => {
      const next = [...prev, entry];
      return next;
    });
    setSelectedResumeId(entry.id);
    setResumeName(entry.name);
    setResumeContent('');
    setResumeProfile(PROFILE_DEFAULTS);
    setActiveResumeId(entry.id);
  }, []);

  const deleteResume = useCallback(() => {
    if (resumes.length <= 1) return;
    setResumes((prev) => {
      const next = prev.filter((r) => r.id !== selectedResumeId);
      const nextActive = next[0]?.id ?? '';
      setActiveResumeId(nextActive);
      const fallback = next[0];
      if (fallback) {
        setSelectedResumeId(fallback.id);
        setResumeName(fallback.name);
        setResumeContent(fallback.content);
        setResumeProfile(fallback.profile);
      }
      return next;
    });
  }, [resumes.length, selectedResumeId]);

  const setAsDefault = useCallback(() => {
    setActiveResumeId(selectedResumeId);
  }, [selectedResumeId]);

  const parseResume = useCallback(() => {
    if (!resumeContent.trim()) {
      setParseStatus('error');
      setParseError('Paste a resume first');
      return;
    }
    setParseStatus('parsing');
    setParseError('');
    browser.storage.local.get(['llmConfig'], (r) => {
      const cfg = (r as Record<string, unknown>).llmConfig as Record<string, unknown>;
      const originalActive = typeof cfg.activeResumeId === 'string' ? cfg.activeResumeId : '';
      browser.storage.local.set({ llmConfig: { ...cfg, activeResumeId: selectedResumeId } }, () => {
        browser.runtime.sendMessage(
          { type: 'backend:parseResume' },
          (res: { success: boolean; data?: { profile: Partial<ProfileData> }; error?: string }) => {
            browser.storage.local.set({ llmConfig: { ...cfg, activeResumeId: originalActive } });
            if (!res.success || !res.data) {
              setParseStatus('error');
              setParseError(res.error ?? 'Parsing failed');
              return;
            }
            const pp = res.data.profile;
            setResumeProfile((current) => {
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
              setResumes((prev) =>
                prev.map((r) => (r.id === selectedResumeId ? { ...r, profile: next, updatedAt: Date.now() } : r)),
              );
              return next;
            });
            setParseStatus('success');
            setTimeout(() => { setParseStatus('idle'); setParseError(''); }, 4000);
          },
        );
      });
    });
  }, [resumeContent, selectedResumeId]);

  const attemptTabChange = useCallback((next: SettingsTab) => {
    if (isDirty) {
      setPendingTab(next);
      return;
    }
    setTab(next);
  }, [isDirty]);

  return (
    <div>
      {pendingTab !== null && (
        <UnsavedDialog
          onStay={() => { setPendingTab(null); }}
          onDiscard={() => {
            setPendingTab(null);
            if (pendingTab !== null) setTab(pendingTab);
          }}
        />
      )}

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => { browser.runtime.openOptionsPage(); }}
            style={{
              padding: '4px 10px',
              fontSize: '10px',
              fontWeight: 600,
              backgroundColor: colors.surface,
              color: colors.accent,
              border: `1px solid ${colors.accentBorder}`,
              borderRadius: radii.xs,
              cursor: 'pointer',
            }}
          >
            Open Options →
          </button>
          <button
            onClick={save}
            disabled={!isDirty}
            style={{
              padding: '4px 12px',
              fontSize: '10px',
              fontWeight: 600,
              backgroundColor: isDirty ? colors.accent : colors.surfaceHover,
              color: isDirty ? colors.textWhite : colors.textMuted,
              border: 'none',
              borderRadius: radii.xs,
              cursor: isDirty ? 'pointer' : 'not-allowed',
              transition: 'all 150ms',
            }}
          >
            {saveStatus === 'saved' ? '✓ Saved' : 'Save'}
          </button>
        </div>
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
              onClick={() => { attemptTabChange(t.key); }}
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
            Configure your LLM provider.
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
            Manage resumes and profile fields.
          </p>

          {/* Resume selector row */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
            <select
              value={selectedResumeId}
              onChange={(e) => { switchResume((e.target as HTMLSelectElement).value); }}
              style={{ ...inputStyle, width: 'auto', minWidth: '140px', padding: '6px 8px', fontSize: '11px' }}
            >
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}{r.id === activeResumeId ? ' ★' : ''}
                </option>
              ))}
            </select>
            <button onClick={addResume} style={smallBtn(colors.accent, colors.textWhite)}>
              + New
            </button>
            {resumes.length > 1 && (
              <button onClick={deleteResume} style={smallBtn(colors.surface, colors.destructive, colors.destructiveBorder)}>
                Delete
              </button>
            )}
            {selectedResumeId !== activeResumeId && (
              <button onClick={setAsDefault} style={smallBtn(colors.greenBg, colors.green, colors.greenBorder)}>
                Default
              </button>
            )}
          </div>

          {/* Resume name */}
          <div style={{ marginBottom: '8px' }}>
            <label style={labelStyle}>Resume Name</label>
            <input
              type="text"
              value={resumeName}
              onInput={(e) => { updateResumeName((e.target as HTMLInputElement).value); }}
              placeholder="Backend Engineer"
              style={inputStyle}
            />
          </div>

          {/* Resume content */}
          <label style={labelStyle}>Resume (Markdown)</label>
          <textarea
            value={resumeContent}
            onInput={(e) => { updateResumeContent((e.target as HTMLTextAreaElement).value); }}
            placeholder="Paste your full resume in markdown here..."
            style={{
              ...inputStyle,
              height: '90px',
              resize: 'vertical' as const,
              fontFamily: '"JetBrains Mono", monospace',
              marginBottom: '6px',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <button
              onClick={parseResume}
              disabled={parseStatus === 'parsing'}
              style={{
                ...smallBtn(parseStatus === 'parsing' ? colors.accentHover : colors.accent, colors.textWhite),
                opacity: parseStatus === 'parsing' ? 0.7 : 1,
                cursor: parseStatus === 'parsing' ? 'not-allowed' : 'pointer',
              }}
            >
              {parseStatus === 'parsing' ? 'Parsing…' : 'Auto-fill Profile'}
            </button>
            {parseStatus === 'success' && (
              <span style={{ fontSize: '11px', color: colors.green, fontWeight: 600 }}>Profile filled</span>
            )}
            {parseStatus === 'error' && (
              <span style={{ fontSize: '11px', color: colors.destructive }}>{parseError}</span>
            )}
          </div>

          {/* Profile fields */}
          <label style={{ ...labelStyle, marginTop: '4px' }}>Profile Fields</label>
          {PROFILE_FIELDS.map((f) => {
            const v = resumeProfile[f.key];
            const str = typeof v === 'number' ? String(v) : v;
            return (
              <div key={f.key} style={{ marginBottom: '6px' }}>
                <label style={{ ...labelStyle, fontSize: '9px', marginBottom: '2px' }}>{f.label}</label>
                <input
                  type={typeof v === 'number' ? 'number' : 'text'}
                  value={str}
                  onInput={(e) => {
                    const raw = (e.target as HTMLInputElement).value;
                    if (typeof v === 'number') updateResumeProfile(f.key, raw === '' ? 0 : (parseInt(raw, 10) || 0));
                    else updateResumeProfile(f.key, raw);
                  }}
                  placeholder={f.placeholder ?? ''}
                  style={{ ...inputStyle, padding: '5px 8px', fontSize: '11px' }}
                />
              </div>
            );
          })}
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
                value={llm[slot.key] as string}
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