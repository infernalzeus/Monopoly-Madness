import React from 'react';
import { Icon } from '../icons';
import { KitButton } from '../primitives';
export interface JailCardProps {
  /** Actual held Player.jailCards count. */ count: number;
  /** Optional authorized spend callback in jail. */ onUse?: () => void;
  /** Rule/write availability reason. */ disabledReason?: string;
}
export function JailCard({count,onUse,disabledReason}:JailCardProps){return <article className="mma-ui mmc-jail-card"><Icon name="key" size={32}/><h3>Get Out of Jail Free</h3><p>Held cards: <strong>{count}</strong></p><p>Keep until needed. Your turn continues after release.</p>{onUse&&<KitButton variant="primary" onClick={onUse} disabledReason={disabledReason||(count<1?'No jail card held.':undefined)}>Use jail card</KitButton>}</article>;}
