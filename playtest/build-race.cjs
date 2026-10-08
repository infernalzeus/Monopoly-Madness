const assert = require('node:assert/strict');
const wait = ms => new Promise(r => setTimeout(r, ms));
module.exports = async ({ run, fixture, read }) => run('build-and-end-race', async () => {
    const f = await fixture(3, {}, s => { s.players[0].position = 0; for (const property of s.properties.filter(p => p.colorGroup === 'brown')) {
        property.isOwned = true;
        property.owner = 'P0';
        s.players[0].properties.push(property.id);
    } });
    try {
        const p = f.pages[0];
        await p.evaluate(() => { window.__testRandom = Math.random; let n = 0; Math.random = () => n++ % 2 ? .2 : 0; });
        await p.getByRole('button', { name: /roll dice/i }).click();
        await wait(1700);
        await p.evaluate(() => { Math.random = window.__testRandom; delete window.__testRandom; });
        assert.equal((await read(f)).gameState.lastDiceRoll.total, 3);
        // Deliver the end-turn write before the building write: a legal network reordering.
        await p.route('**/documents:commit*', async (route) => { try {
            const data = route.request().postDataJSON();
            const built = data.writes?.some(w => w.update?.fields?.gameState?.mapValue?.fields?.properties?.arrayValue?.values?.some(v => v.mapValue?.fields?.id?.stringValue === 'prop-3' && String(v.mapValue?.fields?.houses?.integerValue) === '1'));
            if (built)
                await wait(500);
        }
        finally {
            await route.continue();
        } });
        await p.getByRole('button', { name: 'Build house & end turn', exact: true }).click();
        await wait(4000);
        const after = (await read(f)).gameState;
        assert.equal(after.properties[3].houses, 1, 'Build & end turn advanced without building after reordered delivery');
        f.details = { houses: after.properties[3].houses, turn: after.turn };
        return f;
    }
    catch (e) {
        e.fixture = f;
        throw e;
    }
});
