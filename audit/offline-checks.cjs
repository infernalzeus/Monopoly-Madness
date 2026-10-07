// Offline behavioral audit. No Firebase initialization or network access.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: name => {
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected import: ${name}`);
  }, Date, Math, console, setTimeout, clearTimeout, setInterval, clearInterval }, { filename: file });
  return module.exports;
}
const core = load('src/gameEngine/core.ts');
let slots, cursor;
const react = {
  useState(initial) {
    const index = cursor++;
    if (!(index in slots)) slots[index] = initial;
    return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
  },
  useCallback: fn => fn,
  useEffect: () => {},
  useRef: value => ({ current: value })
};
const hook = load('src/hooks/useGameLogic.ts', {
  react,
  '../lib/firebase': { db: {} },
  'firebase/firestore': {},
  '../gameEngine/core': core
});
function fixture(count = 3) {
  const s = hook.getInitialState();
  s.players = s.players.slice(0, count);
  s.gamePhase = 'playing';
  s.turn = 10;
  s.settings = { ...s.settings, teamsEnabled: false, workersEnabled: false };
  return s;
}
function actions(s, actor = 'player-1') {
  slots = [s]; cursor = 0;
  return hook.useGameLogic(undefined, actor);
}
const dice = (a, b) => ({ dice1: a, dice2: b, total: a + b, isDouble: a === b });
let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log(`PASS ${name}`); }
  catch (e) { fail++; console.log(`FAIL ${name}: ${e.message}`); }
}
test('unaffordable rent transfers only available cash and ends a two-player game', () => {
  const s = fixture(2); s.players[0].balance = 100;
  const n = core.applyPayment(s, 'player-1', 'Alice', 150, 'Rent');
  assert.equal(n.players[1].balance, s.players[1].balance + 100);
  assert.equal(n.players[0].isActive, false);
  assert.equal(n.winnerId, 'player-2'); assert.equal(n.gamePhase, 'ended');
});
test('advance settles pending rent and card exactly once', () => {
  const s = fixture();
  s.pendingRent = { propertyId: 'prop-1', owner: 'Alice', amount: 100 };
  s.pendingCard = { type: 'chance', amount: 50, isReward: false, diceRoll: 4, income: 500, numProperties: 1 };
  const n = core.advanceTurn(s);
  assert.equal(n.players[0].balance, s.players[0].balance - 150);
  assert.equal(n.pendingRent, null); assert.equal(n.pendingCard, null);
});
test('setup dice and ended advance are no-ops', () => {
  const s = fixture(); s.gamePhase = 'setup'; assert.equal(core.rollDiceLogic(s, dice(1, 2)), s);
  s.gamePhase = 'ended'; assert.equal(core.advanceTurn(s), s);
});
test('hotel level participates in even building and selling', () => {
  const s = fixture(); const group = s.properties.filter(p => p.colorGroup === 'brown');
  group.forEach(p => { p.owner = 'You'; p.isOwned = true; p.houses = 4; });
  group[0].hasHotel = true; group[0].houses = 0;
  assert.equal(core.buildLevel(group[0]), 5);
  assert.equal(core.canBuildHotelOn(s.properties, group[1], 'You'), true);
  assert.equal(core.canSellBuildingOn(s.properties, group[1], 'You'), false);
});
test('doubles retain player and third double enters jail', () => {
  let s = fixture(); s = core.rollDiceLogic(s, dice(1, 1)); s = core.advanceTurn(s);
  assert.equal(s.currentPlayer, 'player-1'); s.doubleCount = 2;
  s = core.rollDiceLogic(s, dice(2, 2)); assert.equal(s.players[0].isInJail, true);
});
test('seeded payment conservation: 200 sequences across 2–8 players, up to 100 steps', () => {
  let seed = 0x12345678;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  let steps = 0;
  for (let run = 0; run < 200; run++) {
    let s = fixture(); const template = s.players[0];
    s.players = Array.from({ length: 2 + run % 7 }, (_, i) => ({ ...template, id: `player-${i + 1}`, name: `P${i}`, balance: 1000, properties: [] }));
    const initial = s.players.reduce((n, p) => n + p.balance, 0); let bank = 0;
    for (let k = 0; k < 100 && s.gamePhase !== 'ended'; k++) {
      const active = s.players.filter(p => p.isActive);
      const payer = active[Math.floor(random() * active.length)];
      const others = active.filter(p => p.id !== payer.id);
      const creditor = random() < .4 ? null : others[Math.floor(random() * others.length)].name;
      const amount = Math.floor(random() * 300);
      if (!creditor) bank += Math.min(payer.balance, amount);
      s = core.applyPayment(s, payer.id, creditor, amount, 'audit');
      if (s.gamePhase !== 'ended' && !s.players.find(p => p.id === s.currentPlayer).isActive) s = core.advanceTurn(s);
      assert.equal(s.players.reduce((n, p) => n + p.balance, 0) + bank, initial);
      assert.ok(s.players.every(p => !p.isActive || p.balance >= 0));
      assert.ok(s.gamePhase === 'ended' || s.players.find(p => p.id === s.currentPlayer).isActive);
      steps++;
    }
  }
  console.log(`  verified ${steps} payment transitions`);
});
test('REGRESSION: workers must require a full colour group', () => {
  const s = fixture(); s.settings.workersEnabled = true; s.players[0].position = 39;
  s.properties[1].owner = 'You'; s.properties[1].isOwned = true;
  s.workers = [{ id: 'w', ownerId: 'player-1', propertyId: 'prop-1', color: '#000' }];
  const n = core.movePlayer(s, 1); assert.equal(n.properties[1].houses, 0);
});
// PENDING OWNER DECISION (A13): neutral tiles keep their historical owner by design until the rule is chosen.
const pendingA13 = () => {
  const s = fixture(); s.players[0].balance = 1; s.players[0].properties = ['prop-1'];
  s.properties[1].owner = 'You'; s.properties[1].isOwned = true;
  const n = core.applyPayment(s, 'player-1', null, 2, 'audit');
  assert.equal(n.properties.filter(p => p.owner === 'You').length, n.players[0].properties.length);
};
test('REGRESSION: only addressed player may accept cash-only trade', () => {
  const s = fixture(); s.tradeOffers = [{ id: 't', fromPlayer: 'You', toPlayer: 'Alice', offeredProperties: [], requestedProperties: [], offeredCash: 100, requestedCash: 0, status: 'pending', expiresAt: Date.now() + 10000 }];
  const a = actions(s, 'player-3'); a.acceptTradeOffer('t', 'Bob');
  assert.equal(slots[0].players[2].balance, s.players[2].balance);
});
test('REGRESSION: stale card resolver must not advance another purchase decision', () => {
  const s = fixture(); s.currentPlayer = 'player-2'; s.turnState = 'waiting_for_action';
  s.pendingPurchase = { propertyId: 'prop-1', playerId: 'player-2' };
  const a = actions(s); a.resolveCard(); assert.equal(slots[0].turn, s.turn);
});
test('REGRESSION: double-click jail fine charges only once', () => {
  const s = fixture(); s.players[0].isInJail = true; s.players[0].jailTurns = 3;
  s.properties[1].owner = 'You'; s.properties[1].isOwned = true;
  const a = actions(s); a.payJailFine(); a.payJailFine();
  assert.equal(slots[0].players[0].balance, s.players[0].balance - 400);
});
test('REGRESSION: human driver can spend bot jail card', () => {
  const s = fixture(2); s.currentPlayer = 'player-2';
  Object.assign(s.players[1], { isBot: true, isInJail: true, jailCards: 1 });
  const a = actions(s); a.spendJailCard(); assert.equal(slots[0].players[1].isInJail, false);
});
test('trade built-group lock revalidates at acceptance', () => {
  const s = fixture(); s.properties[1].owner = 'You'; s.properties[1].isOwned = true; s.properties[3].houses = 1;
  s.tradeOffers = [{ id: 't', fromPlayer: 'You', toPlayer: 'Alice', offeredProperties: ['prop-1'], requestedProperties: [], offeredCash: 0, requestedCash: 0, status: 'pending', expiresAt: Date.now() + 10000 }];
  const a = actions(s, 'player-2'); a.acceptTradeOffer('t', 'Alice'); assert.equal(slots[0].tradeOffers[0].status, 'rejected');
});
test('empty draft starts play immediately', () => {
  const s = fixture(); s.gamePhase = 'auction'; s.preAuctionPhase = true; s.settings.preAuctionProperties = [];
  const a = actions(s); a.advanceDraft(); assert.equal(slots[0].gamePhase, 'playing');
});
test('unsold draft property is removed from queue and not retried', () => {
  const s = fixture(); s.gamePhase = 'auction'; s.preAuctionPhase = true; s.settings.preAuctionProperties = ['prop-1'];
  const a = actions(s); a.advanceDraft(); slots[0].currentAuction.endTimestamp = Date.now() - 5000; a.endAuction(); a.advanceDraft();
  assert.equal(slots[0].gamePhase, 'playing'); assert.equal(slots[0].properties[1].isOwned, false);
});
test('auction winner who cannot pay leaves property unsold', () => {
  const s = fixture(); s.pendingPurchase = { propertyId: 'prop-1', playerId: 'player-1' }; const a = actions(s); a.startAuction('prop-1', 'You');
  slots[0].currentAuction.highestBidder = 'Alice'; slots[0].currentAuction.currentBid = 200; slots[0].currentAuction.endTimestamp = Date.now() - 5000;
  slots[0].players[1].balance = 100; a.endAuction(); assert.equal(slots[0].properties[1].isOwned, false);
});
test('sequential lower bid is rejected against live state', () => {
  const s = fixture(); s.pendingPurchase = { propertyId: 'prop-1', playerId: 'player-1' }; const a = actions(s); a.startAuction('prop-1', 'You');
  a.placeBid(50000, 'player-2'); a.placeBid(40000, 'player-3');
  assert.equal(slots[0].currentAuction.highestBidder, 'Alice'); assert.equal(slots[0].currentAuction.currentBid, 50000);
});
test('stale trade ownership is cancelled', () => {
  const s = fixture(); s.properties[1].owner = 'Bob'; s.properties[1].isOwned = true;
  s.tradeOffers = [{ id: 't', fromPlayer: 'You', toPlayer: 'Alice', offeredProperties: ['prop-1'], requestedProperties: [], offeredCash: 0, requestedCash: 0, status: 'pending', expiresAt: Date.now() + 10000 }];
  const a = actions(s, 'player-2'); a.acceptTradeOffer('t', 'Alice'); assert.equal(slots[0].tradeOffers[0].status, 'rejected');
});
console.log(`RESULT ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
