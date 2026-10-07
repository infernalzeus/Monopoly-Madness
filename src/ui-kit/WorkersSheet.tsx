import React, { useId } from 'react';
import { SheetShell } from './SheetShell';
import { KitButton } from './primitives';
import { Icon } from './icons';
export interface WorkerAssignment {
  /** Property id. */ propertyId: string;
  /** Property name. */ propertyName: string;
  /** Caller-selected worker colour. */ color: string;
  /** Existing assignment flag. */ assigned: boolean;
  /** Caller-computed building/assignment reason. */ disabledReason?: string;
}
export interface WorkersSheetProps {
  /** Eligible and locked properties with current assignments. */ assignments: WorkerAssignment[];
  /** Assign worker transition. */ onAssign: (propertyId: string) => void;
  /** Remove worker transition. */ onRemove: (propertyId: string) => void;
  /** Controlled colour updates. */ onColorChange: (propertyId: string, color: string) => void;
  /** Controlled visibility. */ open?: boolean;
  /** Close sheet. */ onClose?: () => void;
}
export function WorkersSheet({ assignments, onAssign, onRemove, onColorChange, open = true, onClose }: WorkersSheetProps) {
  const id = useId();
  return <SheetShell title="Worker assignments" open={open} onClose={onClose}><p>Workers build when you pass GO, subject to the game's building rules.</p><div className="mma-list">{assignments.map(a => <article className="mma-list-card" key={a.propertyId}><h3><Icon name="worker" /> {a.propertyName}</h3><p>{a.assigned ? 'Worker assigned' : 'No worker assigned'}</p><label className="mma-label" htmlFor={`${id}-${a.propertyId}`}>Worker colour for {a.propertyName}</label><input id={`${id}-${a.propertyId}`} type="color" className="mma-input mma-color-input" value={a.color} onChange={e => onColorChange(a.propertyId, e.target.value)} /><KitButton onClick={() => a.assigned ? onRemove(a.propertyId) : onAssign(a.propertyId)} disabledReason={a.disabledReason}>{a.assigned ? 'Remove worker' : 'Assign worker'}</KitButton></article>)}</div></SheetShell>;
}
