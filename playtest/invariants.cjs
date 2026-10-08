const assert = require('node:assert/strict');
function invariant(state, room, previous) {
    assert.equal(new Set(state.players.map(p => p.id)).size, state.players.length, 'duplicate player ids');
    assert.equal(new Set(state.properties.map(p => p.id)).size, state.properties.length, 'duplicate property ids');
    for (const p of state.players) {
        assert.ok(Number.isFinite(p.balance), 'nonfinite balance');
        if (p.isActive)
            assert.ok(p.balance >= 0, 'active balance below zero');
        assert.equal(new Set(p.properties).size, p.properties.length, 'duplicate portfolio id');
        for (const id of p.properties) {
            const tile = state.properties.find(x => x.id === id);
            assert.ok(tile, 'portfolio references missing property');
            assert.equal(tile.owner, p.name, 'portfolio owner mismatch');
        }
    }
    for (const p of state.properties) {
        if (p.isInactive)
            continue;
        if (p.isOwned) {
            const owner = state.players.find(x => x.name === p.owner);
            assert.ok(owner, 'missing property owner');
            assert.ok(owner.properties.includes(p.id), 'owned property absent from portfolio');
        }
    }
    if (state.gamePhase === 'playing') {
        const current = state.players.filter(p => p.id === state.currentPlayer && p.isActive && !p.isSpectator);
        // Documented contract (arch.md v1.1.17): a player who goes bankrupt on their own turn stays `currentPlayer` in the
        // `completed` grace state until advanceTurn (their client after 2 s, any client after 3.5 s) hands over. The
        // invariant is therefore: current player is active, OR the turn is `completed` and the current player is out.
        const everyone = state.players.find(p => p.id === state.currentPlayer);
        const graceOk = state.turnState === 'completed' && everyone && !everyone.isActive;
        assert.ok(current.length === 1 || graceOk, 'current player is not active (outside the completed grace state)');
    }
    assert.ok(!state.currentAuction || state.currentAuction.isActive, 'non-live auction in live auction slot');
    assert.ok(state.properties.filter(p => p.isInAuction).length <= 1, 'multiple live auction tiles');
    if (state.winnerId || state.winnerTeamId)
        assert.equal(state.gamePhase, 'ended', 'winner without ended game');
    if (room)
        assert.equal(room.status, state.gamePhase === 'setup' ? 'waiting' : state.gamePhase === 'ended' ? 'ended' : 'playing', 'room status differs from phase');
    if (previous) {
        assert.ok(state.turn >= previous.turn, 'turn counter moved backwards');
        if (state.currentPlayer !== previous.currentPlayer && previous.gamePhase === 'playing' && state.gamePhase === 'playing')
            assert.ok(state.turn > previous.turn, 'turn changed without counter increment');
    }
    return true;
}
module.exports = { invariant };
