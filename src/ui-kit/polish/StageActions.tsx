import React from 'react';
import { ActionButton, type Action } from './shared';
export interface StageActionsProps {
    actions: Action[];
}
export function StageActions({ actions }: StageActionsProps) { return <div className="mp-stage-actions">{actions.map(action => <ActionButton key={action.id} action={action}/>)}</div>; }
