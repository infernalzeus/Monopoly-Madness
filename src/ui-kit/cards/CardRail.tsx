import React from 'react';
import { PropertyCard } from './PropertyCard';
import type { PropertyCardProps } from './types';
export interface CardRailProps {
  /** Caller-ordered portfolio, grouped for display. */ cards: PropertyCardProps[];
  /** Accessible collection label. */ label?: string;
  /** Called with the new presentation order; never writes game state. */ onReorder?: (ids: string[]) => void;
}
export function CardRail({cards,label='Your property cards',onReorder}:CardRailProps){
  const groups=[...new Set(cards.map(c=>c.property.colorGroup??c.property.type))];
  const move=(i:number,d:number)=>{const ids=cards.map(c=>c.property.id);[ids[i],ids[i+d]]=[ids[i+d],ids[i]];onReorder?.(ids);};
  return <section className="mma-ui mmc-collection" aria-label={label}>{groups.map(group=><section key={group}><h3>{group}</h3><div className="mmc-rail" role="list" onKeyDown={e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;const buttons=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>(':scope > [role=listitem] > .mmc-card-trigger'));const index=buttons.indexOf(document.activeElement as HTMLButtonElement);if(index<0)return;e.preventDefault();buttons[(index+(e.key==='ArrowRight'?1:buttons.length-1))%buttons.length]?.focus();}}>{cards.filter(c=>(c.property.colorGroup??c.property.type)===group).map(c=>{const i=cards.indexOf(c);return <div role="listitem" key={c.property.id}><PropertyCard {...c} size="mini" onMoveLeft={onReorder&&i>0?()=>move(i,-1):undefined} onMoveRight={onReorder&&i<cards.length-1?()=>move(i,1):undefined}/></div>;})}</div></section>)}</section>;
}
