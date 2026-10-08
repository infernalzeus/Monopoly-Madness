import React from 'react';
import { Glyph, type GlyphName } from './shared';
export interface NavItem {
    /** Stable panel id. */ id: string;
    /** Readable label. */ label: string;
    /** SVG icon. */ icon: GlyphName;
    /** Caller-controlled active state. */ active?: boolean;
    /** Caller-supplied pending count. */ badge?: number;
    /** Open/select panel callback. */ onClick: () => void;
}
export interface NavBarProps {
    items: NavItem[];
}
export function NavBar({ items }: NavBarProps) { return <nav className="mp-nav" aria-label="Game panels">{items.map(item => <button type="button" key={item.id} className={`mp-nav-item ${item.active ? 'mp-nav-active' : ''}`} aria-pressed={!!item.active} onClick={item.onClick}><Glyph name={item.icon} size={20}/><span>{item.label}</span>{!!item.badge && <span className="mp-badge" aria-label={`${item.badge} pending`}>{item.badge}</span>}</button>)}</nav>; }
