import React from 'react';
import { AuctionStatus,type AuctionStatusProps } from '../AuctionStatus';
import { PropertyCard } from './PropertyCard';
import type { PropertyCardProps } from './types';
export interface AuctionCardProps {
  /** Deed presentation data. */ card: PropertyCardProps;
  /** Existing live bid-panel props, owned by adapter. */ auction: AuctionStatusProps;
}
export function AuctionCard({card,auction}:AuctionCardProps){return <section className="mma-ui mmc-auction-card" aria-label={`${card.property.name} is up for bid`}><PropertyCard {...card} size="full"/><div className="mmc-auction-panel"><AuctionStatus {...auction}/></div></section>;}
