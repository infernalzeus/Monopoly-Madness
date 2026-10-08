const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { externalRequire } = require('./tools.cjs');
const { chromium } = externalRequire('playwright');
const root = path.join(__dirname, 'artifacts/missing-build');
const server = http.createServer((req, res) => { const name = path.join(root, decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0])); if (!name.startsWith(root + path.sep)) {
    res.writeHead(403).end();
    return;
} fs.readFile(name, (err, data) => { if (err) {
    res.writeHead(404).end();
    return;
} res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html'); res.end(data); }); });
server.listen(4188, '127.0.0.1', async () => { let browser; try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const p = await browser.newPage();
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.goto('http://127.0.0.1:4188');
    await p.getByRole('heading', { name: "Monopoly Madness isn't configured" }).waitFor();
    assert.equal(errors.length, 0);
    await p.screenshot({ path: path.join(__dirname, 'artifacts/missing-env.png') });
    console.log('PASS: missing-env build renders configuration screen with zero page errors');
}
catch (e) {
    console.error(e);
    process.exitCode = 1;
}
finally {
    await browser?.close();
    server.close();
} });
