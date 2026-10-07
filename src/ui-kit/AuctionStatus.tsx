import React from 'react';
import { CurrencyAmount, formatCurrency } from './CurrencyAmount';
import { KitButton, TimerRing } from './primitives';
import { Icon } from './icons';
export interface AuctionStatusProps {
  /** Property being auctioned. */ propertyName: string;
  /** Live highest/start bid. */ currentBid: number;
  /** Current leading name, null before any bid. */ highestBidder: string | null;
  /** Local player's name. */ you: string;
  /** Caller-owned remaining time. */ secondsLeft: number;
  /** Effective timer duration; caller updates for extensions. */ totalSeconds: number;
  /** Legal next increment supplied by game adapter. */ minIncrement: number;
  /** Absolute legal bid amounts, not increments. */ quickBids: number[];
  /** Submit immediately; caller validates atomically. */ onBid: (amount: number) => void;
  /** Local cash available. */ balance: number;
  /** Seller cannot bid. */ isSeller: boolean;
  /** Pre-game draft indicator. */ isDraft?: boolean;
  /** One-based draft progress if known. */ draftIndex?: number;
  /** Original queue count if known. */ draftTotal?: number;
  /** Whether local player previously bid in this auction; derive from bids. */ hasBid?: boolean;
  /** Optional actor/rule/write blocking reason from caller. */ disabledReason?: string;
}
export function AuctionStatus({ propertyName, currentBid, highestBidder, you, secondsLeft, totalSeconds, minIncrement, quickBids, onBid, balance, isSeller, isDraft = false, draftIndex, draftTotal, hasBid = false, disabledReason }: AuctionStatusProps) {
  const winning = highestBidder === you;
  const status = winning ? "You're winning" : hasBid && highestBidder ? 'You were outbid' : 'Not bidding';
  const reason = disabledReason || (secondsLeft <= 0 ? 'Bidding has closed.' : isSeller ? 'You are the seller; you cannot bid.' : winning ? 'You already hold the highest bid.' : undefined);
  return <section className="mma-ui mma-auction"><div className="mma-row"><div className="mma-grow"><p className="mma-eyebrow"><Icon name="auction" />{isDraft ? 'Draft auction' : 'Live auction'}</p><h3>{propertyName}</h3>{isDraft && draftIndex !== undefined && draftTotal !== undefined && <p>Property {draftIndex} of {draftTotal}</p>}</div><TimerRing seconds={secondsLeft} total={totalSeconds} /></div>
    <div className="mma-auction-bid"><span>Current bid</span><div className="mma-money"><CurrencyAmount amount={currentBid} tone="warning" /></div><p>Highest bidder: <strong>{highestBidder ?? 'No bids yet'}</strong></p></div>
    <p className={`mma-status mma-tone-${winning ? 'gain' : hasBid ? 'warning' : 'neutral'}`} aria-live="polite" aria-atomic="true"><Icon name={winning ? 'check' : hasBid ? 'warning' : 'auction'} /> {status}</p>
    <div className="mma-quick-bids">{quickBids.map((amount, i) => <KitButton key={`${amount}-${i}`} variant={i === 0 ? 'primary' : 'secondary'} onClick={() => onBid(amount)} disabledReason={reason || (!Number.isFinite(amount) || amount < currentBid + minIncrement ? 'Below the next legal bid.' : amount > balance ? 'Insufficient cash for this bid.' : undefined)} aria-label={`Bid ${formatCurrency(amount, false)}`}>Bid <CurrencyAmount amount={amount} tone="neutral" compact={false} /></KitButton>)}</div>
    <p className="mma-muted">Your available cash: <CurrencyAmount amount={balance} /> · Minimum increase: <CurrencyAmount amount={minIncrement} /></p>
  </section>;
}
