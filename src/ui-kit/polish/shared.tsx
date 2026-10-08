import React, { type ReactNode, type CSSProperties, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../useReducedMotion';
export interface Identity {
    /** Stable seat id. */ id: string;
    /** Public display name. */ name: string;
    /** Caller-supplied CSS colour; decorative only. */ color: string;
    /** Player token, the only place emoji are allowed. */ token?: ReactNode;
}
export interface Action {
    /** Unique UI action id. */ id: string;
    /** Complete label, including caller-computed prices. */ label: string;
    /** Authorized caller callback. */ onClick: () => void;
    /** Visible rule or write-pending reason. */ disabledReason?: string;
    /** Primary visual emphasis. */ primary?: boolean;
}
export type GlyphName = 'city' | 'go' | 'jail' | 'parking' | 'go-jail' | 'chance' | 'chest' | 'tax' | 'railroad' | 'utility' | 'house' | 'hotel' | 'players' | 'log' | 'trade' | 'teams' | 'workers' | 'trophy' | 'close';
const paths: Record<GlyphName, ReactNode> = {
    city: <><path d="M3 21V9h6v12M9 21V3h6v18M15 21V7h6v14M1 21h22M12 6v1m0 3v1m6-1v1M6 12v1"/></>,
    go: <><path d="M3 12h17m-6-6 6 6-6 6"/><circle cx="6" cy="6" r="2"/></>,
    jail: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 4v16m4-16v16m4-16v16M4 9h16"/></>,
    parking: <><path d="m3 14 2-7h14l2 7v6h-3v-3H6v3H3zM5 12h14"/><circle cx="7" cy="14" r="1"/><circle cx="17" cy="14" r="1"/></>,
    'go-jail': <><path d="m2 7 5 5-5 5m6-5h6M14 3h7v18h-7m3-16v14"/></>,
    chance: <><path d="m12 2 3 6 7 4-7 4-3 6-3-6-7-4 7-4z"/><path d="M10 9a2 2 0 0 1 4 0c0 2-2 2-2 4m0 3h.01"/></>,
    chest: <><path d="M3 10h18v11H3zM3 10V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v3M3 14h18"/><rect x="10" y="12" width="4" height="5"/></>,
    tax: <><path d="M5 2h14v20l-3-2-4 2-4-2-3 2zM9 6h6m-6 4h6m-6 4h4"/></>,
    railroad: <><rect x="5" y="2" width="14" height="16" rx="4"/><path d="M5 9h14M9 3v6M6 22l3-4m9 4-3-4"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/></>,
    utility: <><path d="m14 2-9 12h6l-1 8 9-13h-6z"/></>,
    house: <><path d="m2 11 10-9 10 9M5 9v13h14V9M10 22v-7h4v7"/></>,
    hotel: <><path d="M4 22V2h16v20M1 22h22M8 6h2m4 0h2M8 10h2m4 0h2M8 14h2m4 0h2M10 22v-4h4v4"/></>,
    players: <><circle cx="9" cy="7" r="4"/><path d="M2 22v-4a7 7 0 0 1 14 0v4m1-19a4 4 0 0 1 0 8m2 4a6 6 0 0 1 3 6"/></>,
    log: <><path d="M6 2h13v19H6a3 3 0 0 1 0-6h13M6 2a3 3 0 0 0-3 3v13m6-12h6m-6 4h6"/></>,
    trade: <><path d="M2 7h19l-5-5m5 15H2l5 5M2 7l5 5m14 5-5-5"/></>,
    teams: <><path d="m12 2 9 4v7c0 5-9 9-9 9s-9-4-9-9V6zM8 12l3 3 5-6"/></>,
    workers: <><path d="M3 15a9 9 0 0 1 18 0M2 15h20v4H2zM9 7V3h6v4"/></>,
    trophy: <><path d="M7 2h10v7a5 5 0 0 1-10 0zM7 4H2v4a5 5 0 0 0 6 5m9-9h5v4a5 5 0 0 1-6 5M12 14v6m-5 2h10"/></>,
    close: <path d="m5 5 14 14M5 19 19 5"/>
};
/** Decorative original inline SVG, inheriting high-contrast text colour. */
export function Glyph({ name, size = 24 }: {
    name: GlyphName; /** Pixel size. */
    size?: number;
}) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
/** Currency formatting only, never a financial calculation. */
export function money(value: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value); }
/** Number text remains exact; transform/opacity animate its arrival without layout interpolation. */
export function Counter({ value, label }: {
    value: number; /** Accessible financial label. */
    label: string;
}) {
    return <strong className="mp-counter" aria-label={`${label}: ${money(value)}`}><span key={value}>{money(value)}</span></strong>;
}
export function ActionButton({ action }: {
    action: Action;
}) {
    return <div className="mp-action-wrap"><button type="button" className={`mp-button ${action.primary ? 'mp-primary' : ''}`} disabled={!!action.disabledReason} onClick={action.onClick}>{action.label}</button>{action.disabledReason && <p className="mp-muted">{action.disabledReason}</p>}</div>;
}
export function Ring({ seconds, total }: {
    seconds: number; /** Caller-owned duration. */
    total: number;
}) {
    const n = Math.max(0, Math.ceil(seconds)), fraction = Math.max(0, Math.min(1, n / Math.max(1, total)));
    return <div className={`mp-ring ${n <= 10 ? 'mp-urgent' : ''}`} role="timer" aria-label={`${n} seconds remaining`}><svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="26"/><circle cx="30" cy="30" r="26" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - fraction * 100}/></svg><strong aria-hidden="true">{n}s</strong></div>;
}
/** Decorative burst; owner controls visibility and event identity. */
export function Confetti() { return <div className="mp-confetti" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--angle': `${i * 30}deg`, '--flight': `${45 + i % 3 * 15}px` } as CSSProperties}/>)}</div>; }
/** Optional animated count-up, visual only; accessible value is always the exact supplied amount. */
export function CountUp({ value, label }: {
    value: number; /** Accessible label. */
    label: string;
}) {
    const reduced = useReducedMotion(), previous = useRef(value), [display, setDisplay] = useState(value);
    useEffect(() => { const from = previous.current; previous.current = value; if (reduced) {
        setDisplay(value);
        return;
    } let frame = 0; const start = performance.now(); const tick = (now: number) => { const p = Math.min(1, (now - start) / 260); setDisplay(Math.round(from + (value - from) * (1 - (1 - p) ** 3))); if (p < 1)
        frame = requestAnimationFrame(tick); }; frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame); }, [value, reduced]);
    return <strong className="mp-counter" aria-label={`${label}: ${money(value)}`}><span aria-hidden="true">{money(display)}</span></strong>;
}
