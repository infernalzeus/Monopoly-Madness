import React, { type ButtonHTMLAttributes, type ReactNode, useId } from 'react';
import { Icon } from './icons';
export interface KitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Bright fill or neutral outline. */ variant?: 'primary' | 'secondary' | 'danger';
  /** Plain-language reason shown below a disabled action. */ disabledReason?: string;
}
export function KitButton({ variant = 'secondary', disabledReason, children, className = '', disabled, ...props }: KitButtonProps) {
  const id = useId(); const isDisabled = disabled || !!disabledReason;
  return <div className="mma-button-wrap"><button type="button" {...props} disabled={isDisabled} aria-describedby={disabledReason ? id : props['aria-describedby']} className={`mma-button mma-button-${variant} ${className}`}>{children}</button>{disabledReason && <p id={id} className="mma-reason">{disabledReason}</p>}</div>;
}
export interface TimerRingProps {
  /** Caller-owned countdown; never starts a clock. */ seconds: number;
  /** Effective total/extension denominator from caller. */ total?: number;
}
export function TimerRing({ seconds, total = 60 }: TimerRingProps) {
  const remaining = Math.max(0, Math.ceil(seconds)); const fraction = Math.min(1, Math.max(0, remaining / Math.max(total, 1)));
  return <div className={`mma-timer ${remaining < 10 ? 'mma-tone-warning' : 'mma-tone-info'}`} aria-label={`${remaining} seconds remaining`}>
    <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27" className="mma-ring-track" /><circle cx="32" cy="32" r="27" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - fraction * 100} className="mma-ring-fill" /></svg>
    <strong aria-hidden="true">{remaining}<span>s</span></strong>
  </div>;
}
export function SheetHeading({ title, titleId, onClose }: { title: string; titleId: string; onClose?: () => void }) {
  return <header className="mma-panel-header"><h2 id={titleId}>{title}</h2>{onClose && <KitButton aria-label={`Close ${title}`} onClick={onClose}><Icon name="close" /></KitButton>}</header>;
}
export interface ActionOption {
  /** Complete visible action label. */ label: string;
  /** Owner's action callback. */ onClick: () => void;
  /** Explicitly disable the action. */ disabled?: boolean;
  /** Owner-supplied rule/write reason. */ disabledReason?: string;
}
export function DialogActions({ primary, secondary }: { primary: ActionOption; secondary?: ActionOption }) {
  return <div className="mma-actions"><KitButton variant="primary" onClick={primary.onClick} disabled={primary.disabled} disabledReason={primary.disabledReason}>{primary.label}<Icon name="arrow" /></KitButton>{secondary && <KitButton onClick={secondary.onClick} disabled={secondary.disabled} disabledReason={secondary.disabledReason}>{secondary.label}</KitButton>}</div>;
}
export function Fact({ label, children }: { label: string; children: ReactNode }) { return <div className="mma-fact"><span>{label}</span><strong>{children}</strong></div>; }
