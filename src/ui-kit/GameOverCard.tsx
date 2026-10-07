import React from 'react';
import { CurrencyAmount } from './CurrencyAmount';
import { PlayerIdentity, type PlayerIdentityProps } from './PlayerIdentity';
import { KitButton } from './primitives';
import { Icon } from './icons';
export interface Standing {
  /** Identity in final order. */ player: PlayerIdentityProps;
  /** Final rank from caller. */ rank: number;
  /** Final net worth, computed by caller. */ netWorth: number;
}
export interface GameOverCardProps {
  /** Winner name or team presentation. */ winnerName: string;
  /** Team name for team victory. */ winnerTeamName?: string;
  /** Final standings, already sorted. */ standings: Standing[];
  /** Return to lobby callback. */ onBackToLobby: () => void;
  /** Host-controlled permission, false by default. */ isHost?: boolean;
  /** True only if a real rematch flow exists. */ canRematch?: boolean;
  /** Actual rematch callback, never simulated. */ onRematch?: () => void;
}
export function GameOverCard({ winnerName, winnerTeamName, standings, onBackToLobby, isHost = false, canRematch = false, onRematch }: GameOverCardProps) {
  return <section className="mma-ui mma-game-over"><p className="mma-eyebrow"><Icon name="trophy" /> Game complete</p><h2>{winnerTeamName ? `${winnerTeamName} wins` : `${winnerName} wins`}</h2><p>Final standings</p><ol className="mma-list mma-standings">{standings.map(s => <li className="mma-list-card" key={s.player.name}><div className="mma-row"><strong>#{s.rank}</strong><PlayerIdentity {...s.player} size="sm" /></div><p>Net worth <CurrencyAmount amount={s.netWorth} /></p></li>)}</ol><div className="mma-actions"><KitButton variant="primary" onClick={onBackToLobby}>Back to lobby</KitButton>{isHost && canRematch && onRematch && <KitButton onClick={onRematch}>Rematch</KitButton>}</div></section>;
}
