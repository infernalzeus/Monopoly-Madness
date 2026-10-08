import React from 'react';
import { Confetti, Glyph } from './shared';
export interface AchievementPopProps {
    title: string; /** Caller-supplied explanation. */
    detail: string;
}
/** Remount using the achievement event id; owner controls dismissal/lifetime. */
export function AchievementPop({ title, detail }: AchievementPopProps) { return <section className="mp-achievement mp-surface" role="status"><Confetti /><Glyph name="trophy" size={40}/><p className="mp-eyebrow">Achievement unlocked</p><h2>{title}</h2><p className="mp-muted">{detail}</p></section>; }
