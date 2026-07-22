// ── Shared Design Tokens ───────────────────────────────────────────
// Single source of truth for colors, radii, typography, and reusable
// style factories. Every component imports from here instead of
// copy-pasting hex codes and style objects.

export const colors = {
  primary: '#007ACC',
  primaryLight: '#1A8CD9',
  primaryBg: 'rgba(0,122,204,0.08)',
  primaryBorder: 'rgba(0,122,204,0.2)',
  primaryFg: '#1E1E1E',
  accent: '#007ACC',
  accentHover: '#1A8CD9',
  purple: '#5C6BC0',
  purpleBg: 'rgba(92,107,192,0.08)',
  purpleBorder: 'rgba(92,107,192,0.2)',
  green: '#40A860',
  greenBg: 'rgba(64,168,96,0.08)',
  greenBorder: 'rgba(64,168,96,0.2)',
  orange: '#D4A017',
  orangeBg: 'rgba(212,160,23,0.08)',
  destructive: '#D65757',
  destructiveBg: 'rgba(214,87,87,0.08)',
  destructiveBorder: 'rgba(214,87,87,0.2)',
  surface: '#F3F3F3',
  surfaceHover: '#E8E8E8',
  surfaceBorder: 'rgba(0,0,0,0.08)',
  textPrimary: '#1E1E1E',
  textSecondary: '#616161',
  textMuted: '#8E8E90',
  textWhite: '#FFFFFF',
} as const;

export const radii = {
  sm: '6px',
  md: '8px',
  lg: '12px',
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(0,0,0,0.06)',
  md: '0 4px 12px rgba(0,0,0,0.08)',
} as const;

export const fontFamily = '"Inter",system-ui,-apple-system,sans-serif' as const;

// ── Shared Style Factories ───────────────────────────────────────────

export const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  fontSize: '14px',
  border: `1px solid ${colors.surfaceBorder}`,
  borderRadius: radii.sm,
  boxSizing: 'border-box' as const,
  fontFamily,
  outline: 'none',
  transition: 'border-color 150ms',
  backgroundColor: colors.surface,
  color: colors.textPrimary,
} as const;

export const selectStyle = {
  width: '100%',
  padding: '10px 12px',
  fontSize: '14px',
  border: `1px solid ${colors.surfaceBorder}`,
  borderRadius: radii.sm,
  boxSizing: 'border-box' as const,
  fontFamily,
  outline: 'none',
  backgroundColor: colors.surface,
  color: colors.textPrimary,
} as const;

export const fieldLabel = {
  fontSize: '13px',
  fontWeight: 600,
  color: colors.textSecondary,
  marginBottom: '4px',
  display: 'block',
} as const;

export const sectionTitle = {
  fontSize: '16px',
  fontWeight: 700,
  color: colors.textPrimary,
  marginBottom: '14px',
  marginTop: '28px',
  borderBottom: `1px solid ${colors.surfaceBorder}`,
  paddingBottom: '10px',
} as const;

export const btnPrimary = {
  padding: '10px 20px',
  fontSize: '14px',
  fontWeight: 700,
  backgroundColor: colors.primary,
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
  backgroundColor: colors.surface,
  color: colors.primary,
  border: `1px solid ${colors.primaryBorder}`,
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
  fontWeight: '600',
  border: `1px solid ${active ? colors.primary : colors.surfaceBorder}`,
  borderRadius: '20px',
  cursor: 'pointer',
  backgroundColor: active ? colors.primaryBg : colors.surface,
  color: active ? colors.primary : colors.textSecondary,
  transition: 'all 120ms',
  userSelect: 'none',
});

export const tabBar = {
  display: 'flex',
  gap: '2px',
  marginBottom: '20px',
  borderBottom: `2px solid ${colors.surfaceBorder}`,
  paddingBottom: '0',
} as const;

export const tabBtn = (active: boolean): Record<string, string | number> => ({
  padding: '10px 18px',
  fontSize: '13px',
  fontWeight: active ? 700 : 500,
  color: active ? colors.primary : colors.textSecondary,
  backgroundColor: active ? colors.primaryBg : 'transparent',
  border: 'none',
  borderBottom: active ? `2px solid ${colors.primary}` : '2px solid transparent',
  borderRadius: `${radii.sm} ${radii.sm} 0 0`,
  cursor: 'pointer',
  transition: 'all 150ms',
  marginBottom: '-2px',
});