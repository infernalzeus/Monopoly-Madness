import React, { useId } from 'react';
import { SheetShell } from './SheetShell';
import { CurrencyAmount } from './CurrencyAmount';
import { KitButton } from './primitives';
export interface TradePropertyChoice {
  /** Actual property id. */ id: string;
  /** Property name. */ name: string;
  /** Explicit caller-derived built-group/ownership lock reason. */ lockedReason?: string;
}
export interface TradeDraft {
  /** Recipient player name. */ toPlayer: string;
  /** Selected property ids on each side. */ offeredProperties: string[];
  /** Requested ids. */ requestedProperties: string[];
  /** Controlled cash inputs; empty input remains empty. */ offeredCash: string;
  /** Requested cash input. */ requestedCash: string;
}
export interface TradePreviewOffer {
  /** Actual offer id. */ id: string;
  /** From player name. */ fromPlayer: string;
  /** Recipient player name. */ toPlayer: string;
  /** Display property names, resolved by caller. */ offeredNames: string[];
  /** Requested names. */ requestedNames: string[];
  /** Cash on each side. */ offeredCash: number;
  /** Requested cash. */ requestedCash: number;
  /** Exact expiry timestamp. */ expiresAt: number;
  /** Derived age label if available; TradeOffer has no createdAt field. */ ageLabel?: string;
  /** Authorized controls supplied by caller. */ canAccept?: boolean;
  /** Can reject as recipient. */ canReject?: boolean;
  /** Can withdraw as sender. */ canCancel?: boolean;
  /** Explicit blocked reason. */ disabledReason?: string;
}
export interface TradeSheetProps {
  /** Actor name. */ you: string;
  /** Eligible recipient names. */ recipients: string[];
  /** Controlled offer form. */ draft: TradeDraft;
  /** Controlled form updates; never commits a trade. */ onDraftChange: (draft: TradeDraft) => void;
  /** Available properties for each side, including visible locked rows. */ offeredChoices: TradePropertyChoice[];
  /** Recipient's choices. */ requestedChoices: TradePropertyChoice[];
  /** Populated pending offer cards. */ offers: TradePreviewOffer[];
  /** Owner's current time; no timer/global clock in this component. */ now: number;
  /** Submit controlled draft. */ onSubmit: () => void;
  /** Optional game transitions. */ onAccept?: (id: string) => void;
  /** Reject transition. */ onReject?: (id: string) => void;
  /** Withdraw transition. */ onCancel?: (id: string) => void;
  /** In-flight write state. */ pending?: boolean;
  /** User-visible write error. */ error?: string;
  /** Caller-computed create eligibility reason. */ submitDisabledReason?: string;
  /** Controlled visibility. */ open?: boolean;
  /** Close callback. */ onClose?: () => void;
}
export function TradeSheet({ you, recipients, draft, onDraftChange, offeredChoices, requestedChoices, offers, now, onSubmit, onAccept, onReject, onCancel, pending = false, error, submitDisabledReason, open = true, onClose }: TradeSheetProps) {
  const id = useId(); const update = (patch: Partial<TradeDraft>) => onDraftChange({ ...draft, ...patch });
  const choices = (list: TradePropertyChoice[], side: 'offeredProperties' | 'requestedProperties') => list.map(p => <div key={p.id}><label className="mma-choice"><input type="checkbox" checked={draft[side].includes(p.id)} disabled={!!p.lockedReason || pending} onChange={e => update({ [side]: e.target.checked ? [...draft[side], p.id] : draft[side].filter(v => v !== p.id) })} aria-describedby={p.lockedReason ? `${id}-${side}-${p.id}` : undefined} />{p.name}</label>{p.lockedReason && <p className="mma-reason" id={`${id}-${side}-${p.id}`}>{p.lockedReason}</p>}</div>);
  return <SheetShell title="Trading market" open={open} onClose={onClose} footer={<><KitButton variant="primary" onClick={onSubmit} disabledReason={pending ? 'Sending offer…' : submitDisabledReason}>Send trade offer</KitButton>{error && <p role="alert" className="mma-tone-loss">{error}</p>}</>}><label className="mma-label" htmlFor={`${id}-recipient`}>Trade with</label><select className="mma-input" id={`${id}-recipient`} value={draft.toPlayer} disabled={pending} onChange={e => update({ toPlayer: e.target.value })}><option value="">Choose player</option>{recipients.map(name => <option key={name}>{name}</option>)}</select>
    <div className="mma-trade-sides"><fieldset className="mma-fieldset"><legend>You give · {you}</legend>{choices(offeredChoices, 'offeredProperties')}<label className="mma-label" htmlFor={`${id}-give`}>Cash you give ($)</label><input id={`${id}-give`} className="mma-input" type="number" inputMode="numeric" min={0} step={1} value={draft.offeredCash} disabled={pending} onChange={e => update({ offeredCash: e.target.value })} /></fieldset><fieldset className="mma-fieldset"><legend>You receive · {draft.toPlayer || 'Recipient'}</legend>{choices(requestedChoices, 'requestedProperties')}<label className="mma-label" htmlFor={`${id}-get`}>Cash you request ($)</label><input id={`${id}-get`} className="mma-input" type="number" inputMode="numeric" min={0} step={1} value={draft.requestedCash} disabled={pending} onChange={e => update({ requestedCash: e.target.value })} /></fieldset></div>
    <h3>Pending offers</h3><div className="mma-list">{offers.map(o => { const expired = now >= o.expiresAt; const remaining = Math.max(0, Math.ceil((o.expiresAt - now) / 60000)); const reason = expired ? 'This offer has expired.' : o.disabledReason; return <article className="mma-list-card" key={o.id}><h3>{o.fromPlayer} → {o.toPlayer}</h3><p>Gives: {o.offeredNames.join(', ') || 'No properties'} · <CurrencyAmount amount={o.offeredCash} /></p><p>Requests: {o.requestedNames.join(', ') || 'No properties'} · <CurrencyAmount amount={o.requestedCash} /></p><p className="mma-muted">{o.ageLabel ? `${o.ageLabel} · ` : ''}{expired ? 'Expired' : `Expires in ${remaining} min`}</p><div className="mma-actions">{o.canAccept && onAccept && <KitButton variant="primary" disabledReason={reason} onClick={() => onAccept(o.id)}>Accept</KitButton>}{o.canReject && onReject && <KitButton onClick={() => onReject(o.id)}>Reject</KitButton>}{o.canCancel && onCancel && <KitButton onClick={() => onCancel(o.id)}>Withdraw</KitButton>}</div></article>; })}</div></SheetShell>;
}
