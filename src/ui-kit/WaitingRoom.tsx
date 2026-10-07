import React from 'react';
import { PlayerIdentity, type PlayerIdentityProps } from './PlayerIdentity';
import { KitButton } from './primitives';
import { Icon } from './icons';
export interface WaitingRoomProps {
  /** Exact room code. */ roomCode: string;
  /** Current seat identities and presence. */ seats: PlayerIdentityProps[];
  /** Configured maximum seats. */ maxPlayers: number;
  /** Whether local client is host. */ isHost?: boolean;
  /** Caller-approved start action. */ onStart?: () => void;
  /** Start availability reason, not calculated here. */ startDisabledReason?: string;
  /** Clipboard action delegated to caller. */ onCopy: (code: string) => void;
  /** Caller confirms copy succeeded. */ copied?: boolean;
  /** Optional host editor entry. */ onEditProperties?: () => void;
}
export function WaitingRoom({ roomCode, seats, maxPlayers, isHost = false, onStart, startDisabledReason, onCopy, copied = false, onEditProperties }: WaitingRoomProps) {
  return <section className="mma-ui mma-waiting"><header><p className="mma-eyebrow"><Icon name="team" /> Waiting room</p><h2>Ready when your group is</h2><div className="mma-room-code"><div><span>Room code</span><strong>{roomCode}</strong></div><KitButton aria-label={`Copy room code ${roomCode}`} onClick={() => onCopy(roomCode)}><Icon name={copied ? 'check' : 'copy'} />{copied ? 'Copied' : 'Copy'}</KitButton></div><p>{seats.length} of {maxPlayers} seats filled</p><span className="mma-sr" aria-live="polite">{copied ? 'Room code copied' : ''}</span></header><div className="mma-list">{seats.map((seat, i) => <PlayerIdentity key={`${seat.name}-${i}`} {...seat} marker={seat.marker ?? i + 1} />)}</div><footer className="mma-waiting-footer">{isHost && onStart ? <KitButton variant="primary" onClick={onStart} disabledReason={startDisabledReason}>Start game</KitButton> : <p>Waiting for the host to start.</p>}{isHost && onEditProperties && <KitButton onClick={onEditProperties}>Property editor</KitButton>}</footer></section>;
}
