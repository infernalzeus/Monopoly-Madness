import React, { type CSSProperties } from 'react';
import type { Identity } from './shared';
export interface TokenProps {
    /** Public seat identity. */ player: Identity;
    /** Caller-owned turn indicator. */ active?: boolean;
    /** Caller-owned movement phase; replay with a new key for each hop. */ moving?: boolean;
    /** Pixel diameter. Map tokens may be small; noninteractive. */ size?: number;
}
export function Token({ player, active, moving, size = 40 }: TokenProps) { return <span role="img" aria-label={`${player.name}${active ? ', current turn' : ''}`} className={`mp-token ${active ? 'mp-token-active' : ''} ${moving ? 'mp-token-hop' : ''}`} style={{ '--mp-player': player.color, width: size, height: size } as CSSProperties}><span aria-hidden="true">{player.token || player.name.slice(0, 1)}</span></span>; }
