import React from 'react';
import { Token } from './Token';
import { Ring, type Identity } from './shared';
export interface TurnBannerProps {
    /** Current actor. */ player: Identity;
    /** Local turn ownership. */ isMine?: boolean;
    /** Authoritative readable phase. */ phase: string;
    /** Optional caller-owned countdown. */ seconds?: number;
    /** Effective caller-owned timer duration. */ totalSeconds?: number;
}
export function TurnBanner({ player, isMine, phase, seconds, totalSeconds = 60 }: TurnBannerProps) { return <section className="mp-surface mp-turn" aria-label="Turn status"><Token player={player} active/><div className="mp-grow"><p className="mp-eyebrow">{isMine ? 'Your turn' : `${player.name}'s turn`}</p><strong>{phase}</strong></div>{seconds !== undefined && <Ring seconds={seconds} total={totalSeconds}/>}</section>; }
