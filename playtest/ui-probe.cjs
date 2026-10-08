const fs = require('node:fs'), path = require('node:path');
const external = process.env.MONOPOLY_PLAYTEST_TOOLS || path.join(process.env.TEMP, 'monopoly-playtest-tools');
const { chromium } = require(path.join(external, 'node_modules/playwright'));
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8180';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9199';
const { emulatorDatabase } = require('./tools.cjs');
const { db, close: closeDatabase } = emulatorDatabase();
(async () => { const browser = await chromium.launch({ channel: 'msedge', headless: true }); const logs = []; try {
    const host = await browser.newPage();
    host.on('console', m => logs.push(m.type() + ': ' + m.text()));
    host.on('dialog', async (d) => { logs.push('DIALOG: ' + d.message()); await d.dismiss(); });
    await host.goto('http://127.0.0.1:4187');
    await host.locator('#createPlayerName').fill('Playtest Host');
    await host.getByRole('button', { name: 'Configure & Create Lobby', exact: true }).click();
    await host.getByRole('button', { name: '3 Players', exact: true }).click();
    await host.getByRole('button', { name: 'Off', exact: true }).click();
    await host.getByRole('button', { name: 'Create & Start Lobby', exact: true }).click();
    await host.getByText('Room code', { exact: true }).waitFor();
    const rooms = await db.collection('games').where('hostName', '==', 'Playtest Host').get();
    const code = (await host.locator('.mma-room-code strong').textContent()).trim();
    const room = rooms.docs.find(d => d.id === code);
    if (!room)
        throw Error('Created room not found');
    console.log('Created real UI room ' + room.id);
    const guest = await browser.newPage();
    guest.on('console', m => logs.push(m.type() + ': ' + m.text()));
    guest.on('dialog', async (d) => { logs.push('DIALOG: ' + d.message()); await d.dismiss(); });
    await guest.goto('http://127.0.0.1:4187');
    await guest.locator('#lobbyCode').fill(room.id);
    await guest.locator('#joinPlayerName').fill('Playtest Guest');
    await guest.getByRole('button', { name: 'Join Lobby', exact: true }).click();
    await guest.waitForTimeout(1500);
    const after = (await room.ref.get()).data();
    const out = path.join(__dirname, 'artifacts');
    fs.mkdirSync(out, { recursive: true });
    await guest.screenshot({ path: path.join(out, 'join-probe.png'), fullPage: true });
    fs.writeFileSync(path.join(out, 'join-probe.json'), JSON.stringify({ room: room.id, players: after.gameState.players, logs }, null, 2));
    console.log(JSON.stringify({ players: after.gameState.players.length, errors: logs.filter(x => x.startsWith('error') || x.startsWith('DIALOG')) }, null, 2));
    if (after.gameState.players.length !== 2)
        throw Error('FAIL: guest join left ' + after.gameState.players.length + ' players, expected 2');
}
finally {
    await browser.close();
    await closeDatabase();
} })().catch(e => { console.error(e); process.exitCode = 1; });
