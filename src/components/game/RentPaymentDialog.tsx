import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Home, 
  Hotel, 
  DollarSign, 
  AlertCircle,
  CreditCard
} from 'lucide-react';
import { Property } from '@/types/game';

interface RentPaymentDialogProps {
  property: Property;
  owner: string;
  amount: number;
  onPayRent: () => void;
  onSkipRent: () => void;
  currentPlayerBalance: number;
}

const RentPaymentDialog: React.FC<RentPaymentDialogProps> = ({
  property,
  owner,
  amount,
  onPayRent,
  onSkipRent,
  currentPlayerBalance
}) => {
  const canAfford = currentPlayerBalance >= amount;
  const colorGroups: Record<string, string> = {
    'brown': 'bg-amber-800',
    'lightBlue': 'bg-sky-300',
    'pink': 'bg-pink-400',
    'orange': 'bg-orange-500',
    'red': 'bg-red-500',
    'yellow': 'bg-yellow-400',
    'green': 'bg-green-500',
    'darkBlue': 'bg-blue-800'
  };

  const colorGroupClass = property.colorGroup ? colorGroups[property.colorGroup] || 'bg-gray-400' : 'bg-gray-400';

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount}`;
  };

  return (
    <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-300 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-800">
          <AlertCircle className="w-6 h-6 text-red-600" />
          Rent Payment Required
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Property Information */}
        <div className="bg-white rounded-lg p-4 border border-red-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xl font-bold text-gray-800">{property.name}</h3>
            {property.colorGroup && (
              <div className={`w-6 h-6 rounded-full ${colorGroupClass}`} />
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Owner:</span>
              <span className="ml-2 font-semibold text-gray-800">{owner}</span>
            </div>
            <div>
              <span className="text-gray-500">Type:</span>
              <span className="ml-2 capitalize text-gray-800">{property.type}</span>
            </div>
          </div>

          {/* Property Development */}
          {(property.houses > 0 || property.hasHotel) && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Improvements:</span>
                {property.hasHotel ? (
                  <div className="flex items-center gap-1">
                    <Hotel className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-medium text-gray-800">1 Hotel</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <div className="flex gap-1">
                      {Array.from({ length: property.houses }).map((_, idx) => (
                        <Home key={idx} className="w-3 h-3 text-green-600" />
                      ))}
                    </div>
                    <span className="text-sm font-medium text-gray-800">
                      {property.houses} House{property.houses !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Rent Amount */}
        <div className="text-center">
          <div className="text-sm text-gray-600 mb-1">Rent Amount</div>
          <div className="text-4xl font-bold text-red-600">
            {formatCurrency(amount)}
          </div>
          {!canAfford && (
            <div className="text-sm text-red-500 mt-2 flex items-center justify-center gap-1">
              <AlertCircle className="w-4 h-4" />
              Insufficient funds! You have {formatCurrency(currentPlayerBalance)}
            </div>
          )}
        </div>

        {/* Rent Structure for Properties */}
        {property.type === 'property' && (
          <div className="bg-gray-50 rounded-lg p-3">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Rent Structure</h4>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Base Rent:</span>
                <span className="text-gray-800">{formatCurrency(property.rent[0])}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">1 House:</span>
                <span className="text-gray-800">{formatCurrency(property.rent[1] || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">2 Houses:</span>
                <span className="text-gray-800">{formatCurrency(property.rent[2] || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">3 Houses:</span>
                <span className="text-gray-800">{formatCurrency(property.rent[3] || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">4 Houses:</span>
                <span className="text-gray-800">{formatCurrency(property.rent[4] || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Hotel:</span>
                <span className="text-gray-800">{formatCurrency(property.rent[5] || 0)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={onPayRent}
            className={`flex-1 ${
              canAfford 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'bg-red-700 hover:bg-red-800 text-white'
            }`}
          >
            <CreditCard className="w-4 h-4 mr-2" />
            {canAfford ? 'Pay Rent' : 'Declare Bankruptcy'}
          </Button>
          
          <Button
            onClick={onSkipRent}
            variant="outline"
            className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
            disabled={true} // Rent cannot be skipped in normal Monopoly rules
          >
            Skip (Not Allowed)
          </Button>
        </div>

        {!canAfford && (
          <div className="bg-red-100 border border-red-300 rounded-lg p-3">
            <div className="text-sm text-red-800">
              <strong>Bankruptcy Warning:</strong> You cannot afford the rent! 
              Mortgage or sell buildings first, or declare bankruptcy — your properties become neutral tiles.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RentPaymentDialog;
