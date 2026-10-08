const assert = require('node:assert/strict');
const wait = ms => new Promise(r => setTimeout(r, ms));
module.exports = async ({ run, fixture, read, join }) => {
    await run('refresh-reconnect', async () => { const f = await fixture(); try {
        const p = f.pages[0], uid = p.uid;
        await p.reload();
        await p.locator('#lobbyCode').waitFor();
        assert.equal(await require('./browser-uid.cjs')(p), uid);
        await join(p, f.id, 'P0');
        await p.locator('#lobbyCode').waitFor({ state: 'hidden' });
        const r = await read(f);
        assert.equal(r.gameState.players.length, 3);
        assert.equal(r.hostUid, uid);
        f.details = { seats: 3, uidRetained: true };
        return f;
    }
    catch (e) {
        e.fixture = f;
        throw e;
    } });
    for (const timer of [0, 30])
        await run('disconnect-mid-auction-' + timer, async () => { const f = await fixture(3, { auctionsEnabled: true, turnTimerDuration: timer }, s => { const property = s.properties[1]; property.isInAuction = true; s.turnState = 'waiting_for_action'; s.currentAuction = { propertyId: property.id, startTime: Date.now(), endTimestamp: Date.now() + 8000, duration: 8, currentBid: property.baseValue * .7, highestBidder: null, bids: [], isActive: true, startedBy: null }; }); try {
            await f.pages[0].close();
            await wait(11000);
            const s = (await read(f)).gameState;
            assert.equal(s.currentAuction, null, 'Auction stranded after current player disconnected');
            f.details = { auctionResolved: true, turn: s.turn };
            return f;
        }
        catch (e) {
            e.fixture = f;
            throw e;
        } });
    await run('host-disconnect-mid-draft', async () => { const f = await fixture(3, { auctionsEnabled: true }, s => { s.settings.preAuctionProperties = s.properties.filter(p => p.type === 'property').slice(0, 3).map(p => p.id); s.gamePhase = 'auction'; s.preAuctionPhase = true; }); try {
        await f.pages[0].close();
        const until = Date.now() + 45000;
        let s;
        do {
            s = (await read(f)).gameState;
            if (!s.preAuctionPhase && s.gamePhase === 'playing')
                break;
            await wait(300);
        } while (Date.now() < until);
        assert.equal(s.preAuctionPhase, false, 'Host disconnect stranded draft');
        assert.equal(s.gamePhase, 'playing');
        f.details = { draftFinished: true };
        return f;
    }
    catch (e) {
        e.fixture = f;
        throw e;
    } });
};
