const assert = require('node:assert/strict');
const wait = ms => new Promise(r => setTimeout(r, ms));
module.exports = async function ({ run, fixture, read }) {
    await run('trading-every-pair', async () => { const f = await fixture(3, { tradingEnabled: true }); try {
        const checks = [];
        const activate = async (i) => { let s = (await read(f)).gameState; s.currentPlayer = 'player-' + (i + 1); s.turn++; s.turnState = 'waiting_for_roll'; await f.ref.update({ gameState: s }); await f.pages[i].getByRole('button', { name: 'Trade', exact: true }).waitFor(); };
        for (let from = 0; from < 3; from++)
            for (let to = 0; to < 3; to++)
                if (from !== to) {
                    for (const action of ['Accept', 'Reject', 'Withdraw', 'Expire']) {
                        await activate(from);
                        const p = f.pages[from];
                        await p.getByRole('button', { name: 'Trade', exact: true }).click();
                        await p.getByLabel('Trade with').selectOption('P' + to);
                        await p.getByLabel('Cash you give ($)', { exact: true }).fill('1');
                        await p.getByRole('button', { name: 'Send trade offer', exact: true }).click();
                        await wait(250);
                        let s = (await read(f)).gameState;
                        const offer = s.tradeOffers.filter(o => o.fromPlayer === 'P' + from && o.toPlayer === 'P' + to && o.status === 'pending').at(-1);
                        assert.ok(offer, 'UI offer not persisted');
                        await p.keyboard.press('Escape');
                        const outsiderIndex = [0, 1, 2].find(i => i !== from && i !== to);
                        await activate(outsiderIndex);
                        const outsider = f.pages[outsiderIndex];
                        await outsider.getByRole('button', { name: 'Trade', exact: true }).click();
                        assert.equal(await outsider.getByRole('button', { name: 'Accept', exact: true }).count(), 0, 'Unrelated player can see accept control');
                        await outsider.keyboard.press('Escape');
                        await activate(action === 'Withdraw' ? from : to);
                        const actor = f.pages[action === 'Withdraw' ? from : to];
                        s = (await read(f)).gameState;
                        if (action === 'Expire') {
                            s.tradeOffers.find(o => o.id === offer.id).expiresAt = Date.now() - 60000;
                            await f.ref.update({ gameState: s });
                            await wait(500);
                        }
                        await actor.getByRole('button', { name: 'Trade', exact: true }).click();
                        if (action === 'Expire') {
                            const accept = actor.getByRole('button', { name: 'Accept', exact: true });
                            if (await accept.count())
                                assert.ok(await accept.isDisabled(), 'Expired offer enabled');
                        }
                        else {
                            await actor.getByRole('button', { name: action, exact: true }).click();
                            await wait(300);
                            s = (await read(f)).gameState;
                            const status = s.tradeOffers.find(o => o.id === offer.id)?.status;
                            assert.equal(status, action === 'Accept' ? 'accepted' : action === 'Reject' ? 'rejected' : undefined);
                        }
                        await actor.keyboard.press('Escape');
                        if (action === 'Expire') {
                            s = (await read(f)).gameState;
                            s.tradeOffers = s.tradeOffers.filter(o => o.id !== offer.id);
                            await f.ref.update({ gameState: s });
                        }
                        checks.push({ from, to, action });
                    }
                }
        f.details = { checks: checks.length, wrongPlayerAcceptControlAbsent: true, expiryFixture: true, turnFixtures: true };
        return f;
    }
    catch (e) {
        e.fixture = f;
        throw e;
    } });
    await run('mortgage-unmortgage-ui', async () => { const f = await fixture(3, { mortgageEnabled: true }, s => { const p = s.properties[1]; p.owner = 'P0'; p.isOwned = true; s.players[0].properties = [p.id]; }); try {
        const p = f.pages[0];
        await p.getByRole('button', { name: 'My properties', exact: true }).click();
        await p.getByRole('button', { name: /^Mortgage \+/ }).click();
        await wait(500);
        assert.equal((await read(f)).gameState.properties[1].isMortgaged, true);
        await p.getByRole('button', { name: /^Unmortgage/ }).click();
        await wait(500);
        assert.equal((await read(f)).gameState.properties[1].isMortgaged, false);
        f.details = { mortgage: true, unmortgage: true };
        return f;
    }
    catch (e) {
        e.fixture = f;
        throw e;
    } });
    await run('workers-assignment-ui', async () => { const f = await fixture(3, { workersEnabled: true, teamsEnabled: true }, s => { const own = s.properties.filter(p => p.colorGroup === 'brown'); for (const p of own) {
        p.owner = 'P0';
        p.isOwned = true;
        s.players[0].properties.push(p.id);
    } s.teams = [{ id: 't1', name: 'Alliance', members: ['player-1', 'player-2'], sharedBalance: 0, color: '#67e8f9' }]; s.players[0].teamId = s.players[1].teamId = 't1'; }); try {
        const p = f.pages[0];
        await p.getByRole('button', { name: 'Worker assignment', exact: true }).click();
        await p.getByRole('button', { name: 'Assign worker', exact: true }).first().click();
        await wait(500);
        assert.equal((await read(f)).gameState.workers.length, 1);
        await p.getByRole('button', { name: 'Remove worker', exact: true }).click();
        await wait(500);
        assert.equal((await read(f)).gameState.workers.length, 0);
        f.details = { assigned: true, removed: true };
        return f;
    }
    catch (e) {
        e.fixture = f;
        throw e;
    } });
};
