import React from 'react';
import { PropertyCard } from './PropertyCard';
import type { PropertyCardProps } from './types';
import { Icon } from '../icons';
export interface TradeCardChoice {
  /** Existing property card data. */ card: PropertyCardProps;
  /** Built group, auction or ownership restriction from adapter. */ lockedReason?: string;
}
export interface TradeCardPickerProps {
  /** Label the give/receive side explicitly. */ label: string;
  /** Owned cards, including visibly locked choices. */ choices: TradeCardChoice[];
  /** Controlled selection of actual property IDs. */ selectedIds: string[];
  /** Toggle intent; adapter checks authorization and ownership. */ onToggle: (id:string) => void;
}
export function TradeCardPicker({label,choices,selectedIds,onToggle}:TradeCardPickerProps){return <section className="mma-ui mmc-picker" aria-label={label}><h3>{label}</h3><div className="mmc-picker-grid">{choices.map(({card,lockedReason})=><div key={card.property.id} className="mmc-choice"><PropertyCard {...card} size="mini" selectionDisabledReason={lockedReason} selected={selectedIds.includes(card.property.id)} onSelect={()=>onToggle(card.property.id)}/></div>)}</div></section>;}
