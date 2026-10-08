import React, { type ReactNode } from 'react';
import { CountUp, Ring, type Action, type Identity } from './shared';
import { TokenStack } from './TokenStack';
import { StageActions } from './StageActions';
export interface AuctionHallProps {
    /** Existing property card face, not another inspect dialog. */ card: ReactNode;
    /** Exact current bid. */ currentBid: number;
    /** Caller-resolved leader. */ leader?: string;
    /** Caller-owned remaining seconds. */ seconds: number;
    /** Caller-owned effective duration. */ totalSeconds: number;
    /** Stable unique bidder identities. */ bidders: Identity[];
    /** Whether local player was outbid; replay with a new key for a new event. */ outbid?: boolean;
    /** Exact legal bid labels/callbacks; component never adds a bid increment. */ bids: Action[];
}
export function AuctionHall({ card, currentBid, leader, seconds, totalSeconds, bidders, outbid, bids }: AuctionHallProps) { return <section className={`mp-auction-hall ${outbid ? 'mp-outbid' : ''}`} aria-label="Live auction"><div className="mp-auction-card">{card}</div><div className="mp-auction-details"><div className="mp-row"><div className="mp-grow"><p className="mp-eyebrow">Current bid</p><CountUp value={currentBid} label="Current bid"/></div><Ring seconds={seconds} total={totalSeconds}/></div><p className="mp-muted">{leader ? `${leader} leads` : 'Waiting for the first bid'}</p>{outbid && <p className="mp-loss" role="status">Outbid! Choose your next move.</p>}<TokenStack players={bidders}/><StageActions actions={bids}/></div></section>; }
