// Runs the actual source updaters with React/Firestore/clock boundaries replaced, never Firebase.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('../node_modules/typescript');
const root = path.resolve(__dirname, '..');
const compiled = new Map();
function makeEngine(seed = 1) {
    let value = seed >>> 0, now = 1800000000000, slots = [], cursor = 0, refs = [], refCursor = 0, timers = [];
    const math = Object.create(Math);
    math.random = () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
    class Clock extends Date {
        constructor(...args) { super(...(args.length ? args : [now])); }
        static now() { return now; }
    }
    function load(file, mocks = {}) { const mod = { exports: {} }; let code = compiled.get(file); if (!code) {
        let source = fs.readFileSync(path.join(root, file), 'utf8');
        if (file === 'src/hooks/useGameLogic.ts')
            source = source.replace('    advanceDraft,', '    advanceDraft,\n    advanceTurnForTest: advanceTurn,\n    resolveAuctionForTest: resolveAuction,');
        code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
        compiled.set(file, code);
    } vm.runInNewContext(code, { module: mod, exports: mod.exports, require: name => { if (name in mocks)
            return mocks[name]; throw Error('Unexpected import ' + name); }, Date: Clock, Math: math, console: { ...console, warn: () => { }, log: () => { } }, setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout: () => { }, setInterval: () => 0, clearInterval: () => { } }, { filename: file }); return mod.exports; }
    const core = load('src/gameEngine/core.ts');
    const react = { useState(initial) { const i = cursor++; if (!(i in slots))
            slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], update => { slots[i] = typeof update === 'function' ? update(slots[i]) : update; }]; }, useCallback: fn => fn, useEffect: () => { }, useRef(initial) { const i = refCursor++; return refs[i] ?? (refs[i] = { current: initial }); } };
    const hook = load('src/hooks/useGameLogic.ts', { react, '../lib/firebase': { db: null }, '../lib/clock': { serverNow: () => now }, 'firebase/firestore': {}, '../gameEngine/core': core });
    return { core, initial: hook.getInitialState, random: math.random, get state() { return slots[0]; }, set state(s) { slots = [s]; refs = []; }, get now() { return now; }, set now(v) { now = v; }, get rng() { return value; }, set rng(v) { value = v; }, tick(ms) { now += ms; }, actions(actor) { cursor = 0; refCursor = 0; return hook.useGameLogic(undefined, actor ?? slots[0]?.currentPlayer); }, flush() { const jobs = timers; timers = []; for (const fn of jobs)
            fn(); }, invoke(name, args = [], actor) { const a = this.actions(actor); if (typeof a[name] !== 'function')
            throw Error('Unknown action ' + name); a[name](...args); this.flush(); return this.state; } };
}
let cachedInitial;
function initialState() { if (!cachedInitial)
    cachedInitial = makeEngine().initial(); return JSON.parse(JSON.stringify(cachedInitial)); }
module.exports = { makeEngine, initialState };
