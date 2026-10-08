import React, { type CSSProperties } from 'react';
import { Glyph, type GlyphName, type Identity } from './shared';
export interface BoardTileProps {
    /** Full name, also used in the accessible tap summary. */ name: string;
    /** Short phone map code, never an unexplained accessible name. */ code: string;
    /** Distinct inline SVG treatment. */ kind?: Extract<GlyphName, 'city' | 'go' | 'jail' | 'parking' | 'go-jail' | 'chance' | 'chest' | 'tax' | 'railroad' | 'utility'>;
    /** Caller-formatted price; not computed by the tile. */ price?: string;
    /** Group band colour, decorative. */ groupColor?: string;
    /** Owner identity; flag uses initial plus colour. */ owner?: Identity;
    /** Existing building counts. */ houses?: number;
    /** Existing hotel flag. */ hotel?: boolean;
    /** Mortgage state. */ mortgaged?: boolean;
    /** Bankrupt/neutral state. */ neutral?: boolean;
    /** Live auction highlight. */ auction?: boolean;
    /** Caller-computed monopoly eligibility. */ monopoly?: boolean;
    /** Team tint, decorative only. */ teamColor?: string;
    /** Masks all property/owner/price information. */ hidden?: boolean;
    /** Edge orientation supplied by board geometry. */ orientation?: 'bottom' | 'left' | 'top' | 'right';
    /** Compact map or roomy standalone tile. */ size?: 'map' | 'detail';
    /** Selected state from board owner. */ selected?: boolean;
    /** Opens a caller-owned readable summary. Map cells are the documented target-size exception. */ onSelect?: () => void;
}
export function BoardTile({ name, code, kind = 'city', price, groupColor = '#79ddff', owner, houses = 0, hotel, mortgaged, neutral, auction, monopoly, teamColor, hidden, orientation = 'bottom', size = 'detail', selected, onSelect }: BoardTileProps) {
    const description = hidden ? 'Undiscovered tile' : `${name}${owner ? `, owned by ${owner.name}` : ''}${neutral ? ', neutral' : ''}${mortgaged ? ', mortgaged' : ''}${auction ? ', auction' : ''}${monopoly ? ', monopoly' : ''}${hotel ? ', hotel' : houses ? `, ${houses} houses` : ''}${price ? `, ${price}` : ''}`;
    const contents = <><span className="mp-tile-band"/><div className="mp-tile-content">{hidden ? <><Glyph name="chance"/><b>?</b></> : <><Glyph name={kind}/><b className="mp-tile-name">{size === 'map' ? code : name}</b>{price && <span className="mp-tile-price">{price}</span>}{(houses > 0 || hotel) && <span className="mp-buildings" aria-hidden="true">{Array.from({ length: hotel ? 1 : Math.min(4, houses) }, (_, i) => <Glyph key={i} name={hotel ? 'hotel' : 'house'} size={12}/>)}</span>}</>}</div>{!hidden && <>{owner && <span className="mp-owner" title={owner.name}><i style={{ backgroundColor: owner.color }}/>{owner.name.slice(0, 1).toUpperCase()}</span>}{(mortgaged || neutral) && <span className="mp-tile-status">{neutral ? 'X' : 'M'}</span>}</>}</>;
    const props = { className: `mp-tile mp-tile-${size} mp-edge-${orientation} ${mortgaged && !hidden ? 'mp-mortgaged' : ''} ${neutral && !hidden ? 'mp-neutral' : ''} ${auction && !hidden ? 'mp-auction' : ''} ${monopoly && !hidden ? 'mp-monopoly' : ''} ${hidden ? 'mp-fog' : ''}`, style: { '--mp-group': hidden ? '#64748b' : groupColor, '--mp-team': hidden ? 'transparent' : teamColor || 'transparent' } as CSSProperties, 'aria-label': description };
    return onSelect ? <button {...props} type="button" aria-pressed={!!selected} onClick={onSelect}>{contents}</button> : <div {...props} role="img">{contents}</div>;
}
