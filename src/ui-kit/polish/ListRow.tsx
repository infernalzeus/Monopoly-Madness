import React, { type ReactNode } from 'react';
import { Glyph, type GlyphName, type Identity } from './shared';
import { Token } from './Token';
export interface ListRowProps {
    /** Primary text. */ title: string;
    /** Secondary explanation. */ detail: string;
    /** Optional player avatar. */ player?: Identity;
    /** Optional event icon. */ icon?: GlyphName;
    /** Caller-formatted amount/status. */ trailing?: ReactNode;
    /** Optional full-row selection callback. */ onSelect?: () => void;
}
export function ListRow({ title, detail, player, icon = 'log', trailing, onSelect }: ListRowProps) { const content = <>{player ? <Token player={player} size={36}/> : <Glyph name={icon}/>}<span className="mp-grow"><strong>{title}</strong><span className="mp-muted mp-row-detail">{detail}</span></span>{trailing && <span className="mp-row-trailing">{trailing}</span>}</>; return onSelect ? <button type="button" className="mp-list-row" onClick={onSelect}>{content}</button> : <div className="mp-list-row">{content}</div>; }
/** Named player-row family alias with the same supplied-data contract. */
export const PlayerRow = ListRow;
/** Named log-row family alias with the same supplied-data contract. */
export const LogRow = ListRow;
/** Named trade-row family alias; caller supplies any controls separately. */
export const TradeRow = ListRow;
