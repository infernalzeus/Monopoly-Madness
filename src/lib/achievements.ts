export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  check: (ctx: AchievementContext) => boolean;
}

export interface AchievementContext {
  balance: number;
  ownedCount: number;
  hasMonopoly: boolean;
  hasHouse: boolean;
  hasHotel: boolean;
  hasCompletedTrade: boolean;
  turnCount: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_property',
    title: 'First Step',
    description: 'Buy your first property',
    icon: '🏠',
    check: (ctx) => ctx.ownedCount >= 1,
  },
  {
    id: 'landlord',
    title: 'Landlord',
    description: 'Own 5 properties',
    icon: '🏡',
    check: (ctx) => ctx.ownedCount >= 5,
  },
  {
    id: 'property_mogul',
    title: 'Property Mogul',
    description: 'Own 10 properties',
    icon: '🌆',
    check: (ctx) => ctx.ownedCount >= 10,
  },
  {
    id: 'millionaire',
    title: 'Millionaire',
    description: 'Reach $5,000,000 in cash',
    icon: '💰',
    check: (ctx) => ctx.balance >= 5_000_000,
  },
  {
    id: 'cash_king',
    title: 'Cash King',
    description: 'Hold $15,000,000 in cash',
    icon: '👑',
    check: (ctx) => ctx.balance >= 15_000_000,
  },
  {
    id: 'monopolist',
    title: 'Monopolist',
    description: 'Own all properties in one color group',
    icon: '🎯',
    check: (ctx) => ctx.hasMonopoly,
  },
  {
    id: 'developer',
    title: 'Developer',
    description: 'Build your first house',
    icon: '🔨',
    check: (ctx) => ctx.hasHouse,
  },
  {
    id: 'hotel_magnate',
    title: 'Hotel Magnate',
    description: 'Build a hotel on a property',
    icon: '🏨',
    check: (ctx) => ctx.hasHotel,
  },
  {
    id: 'deal_maker',
    title: 'Deal Maker',
    description: 'Complete a trade with another player',
    icon: '🤝',
    check: (ctx) => ctx.hasCompletedTrade,
  },
  {
    id: 'survivor',
    title: 'Survivor',
    description: 'Last 30 turns without going bankrupt',
    icon: '🏅',
    check: (ctx) => ctx.turnCount >= 30,
  },
];

export interface AchievementProperty {
  owner?: string;
  colorGroup?: string;
  type: string;
  houses: number;
  hasHotel: boolean;
}

export function getAchievementContext(
  playerName: string,
  balance: number,
  properties: AchievementProperty[],
  tradeOffers: Array<{ fromPlayer: string; status: string }>,
  turnCount: number,
): AchievementContext {
  const myProps = properties.filter(p => p.owner === playerName);
  const ownedCount = myProps.length;

  const colorGroups = [...new Set(
    properties.filter(p => p.type === 'property' && p.colorGroup).map(p => p.colorGroup!)
  )];
  const hasMonopoly = colorGroups.some(group => {
    const groupProps = properties.filter(p => p.type === 'property' && p.colorGroup === group);
    return groupProps.length > 0 && groupProps.every(p => p.owner === playerName);
  });

  const hasHouse = myProps.some(p => p.houses > 0);
  const hasHotel = myProps.some(p => p.hasHotel);
  const hasCompletedTrade = tradeOffers.some(o => o.fromPlayer === playerName && o.status === 'accepted');

  return { balance, ownedCount, hasMonopoly, hasHouse, hasHotel, hasCompletedTrade, turnCount };
}

export function loadUnlockedAchievements(playerName: string): Set<string> {
  try {
    const stored = localStorage.getItem(`mm_ach_${playerName}`);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

export function saveUnlockedAchievements(playerName: string, ids: Set<string>): void {
  try {
    localStorage.setItem(`mm_ach_${playerName}`, JSON.stringify([...ids]));
  } catch {
    // ignore storage errors
  }
}
