const r=require('node:child_process').spawnSync(process.execPath,[require('node:path').join(__dirname,'../ui-playtest.cjs'),'build-race'],{stdio:'inherit'});process.exitCode=r.status??1;
