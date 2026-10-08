// Emulator-only browser playthroughs. Admin seeds seats because normal joining is broken.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { externalRequire, emulatorDatabase } = require('./tools.cjs');
const { chromium } = externalRequire('playwright');
const { initialState } = require('./engine.cjs');
const { invariant } = require('./invariants.cjs');
const out = path.join(__dirname, 'artifacts');
fs.mkdirSync(out, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
const clean = x => JSON.parse(JSON.stringify(x));
let serial = 0;
const results = [];
const { db, close } = emulatorDatabase();
let browser;
async function page(width = 390) { const p = await browser.newPage({ viewport: { width, height: 844 } }); p.logs = []; p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning')
    p.logs.push(m.type() + ': ' + m.text()); }); p.on('pageerror', e => p.logs.push('PAGEERROR: ' + e.message)); p.on('dialog', async (d) => { p.logs.push('DIALOG: ' + d.message()); await d.dismiss(); }); await p.goto('http://127.0.0.1:4187'); p.uid = await require('./browser-uid.cjs')(p); assert.ok(p.uid); return p; }
async function join(p, id, name) { await p.locator('#lobbyCode').fill(id); await p.locator('#joinPlayerName').fill(name); await p.getByRole('button', { name: 'Join Lobby', exact: true }).click(); }
async function fixture(n = 3, settings = {}, mutate = () => { }, width = 390) { const pages = await Promise.all(Array.from({ length: n }, () => page(width))); const s = initialState(), template = s.players[0]; s.players = pages.map((p, i) => ({ ...template, id: 'player-' + (i + 1), name: 'P' + i, uid: p.uid, balance: 1500000, properties: [], position: 0, isActive: true, isBot: false })); s.currentPlayer = 'player-1'; s.gamePhase = 'playing'; s.turn = 0; s.turnState = 'waiting_for_roll'; s.settings = { ...s.settings, maxPlayers: n, auctionsEnabled: false, tradingEnabled: true, mortgageEnabled: true, workersEnabled: false, teamsEnabled: false, turnTimerDuration: 0, auctionDuration: 2, ...settings }; s.teams = []; s.workers = []; s.tradeOffers = []; s.turnEndTime = s.settings.turnTimerDuration ? Date.now() + s.settings.turnTimerDuration * 1000 : null; mutate(s); const id = String(100000 + ((Date.now() + process.pid * 100 + serial++) % 900000)); const ref = db.collection('games').doc(id); await ref.set(clean({ gameState: s, status: s.gamePhase === 'setup' ? 'waiting' : s.gamePhase === 'ended' ? 'ended' : 'playing', hostUid: pages[0].uid, hostName: 'P0', members: Object.fromEntries(pages.map(p => [p.uid, true])), playerCount: n, lastUpdated: Date.now() })); const f = { pages, ref, id }; try {
    for (let i = 0; i < pages.length; i++) {
        await join(pages[i], id, 'P' + i);
        await pages[i].locator('#lobbyCode').waitFor({ state: 'hidden', timeout: 20000 });
    }
    await pages[0].waitForTimeout(1500);
    return f;
}
catch (e) {
    e.fixture = f;
    throw e;
} }
async function read(f) { return (await f.ref.get()).data(); }
async function capture(name, f, error) { const screenshots = []; for (let i = 0; i < f.pages.length; i++) {
    const p = f.pages[i];
    if (p.isClosed())
        continue;
    const filename = name + '-' + i + '.png';
    await p.screenshot({ path: path.join(out, filename), fullPage: true }).catch(() => { });
    screenshots.push(filename);
} fs.writeFileSync(path.join(out, name + '-failure.json'), JSON.stringify({ error: String(error), room: await read(f), logs: f.pages.flatMap(p => p.logs), screenshots }, null, 2)); }
async function run(name, fn) { const start = performance.now(); let f; try {
    f = await fn();
    results.push({ name, status: 'PASS', seconds: (performance.now() - start) / 1000, details: f?.details });
}
catch (e) {
    f = e.fixture;
    results.push({ name, status: 'FAIL', error: e.message, seconds: (performance.now() - start) / 1000 });
    if (f)
        await capture(name, f, e);
}
finally {
    f?.stopWatch?.();
    if (f?.pages)
        await Promise.all(f.pages.filter(p => !p.isClosed()).map(p => p.close()));
    fs.writeFileSync(path.join(out, 'ui-results-' + (process.argv[2] || 'all') + '.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results.at(-1)));
} }
async function click(p, regex) { const b = p.getByRole('button', { name: regex }).filter({ visible: true }).first(); if (await b.count() && await b.isEnabled()) {
    await b.click({ timeout: 1500 });
    return true;
} return false; }
async function play(name, settings, mutate = () => { }, factory) {
    await run(name, async () => {
        const f = await (factory ? factory() : fixture(3, settings, mutate));
        try {
            const fast = process.argv.includes('--fast-clock');
            if (fast)
                for (const p of f.pages)
                    await p.clock.install();
            const advanceClocks = async () => { if (fast)
                await Promise.all(f.pages.map(p => p.clock.fastForward(1500))); };
            let watchFailure = null, watchPrevious = null, snapshots = 0;
            f.stopWatch = f.ref.onSnapshot(snap => { if (!snap.exists)
                return; const r = snap.data(); try {
                invariant(r.gameState, r, watchPrevious);
            }
            catch (e) {
                watchFailure = e;
            } watchPrevious = clean(r.gameState); snapshots++; }, e => { watchFailure = e; });
            let prev = null, last = '', changed = Date.now(), rolls = 0, actions = 0;
            const started = Date.now();
            for (;;) {
                if (watchFailure)
                    throw watchFailure;
                const room = await read(f), s = room.gameState;
                invariant(s, room, prev);
                prev = clean(s);
                const key = JSON.stringify(s);
                if (key !== last) {
                    last = key;
                    changed = Date.now();
                }
                if (s.gamePhase === 'ended' || s.turn >= 150) {
                    f.details = { turn: s.turn, phase: s.gamePhase, rolls, actions, snapshots, fixtureSeats: !factory, acceleratedClock: fast };
                    return f;
                }
                assert.ok(Date.now() - changed < 90000, 'No state change for 90 seconds');
                assert.ok(Date.now() - started < 25 * 60 * 1000, 'Scenario exceeded 25 minutes');
                for (let i = 0; i < f.pages.length; i++) {
                    const stages = f.pages[i].locator('.mma-stage:visible');
                    assert.ok(await stages.count() <= 1, 'Multiple action stages');
                    if (s.currentPlayer !== 'player-' + (i + 1) && !s.currentAuction && await stages.count()) {
                        await wait(3000);
                        const fresh = (await read(f)).gameState;
                        if (JSON.stringify(fresh) === JSON.stringify(s))
                            assert.equal(await stages.count(), 0, 'Another player decision exposed after settling');
                    }
                }
                if (s.currentAuction || s.preAuctionPhase || s.turnState === 'processing') {
                    await advanceClocks();
                    await wait(200);
                    continue;
                }
                const index = s.players.findIndex(p => p.id === s.currentPlayer), p = f.pages[index];
                if (s.players[index].isBot) {
                    await advanceClocks();
                    await wait(200);
                    continue;
                }
                if (s.turnState === 'waiting_for_roll' && !s.players[index].isInJail) {
                    const b = p.getByRole('button', { name: /roll dice/i }).first();
                    await b.waitFor({ state: 'visible', timeout: 3000 });
                    await b.waitFor({ state: 'visible' });
                    await p.waitForFunction(() => [...document.querySelectorAll('button')].some(b => /roll dice/i.test(b.textContent) && !b.disabled), {}, { timeout: 3000 });
                    assert.ok(await b.isEnabled(), 'Roll Dice disabled');
                    const before = s.lastDiceRoll;
                    await b.click();
                    if (fast)
                        await p.clock.fastForward(900);
                    const until = Date.now() + 3000;
                    let rolled = false;
                    while (Date.now() < until) {
                        const t = (await read(f)).gameState;
                        if (t.turnState !== 'waiting_for_roll' && t.lastDiceRoll) {
                            rolled = true;
                            break;
                        }
                        await wait(50);
                    }
                    assert.ok(rolled, 'Roll Dice did not update Firestore within 3 seconds');
                    rolls++;
                    actions++;
                }
                else if (s.pendingRent) {
                    if (await click(p, /^(Pay rent|Declare bankruptcy)$/))
                        actions++;
                }
                else if (s.pendingCard) {
                    if (await click(p, /^(Collect reward|Pay penalty|Continue)$/))
                        actions++;
                }
                else if (s.pendingPurchase) {
                    if (await click(p, settings.auctionsEnabled ? /^Pass — send to auction$/ : /^(Buy property|Pass)$/))
                        actions++;
                }
                else if (s.players[index].isInJail) {
                    if (await click(p, /^Stay in jail$/))
                        actions++;
                }
                else {
                    if (await click(p, /^End turn$/i))
                        actions++;
                }
                await advanceClocks();
                await wait(180);
            }
        }
        catch (e) {
            e.fixture = f;
            throw e;
        }
    });
}
async function scrollAndSheets() {
    await run('stage-scroll-and-phone-sheets', async () => {
        const f = await fixture(3, { teamsEnabled: true, workersEnabled: true }, s => { const own = s.properties.filter(p => p.type === 'property').slice(0, 12); own.forEach(p => { p.owner = 'P0'; p.isOwned = true; s.players[0].properties.push(p.id); }); s.gameEvents = Array.from({ length: 40 }, (_, i) => ({ id: 'ev' + i, type: 'move', player: 'P0', message: 'Playtest event ' + i, timestamp: Date.now() - i * 1000 })); });
        try {
            const p = f.pages[0], checks = [];
            for (const width of [390, 1440]) {
                await p.setViewportSize({ width, height: 844 });
                for (const kind of ['rent', 'card', 'purchase']) {
                    const s = (await read(f)).gameState;
                    s.turnState = 'waiting_for_action';
                    s.pendingRent = null;
                    s.pendingCard = null;
                    s.pendingPurchase = null;
                    if (kind === 'rent')
                        s.pendingRent = { propertyId: s.properties[1].id, owner: 'P1', amount: 10000 };
                    if (kind === 'card')
                        s.pendingCard = { type: 'chance', diceRoll: 3, income: 100000, amount: 10000, isReward: true, numProperties: 12 };
                    if (kind === 'purchase')
                        s.pendingPurchase = { propertyId: s.properties.find(x => x.type === 'property' && !x.isOwned).id, playerId: 'player-1' };
                    await f.ref.update({ gameState: clean(s) });
                    await p.locator('.mma-stage[data-kind="' + kind + '"]:visible').waitFor();
                    await p.evaluate(() => window.scrollTo(0, 0));
                    await p.mouse.move(2, 200);
                    await p.mouse.wheel(0, 600);
                    await wait(300);
                    const top = await p.evaluate(() => document.scrollingElement.scrollTop);
                    assert.ok(top > 0, kind + ' background scroll locked at ' + width);
                    checks.push({ width, kind, scrollTop: top });
                }
            }
            const s = (await read(f)).gameState;
            s.pendingPurchase = null;
            s.pendingCard = null;
            s.pendingRent = null;
            s.turnState = 'waiting_for_roll';
            await f.ref.update({ gameState: clean(s) });
            await p.setViewportSize({ width: 390, height: 844 });
            await wait(400);
            for (const label of ['My properties', 'Teams', 'Worker assignment', 'Trade', '📜']) {
                const opener = p.getByRole('button', { name: label, exact: true }).first();
                await opener.click();
                const sheet = p.locator('.mma-sheet:visible');
                await sheet.waitFor();
                const body = sheet.locator('.mma-stage-body');
                const needsScroll = await body.evaluate(n => n.scrollHeight > n.clientHeight + 1);
                if (needsScroll) {
                    const bounds = await body.boundingBox();
                    await p.mouse.move(bounds.x + bounds.width / 2, bounds.y + Math.min(80, bounds.height / 2));
                    await p.mouse.wheel(0, 500);
                    await wait(250);
                    assert.ok(await body.evaluate(n => n.scrollTop > 0), 'Sheet body did not scroll: ' + label);
                }
                await p.keyboard.press('Escape');
                await sheet.waitFor({ state: 'hidden' });
                assert.ok(await opener.evaluate(n => n === document.activeElement), 'Focus did not return to ' + label);
                await opener.click();
                await p.getByRole('button', { name: /^Close / }).filter({ visible: true }).last().click();
                assert.ok(await opener.evaluate(n => n === document.activeElement), 'Close button did not restore focus: ' + label);
                checks.push({ sheet: label, escape: true, close: true, focus: true, scrolled: needsScroll ? 'wheel verified' : 'content fits' });
            }
            f.details = checks;
            return f;
        }
        catch (e) {
            e.fixture = f;
            throw e;
        }
    });
}
async function disconnect(timer) { await run('disconnect-timer-' + timer, async () => { const f = await fixture(3, { turnTimerDuration: timer }); try {
    const before = (await read(f)).gameState;
    await f.pages[0].close();
    await wait(timer ? 40000 : 91000);
    const after = (await read(f)).gameState;
    assert.ok(after.turn > before.turn, 'Disconnected current player left turn stalled for ' + (timer ? 40 : 91) + ' seconds');
    f.details = { before: before.turn, after: after.turn };
    return f;
}
catch (e) {
    e.fixture = f;
    throw e;
} }); }
(async () => { browser = await chromium.launch({ channel: 'msedge', headless: true }); const mode = process.argv[2] || 'all'; if (mode === 'all' || mode === 'play' || mode.startsWith('play-')) {
    if (!mode.startsWith('play-') || mode === 'play-standard')
        await play('standard-3-timer-off', {});
    if (!mode.startsWith('play-') || mode === 'play-auction')
        await play('auctions-draft-3-timer30', { auctionsEnabled: true, turnTimerDuration: 30 }, s => { s.settings.preAuctionProperties = s.properties.filter(p => p.type === 'property').slice(0, 3).map(p => p.id); s.preAuctionPhase = true; s.gamePhase = 'auction'; });
    if (!mode.startsWith('play-') || mode === 'play-teams')
        await play('workers-teams-3', { workersEnabled: true, teamsEnabled: true }, s => { s.teams = [{ id: 't1', name: 'Alliance', members: ['player-1', 'player-2'], color: '#67e8f9', sharedBalance: 0 }]; s.players[0].teamId = s.players[1].teamId = 't1'; });
    if (mode === 'play-trading')
        await play('trading-3', { tradingEnabled: true });
    if (!mode.startsWith('play-') || mode === 'play-mortgage')
        await play('mortgage-3', { mortgageEnabled: true });
} if (mode === 'all' || mode === 'rematch')
    await require('./rematch-scenario.cjs')({ run, fixture, read }); if (mode === 'all' || mode === 'jail-serialization')
    await require('./jail-serialization.cjs')({ run, page, db, read }); if (mode === 'all' || mode === 'reconnect')
    await require('./reconnect-scenarios.cjs')({ run, fixture, read, join }); if (mode === 'all' || mode === 'build-race')
    await require('./build-race.cjs')({ run, fixture, read }); if (mode === 'all' || mode === 'landing')
    await require('./landing-scenarios.cjs')({ run, fixture, read }); if (mode === 'all' || mode === 'features')
    await require('./feature-scenarios.cjs')({ run, fixture, read }); if (mode === 'all' || mode === 'bot') {
    for (const draft of [false, true])
        await play('bot-draft-' + draft, { auctionsEnabled: true }, () => { }, () => require('./bot-fixture.cjs')({ page, db }, draft));
} if (mode === 'all' || mode === 'ux')
    await scrollAndSheets(); if (mode === 'all' || mode === 'disconnect') {
    await disconnect(30);
    await disconnect(0);
} await browser.close(); await close(); if (results.some(x => x.status === 'FAIL'))
    process.exitCode = 1; })().catch(async (e) => { console.error(e); await browser?.close(); await close(); process.exitCode = 1; });
