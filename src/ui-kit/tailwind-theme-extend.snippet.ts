import { tokens } from './tokens';
/** Merge into theme.extend; include src/ui-kit in Tailwind content (src/** already covers it). */
export const uiKitThemeExtend = {
  colors: { mma: tokens.colors },
  fontSize: { 'mma-body': '14px', 'mma-action': '16px', 'mma-title': '20px', 'mma-money': '36px' },
  borderRadius: { 'mma-control': '10px', 'mma-card': '16px', 'mma-sheet': '24px' },
  boxShadow: { 'mma-card': tokens.elevation.card, 'mma-sheet': tokens.elevation.sheet, 'mma-glow': tokens.elevation.glow },
  transitionDuration: { 'mma-fast': '120ms', 'mma-normal': '180ms', 'mma-slow': '240ms' },
};
