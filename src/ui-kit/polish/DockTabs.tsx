import React from 'react';
import { Glyph } from './shared';
import type { NavBarProps } from './NavBar';
/** Desktop panel navigation; buttons are not ARIA tabs because caller owns panel lifecycle. */
export function DockTabs({ items }: NavBarProps) { return <nav className="mp-dock-tabs" aria-label="Dock panels">{items.map(item => <button type="button" key={item.id} className={`mp-button ${item.active ? 'mp-primary' : ''}`} onClick={item.onClick} aria-pressed={!!item.active}><Glyph name={item.icon} size={18}/>{item.label}{!!item.badge && <span className="mp-badge-inline">{item.badge}</span>}</button>)}</nav>; }
