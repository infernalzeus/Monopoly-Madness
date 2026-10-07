import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Home, 
  Hotel, 
  DollarSign, 
  Banknote,
  Building,
  MapPin 
} from 'lucide-react';
import { Property } from '@/types/game';

interface PropertyCardProps {
  property: Property;
  isOwned: boolean;
  canBuyHouse: boolean;
  canBuyHotel: boolean;
  onBuyHouse?: () => void;
  onBuyHotel?: () => void;
  onSellHouse?: () => void;
  onSellHotel?: () => void;
  onMortgage?: () => void;
  onUnmortgage?: () => void;
  allProperties?: Property[];
}

const PropertyCard: React.FC<PropertyCardProps> = ({
  property,
  isOwned,
  canBuyHouse,
  canBuyHotel,
  onBuyHouse,
  onBuyHotel,
  onSellHouse,
  onSellHotel,
  onMortgage,
  onUnmortgage,
  allProperties
}) => {
  const colorGroupHex: Record<string, string> = {
    'brown': '#8B4513', 'lightBlue': '#87CEFA', 'pink': '#FF69B4',
    'orange': '#FF8C00', 'red': '#EF4444', 'yellow': '#FFD700',
    'green': '#22C55E', 'darkBlue': '#1D4ED8'
  };

  // Returns inline style or class for a colorGroup value (supports raw #hex too)
  const getGroupStyle = (cg: string | null | undefined) => {
    if (!cg) return { hex: null, cls: 'bg-gray-400' };
    if (cg.startsWith('#')) return { hex: cg, cls: '' };
    return { hex: colorGroupHex[cg] || null, cls: '' };
  };

  const { hex: colorHex } = getGroupStyle(property.colorGroup);
  const colorGroupClass = colorHex ? '' : 'bg-gray-400'; // fallback only if no hex

  const getRentAmount = () => {
    if (property.type !== 'property') return property.rent[0];
    
    let rentIndex = 0;
    if (property.hasHotel) rentIndex = 5;
    else if (property.houses > 0) rentIndex = property.houses;
    
    return property.rent[rentIndex] || property.rent[0];
  };

  const formatCurrency = (amount: number) => `$${amount.toLocaleString('en-US')}`;

  return (
    <Card className="bg-gradient-card border-border max-w-sm">
      <CardHeader className="pb-3">
        {property.colorGroup && property.type === 'property' && (
          <div
            className={`w-full h-3 rounded-t-sm -mt-2 mb-2 opacity-90 ${!colorHex ? colorGroupClass : ''}`}
            style={colorHex ? { backgroundColor: colorHex } : undefined}
          />
        )}
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <MapPin className="w-4 h-4 text-primary" />
            {property.name}
          </CardTitle>
          {property.colorGroup && (
            <Badge
              className="text-[0.6rem] text-white border-0"
              style={colorHex ? { backgroundColor: colorHex, opacity: 0.9 } : { opacity: 0.9 }}
            >
              {property.colorGroup.startsWith('#') ? 'Custom' : property.colorGroup}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Property Status */}
        <div className="flex flex-wrap gap-2">
          {property.isOwned && (
            <Badge variant="secondary">
              Owned by {property.owner}
            </Badge>
          )}
          
          {property.isMortgaged && (
            <Badge variant="destructive">
              Mortgaged
            </Badge>
          )}
          
          {property.isInAuction && (
            <Badge className="bg-auction-active animate-pulse-glow">
              In Auction
            </Badge>
          )}
        </div>

        {/* Property Values */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-background/30 rounded-lg p-3">
            <div className="text-xs text-muted-foreground">Property Value</div>
            <div className="text-sm font-bold text-primary">
              {formatCurrency(property.baseValue)}
            </div>
          </div>
          
          <div className="bg-background/30 rounded-lg p-3">
            <div className="text-xs text-muted-foreground">Current Rent</div>
            <div className="text-sm font-bold text-foreground">
              {formatCurrency(getRentAmount())}
            </div>
          </div>
          
          {property.type === 'property' && (
            <>
              <div className="bg-background/30 rounded-lg p-3">
                <div className="text-xs text-muted-foreground">House Cost</div>
                <div className="text-sm font-bold text-green-400">
                  {formatCurrency(property.houseCost || 0)}
                </div>
              </div>
              
              <div className="bg-background/30 rounded-lg p-3">
                <div className="text-xs text-muted-foreground">Hotel Cost</div>
                <div className="text-sm font-bold text-red-400">
                  {formatCurrency(property.hotelCost || 0)}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Rent Structure */}
        {property.type === 'property' && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Rent Structure</h4>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Rent:</span>
                <span className="text-foreground">{formatCurrency(property.rent[0])}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">1 House:</span>
                <span className="text-foreground">{formatCurrency(property.rent[1] || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">2 Houses:</span>
                <span className="text-foreground">{formatCurrency(property.rent[2] || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">3 Houses:</span>
                <span className="text-foreground">{formatCurrency(property.rent[3] || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">4 Houses:</span>
                <span className="text-foreground">{formatCurrency(property.rent[4] || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hotel:</span>
                <span className="text-foreground">{formatCurrency(property.rent[5] || 0)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Color Group Monopoly Bonus */}
        {property.type === 'property' && property.colorGroup && (
          <div className="space-y-2 border-t border-border pt-3">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${!colorHex ? colorGroupClass : ''}`}
                style={colorHex ? { backgroundColor: colorHex } : undefined}
              />
              Color Group Bonus
            </h4>
            {allProperties ? (() => {
              const groupProps = allProperties.filter(p => p.colorGroup === property.colorGroup && p.type === 'property');
              const allSameOwner = groupProps.length > 0 &&
                groupProps[0].isOwned &&
                groupProps.every(p => p.owner === groupProps[0].owner && p.isOwned && !p.isMortgaged);
              const monopolyOwner = allSameOwner ? groupProps[0].owner : null;
              return (
                <div className="space-y-1">
                  {groupProps.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-xs">
                      <span className={p.id === property.id ? 'font-bold text-primary' : 'text-muted-foreground'}>
                        {p.id === property.id ? '▸ ' : '  '}{p.name}
                      </span>
                      <Badge
                        variant={p.isOwned ? 'secondary' : 'outline'}
                        className={`text-[0.6rem] py-0 ${p.isOwned ? 'bg-slate-700' : ''}`}
                      >
                        {p.isOwned ? p.owner : 'Unowned'}
                      </Badge>
                    </div>
                  ))}
                  <div className={`mt-2 p-2 rounded border text-center ${
                    monopolyOwner
                      ? 'bg-yellow-500/10 border-yellow-500/40'
                      : 'bg-slate-800/40 border-slate-600/30'
                  }`}>
                    {monopolyOwner ? (
                      <span className="text-xs text-yellow-400 font-semibold">
                        🏆 MONOPOLY — {monopolyOwner} earns 2× base rent
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 italic">
                        Own all {groupProps.length} for 2× base rent bonus
                      </span>
                    )}
                  </div>
                </div>
              );
            })() : (
              <p className="text-xs text-slate-500 italic">
                Group: {property.colorGroup} · Own all for 2× rent
              </p>
            )}
          </div>
        )}

        {/* Houses and Hotels Display */}
        {property.type === 'property' && (property.houses > 0 || property.hasHotel) && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Development</h4>
            <div className="flex items-center gap-2">
              {property.hasHotel ? (
                <div className="flex items-center gap-1">
                  <Hotel className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-foreground">1 Hotel</span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <div className="flex gap-1">
                    {Array.from({ length: property.houses }).map((_, idx) => (
                      <Home key={idx} className="w-3 h-3 text-green-600" />
                    ))}
                  </div>
                  <span className="text-sm text-foreground">
                    {property.houses} House{property.houses !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {isOwned && property.type === 'property' && !property.isMortgaged && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {!property.hasHotel && property.houses < 4 && canBuyHouse && (
                <Button
                  onClick={onBuyHouse}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  <Home className="w-3 h-3 mr-1" />
                  Buy House
                </Button>
              )}
              
              {property.houses === 4 && !property.hasHotel && canBuyHotel && (
                <Button
                  onClick={onBuyHotel}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  <Hotel className="w-3 h-3 mr-1" />
                  Buy Hotel
                </Button>
              )}
              
              {property.houses > 0 && (
                <Button
                  onClick={onSellHouse}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  Sell House
                </Button>
              )}
              
              {property.hasHotel && (
                <Button
                  onClick={onSellHotel}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  Sell Hotel
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Mortgage Actions */}
        {isOwned && (
          <div className="pt-2 border-t border-border">
            {property.isMortgaged ? (
              <Button
                onClick={onUnmortgage}
                size="sm"
                variant="outline"
                className="w-full text-xs"
              >
                <Banknote className="w-3 h-3 mr-1" />
                Unmortgage ({formatCurrency(Math.round(Math.round(property.currentValue * 0.5) * 1.1))})
              </Button>
            ) : (
              <Button
                onClick={onMortgage}
                size="sm"
                variant="outline"
                className="w-full text-xs"
              >
                <DollarSign className="w-3 h-3 mr-1" />
                Mortgage (+{formatCurrency(Math.round(property.currentValue * 0.5))})
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PropertyCard;