import React from 'react';
import { Token } from './Token';
import { CountUp, Glyph, type Identity } from './shared';
export interface PlayerCardProps {
    /** Player identity. */ player: Identity;
    /** Exact current cash. */ cash: number;
    /** Exact caller-computed net worth; never computed in this component. */ netWorth: number;
    /** Caller-computed rank including tie policy. */ rank: number;
    /** Optional caller-owned history, never synthesized. */ history?: number[];
    /** Caller-resolved jail/away/bot/team labels. */ statuses?: string[];
}
export function PlayerCard({ player, cash, netWorth, rank, history = [], statuses = [] }: PlayerCardProps) {
    const finite = history.filter(Number.isFinite), min = Math.min(...finite), span = Math.max(1, Math.max(...finite) - min);
    const points = finite.map((n, i) => `${i / Math.max(1, finite.length - 1) * 240},${46 - (n - min) / span * 40}`).join(' ');
    return <section className="mp-surface mp-player-card"><header className="mp-row"><Token player={player} size={48}/><h2 className="mp-grow">{player.name}</h2><span className="mp-rank"><Glyph name="trophy" size={18}/>#{rank}</span></header><div className="mp-balances"><div><p className="mp-muted">Cash</p><CountUp value={cash} label="Cash"/></div><div><p className="mp-muted">Net worth</p><CountUp value={netWorth} label="Net worth"/></div></div>{finite.length >= 2 ? <svg className="mp-sparkline" viewBox="0 0 240 50" role="img" aria-label={`Net worth history: ${finite.length} observations`}><path d="M0 49h240" stroke="#425573"/><polyline points={points} fill="none" stroke="#79ddff" strokeWidth="2"/></svg> : <p className="mp-muted">Net worth history not available</p>}<div className="mp-chips">{statuses.map(label => <span key={label}>{label}</span>)}</div></section>;
}
