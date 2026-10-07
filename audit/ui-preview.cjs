// Render the existing UI with synthetic fixtures. No effects, Firebase or app writes.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const out = path.join(__dirname, 'ui-preview');
let scene = 'board-my-turn', game;
let cache = new Map();
const noop = () => {};
function load(file, originalHook = false) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  let source = fs.readFileSync(file, 'utf8');
  if (file.endsWith('MonopolyGame.tsx')) {
    source = source.replace('useState(true);', `useState(${scene === 'lobby'});`)
      .replace('setIsLobbyOwner] = useState(false)', 'setIsLobbyOwner] = useState(true)')
      .replace("setLobbyCode] = useState('')", "setLobbyCode] = useState('654321')")
      .replace("setLocalPlayerId] = useState<string>('')", "setLocalPlayerId] = useState<string>('player-1')")
      .replace('setAuthChecked] = useState(false)', 'setAuthChecked] = useState(true)');
  }
  const module = { exports: {} }; cache.set(file, module);
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, console, Date, Math, setTimeout, clearTimeout, setInterval, clearInterval,
    require(name) {
      if (name === 'firebase/firestore') return {};
      if (name.endsWith('/lib/firebase')) return { db: {}, authReady: Promise.resolve(null), currentUid: () => 'fixture' };
      if (name === '@/hooks/useGameLogic' && !originalHook) return {
        getInitialState: () => game,
        useGameLogic: () => new Proxy({ gameState: game, turnTimer: 17, auctionTimer: 12, isRolling: false,
          getJailFineAmount: () => ({ fine: 50000, income: 250000, numProperties: 4 }) },
          { get: (o, k) => k in o ? o[k] : noop })
      };
      if (name.startsWith('.') || name.startsWith('@/')) {
        const base = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : path.resolve(path.dirname(file), name);
        const resolved = ['.tsx', '.ts', '.js', ''].map(ext => base + ext).find(p => fs.existsSync(p) && fs.statSync(p).isFile());
        if (!resolved) throw new Error(`Cannot resolve ${name}`);
        return load(resolved);
      }
      if (name.startsWith('firebase/')) throw new Error(`Firebase import prohibited: ${name}`);
      return require(name);
    }
  }, { filename: file });
  return module.exports;
}
const initial = load(path.join(root, 'src/hooks/useGameLogic.ts'), true).getInitialState;
function fixture() {
  const s = initial();
  const names = ['You', 'Alice', 'Bob', 'Charlie', 'Priya', 'Noah', 'Maya', 'Leo'];
  const colors = ['#06B6D4', '#F43F5E', '#F59E0B', '#10B981', '#8B5CF6', '#3B82F6', '#EC4899', '#F97316'];
  s.players = names.map((name, i) => ({ ...s.players[0], id: `player-${i + 1}`, name, color: colors[i],
    balance: 10234567 - i * 713321, properties: [], position: [7, 16, 21, 10, 28, 39, 1, 25][i],
    discoveredProperties: Array.from({ length: 40 }, (_, j) => j), pieceIcon: ['🌊', '🌹', '🔶', '💚', '⚡', '🌙', '🌸', '🔥'][i] }));
  const owners = { 1: 0, 3: 0, 6: 0, 8: 0, 9: 0, 11: 1, 13: 1, 14: 1, 16: 2, 18: 2, 19: 2, 21: 3, 23: 3, 24: 3, 26: 4, 27: 4, 29: 4, 31: 5, 32: 5, 34: 5, 37: 6, 39: 6, 5: 0, 15: 7, 25: 7, 35: 7, 12: 0, 28: 1 };
  for (const [index, owner] of Object.entries(owners)) {
    Object.assign(s.properties[index], { owner: names[owner], isOwned: true });
    s.players[owner].properties.push(s.properties[index].id);
  }
  s.properties[1].houses = 2; s.properties[3].houses = 2;
  s.properties[11].hasHotel = true; s.properties[13].houses = 4; s.properties[14].houses = 4;
  s.properties[8].isMortgaged = true;
  s.players[7].isActive = false; s.players[7].properties = [];
  for (const p of s.properties.filter(p => p.owner === 'Leo')) p.isInactive = true;
  s.settings = { ...s.settings, tradingEnabled: true, workersEnabled: true, teamsEnabled: true };
  s.teams = [{ id: 't1', name: 'Cyan Alliance', members: ['player-1', 'player-4'], sharedBalance: 0, color: colors[0] }];
  s.players[0].teamId = 't1'; s.players[3].teamId = 't1';
  s.gamePhase = 'playing'; s.currentPlayer = 'player-1'; s.turn = 14;
  s.workers = [{ id: 'w1', ownerId: 'player-1', propertyId: 'prop-1', color: '#FFE5B4' }];
  s.tradeOffers = [{ id: 'trade-1', fromPlayer: 'Alice', toPlayer: 'Bob', offeredProperties: [], requestedProperties: [], offeredCash: 125000, requestedCash: 0, status: 'pending', expiresAt: Date.now() + 600000 }];
  return s;
}
fs.mkdirSync(out, { recursive: true });
const cssFile = fs.readdirSync(path.join(root, 'dist/assets')).find(f => f.endsWith('.css'));
const css = fs.readFileSync(path.join(root, 'dist/assets', cssFile), 'utf8');
fs.copyFileSync(path.join(root, 'public/favicon.svg'), path.join(out, 'favicon.svg'));
const scenes = ['lobby', 'waiting-room', 'board-my-turn', 'board-standard', 'board-not-my-turn', 'auction-outbid', 'rent-due', 'jail', 'card', 'player-panel', 'trade-market', 'winner', 'property-card', 'teams', 'game-log'];
for (scene of scenes) {
  game = fixture(); cache = new Map();
  let component = 'MonopolyGame', props = {}, wrapper = '';
  if (scene === 'waiting-room') {
    game.gamePhase = 'setup'; game.players = game.players.slice(0, 7).map(p => ({ ...p, isActive: true, position: 0, properties: [] }));
    game.properties = initial().properties;
  }
  if (scene === 'board-standard') game.settings.workersEnabled = false;
  if (scene === 'board-not-my-turn') game.currentPlayer = 'player-2';
  if (scene === 'auction-outbid') {
    Object.assign(game.properties[16], { isOwned: false, owner: undefined, isInAuction: true });
    game.currentAuction = { propertyId: 'prop-16', currentBid: 1250000, highestBidder: 'Alice', startedBy: 'Bob', startTime: Date.now(), duration: 120, endTimestamp: Date.now() + 12000, isActive: true,
      bids: [{ player: 'You', amount: 1200000, timestamp: Date.now() - 5000 }, { player: 'Alice', amount: 1250000, timestamp: Date.now() - 2000 }] };
    game.turnState = 'waiting_for_action';
  }
  if (scene === 'rent-due') { game.pendingRent = { propertyId: 'prop-11', owner: 'Alice', amount: 750000 }; game.turnState = 'waiting_for_action'; }
  if (scene === 'jail') { Object.assign(game.players[0], { isInJail: true, jailTurns: 2, jailCards: 1 }); }
  if (scene === 'card') { game.pendingCard = { type: 'chance', income: 250000, amount: 25000, numProperties: 4, diceRoll: 7, isReward: true }; game.turnState = 'waiting_for_action'; }
  if (scene === 'winner') { game.gamePhase = 'ended'; game.winnerId = 'player-1'; for (const p of game.players.slice(1)) p.isActive = false; }
  if (scene === 'player-panel') { component = 'PlayerPanel'; props = { currentPlayer: game.players[0], allPlayers: game.players, ownedProperties: game.properties.filter(p => p.owner === 'You'), workers: game.workers, workersEnabled: true, onMortgage: noop, onUnmortgage: noop, onSell: noop, onTrade: noop }; wrapper = 'max-width:600px;padding:16px'; }
  if (scene === 'trade-market') { component = 'TradingSystem'; props = { currentPlayer: game.players[0], allPlayers: game.players, ownedProperties: game.properties.filter(p => p.owner === 'You'), allProperties: game.properties, tradeOffers: game.tradeOffers, onCreateTradeOffer: noop, onAcceptTradeOffer: noop, onRejectTradeOffer: noop, onCancelTradeOffer: noop, onPlaceTradeBid: noop }; wrapper = 'max-width:900px;padding:16px'; }
  if (scene === 'property-card') { component = 'PropertyCard'; props = { property: game.properties[1], isOwned: true, canBuyHouse: true, canBuyHotel: false, allProperties: game.properties, onBuyHouse: noop, onBuyHotel: noop, onMortgage: noop }; wrapper = 'max-width:384px;padding:16px'; }
  if (scene === 'teams') { component = 'TeamPanel'; props = { currentPlayer: game.players[0], players: game.players, teams: game.teams, onJoinTeam: noop, onCreateTeam: noop }; wrapper = 'max-width:600px;padding:16px'; }
  if (scene === 'game-log') { component = 'GameLog'; props = { players: game.players, events: [{ id: 'e', player: 'You', type: 'rent', message: 'paid $750,000 rent to Alice for Tokyo', amount: -750000, timestamp: Date.now() }] }; wrapper = 'max-width:600px;padding:16px'; }
  const C = load(path.join(root, `src/components/game/${component}.tsx`)).default;
  const html = renderToStaticMarkup(React.createElement(C, props));
  fs.writeFileSync(path.join(out, `${scene}.html`), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'self'"><title>Offline audit: ${scene}</title><style>${css}</style></head><body><main style="${wrapper}">${html}</main></body></html>`);
  console.log(`Rendered ${scene}`);
}
if (process.argv.includes('--serve')) {
  const http = require('node:http');
  http.createServer((req, res) => {
    const name = path.basename(new URL(req.url, 'http://127.0.0.1').pathname);
    const file = path.join(out, name);
    if (!name || !fs.existsSync(file)) { res.writeHead(404); return res.end('Not found'); }
    res.setHeader('Content-Type', name.endsWith('.svg') ? 'image/svg+xml' : 'text/html; charset=utf-8');
    res.end(fs.readFileSync(file));
  }).listen(4174, '127.0.0.1', () => console.log('Offline preview at http://127.0.0.1:4174/board-my-turn.html'));
}
