import React from 'react';
import { SheetShell } from './SheetShell';
import { CurrencyAmount } from './CurrencyAmount';
export interface LogEntry {
  /** GameEvent id. */ id: string;
  /** GameEvent.player. */ player: string;
  /** GameEvent.message. */ message: string;
  /** Signed GameEvent.amount. */ amount?: number;
  /** Display time derived from GameEvent.timestamp. */ timeLabel: string;
  /** GameEvent.type presentation label. */ type: string;
}
export interface LogSheetProps {
  /** Caller-ordered recent events (newest first recommended). */ entries: LogEntry[];
  /** Controlled visibility. */ open?: boolean;
  /** Close sheet. */ onClose?: () => void;
}
export function LogSheet({ entries, open = true, onClose }: LogSheetProps) {
  return <SheetShell title="Game log" open={open} onClose={onClose}><ol className="mma-list mma-log">{entries.map(entry => <li className="mma-list-card" key={entry.id}><div className="mma-row"><strong>{entry.player}</strong><span className="mma-muted">{entry.timeLabel}</span></div><p className="mma-eyebrow">{entry.type}</p><p>{entry.message}</p>{entry.amount !== undefined && <CurrencyAmount amount={entry.amount} signed />}</li>)}</ol></SheetShell>;
}
