import React from 'react';
import { Glyph, ActionButton, type Action, type GlyphName } from './shared';
export interface EmptyStateProps {
    title: string; /** Useful next-step explanation. */
    detail: string; /** Contextual SVG. */
    icon?: GlyphName; /** Optional authorized next step. */
    action?: Action;
}
export function EmptyState({ title, detail, icon = 'city', action }: EmptyStateProps) { return <section className="mp-empty mp-surface"><Glyph name={icon} size={40}/><h2>{title}</h2><p className="mp-muted">{detail}</p>{action && <ActionButton action={action}/>}</section>; }
