import React, { type CSSProperties } from 'react';
import { CurrencyAmount } from './CurrencyAmount';
import { Icon } from './icons';
export interface TileToken {
  /** Name for the tile's accessible token list. */ name: string;
  /** Plain-text player token. */ icon?: string;
  /** Distinct seat marker. */ marker?: string | number;
}
export interface PropertyTileProps {
  /** Global Edition property name. */ name: string;
  /** Current market price. */ price: number;
  /** Named group or #RGB/#RRGGBB colour. */ colorGroup?: string;
  /** Owner identity colour. */ ownerColor?: string;
  /** Owner name; omitted for unowned. */ ownerName?: string;
  /** Number of houses shown, supplied by engine. */ houses?: number;
  /** Hotel flag. */ hasHotel?: boolean;
  /** Mortgage flag. */ isMortgaged?: boolean;
  /** Neutral bankrupt property flag. */ isInactive?: boolean;
  /** Live auction flag. */ isInAuction?: boolean;
  /** Resolved team name, if applicable. */ teamName?: string;
  /** Tokens currently occupying tile. */ tokens?: TileToken[];
  /** Phone overview or desktop detailed tile. */ size?: 'map' | 'full';
  /** Open the selected-tile summary. */ onSelect?: () => void;
  /** Whether this tile is selected. */ selected?: boolean;
  /** Optional blind-pick mask. */ isHidden?: boolean;
}
const groups: Record<string, string> = { brown: '#b45309', lightBlue: '#7dd3fc', pink: '#f9a8d4', orange: '#fb923c', red: '#fb7185', yellow: '#fde047', green: '#4ade80', darkBlue: '#60a5fa' };
export function PropertyTile({ name, price, colorGroup, ownerColor, ownerName, houses = 0, hasHotel = false, isMortgaged = false, isInactive = false, isInAuction = false, teamName, tokens = [], size = 'map', onSelect, selected = false, isHidden = false }: PropertyTileProps) {
  const safeColor = (c?: string) => c && /^#(?:[a-f0-9]{3}|[a-f0-9]{6})$/i.test(c) ? c : '#475569';
  const group = groups[colorGroup ?? ''] ?? safeColor(colorGroup);
  const short = name.split(/\s+/).map(word => word[0]).join('').slice(0, 3).toUpperCase();
  const states = [isInactive ? 'Neutral, inactive' : ownerName ? `Owner ${ownerName}` : 'Unowned', isMortgaged ? 'Mortgaged' : '', hasHotel ? 'Hotel' : houses ? `${houses} houses` : '', isInAuction ? 'In auction' : '', teamName ? `Team ${teamName}` : '', tokens.length ? `Players: ${tokens.map(t => t.name).join(', ')}` : ''].filter(Boolean).join('. ');
  const label = isHidden ? 'Undiscovered tile' : `${name}. ${states}`;
  const className = `mma-ui mma-tile mma-tile-${size} ${isInactive ? 'mma-tile-inactive' : ''} ${isMortgaged ? 'mma-tile-mortgaged' : ''}`;
  const content = <><span className="mma-tile-group" style={{ background: isHidden ? '#475569' : isInactive ? '#64748b' : group }} /><span className="mma-tile-code">{isHidden ? '?' : size === 'map' ? short : name}</span>{!isHidden && <>
    {size === 'full' && <CurrencyAmount amount={price} />}
    <span className="mma-tile-state">{isInactive ? 'X' : isMortgaged ? 'M' : hasHotel ? <Icon name="hotel" size={14} /> : houses > 0 ? <><Icon name="house" size={14} />{houses}</> : null}{isInAuction && <Icon name="auction" size={14} />}</span>
    {ownerName && !isInactive && <span className="mma-tile-owner" style={{ borderColor: safeColor(ownerColor) }}>{size === 'full' ? ownerName : ownerName.slice(0, 1)}</span>}
    {teamName && !isInactive && <span className="mma-tile-team" aria-label={`Team ${teamName}`}><Icon name="team" size={14} />{size === 'full' ? teamName : ''}</span>}
  </>}{tokens.length > 0 && <span className="mma-tile-tokens" aria-hidden="true">{tokens.slice(0, size === 'map' ? 2 : 8).map((token, i) => <span key={`${token.name}-${i}`}>{token.icon ?? token.marker ?? token.name[0]}</span>)}{size === 'map' && tokens.length > 2 && <span>+{tokens.length - 2}</span>}</span>}</>;
  const style = { '--mma-owner': safeColor(ownerColor) } as CSSProperties;
  return onSelect ? <button type="button" className={className} style={style} onClick={onSelect} aria-label={label} aria-pressed={selected} title={label}>{content}</button> : <div className={className} style={style} role="img" aria-label={label} title={label}>{content}</div>;
}
