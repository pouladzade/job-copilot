// ── Studio Light — Options Page Theme ─────────────────────────────
// A refined light aesthetic for the full-page settings UI.
// Cool lavender-gray background, white cards, single indigo accent.
// No gradients. No glow effects. Clean and professional.

export const colors = {
  // ── Background hierarchy ──
  bg: '#F2F1F4',
  card: '#FFFFFF',
  surface: '#FAF9FC',
  surfaceHover: '#EEEDF1',

  // ── Accent (indigo — the single signature color) ──
  accent: '#4F46E5',
  accentHover: '#4338CA',
  accentBg: 'rgba(79,70,229,0.06)',
  accentBorder: 'rgba(79,70,229,0.18)',

  // ── Semantic ──
  green: '#16A34A',
  greenBg: 'rgba(22,163,74,0.06)',
  greenBorder: 'rgba(22,163,74,0.18)',
  destructive: '#DC2626',
  destructiveBg: 'rgba(220,38,38,0.05)',
  destructiveBorder: 'rgba(220,38,38,0.15)',
  orange: '#D97706',
  orangeBg: 'rgba(217,119,6,0.06)',

  // ── Borders ──
  border: 'rgba(0,0,0,0.05)',
  borderFocus: 'rgba(79,70,229,0.28)',

  // ── Text ──
  textPrimary: '#13131A',
  textSecondary: '#5E5D6E',
  textMuted: '#9D9CA8',
  textWhite: '#FFFFFF',
} as const;

export const radii = {
  xs: '6px',
  sm: '8px',
  md: '12px',
  lg: '16px',
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(0,0,0,0.04)',
  md: '0 2px 8px rgba(0,0,0,0.06)',
} as const;

export const fontFamily = '"Inter",system-ui,-apple-system,sans-serif' as const;
export const monoFont = '"JetBrains Mono",monospace' as const;

// ── Shared Style Factories ───────────────────────────────────────────

export const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  fontSize: '14px',
  border: `1px solid ${colors.border}`,
  borderRadius: radii.sm,
  boxSizing: 'border-box' as const,
  fontFamily,
  outline: 'none',
  transition: 'border-color 150ms, box-shadow 150ms',
  backgroundColor: colors.card,
  color: colors.textPrimary,
} as const;

export const selectStyle = {
  ...inputStyle,
  padding: '10px 12px',
} as const;

export const fieldLabel = {
  fontSize: '13px',
  fontWeight: 600,
  color: colors.textSecondary,
  marginBottom: '6px',
  display: 'block',
} as const;

export const sectionTitle = {
  fontSize: '12px',
  fontWeight: 600,
  color: colors.textMuted,
  marginBottom: '10px',
  marginTop: '22px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
} as const;

export const btnPrimary = {
  width: '100%',
  padding: '12px 20px',
  fontSize: '14px',
  fontWeight: 600,
  backgroundColor: colors.accent,
  color: colors.textWhite,
  border: 'none',
  borderRadius: radii.sm,
  cursor: 'pointer',
  transition: 'all 150ms',
} as const;

export const btnSecondary = {
  padding: '8px 16px',
  fontSize: '12px',
  fontWeight: 600,
  backgroundColor: colors.card,
  color: colors.textSecondary,
  border: `1px solid ${colors.border}`,
  borderRadius: radii.sm,
  cursor: 'pointer',
  transition: 'all 150ms',
} as const;

export const btnDestructive = {
  padding: '8px 16px',
  fontSize: '12px',
  fontWeight: 600,
  backgroundColor: colors.card,
  color: colors.destructive,
  border: `1px solid ${colors.destructiveBorder}`,
  borderRadius: radii.sm,
  cursor: 'pointer',
  transition: 'all 150ms',
} as const;

export const chip = (active: boolean): Record<string, string> => ({
  padding: '6px 14px',
  fontSize: '12px',
  fontWeight: '500',
  border: `1px solid ${active ? colors.accentBorder : colors.border}`,
  borderRadius: radii.xs,
  cursor: 'pointer',
  backgroundColor: active ? colors.accentBg : colors.card,
  color: active ? colors.accent : colors.textSecondary,
  transition: 'all 120ms',
  userSelect: 'none',
});

export const tabBar = {
  display: 'flex',
  gap: '0',
  marginBottom: '28px',
  borderBottom: `1px solid ${colors.border}`,
  paddingBottom: '0',
} as const;

export const tabBtn = (active: boolean): Record<string, string | number> => ({
  padding: '10px 20px',
  fontSize: '13px',
  fontWeight: active ? 600 : 400,
  color: active ? colors.accent : colors.textMuted,
  backgroundColor: 'transparent',
  border: 'none',
  borderBottom: active ? `2px solid ${colors.accent}` : '2px solid transparent',
  borderRadius: '0',
  cursor: 'pointer',
  transition: 'all 150ms',
  marginBottom: '-1px',
});

export const cardBox = {
  backgroundColor: colors.card,
  borderRadius: radii.md,
  border: `1px solid ${colors.border}`,
  padding: '20px',
  boxShadow: shadows.sm,
} as const;
