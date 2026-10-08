// Timer-on control, then the 91-second timer-off disconnection repro.
const r=require('node:child_process').spawnSync(process.execPath,[require('node:path').join(__dirname,'../ui-playtest.cjs'),'disconnect'],{stdio:'inherit'});process.exitCode=r.status??1;
