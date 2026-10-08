import React from 'react';
import { Confetti, Glyph, money, type Action, type Identity } from './shared';
import { Token } from './Token';
import { StageActions } from './StageActions';
import { PlayerRow } from './ListRow';
export interface Standing {
    player: Identity; /** Exact caller-computed rank. */
    rank: number; /** Exact caller-computed worth. */
    netWorth: number;
}
export interface GameOverStageProps {
    /** Caller-resolved winner or representative token. */ winner: Identity;
    /** Winner/team display label. */ winnerLabel: string;
    /** Already ordered caller-computed standings. */ standings: Standing[];
    /** Back/rematch actions with caller authority. */ actions: Action[];
}
export function GameOverStage({ winner, winnerLabel, standings, actions }: GameOverStageProps) { return <section className="mp-surface mp-game-over"><div className="mp-podium"><Confetti /><Glyph name="trophy" size={36}/><Token player={winner} size={64} active/><p className="mp-eyebrow">Game complete</p><h2>{winnerLabel} wins</h2></div><ol className="mp-standings">{standings.map(s => <li key={s.player.id}><PlayerRow player={s.player} title={`#${s.rank} ${s.player.name}`} detail="Final net worth" trailing={money(s.netWorth)}/></li>)}</ol><StageActions actions={actions}/></section>; }
