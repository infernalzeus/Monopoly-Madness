import React, { type ReactNode } from 'react';
export interface BoardFrameProps {
    /** Caller-owned tile grid and centre content. */ children: ReactNode;
    /** Accessible board label. */ label?: string;
    /** Disable the subtle backdrop animation. */ ambient?: boolean;
}
/** Pure frame: does not position tokens or decide board geometry. */
export function BoardFrame({ children, label = 'Monopoly board', ambient = true }: BoardFrameProps) { return <section className={`mp-board-frame ${ambient ? 'mp-ambient' : ''}`} aria-label={label}><div className="mp-board-backdrop" aria-hidden="true"/><div className="mp-board-content">{children}</div></section>; }
