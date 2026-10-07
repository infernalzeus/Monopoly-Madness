/** Semantic UI tokens. Import tokens.css once when integrating the kit. */
export const tokens = {
  colors: { canvas: '#020617', surface: '#0f172a', raised: '#1e293b', border: '#475569', text: '#f1f5f9', muted: '#cbd5e1', ink: '#020617', info: '#67e8f9', gain: '#6ee7b7', loss: '#fda4af', warning: '#fcd34d', neutral: '#cbd5e1' },
  type: { caption: 12, body: 14, action: 16, title: 20, headline: 28, money: 36, map: 9 },
  spacing: [4, 8, 12, 16, 24, 32] as const,
  radii: { control: 10, card: 16, sheet: 24 },
  elevation: { card: '0 8px 24px #02061766', sheet: '0 24px 80px #020617aa', glow: '0 0 24px #67e8f91a' },
  motion: { fast: 120, normal: 180, slow: 240 },
  touchTarget: 44,
} as const;
export type Tone = 'neutral' | 'info' | 'gain' | 'loss' | 'warning';
