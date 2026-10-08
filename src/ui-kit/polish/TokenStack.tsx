import React from 'react';
import { Token } from './Token';
import type { Identity } from './shared';
export interface TokenStackProps {
    /** Up to eight identities, in stable caller-owned order. */ players: Identity[];
    /** Active seat id. */ activeId?: string;
    /** Compact board placement or bidder/avatar stack. */ compact?: boolean;
    /** Caller-owned currently hopping seat ids; at most eight tokens render. */ movingIds?: string[];
}
export function TokenStack({ players, activeId, compact, movingIds = [] }: TokenStackProps) { return <div className={`mp-token-stack ${compact ? 'mp-stack-compact' : ''}`} aria-label={`${players.length} players`}>{players.slice(0, 8).map(player => <Token key={player.id} player={player} active={activeId === player.id} moving={movingIds.includes(player.id)} size={compact ? 12 : 32}/>)}</div>; }
