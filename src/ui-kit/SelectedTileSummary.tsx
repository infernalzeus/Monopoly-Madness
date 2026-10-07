import React from 'react';
import { CurrencyAmount } from './CurrencyAmount';
import { Icon } from './icons';
import { KitButton } from './primitives';
export interface SelectedTileSummaryProps {
  /** Selected tile name. */ name: string;
  /** Current market value. */ price: number;
  /** Current payable rent if known. */ rent?: number;
  /** Resolved owner. */ ownerName?: string;
  /** Mortgage label. */ isMortgaged?: boolean;
  /** Neutral inactive label. */ isInactive?: boolean;
  /** Optional caller-computed income/utility description. */ rentLabel?: string;
  /** Open accessible full details. */ onDetails?: () => void;
}
export function SelectedTileSummary({ name, price, rent, ownerName, isMortgaged, isInactive, rentLabel, onDetails }: SelectedTileSummaryProps) {
  return <section className="mma-ui mma-selected"><div className="mma-grow"><h3><Icon name="house" /> {name}</h3><p>{isInactive ? 'Neutral · inactive' : isMortgaged ? 'Mortgaged · no rent' : ownerName ? `Owner: ${ownerName}` : 'Unowned'}</p><p>Market <CurrencyAmount amount={price} />{!isMortgaged && !isInactive && (rentLabel ? ` · ${rentLabel}` : rent !== undefined ? <> · Rent <CurrencyAmount amount={rent} /></> : null)}</p></div>{onDetails && <KitButton onClick={onDetails}>Details</KitButton>}</section>;
}
