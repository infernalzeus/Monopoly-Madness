// Creates a real UI room and attempts one normal guest join against the emulators.
const r=require('node:child_process').spawnSync(process.execPath,[require('node:path').join(__dirname,'../ui-probe.cjs')],{stdio:'inherit'});process.exitCode=r.status??1;
