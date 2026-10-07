import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Home, GripVertical, Hotel, Building, DollarSign, Banknote } from 'lucide-react';
import { Player, Property, Worker } from '@/types/game';

const colorGroupHex: Record<string, string> = {
  brown: '#8B4513', lightBlue: '#87CEFA', pink: '#FF69B4', orange: '#FF8C00',
  red: '#EF4444', yellow: '#FFD700', green: '#22C55E', darkBlue: '#1D4ED8'
};

const getGroupHex = (cg: string | null | undefined): string | null => {
  if (!cg) return null;
  if (cg.startsWith('#')) return cg;
  return colorGroupHex[cg] || null;
};

const DEFAULT_COLOR_ORDER = ['brown', 'lightBlue', 'pink', 'orange', 'red', 'yellow', 'green', 'darkBlue'];

const WorkerFaceInPanel: React.FC<{ color: string }> = ({ color }) => {
  const [blink, setBlink] = React.useState(false);
  React.useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const cycle = () => {
      setBlink(true);
      setTimeout(() => setBlink(false), 130);
      t = setTimeout(cycle, 2200 + Math.random() * 2000);
    };
    t = setTimeout(cycle, 600 + Math.random() * 1200);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="w-5 h-5 rounded-full border border-black/30 relative flex-shrink-0" style={{ backgroundColor: color }}>
      <div className="absolute inset-0 flex justify-center gap-[3px]" style={{ paddingTop: '20%', paddingBottom: '48%' }}>
        <div className="rounded-full bg-black/80 self-center" style={{ width: 4, height: blink ? 1 : 4, transition: 'height 0.07s' }} />
        <div className="rounded-full bg-black/80 self-center" style={{ width: 4, height: blink ? 1 : 4, transition: 'height 0.07s' }} />
      </div>
      <div className="absolute inset-0 flex justify-center items-end" style={{ paddingBottom: '12%' }}>
        <div style={{ width: 8, height: 4, borderBottom: '1.5px solid white', borderLeft: '1.5px solid white', borderRight: '1.5px solid white', borderRadius: '0 0 6px 6px' }} />
      </div>
    </div>
  );
};

interface PropertyMiniCardProps {
  property: Property;
  worker?: Worker;
  workersEnabled: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onMortgage: () => void;
  onUnmortgage: () => void;
}

const PropertyMiniCard: React.FC<PropertyMiniCardProps> = ({
  property, worker, workersEnabled, isSelected, onSelect, onMortgage, onUnmortgage
}) => {
  const hex = getGroupHex(property.colorGroup);
  const rentTiers = property.type === 'property' ? property.rent : null;
  const currentRentIdx = property.hasHotel ? 5 : property.houses > 0 ? property.houses : 0;
  const currentRent = rentTiers ? rentTiers[currentRentIdx] : property.rent[0];

  return (
    <div
      className={`rounded-lg border cursor-pointer transition-all overflow-hidden select-none
        ${isSelected ? 'ring-2 ring-white/30 border-white/30' : 'border-white/10 hover:border-white/25'}
        ${property.isMortgaged ? 'opacity-55' : ''}
        ${property.isInactive ? 'opacity-30' : ''}
      `}
      style={hex
        ? { backgroundColor: `${hex}22`, borderLeftColor: hex, borderLeftWidth: 3 }
        : { backgroundColor: 'rgba(51,65,85,0.5)' }}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-expanded={isSelected}
      aria-label={`${property.name}${property.isMortgaged ? ', mortgaged' : ''}`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
    >
      {/* Colour strip */}
      {hex && <div className="h-1.5 w-full" style={{ backgroundColor: hex }} />}

      <div className="p-2">
        {/* Name + worker + buildings */}
        <div className="flex items-center gap-1 min-w-0 mb-1">
          {workersEnabled && worker && <WorkerFaceInPanel color={worker.color} />}
          <span className="text-[0.7rem] font-bold text-white truncate flex-1 leading-tight">{property.name}</span>
          {property.isMortgaged && <span className="text-[0.55rem] text-rose-400 flex-shrink-0">MTG</span>}
          {property.hasHotel && <span className="text-[0.65rem] flex-shrink-0">🏨</span>}
          {!property.hasHotel && property.houses > 0 && (
            <span className="text-[0.55rem] text-green-400 flex-shrink-0 font-bold">🏠{property.houses}</span>
          )}
        </div>

        {/* Value + rent */}
        <div className="flex gap-2 text-[0.6rem]">
          <span className="text-slate-400">${(property.currentValue / 1000).toFixed(0)}K</span>
          {property.isInactive ? (
            <span className="text-slate-400">Neutral tile</span>
          ) : property.isMortgaged ? (
            <span className="text-rose-300">Mortgaged · no rent</span>
          ) : property.type === 'utility' ? (
            <span className="text-emerald-400">Rent: dice × $4K/$10K</span>
          ) : (
            <span className="text-emerald-400">Rent ${(currentRent / 1000).toFixed(0)}K</span>
          )}
        </div>

        {/* Expanded detail card */}
        {isSelected && (
          <div
            className="mt-2 pt-2 border-t space-y-1.5"
            style={{ borderColor: hex ? `${hex}50` : 'rgba(71,85,105,0.5)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Rent table */}
            {property.type === 'property' && rentTiers && (
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[0.6rem]">
                {['Base', '1 House', '2 Houses', '3 Houses', '4 Houses', 'Hotel'].map((label, i) => (
                  <div key={i} className={`flex justify-between ${i === currentRentIdx ? 'text-yellow-300 font-bold' : 'text-slate-400'}`}>
                    <span>{label}</span>
                    <span>${((rentTiers[i] ?? 0) / 1000).toFixed(0)}K</span>
                  </div>
                ))}
              </div>
            )}
            {property.type === 'railroad' && (
              <div className="text-[0.6rem] text-slate-400 space-y-0.5">
                {['1 owned', '2 owned', '3 owned', '4 owned'].map((label, i) => (
                  <div key={i} className={`flex justify-between ${i === currentRentIdx ? 'text-yellow-300 font-bold' : ''}`}>
                    <span>{label}</span><span>${((property.rent[i] ?? 0) / 1000).toFixed(0)}K</span>
                  </div>
                ))}
              </div>
            )}
            {property.type === 'utility' && (
              <div className="text-[0.6rem] text-slate-400 space-y-0.5">
                <div className="flex justify-between"><span>1 utility</span><span>4× dice</span></div>
                <div className="flex justify-between"><span>2 utilities</span><span>10× dice</span></div>
              </div>
            )}
            {/* House/hotel cost */}
            {property.type === 'property' && property.houseCost && (
              <div className="flex gap-3 text-[0.6rem]">
                <span className="text-slate-400">🏠 ${((property.houseCost) / 1000).toFixed(0)}K</span>
                <span className="text-slate-400">🏨 ${((property.hotelCost ?? property.houseCost) / 1000).toFixed(0)}K</span>
              </div>
            )}
            {/* Mortgage value */}
            <div className="text-[0.6rem] text-slate-500">Mortgage: ${(Math.round(property.currentValue * 0.5) / 1000).toFixed(0)}K</div>
            {/* Action buttons */}
            <div className="flex gap-1 pt-0.5">
              {!property.isMortgaged ? (
                <Button size="sm" variant="outline"
                  onClick={onMortgage}
                  className="text-[0.6rem] px-1.5 h-5 border-slate-600 text-slate-300 hover:bg-slate-700">
                  Mortgage
                </Button>
              ) : (
                <Button size="sm" variant="outline"
                  onClick={onUnmortgage}
                  className="text-[0.6rem] px-1.5 h-5 border-slate-600 text-slate-300 hover:bg-slate-700">
                  Unmortgage
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface PlayerPanelProps {
  currentPlayer: Player;
  allPlayers: Player[];
  ownedProperties: Property[];
  workers?: Worker[];
  onMortgage: (propertyId: string) => void;
  onUnmortgage?: (propertyId: string) => void;
  onSell: (propertyId: string, amount: number) => void;
  onTrade: (toPlayer: string, offeredProps: string[], requestedProps: string[]) => void;
  workersEnabled?: boolean;
}

const PlayerPanel: React.FC<PlayerPanelProps> = ({
  currentPlayer,
  allPlayers,
  ownedProperties,
  workers = [],
  onMortgage,
  onUnmortgage,
  onSell,
  onTrade,
  workersEnabled = false,
}) => {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [colorOrder, setColorOrder] = useState<string[]>(DEFAULT_COLOR_ORDER);
  const [draggingGroup, setDraggingGroup] = useState<string | null>(null);
  const dragOver = useRef<string | null>(null);

  const netWorth = currentPlayer.balance + ownedProperties.reduce((sum, p) => sum + p.currentValue, 0);
  const rank = allPlayers
    .filter(p => p.isActive)
    .sort((a, b) => (b.balance + b.properties.length * 100000) - (a.balance + a.properties.length * 100000))
    .findIndex(p => p.id === currentPlayer.id) + 1;

  // Group properties by colorGroup (special/railroad/utility go into 'other')
  const getGroupKey = (p: Property) => p.colorGroup || (p.type === 'railroad' ? '__railroad' : p.type === 'utility' ? '__utility' : '__other');

  const groups: Record<string, Property[]> = {};
  ownedProperties.forEach(p => {
    const key = getGroupKey(p);
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });

  // Build sorted group list based on colorOrder + any extras (railroads, utilities, other)
  const extraGroupKeys = Object.keys(groups).filter(k => !colorOrder.includes(k));
  const orderedGroupKeys = [...colorOrder, ...extraGroupKeys].filter(k => groups[k]?.length);

  // Drag handlers for reordering color groups
  const handleDragStart = (key: string) => setDraggingGroup(key);
  const handleDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    dragOver.current = key;
  };
  const handleDrop = (targetKey: string) => {
    if (!draggingGroup || draggingGroup === targetKey) { setDraggingGroup(null); return; }
    setColorOrder(prev => {
      const arr = [...prev];
      const fromIdx = arr.indexOf(draggingGroup);
      const toIdx = arr.indexOf(targetKey);
      if (fromIdx === -1 || toIdx === -1) return prev;
      arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, draggingGroup);
      return arr;
    });
    setDraggingGroup(null);
    dragOver.current = null;
  };
  const handleDragEnd = () => { setDraggingGroup(null); dragOver.current = null; };

  const groupLabel = (key: string) => {
    if (key === '__railroad') return '🚂 Railroads';
    if (key === '__utility') return '⚡ Utilities';
    if (key === '__other') return '⭐ Special';
    const hex = getGroupHex(key);
    return key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
  };

  return (
    <Card className="bg-gradient-to-br from-gray-800 to-gray-700 border-gray-600">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-white text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xl" dangerouslySetInnerHTML={{ __html: currentPlayer.pieceIcon }} />
            <span style={{ color: currentPlayer.color }} className="font-bold">{currentPlayer.name}</span>
            {currentPlayer.isInJail && (
              <span className="text-xs bg-rose-900/60 text-rose-300 border border-rose-700/50 px-1.5 py-0.5 rounded-full">🔒 {currentPlayer.jailTurns}</span>
            )}
          </div>
          <span className="text-xs text-slate-400 font-normal">Rank #{rank}</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* Finances */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-700/50 rounded-lg p-2">
            <div className="text-xs text-gray-400">Cash</div>
            <div className="text-sm font-bold text-cyan-400">${currentPlayer.balance.toLocaleString('en-US')}</div>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-2">
            <div className="text-xs text-gray-400">Net Worth</div>
            <div className="text-sm font-bold text-white">${netWorth.toLocaleString('en-US')}</div>
          </div>
        </div>

        {/* Properties header */}
        <div>
          <h3 className="font-semibold text-white text-sm flex items-center gap-2 mb-1.5">
            <Home className="w-3.5 h-3.5" />
            Properties ({ownedProperties.length})
            {ownedProperties.length > 1 && (
              <span className="text-[0.6rem] text-slate-500 font-normal ml-auto flex items-center gap-0.5">
                <GripVertical className="w-3 h-3" />drag groups to reorder
              </span>
            )}
          </h3>

          {ownedProperties.length === 0 ? (
            <div className="text-center py-4 text-slate-500 text-xs">
              <Home className="w-6 h-6 mx-auto mb-1 opacity-40" />
              No properties owned yet
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-0.5 custom-scrollbar">
              {orderedGroupKeys.map(groupKey => {
                const groupProps = groups[groupKey] ?? [];
                const hex = getGroupHex(groupKey);
                const isDragging = draggingGroup === groupKey;

                return (
                  <div
                    key={groupKey}
                    draggable={colorOrder.includes(groupKey)}
                    onDragStart={() => handleDragStart(groupKey)}
                    onDragOver={e => handleDragOver(e, groupKey)}
                    onDrop={() => handleDrop(groupKey)}
                    onDragEnd={handleDragEnd}
                    className={`rounded-lg border transition-all ${isDragging ? 'opacity-40 border-dashed border-white/30' : 'border-transparent'}`}
                  >
                    {/* Group header */}
                    <div className="flex items-center gap-1.5 px-1 mb-1">
                      {hex && (
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: hex }} />
                      )}
                      <span className="text-[0.65rem] font-semibold text-slate-400 uppercase tracking-wider flex-1">
                        {groupLabel(groupKey)}
                      </span>
                      {colorOrder.includes(groupKey) && (
                        <GripVertical className="w-3 h-3 text-slate-600 cursor-grab" />
                      )}
                    </div>

                    {/* Tiles side-by-side in a 2-column grid */}
                    <div className="grid grid-cols-2 gap-1.5">
                      {groupProps.map(property => (
                        <PropertyMiniCard
                          key={property.id}
                          property={property}
                          worker={workers.find(w => w.propertyId === property.id)}
                          workersEnabled={workersEnabled}
                          isSelected={selectedPropertyId === property.id}
                          onSelect={() => setSelectedPropertyId(selectedPropertyId === property.id ? '' : property.id)}
                          onMortgage={() => onMortgage(property.id)}
                          onUnmortgage={() => onUnmortgage?.(property.id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="pt-2 border-t border-slate-600">
          <div className="grid grid-cols-3 gap-2 text-xs text-center">
            <div>
              <div className="text-slate-400">Props</div>
              <div className="font-semibold text-white">{ownedProperties.length}</div>
            </div>
            <div>
              <div className="text-slate-400">Mortgaged</div>
              <div className="font-semibold text-white">{ownedProperties.filter(p => p.isMortgaged).length}</div>
            </div>
            <div>
              <div className="text-slate-400">Workers</div>
              <div className="font-semibold text-white">{workers.filter(w => w.ownerId === currentPlayer.id).length}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PlayerPanel;
