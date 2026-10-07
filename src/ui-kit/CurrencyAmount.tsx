import React from 'react';
import type { Tone } from './tokens';
export interface CurrencyAmountProps {
  /** Exact dollar value; finite numbers only. */ amount: number;
  /** Display + for positive values; losses always retain a true minus sign. */ signed?: boolean;
  /** Compact K/M/B display; exact value remains accessible. */ compact?: boolean;
  /** Semantic colour; signed gains/losses determine their own tone. */ tone?: Tone;
}
export function formatCurrency(amount: number, compact = true, signed = false): string {
  if (!Number.isFinite(amount)) return 'Amount unavailable';
  const value = Math.abs(amount);
  const unit = value >= 1e9 ? [1e9, 'B'] as const : value >= 1e6 ? [1e6, 'M'] as const : value >= 1e3 ? [1e3, 'K'] as const : null;
  const number = compact && unit ? `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value / unit[0])}${unit[1]}` : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
  return `${amount < 0 ? '−' : signed && amount > 0 ? '+' : ''}$${number}`;
}
export function CurrencyAmount({ amount, signed = false, compact = true, tone = 'neutral' }: CurrencyAmountProps) {
  const exact = formatCurrency(amount, false, signed);
  const resolvedTone = signed && amount !== 0 ? (amount > 0 ? 'gain' : 'loss') : amount < 0 ? 'loss' : tone;
  return <span className={`mma-ui mma-currency mma-tone-${resolvedTone}`} title={exact} aria-label={exact}>{formatCurrency(amount, compact, signed)}</span>;
}
