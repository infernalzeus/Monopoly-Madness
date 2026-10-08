const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { externalRequire, emulatorDatabase } = require('./tools.cjs');
const { initialState } = require('./engine.cjs');
const { chromium } = externalRequire('playwright');
const { db, close } = emulatorDatabase();
(async () => { const start = performance.now(), browser = await chromium.launch({ channel: 'msedge', headless: true }); try {
    const pages = await Promise.all(Array.from({ length: 8 }, async (_, i) => { const p = await browser.newPage({ viewport: { width: 390, height: 844 } }); p.logs = []; p.on('console', m => { if (m.type() === 'error')
        p.logs.push(m.text()); }); p.on('dialog', async (d) => { p.logs.push(d.message()); await d.dismiss(); }); await p.goto('http://127.0.0.1:4187'); p.uid = await require('./browser-uid.cjs')(p); return p; }));
    assert.equal(new Set(pages.map(p => p.uid)).size, 8);
    const s = initialState();
    s.players = [];
    s.settings.maxPlayers = 8;
    const code = String(100000 + Date.now() % 900000), ref = db.collection('games').doc(code);
    await ref.set({ gameState: s, status: 'waiting', hostUid: pages[0].uid, hostName: 'Concurrent fixture', members: { [pages[0].uid]: true }, lastUpdated: Date.now() });
    await Promise.all(pages.map(async (p, i) => { await p.locator('#lobbyCode').fill(code); await p.locator('#joinPlayerName').fill('Join' + i); }));
    await Promise.all(pages.map(p => p.getByRole('button', { name: 'Join Lobby', exact: true }).click()));
    await new Promise(r => setTimeout(r, 2000));
    const after = (await ref.get()).data(), result = { expectedPlayers: 8, actualPlayers: after.gameState.players.length, uniqueUids: 8, logs: pages.map(p => p.logs), seconds: (performance.now() - start) / 1000 };
    fs.writeFileSync(path.join(__dirname, 'artifacts/concurrent-joins.json'), JSON.stringify(result, null, 2));
    await pages[0].screenshot({ path: path.join(__dirname, 'artifacts/concurrent-joins.png'), fullPage: true });
    console.log(JSON.stringify(result));
    assert.equal(result.actualPlayers, 8, 'Eight concurrent new joins did not persist');
}
finally {
    await browser.close();
    await close();
} })().catch(e => { console.error(e.message); process.exitCode = 1; });
