import { GameState, DiceRoll, Player, Property, GameEvent, PendingCard, Worker } from '../types/game';

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

export const advanceTurn = (state: GameState): GameState => {
  const playerCount = state.players.length;
  const currentIndex = state.players.findIndex(p => p.id === state.currentPlayer);
  let nextIndex = (currentIndex + 1) % playerCount;

  // Skip inactive players and spectators
  for (let i = 0; i < playerCount; i++) {
    if (state.players[nextIndex].isActive && !state.players[nextIndex].isSpectator) break;
    nextIndex = (nextIndex + 1) % playerCount;
  }

  const nextPlayer = state.players[nextIndex];
  let nextState: GameState = {
    ...state,
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
  if (state.turnState !== 'waiting_for_roll') return state;
  
  let nextState: GameState = { ...state, turnState: 'processing', lastDiceRoll: diceResult };
  const currentPlayerData = nextState.players.find(p => p.id === nextState.currentPlayer);
  if (!currentPlayerData) return { ...nextState, turnState: 'waiting_for_roll' };

  if (currentPlayerData.isInJail) {
    const players = nextState.players.map(p => {
      if (p.id !== nextState.currentPlayer) return p;
      const remaining = Math.max(0, (p.jailTurns || 0) - 1);
      return { ...p, jailTurns: remaining, isInJail: remaining > 0 };
    });
    nextState = { ...nextState, players, turnState: 'completed' as const };
    return addEvent(nextState, 'move', currentPlayerData.name, 'turn skipped while in Jail');
  }

  return movePlayer(nextState, diceResult.total);
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
    playerWorkers.forEach(worker => {
      propertiesAfterWorkers = propertiesAfterWorkers.map(prop => {
        if (prop.id !== worker.propertyId) return prop;
        if (prop.owner !== movingPlayerBefore.name) return prop;
        if (prop.isMortgaged || prop.type !== 'property') return prop;
        if (prop.hasHotel) return prop;
        if (!prop.colorGroup) return prop;
        if (prop.houses < 4) {
          const cost = (prop.houseCost || 0) * (prop.houses + 1);
          if (movingPlayerBefore.balance - workerBuildDebt < cost) return prop;
          workerBuildDebt += cost;
          return { ...prop, houses: prop.houses + 1 };
        }
        // 4 houses → upgrade to hotel
        const cost = prop.hotelCost || 0;
        if (movingPlayerBefore.balance - workerBuildDebt < cost) return prop;
        workerBuildDebt += cost;
        return { ...prop, hasHotel: true, houses: 0 };
      });
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
    if (!ownerPlayer?.isInJail) {
      const rentAmount = computeRent(state.properties, landedProperty, state.lastDiceRoll?.total || 0);
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
      numProperties
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
export const computeRent = (properties: Property[], property: Property, diceTotal: number): number => {
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
          .every(p => p.owner === property.owner && !p.isMortgaged);
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
  return state;
};

// Apply payment and check bankruptcy
export const applyPayment = (state: GameState, fromId: string, toPlayerName: string | null, amount: number, reason: string): GameState => {
  let players = [...state.players];
  const payerIdx = players.findIndex(p => p.id === fromId);
  if (payerIdx === -1) return state;
  players[payerIdx] = { ...players[payerIdx], balance: players[payerIdx].balance - amount };

  if (toPlayerName) {
    const receiverIdx = players.findIndex(p => p.name === toPlayerName);
    if (receiverIdx !== -1) {
      players[receiverIdx] = { ...players[receiverIdx], balance: players[receiverIdx].balance + amount };
    }
  }

  // Bankruptcy — mark player inactive; their properties become neutral inactive tiles
  let nextState = { ...state, players };
  if (players[payerIdx].balance < 0) {
    players[payerIdx] = { ...players[payerIdx], isActive: false };
    const bankruptName = players[payerIdx].name;
    const inactiveProps = state.properties.map(prop =>
      prop.owner === bankruptName
        ? { ...prop, isInactive: true, isMortgaged: false }
        : prop
    );
    nextState = { ...nextState, players, properties: inactiveProps };
  }

  return checkWinCondition(nextState);
};
