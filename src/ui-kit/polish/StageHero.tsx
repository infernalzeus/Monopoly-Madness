import React, { type ReactNode } from 'react';
import { Glyph, type GlyphName } from './shared';
export interface StageHeroProps {
    /** Kind icon. */ icon: GlyphName;
    /** Main readable title. */ title: string;
    /** Description or rule explanation. */ children?: ReactNode;
}
export function StageHero({ icon, title, children }: StageHeroProps) { return <div className="mp-hero"><span className="mp-hero-icon"><Glyph name={icon} size={36}/></span><h3>{title}</h3>{children && <div className="mp-muted">{children}</div>}</div>; }
