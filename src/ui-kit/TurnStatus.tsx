import React from 'react';
import { TimerRing } from './primitives';
import { Icon } from './icons';
export interface TurnStatusProps {
  /** Resolved current player's name. */ actorName: string;
  /** Whether this client owns the turn. */ isMine: boolean;
  /** Caller-owned seconds; absent means no countdown. */ secondsLeft?: number;
  /** Effective total seconds for timer display. */ totalSeconds?: number;
  /** Human-readable phase label, supplied by the adapter. */ phase: string;
}
export function TurnStatus({ actorName, isMine, secondsLeft, totalSeconds = 60, phase }: TurnStatusProps) {
  const turnLabel = `${isMine ? 'Your turn' : `${actorName}'s turn`}`;
  return <div className="mma-ui mma-turn"><div className="mma-grow"><p className="mma-eyebrow"><Icon name="dice" /> {turnLabel}</p><strong>{phase}</strong></div>{secondsLeft !== undefined && <TimerRing seconds={secondsLeft} total={totalSeconds} />}<span className="mma-sr" aria-live="polite" aria-atomic="true">{turnLabel}</span></div>;
}
