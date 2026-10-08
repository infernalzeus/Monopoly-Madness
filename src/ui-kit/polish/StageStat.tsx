import React, { type ReactNode } from 'react';
export interface StageStatProps {
    label: string; /** Exact caller-owned value. */
    value: ReactNode; /** Optional contextual help. */
    detail?: string;
}
export function StageStat({ label, value, detail }: StageStatProps) { return <div className="mp-stat"><span className="mp-muted">{label}</span><strong>{value}</strong>{detail && <span className="mp-muted">{detail}</span>}</div>; }
