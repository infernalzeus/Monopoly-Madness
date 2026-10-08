import React from 'react';
import { PropertyCard } from './PropertyCard';
import type { PropertyCardProps } from './types';
export interface CardGridProps {
  /** Populated property cards; keep collections at or below 40. */ cards: PropertyCardProps[];
  /** Accessible collection label. */ label?: string;
}
export function CardGrid({cards,label='Property card grid'}:CardGridProps){return <section className="mma-ui mmc-collection" aria-label={label}>{[...new Set(cards.map(c=>c.property.colorGroup??c.property.type))].map(group=><section key={group}><h3>{group}</h3><div className="mmc-grid">{cards.filter(c=>(c.property.colorGroup??c.property.type)===group).map(c=><PropertyCard key={c.property.id} {...c} size="hand"/>)}</div></section>)}</section>;}
