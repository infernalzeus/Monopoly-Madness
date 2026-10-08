import React from 'react';
import { money } from './shared';
export interface MoneyDeltaProps {
    /** Signed amount supplied by caller; not inferred from events. */ amount: number;
    /** Caller-owned visibility; remount with a stable transaction key to replay motion. */ visible?: boolean;
}
export function MoneyDelta({ amount, visible = true }: MoneyDeltaProps) { return visible ? <span className={`mp-money-delta ${amount < 0 ? 'mp-loss' : 'mp-gain'}`} role="status">{amount < 0 ? '−' : '+'}{money(Math.abs(amount))}</span> : null; }
