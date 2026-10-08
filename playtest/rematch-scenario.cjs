const assert = require('node:assert/strict');
const wait = ms => new Promise(r => setTimeout(r, ms));
module.exports = async ({ run, fixture, read }) => run('host-rematch-serialization', async () => { const f = await fixture(3, {}, s => { s.gamePhase = 'ended'; s.winnerId = 'player-1'; s.players[1].isActive = false; s.players[2].isActive = false; }); try {
    await f.pages[0].getByRole('button', { name: 'Rematch', exact: true }).click();
    await wait(3000);
    assert.equal((await read(f)).gameState.gamePhase, 'setup', 'Rematch write rejected; room remains ended');
    return f;
}
catch (e) {
    e.fixture = f;
    throw e;
} });
