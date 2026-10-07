import React, { useState } from 'react';
import { hasBuildingsInGroup } from '@/gameEngine/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Handshake, Plus, DollarSign, Home, Users, X } from 'lucide-react';
import { Property, Player, TradeOffer } from '@/types/game';

interface TradingSystemProps {
  currentPlayer: Player;
  allPlayers: Player[];
  ownedProperties: Property[];       // current player's properties
  allProperties: Property[];          // all board properties (for target player's holdings)
  tradeOffers: TradeOffer[];
  onCreateTradeOffer: (toPlayer: string, offeredProperties: string[], requestedProperties: string[], offeredCash: number, requestedCash: number) => void;
  onAcceptTradeOffer: (offerId: string, acceptorName?: string) => void;
  onRejectTradeOffer: (offerId: string) => void;
  onCancelTradeOffer: (offerId: string) => void;
  onPlaceTradeBid: (offerId: string, bidAmount: number) => void;
}

const TradingSystem: React.FC<TradingSystemProps> = ({
  currentPlayer,
  allPlayers,
  ownedProperties,
  allProperties,
  tradeOffers,
  onCreateTradeOffer,
  onAcceptTradeOffer,
  onRejectTradeOffer,
  onCancelTradeOffer,
}) => {
  const [showCreateTrade, setShowCreateTrade] = useState(false);
  const [selectedOfferedProperties, setSelectedOfferedProperties] = useState<string[]>([]);
  const [selectedRequestedProperties, setSelectedRequestedProperties] = useState<string[]>([]);
  const [offeredCash, setOfferedCash] = useState<string>('');
  const [requestedCash, setRequestedCash] = useState<string>('');
  // targetPlayer stores player NAME for consistency with TradeOffer.toPlayer
  const [targetPlayer, setTargetPlayer] = useState<string>('');

  // Properties in a colour group with buildings can't be traded until the buildings are sold
  const tradableOwned = ownedProperties.filter(p => !hasBuildingsInGroup(allProperties, p));
  const targetPlayerData = allPlayers.find(p => p.name === targetPlayer);
  const targetPlayerProperties = targetPlayerData
    ? allProperties.filter(p => p.owner === targetPlayerData.name && !p.isInactive && !hasBuildingsInGroup(allProperties, p))
    : [];

  const handleCreateTrade = () => {
    if (!targetPlayer) return;
    if (selectedOfferedProperties.length === 0 && parseInt(offeredCash) <= 0) return;
    onCreateTradeOffer(
      targetPlayer,
      selectedOfferedProperties,
      selectedRequestedProperties,
      parseInt(offeredCash) || 0,
      parseInt(requestedCash) || 0
    );
    setShowCreateTrade(false);
    setSelectedOfferedProperties([]);
    setSelectedRequestedProperties([]);
    setOfferedCash('');
    setRequestedCash('');
    setTargetPlayer('');
  };

  const toggleOffered = (propertyId: string) =>
    setSelectedOfferedProperties(prev =>
      prev.includes(propertyId) ? prev.filter(id => id !== propertyId) : [...prev, propertyId]
    );

  const toggleRequested = (propertyId: string) =>
    setSelectedRequestedProperties(prev =>
      prev.includes(propertyId) ? prev.filter(id => id !== propertyId) : [...prev, propertyId]
    );

  const pendingOffers = tradeOffers.filter(o => o.status === 'pending');
  const resolvedOffers = tradeOffers.filter(o => o.status !== 'pending');

  const renderPropertyName = (propId: string) => {
    const prop = allProperties.find(p => p.id === propId);
    return prop ? prop.name : propId;
  };

  return (
    <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-purple-400 shadow-lg">
      <CardHeader>
        <CardTitle className="text-purple-300 text-xl font-bold flex items-center gap-2">
          <Handshake className="w-6 h-6" />
          Trading Market
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Create Trade Offer */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-purple-300">New Trade</h3>
            <Button
              onClick={() => { setShowCreateTrade(!showCreateTrade); }}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              {showCreateTrade ? 'Cancel' : 'Create Trade'}
            </Button>
          </div>

          {showCreateTrade && (
            <div className="bg-slate-700/50 p-4 rounded-lg border border-purple-400/30 space-y-4">
              {/* Target Player */}
              <div>
                <label className="text-sm font-bold text-purple-200 mb-2 block">Trade With</label>
                <Select value={targetPlayer} onValueChange={v => { setTargetPlayer(v); setSelectedRequestedProperties([]); }}>
                  <SelectTrigger className="bg-slate-600 border-purple-400/50 text-purple-100">
                    <SelectValue placeholder="Select player" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-purple-400/50">
                    {allPlayers
                      .filter(p => p.id !== currentPlayer.id && p.isActive)
                      .map(player => (
                        <SelectItem key={player.id} value={player.name} className="text-purple-200">
                          {player.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Your Properties (offered) */}
              <div>
                <label className="text-sm font-bold text-purple-200 mb-2 block">
                  <Home className="w-3 h-3 inline mr-1" />
                  Properties You're Offering
                </label>
                <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                  {tradableOwned.length === 0 ? (
                    <p className="text-slate-500 text-xs italic">You own no properties.</p>
                  ) : tradableOwned.map(property => (
                    <div
                      key={property.id}
                      className={`p-2 rounded border cursor-pointer transition-colors text-sm ${
                        selectedOfferedProperties.includes(property.id)
                          ? 'border-green-400 bg-green-500/20 text-green-200'
                          : 'border-slate-600 hover:border-purple-400 text-purple-200'
                      }`}
                      onClick={() => toggleOffered(property.id)}
                    >
                      {property.name}
                      <span className="text-xs text-slate-400 ml-2">${property.currentValue.toLocaleString('en-US')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Target Player's Properties (requested) */}
              {targetPlayer && (
                <div>
                  <label className="text-sm font-bold text-purple-200 mb-2 block">
                    <Home className="w-3 h-3 inline mr-1" />
                    Properties You're Requesting from {targetPlayer}
                  </label>
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {targetPlayerProperties.length === 0 ? (
                      <p className="text-slate-500 text-xs italic">{targetPlayer} owns no properties.</p>
                    ) : targetPlayerProperties.map(property => (
                      <div
                        key={property.id}
                        className={`p-2 rounded border cursor-pointer transition-colors text-sm ${
                          selectedRequestedProperties.includes(property.id)
                            ? 'border-yellow-400 bg-yellow-500/20 text-yellow-200'
                            : 'border-slate-600 hover:border-purple-400 text-purple-200'
                        }`}
                        onClick={() => toggleRequested(property.id)}
                      >
                        {property.name}
                        <span className="text-xs text-slate-400 ml-2">${property.currentValue.toLocaleString('en-US')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cash */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold text-purple-200 mb-1 block">
                    <DollarSign className="w-3 h-3 inline" /> Cash You're Offering
                  </label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={offeredCash}
                    onChange={e => setOfferedCash(e.target.value)}
                    className="bg-slate-600 border-purple-400/50 text-purple-100"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-purple-200 mb-1 block">
                    <DollarSign className="w-3 h-3 inline" /> Cash You Want
                  </label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={requestedCash}
                    onChange={e => setRequestedCash(e.target.value)}
                    className="bg-slate-600 border-purple-400/50 text-purple-100"
                  />
                </div>
              </div>

              <Button
                onClick={handleCreateTrade}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold"
                disabled={!targetPlayer || (selectedOfferedProperties.length === 0 && !(parseInt(offeredCash) > 0))}
              >
                <Handshake className="w-4 h-4 mr-2" />
                Send Trade Offer
              </Button>
            </div>
          )}
        </div>

        {/* Pending Offers */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-purple-300 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Active Offers
          </h3>

          {pendingOffers.length === 0 && (
            <div className="text-center text-purple-400 py-6">
              <Handshake className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No pending trades</p>
            </div>
          )}

          <div className="space-y-3 max-h-72 overflow-y-auto">
            {pendingOffers.map(offer => {
              const isMyOffer = offer.fromPlayer === currentPlayer.name;
              const isForMe = offer.toPlayer === currentPlayer.name;
              return (
                <div key={offer.id} className="bg-slate-700/50 p-4 rounded-lg border border-purple-400/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-purple-200 font-semibold text-sm">
                      {offer.fromPlayer} → {offer.toPlayer}
                    </span>
                    {isMyOffer && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onCancelTradeOffer(offer.id)}
                        className="h-6 w-6 p-0 text-slate-400 hover:text-red-400"
                        title="Cancel offer"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-green-300 font-semibold mb-1">Offering:</div>
                      {offer.offeredProperties.map(id => (
                        <div key={id} className="text-purple-200">🏠 {renderPropertyName(id)}</div>
                      ))}
                      {offer.offeredCash > 0 && (
                        <div className="text-green-300">💰 ${offer.offeredCash.toLocaleString('en-US')}</div>
                      )}
                    </div>
                    <div>
                      <div className="text-yellow-300 font-semibold mb-1">Requesting:</div>
                      {offer.requestedProperties.map(id => (
                        <div key={id} className="text-purple-200">🏠 {renderPropertyName(id)}</div>
                      ))}
                      {offer.requestedCash > 0 && (
                        <div className="text-red-300">💰 ${offer.requestedCash.toLocaleString('en-US')}</div>
                      )}
                      {offer.requestedProperties.length === 0 && offer.requestedCash === 0 && (
                        <div className="text-slate-500 italic">Nothing</div>
                      )}
                    </div>
                  </div>

                  {!isForMe && (
                    <p className="text-xs text-slate-400 italic">{isMyOffer ? `Waiting for ${offer.toPlayer}…` : `Offer to ${offer.toPlayer}`}</p>
                  )}

                  {isForMe && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        onClick={() => onAcceptTradeOffer(offer.id, currentPlayer.name)}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white flex-1"
                        disabled={offer.requestedProperties.some(id => {
                          const prop = allProperties.find(p => p.id === id);
                          return !prop || prop.owner !== currentPlayer.name;
                        })}
                      >
                        Accept
                      </Button>
                      {isForMe && (
                        <Button
                          onClick={() => onRejectTradeOffer(offer.id)}
                          size="sm"
                          variant="outline"
                          className="border-red-400 text-red-300 hover:bg-red-500/20 flex-1"
                        >
                          Reject
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Resolved Offers (collapsed history) */}
        {resolvedOffers.length > 0 && (
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer hover:text-slate-300 select-none">
              {resolvedOffers.length} resolved offer{resolvedOffers.length !== 1 ? 's' : ''}
            </summary>
            <div className="mt-2 space-y-1">
              {resolvedOffers.slice(-5).map(offer => (
                <div key={offer.id} className="flex items-center gap-2">
                  <Badge variant="outline" className={offer.status === 'accepted' ? 'border-green-600 text-green-400' : 'border-red-600 text-red-400'}>
                    {offer.status}
                  </Badge>
                  <span>{offer.fromPlayer} → {offer.toPlayer}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
};

export default TradingSystem;
