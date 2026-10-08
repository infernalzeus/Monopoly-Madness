// Seeded legal-action fuzz of real core + hook updaters, with replay and deletion minimization.
const fs = require('node:fs'), path = require('node:path');
const { makeEngine, initialState } = require('./engine.cjs');
const { invariant } = require('./invariants.cjs');
const out = path.join(__dirname, 'artifacts');
const reproDir = path.join(__dirname, 'repros');
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(reproDir, { recursive: true });
const copy = x => JSON.parse(JSON.stringify(x));
function rng(seed) { let n = seed >>> 0; return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; }; }
function fixture(seed) {
    const random = rng(seed);
    const s = initialState();
    const n = 2 + seed % 7;
    const template = s.players[0];
    s.players = Array.from({ length: n }, (_, i) => ({ ...template, id: `player-${i + 1}`, name: `P${i}`, balance: 300000 + Math.floor(random() * 3000000), properties: [], isActive: true, isBot: n === 2 && i === 1 && seed % 2 === 0, position: Math.floor(random() * 40) }));
    s.currentPlayer = s.players[0].id;
    s.gamePhase = 'playing';
    s.turn = 0;
    s.settings = { ...s.settings, auctionsEnabled: random() < .5, tradingEnabled: random() < .5, workersEnabled: random() < .5, teamsEnabled: random() < .5, mortgageEnabled: random() < .5, freeParkingPot: random() < .5, supplyLimits: random() < .5, blindPickEnabled: random() < .5, turnTimerDuration: random() < .5 ? 30 : 0, auctionDuration: 2 };
    s.teams = [];
    s.workers = [];
    s.tradeOffers = [];
    // Valid mid-game holdings, including complete groups, to exercise building and liquidation.
    const groups = [...new Set(s.properties.filter(p => p.type === 'property').map(p => p.colorGroup))];
    groups.forEach((g, j) => { if (random() < .25)
        return; const owner = s.players[j % n]; for (const p of s.properties.filter(p => p.colorGroup === g)) {
        p.owner = owner.name;
        p.isOwned = true;
        p.isMortgaged = s.settings.mortgageEnabled && random() < .15;
        owner.properties.push(p.id);
    } });
    if (s.settings.teamsEnabled && n > 2 && random() < .6) {
        s.teams = [{ id: 't1', name: 'First alliance', members: s.players.slice(0, 2).map(p => p.id), sharedBalance: 0, color: '#67e8f9' }];
        s.players[0].teamId = 't1';
        s.players[1].teamId = 't1';
    }
    if (s.settings.auctionsEnabled && seed % 4 === 0) {
        const ids = s.properties.filter(p => !p.isOwned && p.type !== 'special').slice(0, 3).map(p => p.id);
        s.settings.preAuctionProperties = ids;
        s.preAuctionPhase = true;
        s.gamePhase = 'auction';
    }
    return s;
}
function apply(e, a, saved) { e.now = a.at; e.rng = a.rng; const before = copy(e.state); if (a.name === 'replay') {
    const fn = saved.get(a.reference);
    if (fn)
        fn();
    e.flush();
}
else {
    const actions = e.actions(a.actor);
    const fn = () => actions[a.name](...a.args);
    saved.set(a.id, fn);
    fn();
    e.flush();
} invariant(e.state, null, before); }
function replay(test) { const e = makeEngine(test.seed); e.state = copy(test.initial); const saved = new Map(); try {
    invariant(e.state);
    for (const action of test.actions)
        apply(e, action, saved);
    return null;
}
catch (error) {
    return error.message;
} }
function select(e, random, trace) {
    const s = e.state, active = s.players.filter(p => p.isActive && !p.isSpectator);
    const p = s.players.find(p => p.id === s.currentPlayer);
    const actor = p?.id;
    if (trace.length && random() < .04) {
        return { name: 'replay', reference: trace[Math.floor(random() * trace.length)].id, args: [], actor };
    }
    if (s.currentAuction) {
        const a = s.currentAuction;
        const bidders = active.filter(p => p.name !== a.startedBy && p.name !== a.highestBidder && p.balance >= a.currentBid + 10000);
        if (bidders.length && random() < .55) {
            const b = bidders[Math.floor(random() * bidders.length)];
            return { name: 'placeBid', args: [a.currentBid + 10000], actor: b.id };
        }
        e.tick(20000);
        return { name: 'resolveAuctionForTest', args: [false, a.startTime], actor };
    }
    if (s.preAuctionPhase)
        return { name: 'advanceDraft', args: [], actor };
    const offers = s.tradeOffers.filter(o => o.status === 'pending');
    if (s.settings.tradingEnabled && offers.length && random() < .22) {
        const o = offers[Math.floor(random() * offers.length)];
        const method = ['acceptTradeOffer', 'rejectTradeOffer', 'cancelTradeOffer'][Math.floor(random() * 3)];
        return { name: method, args: [o.id], actor: s.players.find(p => p.name === (method === 'cancelTradeOffer' ? o.fromPlayer : o.toPlayer)).id };
    }
    if (s.settings.tradingEnabled && random() < .12) {
        const from = active[Math.floor(random() * active.length)], others = active.filter(p => p.id !== from.id);
        if (others.length) {
            const to = others[Math.floor(random() * others.length)];
            const offered = s.properties.filter(p => p.owner === from.name && !p.isInactive && !p.isInAuction && !e.core.hasBuildingsInGroup(s.properties, p));
            return { name: 'createTradeOffer', args: [to.name, offered.length && random() < .5 ? [offered[0].id] : [], [], Math.min(10000, from.balance), 0], actor: from.id };
        }
    }
    if (s.settings.turnTimerDuration && s.turnEndTime && random() < .06) {
        const end = s.turnEndTime;
        e.now = Math.max(e.now, end + 1);
        return { name: 'advanceTurnForTest', args: [s.turn, end], actor };
    }
    if (s.pendingRent)
        return { name: 'payRent', args: [], actor };
    if (s.pendingCard)
        return { name: 'resolveCard', args: [], actor };
    if (s.pendingPurchase) {
        const pr = s.properties.find(p => p.id === s.pendingPurchase.propertyId);
        return p.balance > pr.currentValue && random() < .6 ? { name: 'purchaseProperty', args: [pr.id], actor } : { name: 'skipPurchase', args: [], actor };
    }
    if (s.turnState === 'completed' || s.turnState === 'waiting_for_action')
        return { name: 'endTurn', args: [], actor };
    if (p.isInJail) {
        const fine = e.actions(actor).getJailFineAmount().fine;
        if (p.jailCards && random() < .5)
            return { name: 'spendJailCard', args: [], actor };
        if (fine > 0 && p.balance >= fine && random() < .5)
            return { name: 'payJailFine', args: [], actor };
        return { name: 'skipJailTurn', args: [], actor };
    }
    const props = s.properties.filter(pr => pr.owner === p.name && !pr.isInactive);
    const options = [];
    for (const pr of props) {
        if (e.core.canBuildHouseOn(s.properties, pr, p.name, s.settings.supplyLimits) && p.balance >= (pr.houseCost || 0) * (pr.houses + 1))
            options.push(['buildHouse', pr.id]);
        if (e.core.canBuildHotelOn(s.properties, pr, p.name, s.settings.supplyLimits) && p.balance >= (pr.hotelCost || 0))
            options.push(['buildHotel', pr.id]);
        if (e.core.canSellBuildingOn(s.properties, pr, p.name, s.settings.supplyLimits))
            options.push([pr.hasHotel ? 'sellHotel' : 'sellHouse', pr.id]);
        if (s.settings.mortgageEnabled) {
            if (pr.isMortgaged && p.balance >= e.core.unmortgageCost(pr))
                options.push(['unmortgageProperty', pr.id]);
            else if (!pr.isMortgaged && !e.core.hasBuildingsInGroup(s.properties, pr))
                options.push(['mortgageProperty', pr.id]);
        }
        if (s.settings.workersEnabled && pr.type === 'property' && !s.workers.some(w => w.propertyId === pr.id))
            options.push(['assignWorker', pr.id, '#ffe5b4']);
    }
    if (options.length && random() < .4) {
        const [name, ...args] = options[Math.floor(random() * options.length)];
        return { name, args, actor };
    }
    return { name: p.isBot ? 'rollDiceForBot' : 'handleDiceRoll', args: [], actor: p.isBot ? s.players.find(p => !p.isBot).id : actor };
}
function minimize(test) { let actions = test.actions; for (let span = Math.max(1, Math.floor(actions.length / 2)); span >= 1; span = Math.floor(span / 2)) {
    for (let i = 0; i < actions.length;) {
        const candidate = actions.slice(0, i).concat(actions.slice(i + span));
        if (replay({ ...test, actions: candidate }) === test.failure)
            actions = candidate;
        else
            i += span;
    }
} return { ...test, actions }; }
if (process.argv.includes('--repro')) {
    const p = process.argv[process.argv.indexOf('--repro') + 1];
    const t = JSON.parse(fs.readFileSync(p, 'utf8'));
    const error = replay(t);
    console.log(error ? 'FAIL ' + error : 'PASS');
    process.exitCode = error ? 1 : 0;
}
else {
    const started = performance.now();
    const seeds = Number(process.argv.find(a => a.startsWith('--seeds='))?.split('=')[1] || 2000);
    const failures = [], unique = new Map(), coverage = {};
    let transitions = 0;
    for (let seed = 1; seed <= seeds; seed++) {
        const e = makeEngine(seed);
        const initial = fixture(seed);
        e.state = copy(initial);
        const random = rng(seed ^ 0xabc123);
        const trace = [], saved = new Map();
        try {
            invariant(e.state);
            for (let step = 0; step < 500 && e.state.gamePhase !== 'ended' && e.state.turn < 150; step++) {
                e.tick(1000);
                const a = { ...select(e, random, trace), id: step, at: e.now, rng: e.rng };
                trace.push(a);
                coverage[a.name] = (coverage[a.name] || 0) + 1;
                apply(e, a, saved);
                transitions++;
            }
        }
        catch (error) {
            const test = { seed, initial, actions: trace, failure: error.message };
            failures.push({ seed, error: error.message, steps: trace.length });
            if (!unique.has(error.message))
                unique.set(error.message, minimize(test));
        }
        if (seed % 250 === 0)
            console.log('Seeds ' + seed + '/' + seeds + '; failures ' + failures.length);
    }
    let i = 0;
    for (const test of unique.values()) {
        const id = 'fuzz-' + (++i);
        fs.writeFileSync(path.join(reproDir, id + '.json'), JSON.stringify(test, null, 2));
        fs.writeFileSync(path.join(reproDir, id + '.cjs'), `require('node:child_process').spawnSync(process.execPath,[require('node:path').join(__dirname,'../fuzz.cjs'),'--repro',require('node:path').join(__dirname,'${id}.json')],{stdio:'inherit'}).status && (process.exitCode=1);\n`);
    }
    const summary = { seeds, transitions, failures, uniqueFailures: [...unique.values()].map(t => ({ seed: t.seed, error: t.failure, minimalSteps: t.actions.length })), coverage, wallSeconds: (performance.now() - started) / 1000 };
    fs.writeFileSync(path.join(out, 'fuzz-results.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify({ ...summary, failures: failures.length }, null, 2));
    if (failures.length)
        process.exitCode = 1;
}
