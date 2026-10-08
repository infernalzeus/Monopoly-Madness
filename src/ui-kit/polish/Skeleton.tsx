import React from 'react';
export interface SkeletonProps {
    rows?: number; /** Accessible loading description. */
    label?: string;
}
export function Skeleton({ rows = 3, label = 'Loading panel' }: SkeletonProps) { return <div className="mp-skeleton" role="status" aria-label={label}>{Array.from({ length: Math.max(1, Math.min(8, rows)) }, (_, i) => <div key={i} aria-hidden="true"><i /><span /></div>)}</div>; }
