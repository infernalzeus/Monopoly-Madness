import React from 'react';
import { SheetShell } from './SheetShell';
import { PlayerIdentity, type PlayerIdentityProps } from './PlayerIdentity';
import { CurrencyAmount } from './CurrencyAmount';
import { KitButton } from './primitives';
export interface TeamSummary {
  /** Team.id. */ id: string;
  /** Team.name. */ name: string;
  /** Resolved member identities. */ members: PlayerIdentityProps[];
  /** Sum of balances, not a fictitious shared bank. */ combinedCash: number;
  /** Caller-authorized join availability. */ canJoin?: boolean;
  /** Rule/consent reason if join blocked. */ disabledReason?: string;
}
export interface TeamsSheetProps {
  /** Teams with resolved members. */ teams: TeamSummary[];
  /** Current team id if assigned. */ yourTeamId?: string;
  /** Join transition. */ onJoin?: (id: string) => void;
  /** Open caller-owned creation flow. */ onCreate?: () => void;
  /** Controlled visibility. */ open?: boolean;
  /** Close sheet. */ onClose?: () => void;
}
export function TeamsSheet({ teams, yourTeamId, onJoin, onCreate, open = true, onClose }: TeamsSheetProps) {
  return <SheetShell title="Teams" open={open} onClose={onClose} footer={onCreate && <KitButton onClick={onCreate}>Create team</KitButton>}><div className="mma-list">{teams.map(team => <article className="mma-list-card" key={team.id}><h3>{team.name}{team.id === yourTeamId && ' · Your team'}</h3><p>Combined cash <CurrencyAmount amount={team.combinedCash} /></p>{team.members.map(member => <PlayerIdentity key={member.name} {...member} size="sm" />)}{team.canJoin && onJoin && <KitButton onClick={() => onJoin(team.id)} disabledReason={team.disabledReason}>Join {team.name}</KitButton>}</article>)}</div></SheetShell>;
}
