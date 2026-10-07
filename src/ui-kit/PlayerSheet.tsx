import React from 'react';
import { SheetShell } from './SheetShell';
import { PlayerIdentity, type PlayerIdentityProps } from './PlayerIdentity';
import { CurrencyAmount } from './CurrencyAmount';
import { KitButton, Fact } from './primitives';
export interface PortfolioProperty {
  /** Property id returned to callbacks. */ id: string;
  /** Property label. */ name: string;
  /** Group name for presentation. */ group?: string;
  /** Current value. */ value: number;
  /** Payable current rent, computed by caller. */ rent?: number;
  /** Dice-based/other rent description if needed. */ rentLabel?: string;
  /** Mortgage state. */ isMortgaged?: boolean;
  /** Neutral tile state. */ isInactive?: boolean;
  /** Correct legal action label including price. */ actionLabel?: string;
  /** Caller-provided eligibility reason. */ disabledReason?: string;
}
export interface PlayerSheetProps {
  /** Player presentation data. */ player: PlayerIdentityProps;
  /** Cash balance. */ balance: number;
  /** Correct net worth/rank from caller. */ netWorth: number;
  /** Optional rank. */ rank?: number;
  /** Ordered portfolio rows. */ properties: PortfolioProperty[];
  /** Caller-approved property action. */ onPropertyAction?: (id: string) => void;
  /** Optional controlled order change; keyboard-operable alternative to dragging. */ onReorder?: (ids: string[]) => void;
  /** Controlled visibility. */ open?: boolean;
  /** Close sheet. */ onClose?: () => void;
}
export function PlayerSheet({ player, balance, netWorth, rank, properties, onPropertyAction, onReorder, open = true, onClose }: PlayerSheetProps) {
  const move = (index: number, direction: number) => { const ids = properties.map(p => p.id); [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]]; onReorder?.(ids); };
  return <SheetShell title="Your portfolio" open={open} onClose={onClose}><PlayerIdentity {...player} /><div className="mma-facts"><Fact label="Cash"><CurrencyAmount amount={balance} /></Fact><Fact label="Net worth"><CurrencyAmount amount={netWorth} /></Fact>{rank !== undefined && <Fact label="Rank">#{rank}</Fact>}</div><div className="mma-list">{properties.map((p, i) => <article className="mma-list-card" key={p.id}><p className="mma-eyebrow">{p.group ?? 'Property'}</p><h3>{p.name}</h3><p>Market <CurrencyAmount amount={p.value} /></p><p>{p.isInactive ? 'Neutral · inactive' : p.isMortgaged ? 'Mortgaged · no rent' : p.rentLabel ?? (p.rent !== undefined ? <>Rent <CurrencyAmount amount={p.rent} /></> : 'Rent not provided')}</p>{p.actionLabel && onPropertyAction && <KitButton disabledReason={p.disabledReason} onClick={() => onPropertyAction(p.id)}>{p.actionLabel}</KitButton>}{onReorder && <div className="mma-actions"><KitButton aria-label={`Move ${p.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>Move up</KitButton><KitButton aria-label={`Move ${p.name} down`} disabled={i === properties.length - 1} onClick={() => move(i, 1)}>Move down</KitButton></div>}</article>)}</div></SheetShell>;
}
