// Real UI room creation; only test auction duration/draft queue are configured through Admin.
module.exports = async function botFixture({ page, db }, draft) { const p = await page(390); await p.locator('#createPlayerName').fill('Bot Playtest'); await p.getByRole('button', { name: 'Configure & Create Lobby', exact: true }).click(); await p.getByRole('button', { name: '1 (vs Bot)', exact: true }).click(); await p.getByRole('button', { name: 'Off', exact: true }).click(); await p.getByRole('button', { name: 'Create & Start Lobby', exact: true }).click(); await p.getByRole('button', { name: /roll dice/i }).first().waitFor({ timeout: 15000 }); const rooms = await db.collection('games').where('hostUid', '==', p.uid).get(); if (rooms.size !== 1)
    throw Error('Expected exactly one newly created bot room'); const ref = rooms.docs[0].ref; let s = rooms.docs[0].data().gameState; s.settings.auctionsEnabled = true; s.settings.auctionDuration = 2; if (draft) {
    s.settings.preAuctionProperties = s.properties.filter(p => p.type === 'property').slice(0, 3).map(p => p.id);
    s.preAuctionPhase = true;
    s.gamePhase = 'auction';
} await ref.update({ gameState: JSON.parse(JSON.stringify(s)) }); return { pages: [p], ref, id: ref.id }; };
