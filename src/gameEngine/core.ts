import { GameState, DiceRoll, Player, Property, GameEvent, PendingCard, Worker } from '../types/game';

// Teammates (teamsEnabled) don't pay each other rent and count towards each other's colour-group monopolies.
export const sameTeam = (players: Player[], nameA?: string | null, nameB?: string | null): boolean => {
  if (!nameA || !nameB) return false;
  if (nameA === nameB) return true;
  const a = players.find(p => p.name === nameA);
  const b = players.find(p => p.name === nameB);
  return !!(a?.teamId && a.teamId === b?.teamId);
};

// Standard rule: nothing in a colour group can be traded while any property in it has buildings.
export const hasBuildingsInGroup = (properties: Property[], property: Property): boolean =>
  property.type === 'property' && !!property.colorGroup &&
  properties.some(p => p.type === 'property' && p.colorGroup === property.colorGroup && (p.houses > 0 || p.hasHotel));

// Helper to add GameEvent cleanly
export const addEvent = (state: GameState, type: GameEvent['type'], player: string, message: string, amount?: number): GameState => {
  const event: any = {
    id: `event-${Date.now()}-${Math.random()}`,
    type,
    player,
    message,
    timestamp: Date.now()
  };
  if (amount !== undefined) {
    event.amount = amount;
  }
  return {
    ...state,
    gameEvents: [...state.gameEvents.slice(-19), event as GameEvent]
  };
};

// Anything still unresolved when a turn ends (timer expiry, forced advance) is settled in the
// bank's/creditor's favour so a player can never dodge rent or a card penalty by running out the clock.
export const settlePending = (state: GameState): GameState => {
  let s = state;
  if (s.pendingCard) s = resolvePendingCard(s);
  if (s.pendingRent && s.gamePhase !== 'ended') {
    const { owner, amount, propertyId } = s.pendingRent;
    const prop = s.properties.find(p => p.id === propertyId);
    const payer = s.players.find(p => p.id === s.currentPlayer);
    s = { ...s, pendingRent: null };
    if (payer) {
      s = applyPayment(s, s.currentPlayer, owner, amount, 'Rent');
      s = addEvent(s, 'rent', payer.name, `paid $${amount.toLocaleString('en-US')} rent to ${owner}${prop ? ` for ${prop.name}` : ''}`, -amount);
    }
  }
  if (s.pendingPurchase) s = { ...s, pendingPurchase: null };
  return s;
};

export const advanceTurn = (rawState: GameState): GameState => {
  if (rawState.gamePhase === 'ended') return rawState;
  const state = settlePending(rawState);
  if (state.gamePhase === 'ended') return state;
  const playerCount = state.players.length;
  const currentIndex = state.players.findIndex(p => p.id === state.currentPlayer);
  let nextIndex = (currentIndex + 1) % playerCount;

  // Skip inactive players and spectators
  for (let i = 0; i < playerCount; i++) {
    if (state.players[nextIndex].isActive && !state.players[nextIndex].isSpectator) break;
    nextIndex = (nextIndex + 1) % playerCount;
  }

  // Doubles: the same player rolls again (unless jailed / bankrupt). lastDiceRoll is cleared for the
  // extra roll, so an idle timeout on it falls through to a normal hand-over.
  const cur = state.players[currentIndex];
  if (state.lastDiceRoll?.isDouble && (state.doubleCount || 0) > 0 && cur && cur.isActive && !cur.isInJail && !cur.isSpectator) {
    const again: GameState = {
      ...state, turn: state.turn + 1, turnState: 'waiting_for_roll', lastDiceRoll: null,
      pendingPurchase: null, pendingRent: null, pendingCard: null
    };
    return addEvent(again, 'move', cur.name, `rolled doubles — ${cur.name} rolls again`);
  }

  const nextPlayer = state.players[nextIndex];
  let nextState: GameState = {
    ...state,
    doubleCount: 0,
    turn: state.turn + 1,
    currentPlayer: nextPlayer.id,
    turnState: 'waiting_for_roll',
    lastDiceRoll: null,
    pendingPurchase: null,
    pendingRent: null,
    pendingCard: null
  };

  return addEvent(nextState, 'move', nextPlayer.name, `Turn ${nextState.turn} - ${nextPlayer.name}'s turn`);
};

// Compute a player's total income from all owned properties (used for jail fine and card amounts)
export const computePlayerIncome = (properties: Property[], playerName: string): { income: number; numProperties: number } => {
  const ownedProps = properties.filter(p => p.owner === playerName && !p.isMortgaged);
  // Count only properties that actually generate income (utilities don't contribute)
  const numProperties = ownedProps.filter(p => p.type === 'property' || p.type === 'railroad').length;
  let income = 0;
  ownedProps.forEach(prop => {
    if (prop.type === 'property') {
      if (prop.hasHotel) income += prop.rent[5] || 0;
      else income += prop.rent[Math.max(0, prop.houses)] || 0;
    } else if (prop.type === 'railroad') {
      const count = ownedProps.filter(p => p.type === 'railroad').length;
      income += prop.rent[Math.min(count - 1, 3)] || 0;
    }
    // utilities excluded from income calc
  });
  return { income, numProperties };
};

export const rollDiceLogic = (state: GameState, diceResult: DiceRoll): GameState => {
  if (state.turnState !== 'waiting_for_roll' || state.gamePhase !== 'playing') return state;
  
  let nextState: GameState = { ...state, turnState: 'processing', lastDiceRoll: diceResult };
  const currentPlayerData = nextState.players.find(p => p.id === nextState.currentPlayer);
  if (!currentPlayerData) return { ...nextState, turnState: 'waiting_for_roll' };

  if (currentPlayerData.isInJail) {
    const players = nextState.players.map(p => {
      if (p.id !== nextState.currentPlayer) return p;
      const remaining = Math.max(0, (p.jailTurns || 0) - 1);
      return { ...p, jailTurns: remaining, isInJail: remaining > 0 };
    });
    nextState = { ...nextState, players, doubleCount: 0, turnState: 'completed' as const };
    return addEvent(nextState, 'move', currentPlayerData.name, 'turn skipped while in Jail');
  }

  const doubles = diceResult.isDouble ? (state.doubleCount || 0) + 1 : 0;
  if (doubles >= 3) {
    // Three doubles in a row: straight to jail
    const players = nextState.players.map(p =>
      p.id === nextState.currentPlayer ? { ...p, position: 10, isInJail: true, jailTurns: 3 } : p);
    nextState = { ...nextState, players, doubleCount: 0, turnState: 'completed' as const };
    return addEvent(nextState, 'jail', currentPlayerData.name, `rolled three doubles in a row and was sent to Jail!`);
  }
  return movePlayer({ ...nextState, doubleCount: doubles }, diceResult.total);
};

export const movePlayer = (state: GameState, spaces: number): GameState => {
  // Pre-compute GO bonus using pre-move balance so it isn't self-referential
  const movingPlayerBefore = state.players.find(p => p.id === state.currentPlayer)!;
  const newPositionCalc = (movingPlayerBefore.position + spaces) % 40;
  const passedGo = movingPlayerBefore.position + spaces >= 40;
  // 10% of current cash, rounded to nearest $1,000, minimum = flat passGoReward
  const passGoBonus = passedGo
    ? Math.max(Math.round(movingPlayerBefore.balance * 0.10 / 1000) * 1000, state.settings.passGoReward)
    : 0;

  const players = state.players.map(player => {
    if (player.id === state.currentPlayer) {
      const newPosition = newPositionCalc;

      // Update discovered properties
      const discoveredProperties = [...(player.discoveredProperties || [])];
      if (!discoveredProperties.includes(newPosition)) {
        discoveredProperties.push(newPosition);
      }

      return {
        ...player,
        position: newPosition,
        balance: player.balance + passGoBonus,
        discoveredProperties
      };
    }
    return player;
  });

  const movingPlayer = players.find(p => p.id === state.currentPlayer)!;
  const landedProperty = state.properties.find(p => p.position === movingPlayer.position);
  const isBuyable = landedProperty && ['property', 'railroad', 'utility'].includes(landedProperty.type);
  const shouldOfferPurchase = Boolean(isBuyable && landedProperty && !landedProperty.isOwned && !landedProperty.isInactive);

  // Worker auto-build: every time the current player passes GO, each assigned worker builds one house/hotel.
  // Progressive cost: Nth house costs houseCost * N; hotel costs hotelCost.
  let propertiesAfterWorkers = state.properties;
  let workerBuildDebt = 0;
  if (passedGo && state.settings.workersEnabled && state.workers && state.workers.length > 0) {
    const playerWorkers = state.workers.filter(w => w.ownerId === state.currentPlayer);
    // Workers obey the same rules as a human builder (full group, even build, hotel only at 4 houses everywhere)
    playerWorkers.forEach(worker => {
      const prop = propertiesAfterWorkers.find(p => p.id === worker.propertyId);
      if (!prop) return;
      if (canBuildHouseOn(propertiesAfterWorkers, prop, movingPlayerBefore.name)) {
        const cost = (prop.houseCost || 0) * (prop.houses + 1);
        if (movingPlayerBefore.balance - workerBuildDebt < cost) return;
        workerBuildDebt += cost;
        propertiesAfterWorkers = propertiesAfterWorkers.map(p => p.id === prop.id ? { ...p, houses: p.houses + 1 } : p);
      } else if (canBuildHotelOn(propertiesAfterWorkers, prop, movingPlayerBefore.name)) {
        const cost = prop.hotelCost || 0;
        if (movingPlayerBefore.balance - workerBuildDebt < cost) return;
        workerBuildDebt += cost;
        propertiesAfterWorkers = propertiesAfterWorkers.map(p => p.id === prop.id ? { ...p, hasHotel: true, houses: 0 } : p);
      }
    });
  }

  // Deduct worker build costs from the moving player
  const playersAfterWorkerCosts = workerBuildDebt > 0
    ? players.map(p => p.id === state.currentPlayer ? { ...p, balance: p.balance - workerBuildDebt } : p)
    : players;

  // If player lands on their OWN owned property, pause so they can optionally build
  const ownsLanded = isBuyable && landedProperty?.isOwned && landedProperty?.owner === movingPlayer.name;

  let nextState: GameState = {
    ...state,
    players: playersAfterWorkerCosts,
    properties: propertiesAfterWorkers,
    turnState: shouldOfferPurchase || ownsLanded ? 'waiting_for_action' : 'completed',
    pendingPurchase: shouldOfferPurchase ? { propertyId: landedProperty!.id, playerId: state.currentPlayer } : null
  };

  const message = `moved to ${landedProperty?.name || 'position ' + movingPlayer.position}`;
  nextState = addEvent(nextState, 'move', movingPlayer.name, message);

  if (passedGo && passGoBonus > 0) {
    nextState = addEvent(nextState, 'passGo', movingPlayer.name,
      `passed GO! Earned 10% income: +$${passGoBonus.toLocaleString('en-US')}`, passGoBonus);
  }

  // Check rent — jailed owners and inactive properties cannot collect rent
  if (isBuyable && landedProperty && landedProperty.isOwned && !landedProperty.isInactive && landedProperty.owner !== movingPlayer.name && !landedProperty.isMortgaged) {
    const ownerPlayer = state.players.find(p => p.name === landedProperty.owner);
    const teammate = state.settings.teamsEnabled && sameTeam(state.players, landedProperty.owner, movingPlayer.name);
    if (!ownerPlayer?.isInJail && !teammate) {
      const rentAmount = computeRent(state.properties, landedProperty, state.lastDiceRoll?.total || 0, state.settings.teamsEnabled ? state.players : undefined);
      if (rentAmount > 0) {
        nextState = {
          ...nextState,
          pendingRent: { propertyId: landedProperty.id, owner: landedProperty.owner!, amount: rentAmount },
          turnState: 'waiting_for_action'
        };
      }
    }
  }

  // Mortgaged property owned by another active player — offer to buy it at mortgage price
  if (
    isBuyable &&
    landedProperty?.isOwned &&
    !landedProperty.isInactive &&
    landedProperty.isMortgaged &&
    landedProperty.owner !== movingPlayer.name
  ) {
    nextState = {
      ...nextState,
      turnState: 'waiting_for_action',
      pendingPurchase: { propertyId: landedProperty.id, playerId: state.currentPlayer }
    };
  }

  // Chance / Community Chest — income-based reward or penalty
  if (landedProperty?.name === 'Chance' || landedProperty?.name === 'Community Chest') {
    const { income, numProperties } = computePlayerIncome(state.properties, movingPlayer.name);
    const diceTotal = state.lastDiceRoll?.total || 0;
    const isOdd = diceTotal % 2 !== 0;
    const amount = Math.round(income * 0.10);
    const pendingCard: PendingCard = {
      type: landedProperty.name === 'Chance' ? 'chance' : 'community',
      diceRoll: diceTotal,
      income,
      amount,
      isReward: isOdd,
      numProperties,
      jailCard: !!state.lastDiceRoll?.isDouble
    };
    nextState = { ...nextState, pendingCard, turnState: 'waiting_for_action' };
  }

  // Go to Jail
  if (landedProperty?.name === 'Go to Jail') {
    const jailedPlayers = nextState.players.map(p =>
      p.id === state.currentPlayer ? { ...p, position: 10, isInJail: true, jailTurns: 3 } : p
    );
    nextState = { ...nextState, players: jailedPlayers, turnState: 'completed' as const };
    return addEvent(nextState, 'jail', movingPlayer.name, `${movingPlayer.name} was sent to Jail!`);
  }

  // Check Tax (Income Tax, Luxury Tax)
  if (landedProperty && landedProperty.name.toLowerCase().includes('tax')) {
    const playerProperties = state.properties.filter(p => p.owner === movingPlayer.name);
    const propertyValue = playerProperties.reduce((sum, p) => sum + p.currentValue, 0);
    const totalFinance = movingPlayer.balance + propertyValue;
    const taxAmount = Math.round((totalFinance * 0.1) / 100) * 100; // 10% rounded to nearest 100

    nextState = applyPayment(nextState, state.currentPlayer, null, taxAmount, 'Tax Payment');
    nextState = addEvent(nextState, 'tax', movingPlayer.name, `paid $${taxAmount.toLocaleString('en-US')} in ${landedProperty.name}`, -taxAmount);
    nextState = { ...nextState, turnState: 'completed' };
  }

  return nextState;
};

// Simplified rent calculation (pure)
export const computeRent = (properties: Property[], property: Property, diceTotal: number, teamPlayers?: Player[]): number => {
  if (property.isMortgaged) return 0;
  if (property.type === 'railroad') {
    const count = properties.filter(p => p.type === 'railroad' && p.owner === property.owner).length;
    const index = Math.max(1, Math.min(4, count)) - 1;
    return property.rent[index] || 0;
  }
  if (property.type === 'utility') {
    const count = properties.filter(p => p.type === 'utility' && p.owner === property.owner).length;
    const mult = count >= 2 ? 10 : 4;
    return diceTotal * mult * 1000;
  }
  if (property.type === 'property') {
    if (property.hasHotel) return property.rent[5] || 0;
    if (property.houses > 0) return property.rent[property.houses] || 0;
    const hasMonopoly = property.colorGroup
      && properties
          .filter(p => p.type === 'property' && p.colorGroup === property.colorGroup)
          .every(p => (p.owner === property.owner || (!!teamPlayers && sameTeam(teamPlayers, p.owner, property.owner))) && !p.isMortgaged);
    return hasMonopoly ? property.rent[0] * 2 : property.rent[0];
  }
  return 0;
};

export const handlePropertyPurchase = (state: GameState, propertyId: string, playerId: string): GameState => {
  const property = state.properties.find(p => p.id === propertyId);
  const player = state.players.find(p => p.id === playerId);
  if (!property || !player || property.isOwned || player.balance < property.currentValue) return state;

  const nextState = {
    ...state,
    properties: state.properties.map(p => p.id === propertyId ? { ...p, isOwned: true, owner: player.name } : p),
    players: state.players.map(pl => pl.id === playerId ? { ...pl, balance: pl.balance - property.currentValue, properties: [...pl.properties, propertyId] } : pl),
    pendingPurchase: null,
    turnState: 'completed' as const
  };
  
  return addEvent(nextState, 'purchase', player.name, `bought ${property.name}`, -property.currentValue);
};

export const checkWinCondition = (state: GameState): GameState => {
  const activePlayers = state.players.filter(p => p.isActive && !p.isSpectator);
  if (activePlayers.length === 1 && !state.winnerId) {
    return { ...state, winnerId: activePlayers[0].id, gamePhase: 'ended' };
  }
  // Team mode: once someone has been eliminated, the game ends when every survivor is on one team
  if (state.settings.teamsEnabled && !state.winnerId && activePlayers.length > 1 && state.players.some(p => !p.isActive) &&
      activePlayers.every(p => p.teamId && p.teamId === activePlayers[0].teamId)) {
    return { ...state, winnerId: activePlayers[0].id, winnerTeamId: activePlayers[0].teamId, gamePhase: 'ended' };
  }
  return state;
};

// ── Build / mortgage rules (single source of truth for hook + UI) ──────────────
export const buildLevel = (p: Property): number => (p.hasHotel ? 5 : p.houses);
export const mortgagePayout = (p: Property): number => Math.round(p.currentValue * 0.5);
export const unmortgageCost = (p: Property): number => Math.round(mortgagePayout(p) * 1.1);

const colorGroupOf = (properties: Property[], property: Property): Property[] =>
  property.colorGroup ? properties.filter(p => p.type === 'property' && p.colorGroup === property.colorGroup) : [];

export const ownsFullGroup = (properties: Property[], property: Property, ownerName: string): boolean => {
  const group = colorGroupOf(properties, property);
  return group.length > 0 && group.every(p => p.owner === ownerName && !p.isMortgaged && !p.isInactive);
};

// Even-build: a property may only be raised when it is at the lowest level in its group (hotel = level 5).
export const canBuildHouseOn = (properties: Property[], property: Property, ownerName: string): boolean => {
  if (property.type !== 'property' || property.isMortgaged || property.isInactive || property.hasHotel) return false;
  if (property.owner !== ownerName || property.houses >= 4) return false;
  if (!ownsFullGroup(properties, property, ownerName)) return false;
  const minLevel = Math.min(...colorGroupOf(properties, property).map(buildLevel));
  return buildLevel(property) <= minLevel;
};

export const canBuildHotelOn = (properties: Property[], property: Property, ownerName: string): boolean => {
  if (property.type !== 'property' || property.isMortgaged || property.isInactive || property.hasHotel) return false;
  if (property.owner !== ownerName || property.houses !== 4) return false;
  if (!ownsFullGroup(properties, property, ownerName)) return false;
  return Math.min(...colorGroupOf(properties, property).map(buildLevel)) >= 4;
};

// Even-sell: a property may only be lowered when it is at the highest level in its group.
export const canSellBuildingOn = (properties: Property[], property: Property, ownerName: string): boolean => {
  if (property.type !== 'property' || property.owner !== ownerName || buildLevel(property) <= 0) return false;
  return buildLevel(property) >= Math.max(...colorGroupOf(properties, property).map(buildLevel));
};

// ── Chance / Community Chest resolution (income-based) ──────────────────────────
export const resolvePendingCard = (state: GameState): GameState => {
  const pc = state.pendingCard;
  if (!pc) return state;
  const cp = state.players.find(p => p.id === state.currentPlayer);
  const cleared: GameState = { ...state, pendingCard: null };
  if (!cp) return cleared;

  const amount = pc.amount ?? 0;
  const label = pc.type === 'chance' ? 'Chance' : 'Community Chest';
  if (pc.jailCard) {
    cleared.players = cleared.players.map(p => p.id === cp.id ? { ...p, jailCards: (p.jailCards || 0) + 1 } : p);
    cleared.gameEvents = addEvent(cleared, 'card', cp.name, `${label}: doubles! Got a Get Out of Jail Free card`).gameEvents;
  }
  const rollLabel = `roll ${pc.diceRoll} — ${pc.diceRoll % 2 !== 0 ? 'odd' : 'even'}`;
  if (amount <= 0) {
    return addEvent(cleared, 'card', cp.name, `${label} (${rollLabel}): No properties — no change`);
  }
  const msg = `${label} (${rollLabel}): ${pc.isReward ? '+' : '-'}$${amount.toLocaleString('en-US')} from ${pc.numProperties} prop${pc.numProperties !== 1 ? 's' : ''}`;
  let next = addEvent(cleared, 'card', cp.name, msg, pc.isReward ? amount : -amount);
  if (pc.isReward) {
    return { ...next, players: next.players.map(p => p.id === cp.id ? { ...p, balance: p.balance + amount } : p) };
  }
  return applyPayment(next, cp.id, null, amount, label); // penalty can bankrupt
};

// Apply payment and check bankruptcy.
// Creditor only receives what the payer actually had. A bankrupt player's properties become neutral
// inactive tiles (no rent, no purchase); their workers and pending trade offers are cleared.
export const applyPayment = (state: GameState, fromId: string, toPlayerName: string | null, amount: number, reason: string): GameState => {
  const payerIdx = state.players.findIndex(p => p.id === fromId);
  if (payerIdx === -1 || amount <= 0) return state;
  const payer = state.players[payerIdx];
  const goesBankrupt = payer.balance - amount < 0;
  const received = goesBankrupt ? Math.max(0, payer.balance) : amount;

  const players = state.players.map((p, i) => {
    if (i === payerIdx) {
      return goesBankrupt
        ? { ...p, balance: 0, isActive: false, properties: [] as string[] }
        : { ...p, balance: p.balance - amount };
    }
    if (toPlayerName && p.name === toPlayerName) return { ...p, balance: p.balance + received };
    return p;
  });

  let nextState: GameState = { ...state, players };
  if (goesBankrupt) {
    nextState = {
      ...nextState,
      properties: state.properties.map(prop =>
        prop.owner === payer.name
          ? { ...prop, isInactive: true, isMortgaged: false, houses: 0, hasHotel: false }
          : prop
      ),
      workers: (state.workers || []).filter(w => w.ownerId !== payer.id),
      tradeOffers: (state.tradeOffers || []).map(o =>
        o.status === 'pending' && (o.fromPlayer === payer.name || o.toPlayer === payer.name)
          ? { ...o, status: 'rejected' as const }
          : o
      ),
      turnState: state.currentPlayer === payer.id ? 'completed' : state.turnState,
      pendingPurchase: state.currentPlayer === payer.id ? null : state.pendingPurchase
    };
    nextState = addEvent(nextState, 'bankrupt', payer.name, `went bankrupt (${reason})`);
  }
  return checkWinCondition(nextState);
};
