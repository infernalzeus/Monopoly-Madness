const assert = require('node:assert/strict');
const wait = ms => new Promise(r => setTimeout(r, ms));
module.exports = async ({ run, page, db, read }) => run('bot-jail-fine-serialization', async () => { const f = await require('./bot-fixture.cjs')({ page, db }, false); try {
    const s = (await read(f)).gameState;
    s.currentPlayer = 'player-2';
    s.turnState = 'waiting_for_roll';
    s.players[1].isInJail = true;
    s.players[1].jailTurns = 3;
    s.players[1].jailCards = 0;
    s.players[1].position = 10;
    s.players[1].properties = ['prop-1'];
    s.properties[1].owner = s.players[1].name;
    s.properties[1].isOwned = true;
    s.settings.auctionsEnabled = false;
    s.settings.freeParkingPot = false;
    delete s.freeParkingPot;
    await f.ref.update({ gameState: s });
    await wait(4000);
    const after = (await read(f)).gameState;
    assert.equal(after.players[1].isInJail, false, 'Bot bail write rejected; bot stays jailed with timer off');
    f.details = { released: true };
    return f;
}
catch (e) {
    e.fixture = f;
    throw e;
} });
