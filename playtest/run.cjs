// Full playtest batch; start the emulators and isolated Vite server first.
const fs = require('node:fs'), path = require('node:path'), { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..'), out = path.join(__dirname, 'artifacts');
fs.mkdirSync(out, { recursive: true });
const jobs = [['fuzz', ['playtest/fuzz.cjs', '--seeds=2000']], ...['standard', 'auction', 'teams', 'mortgage', 'trading'].map(n => ['play-' + n, ['playtest/ui-playtest.cjs', 'play-' + n, '--fast-clock']]), ['bot', ['playtest/ui-playtest.cjs', 'bot', '--fast-clock']], ...['features', 'landing', 'ux', 'disconnect', 'reconnect', 'jail-serialization', 'rematch'].map(n => [n, ['playtest/ui-playtest.cjs', n]]), ['join', ['playtest/ui-probe.cjs']], ['concurrent-joins', ['playtest/concurrent-joins.cjs']], ['offline', ['audit/offline-checks.cjs']], ['missing-build', ['node_modules/vite/bin/vite.js', 'build', '--config', 'playtest/vite.config.mjs', '--mode', 'missing', '--outDir', 'playtest/artifacts/missing-build']]];
const results = [], started = Date.now(), children = new Set();
let next = 0;
const workerCount = Math.max(1, Math.min(3, Number(process.argv.find(a => a.startsWith('--workers='))?.split('=')[1] || 1)));
function save(status) { fs.writeFileSync(path.join(out, 'full-run.json'), JSON.stringify({ status, startedAt: new Date(started).toISOString(), finishedAt: new Date().toISOString(), wallSeconds: (Date.now() - started) / 1000, results }, null, 2)); }
process.on('SIGINT', () => { for (const child of children)
    child.kill(); save('ABORTED'); process.exit(130); });
async function run(name, args) { const start = Date.now(), log = fs.createWriteStream(path.join(out, 'run-' + name + '.log')); return new Promise(resolve => { const child = spawn(process.execPath, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }); children.add(child); const timer = setTimeout(() => { child.kill(); }, 12 * 60 * 1000); child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false }); child.on('error', e => log.write(String(e))); child.on('close', (exitCode, signal) => { children.delete(child); clearTimeout(timer); log.end(); const r = { name, command: 'node ' + args.join(' '), exitCode, signal, seconds: (Date.now() - start) / 1000 }; results.push(r); save('RUNNING'); console.log(JSON.stringify(r)); resolve(r); }); }); }
async function worker() { while (next < jobs.length) {
    const [name, args] = jobs[next++];
    if (!['fuzz', 'offline', 'missing-build'].includes(name)) {
        try {
            const response = await fetch('http://127.0.0.1:8180/v1/projects/demo-monopoly-playtest/databases/(default)/documents/games?pageSize=1', { signal: AbortSignal.timeout(5000) });
            if (response.status >= 500)
                throw Error('Emulator HTTP ' + response.status);
        }
        catch (e) {
            const r = { name, exitCode: 1, skipped: true, reason: 'Emulator unavailable: ' + e.message };
            results.push(r);
            save('RUNNING');
            console.log(JSON.stringify(r));
            continue;
        }
    }
    await run(name, args);
} }
(async () => { await Promise.all(Array.from({ length: workerCount }, () => worker())); await run('missing-env', ['playtest/missing-env.cjs']); save(results.some(r => r.exitCode !== 0) ? 'FAIL' : 'PASS'); console.log('Full run wall seconds: ' + (Date.now() - started) / 1000); if (results.some(r => r.exitCode !== 0))
    process.exitCode = 1; })().catch(e => { console.error(e); save('FAIL'); process.exitCode = 1; });
