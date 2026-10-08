const assert = require('node:assert/strict');
const wait = ms => new Promise(r => setTimeout(r, ms));
module.exports = async ({ run, fixture, read }) => {
    for (const mode of ['teammate', 'mortgaged', 'shared-monopoly', 'even-build', 'uneven-build'])
        await run('landing-' + mode, async () => { const f = await fixture(3, { teamsEnabled: mode === 'teammate' || mode === 'shared-monopoly', mortgageEnabled: true }, s => { s.players[0].position = 39; s.players.forEach(p => p.balance = 10000000); const brown = s.properties.filter(p => p.colorGroup === 'brown'); for (let i = 0; i < brown.length; i++) {
            const owner = mode.includes('build') ? 0 : mode === 'shared-monopoly' ? i + 1 : 1;
            brown[i].owner = 'P' + owner;
            brown[i].isOwned = true;
            s.players[owner].properties.push(brown[i].id);
        } if (mode === 'mortgaged')
            brown[0].isMortgaged = true; if (mode === 'uneven-build')
            brown[0].houses = 1; if (mode === 'teammate' || mode === 'shared-monopoly') {
            const members = mode === 'teammate' ? ['player-1', 'player-2'] : ['player-2', 'player-3'];
            s.teams = [{ id: 't1', name: 'Alliance', members, sharedBalance: 0, color: '#67e8f9' }];
            for (const p of s.players)
                if (members.includes(p.id))
                    p.teamId = 't1';
        } }); try {
            const p = f.pages[0];
            await p.evaluate(() => { window.__testRandom = Math.random; Math.random = () => 0; });
            await p.getByRole('button', { name: /roll dice/i }).click();
            await wait(1600);
            await p.evaluate(() => { Math.random = window.__testRandom; delete window.__testRandom; });
            let s = (await read(f)).gameState;
            assert.equal(s.lastDiceRoll.total, 2);
            if (mode === 'teammate' || mode === 'mortgaged')
                assert.equal(s.pendingRent, null, 'Rent charged on exempt landing');
            if (mode === 'shared-monopoly')
                assert.equal(s.pendingRent.amount, s.properties[1].rent[0] * 2, 'Team monopoly rent not doubled');
            if (mode === 'even-build') {
                await p.getByRole('button', { name: 'Build house & end turn', exact: true }).click();
                const until = Date.now() + 5000;
                while (Date.now() < until && (await read(f)).gameState.properties[1].houses !== 1)
                    await wait(100);
                assert.equal((await read(f)).gameState.properties[1].houses, 1);
            }
            if (mode === 'uneven-build') {
                assert.equal(await p.getByRole('button', { name: 'Build house & end turn', exact: true }).count(), 0);
                assert.equal(s.properties[1].houses, 1);
            }
            f.details = { dice: 2, position: s.players[0].position };
            return f;
        }
        catch (e) {
            e.fixture = f;
            throw e;
        } });
    await run('last-team-win-ui', async () => { const f = await fixture(3, { teamsEnabled: true }, s => { s.currentPlayer = 'player-3'; s.players[2].balance = 1; s.turnState = 'waiting_for_action'; s.players[2].position = 1; s.properties[1].owner = 'P0'; s.properties[1].isOwned = true; s.players[0].properties = [s.properties[1].id]; s.pendingRent = { propertyId: s.properties[1].id, owner: 'P0', amount: 2 }; s.teams = [{ id: 't1', name: 'Alliance', members: ['player-1', 'player-2'], sharedBalance: 0, color: '#67e8f9' }]; s.players[0].teamId = s.players[1].teamId = 't1'; }); try {
        await f.pages[2].getByRole('button', { name: 'Declare bankruptcy', exact: true }).click();
        await wait(700);
        const s = (await read(f)).gameState;
        assert.equal(s.gamePhase, 'ended');
        assert.equal(s.winnerTeamId, 't1');
        f.details = { winner: s.winnerTeamId };
        return f;
    }
    catch (e) {
        e.fixture = f;
        throw e;
    } });
};
