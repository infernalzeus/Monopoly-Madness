import React from 'react';
import { Glyph, type GlyphName } from './shared';
export interface ToastProps {
    /** Message title. */ title: string;
    /** Supporting explanation. */ detail?: string;
    /** Semantic visual accent. */ tone?: 'info' | 'gain' | 'loss';
    /** Original SVG treatment. */ icon?: GlyphName;
    /** Optional caller-owned dismissal; no automatic timers. */ onDismiss?: () => void;
}
export function Toast({ title, detail, tone = 'info', icon = 'log', onDismiss }: ToastProps) { return <div className={`mp-toast mp-${tone}`} role="status"><Glyph name={icon}/><div className="mp-grow"><strong>{title}</strong>{detail && <p className="mp-muted">{detail}</p>}</div>{onDismiss && <button type="button" className="mp-button mp-close" aria-label={`Dismiss ${title}`} onClick={onDismiss}><Glyph name="close"/></button>}</div>; }
