const r=require('node:child_process').spawnSync(process.execPath,[require('node:path').join(__dirname,'../ui-playtest.cjs'),'rematch'],{stdio:'inherit'});process.exitCode=r.status??1;
