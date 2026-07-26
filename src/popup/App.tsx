import { render } from 'preact';
import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { colors, fontFamily } from './theme';
import { CopilotView } from './views/CopilotView';
import { PresetsView } from './views/PresetsView';
import { SettingsView } from './views/SettingsView';

// ── Types ────────────────────────────────────────────────────────────

export type ViewKey = 'copilot' | 'presets' | 'settings';

const TABS: readonly { readonly key: ViewKey; readonly label: string; readonly icon: string }[] = [
  { key: 'copilot', label: 'Copilot', icon: '✦' },
  { key: 'presets', label: 'Presets', icon: '◐' },
  { key: 'settings', label: 'Settings', icon: '⚙' },
];

// ── Shell Components ─────────────────────────────────────────────────

function Container(p: { readonly children: preact.ComponentChildren }): JSX.Element {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        fontFamily,
        fontSize: '13px',
        lineHeight: 1.5,
        color: colors.textPrimary,
        backgroundColor: colors.bg,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {p.children}
    </div>
  );
}

function ShellHeader(): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 14px',
        backgroundColor: colors.card,
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <img
        src="assets/logo.png"
        alt="AI Job Copilot"
        style={{ width: '20px', height: '20px', flexShrink: 0 }}
      />
      <span
        style={{
          fontWeight: 600,
          fontSize: '12px',
          color: colors.textSecondary,
          letterSpacing: '-0.01em',
        }}
      >
        AI Job Copilot
      </span>
    </div>
  );
}

function TabBar(p: {
  readonly active: ViewKey;
  readonly onChange: (key: ViewKey) => void;
}): JSX.Element {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        backgroundColor: colors.card,
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      {TABS.map((t) => {
        const isActive = t.key === p.active;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => { p.onChange(t.key); }}
            style={{
              flex: 1,
              padding: '9px 0',
              fontSize: '12px',
              fontWeight: isActive ? 600 : 500,
              color: isActive ? colors.accent : colors.textMuted,
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: isActive ? `2px solid ${colors.accent}` : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 150ms',
              marginBottom: isActive ? '-1px' : '0',
              fontFamily,
            }}
          >
            <span style={{ marginRight: '4px' }}>{t.icon}</span>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ── App Shell ────────────────────────────────────────────────────────

export function App(): JSX.Element {
  const [view, setView] = useState<ViewKey>('copilot');

  return (
    <Container>
      <ShellHeader />
      <TabBar active={view} onChange={setView} />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '14px 16px 16px',
        }}
      >
        {view === 'copilot' && <CopilotView onNavigate={setView} />}
        {view === 'presets' && <PresetsView />}
        {view === 'settings' && <SettingsView />}
      </div>
    </Container>
  );
}

render(<App />, document.getElementById('app')!);
