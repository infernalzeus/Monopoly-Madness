import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Users, Shield, UserPlus, Trophy, Coins } from 'lucide-react';
import { Player, Team } from '@/types/game';

interface TeamPanelProps {
  currentPlayer: Player;
  teams: Team[];
  players?: Player[];
  onJoinTeam: (teamId: string) => void;
  onCreateTeam: (teamName: string) => void;
  /** Alliances are fixed after the first round */
  locked?: boolean;
}

const TeamPanel: React.FC<TeamPanelProps> = ({ currentPlayer, teams, players = [], onJoinTeam, onCreateTeam, locked = false }) => {
  const [newTeamName, setNewTeamName] = useState('');
  const playerTeam = teams.find(t => t.members.includes(currentPlayer.id));

  return (
    <Card className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border-indigo-500/30 backdrop-blur-sm shadow-xl">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-indigo-100 text-lg">
          <Users className="w-5 h-5 text-indigo-400" />
          Teams
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {locked && !playerTeam ? (
          <p className="text-xs text-indigo-300/80 bg-indigo-500/10 p-2 rounded border border-indigo-500/20">Alliances are locked — teams can only be formed during the first round.</p>
        ) : !playerTeam ? (
          <div className="space-y-4">
            <p className="text-xs text-indigo-300/70 bg-indigo-500/10 p-2 rounded border border-indigo-500/20">
              Team up to share monopoly color bonuses! Each player keeps their own turn and balance, but color groups count across teammates.
            </p>
            {teams.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-indigo-200 uppercase tracking-wider">Available Teams</h4>
                {teams.filter(t => t.members.length < 4).map(team => {
                  const memberPlayers = players.filter(p => team.members.includes(p.id));
                  const combined = memberPlayers.reduce((s, p) => s + p.balance, 0);
                  return (
                    <Button key={team.id} onClick={() => onJoinTeam(team.id)} variant="outline" size="sm"
                      className="w-full justify-between bg-indigo-950/30 border-indigo-500/30 hover:bg-indigo-500/20 text-indigo-100">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: team.color }} />
                        <span>{team.name}</span>
                        <span className="text-indigo-400 text-xs">{team.members.length} members</span>
                      </div>
                      <span className="text-emerald-400 font-mono text-xs">${(combined / 1000).toFixed(0)}K total</span>
                    </Button>
                  );
                })}
              </div>
            )}
            <div className="space-y-2 pt-2 border-t border-indigo-500/20">
              <h4 className="text-xs font-bold text-indigo-200 uppercase tracking-wider">Create Team</h4>
              <div className="flex gap-2">
                <Input placeholder="Team Name" value={newTeamName} onChange={e => setNewTeamName(e.target.value)}
                  className="bg-indigo-950/50 border-indigo-500/30 text-indigo-100 placeholder:text-indigo-400/40 h-8" />
                <Button onClick={() => { if (newTeamName.trim()) { onCreateTeam(newTeamName.trim()); setNewTeamName(''); } }}
                  size="sm" disabled={!newTeamName.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white h-8">
                  <UserPlus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge style={{ backgroundColor: playerTeam.color }} className="text-white px-3 py-1 text-sm font-bold shadow-lg">
                <Shield className="w-3 h-3 mr-1" />
                {playerTeam.name}
              </Badge>
              <span className="text-xs text-indigo-300">{playerTeam.members.length} members</span>
            </div>
            <div className="space-y-2">
              {players.filter(p => playerTeam.members.includes(p.id)).map(member => (
                <div key={member.id} className="flex items-center justify-between bg-indigo-950/30 rounded-lg p-2 border border-indigo-500/20">
                  <div className="flex items-center gap-2">
                    <span dangerouslySetInnerHTML={{ __html: member.pieceIcon }} />
                    <span className="text-sm text-indigo-100 font-medium">{member.name}</span>
                    {member.id === currentPlayer.id && <Badge className="text-[0.6rem] bg-indigo-500/30 text-indigo-300 border-0 py-0">You</Badge>}
                  </div>
                  <span className="text-emerald-400 font-mono text-xs">${(member.balance / 1000).toFixed(0)}K</span>
                </div>
              ))}
            </div>
            <div className="bg-indigo-950/40 rounded-lg p-3 border border-indigo-500/20">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-indigo-300 flex items-center gap-1"><Coins className="w-3 h-3" /> Combined Wealth</span>
                <Trophy className="w-3 h-3 text-amber-400" />
              </div>
              <div className="text-xl font-bold text-emerald-400 font-mono">
                ${(players.filter(p => playerTeam.members.includes(p.id)).reduce((s, p) => s + p.balance, 0) / 1000).toFixed(0)}K
              </div>
            </div>
            <p className="text-[10px] text-indigo-400/60 italic text-center">
              Color group bonuses count across all teammates' properties!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TeamPanel;
