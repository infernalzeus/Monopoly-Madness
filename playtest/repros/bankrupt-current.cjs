// One valid mid-game fixture, one real updater. Expected FAIL until current-player handling changes.
const {initialState,makeEngine}=require('../engine.cjs');const {invariant}=require('../invariants.cjs');
const e=makeEngine(13),s=initialState(),template=s.players[0];
s.players=Array.from({length:3},(_,i)=>({...template,id:'player-'+(i+1),name:'P'+i,balance:i?1000000:1,properties:[]}));
s.gamePhase='playing';s.currentPlayer='player-1';s.turnState='waiting_for_action';s.settings.turnTimerDuration=0;
const tile=s.properties[1];tile.owner='P1';tile.isOwned=true;s.players[1].properties=[tile.id];s.pendingRent={propertyId:tile.id,owner:'P1',amount:2};
invariant(s);e.state=s;e.invoke('payRent',[],'player-1');
try{invariant(e.state);console.log('PASS');}catch(error){console.error('FAIL: '+error.message);process.exitCode=1;}
