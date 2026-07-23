// ── Shared Design Tokens ───────────────────────────────────────────
// Dark luxury aesthetic: deep indigo/graphite with soft purple accents.
// Inspired by Linear + Arc Browser with subtle cyberpunk lighting.

export const colors = {
  // ── Background hierarchy ──
  bg: '#171627',
  card: '#22203B',
  surface: '#2B2948',
  surfaceHover: '#35325A',

  // ── Accent (purple — used sparingly for active/focus/glow) ──
  accent: '#8B6DFF',
  accentHover: '#9A80FF',
  accentBg: 'rgba(139,109,255,0.12)',
  accentBorder: 'rgba(139,109,255,0.25)',
  accentGlow: '0 0 20px rgba(139,109,255,0.25)',

  // ── Semantic ──
  green: '#40A860',
  greenBg: 'rgba(64,168,96,0.12)',
  greenBorder: 'rgba(64,168,96,0.25)',
  destructive: '#D65757',
  destructiveBg: 'rgba(214,87,87,0.12)',
  destructiveBorder: 'rgba(214,87,87,0.25)',
  orange: '#D4A017',
  orangeBg: 'rgba(212,160,23,0.12)',

  // ── Borders ──
  border: 'rgba(255,255,255,0.08)',
  borderFocus: 'rgba(139,109,255,0.35)',

  // ── Text ──
  textPrimary: '#F4F5FA',
  textSecondary: '#B3B7C8',
  textMuted: '#7A7D8E',
  textWhite: '#FFFFFF',
} as const;

export const radii = {
  xs: '8px',
  sm: '12px',
  md: '16px',
  lg: '20px',
} as const;

export const shadows = {
  sm: '0 2px 4px rgba(0,0,0,0.2)',
  md: '0 4px 12px rgba(0,0,0,0.3)',
  glow: '0 0 20px rgba(139,109,255,0.25)',
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
  backgroundColor: colors.surface,
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
  fontSize: '14px',
  fontWeight: 700,
  color: colors.textSecondary,
  marginBottom: '12px',
  marginTop: '24px',
  letterSpacing: '0.04em',
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
  boxShadow: colors.accentGlow,
} as const;

export const btnSecondary = {
  padding: '8px 16px',
  fontSize: '12px',
  fontWeight: 600,
  backgroundColor: colors.surface,
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
  backgroundColor: colors.surface,
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
  gap: '4px',
  marginBottom: '24px',
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
  borderRadius: `4px 4px 0 0`,
  cursor: 'pointer',
  transition: 'all 150ms',
  marginBottom: '-1px',
});

export const cardBox = {
  backgroundColor: colors.card,
  borderRadius: radii.md,
  border: `1px solid ${colors.border}`,
  padding: '16px',
} as const;