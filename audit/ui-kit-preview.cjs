// Standalone fixture renderer: imports only the new UI kit, React and inline SVG icons.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToString } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const out = path.join(__dirname, 'ui-kit-preview');
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { module:ts.ModuleKind.CommonJS, jsx:ts.JsxEmit.React, target:ts.ScriptTarget.ES2022, esModuleInterop:true } }).outputText;
  vm.runInNewContext(code, { module, exports:module.exports, console, require(name) {
    if (name.startsWith('.')) {
      const base = path.resolve(path.dirname(file),name);
      const resolved = ['.tsx','.ts','/index.ts'].map(ext=>base+ext).find(fs.existsSync);
      if (!resolved || !resolved.startsWith(path.join(root,'src','ui-kit')+path.sep)) throw new Error(`Outside kit: ${name}`);
      return load(resolved);
    }
    if (!['react','lucide-react'].includes(name)) throw new Error(`External import prohibited: ${name}`);
    return require(name);
  } }, { filename:file });
  return module.exports;
}
fs.mkdirSync(out,{recursive:true});
const { KitPreview, scenes } = load(path.join(root,'src/ui-kit/preview.tsx'));
const css = fs.readFileSync(path.join(root,'src/ui-kit/tokens.css'),'utf8') + '\nhtml,body{margin:0;background:#020617;color:#f1f5f9} .fixture{padding:16px;max-width:1100px;margin:auto;display:grid;gap:16px}.fixture-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.fixture-launch{min-height:44px;border:1px solid #475569;border-radius:10px;background:#1e293b;color:#f1f5f9}.fixture nav{display:flex;flex-wrap:wrap;gap:8px}a{color:#67e8f9} .fixture-link{display:inline-flex;align-items:center;min-height:44px;padding:8px}@media(min-width:640px){.fixture-grid{grid-template-columns:repeat(8,minmax(0,1fr))}}';
const entry = path.join(out,'client-entry.tsx');
fs.writeFileSync(entry,`import React from 'react';import { hydrateRoot } from 'react-dom/client';import { KitPreview } from ${JSON.stringify(path.join(root,'src/ui-kit/preview.tsx').replaceAll('\\','/'))};hydrateRoot(document.getElementById('root')!,<KitPreview scene={document.body.dataset.scene} />);`);
require('esbuild').buildSync({entryPoints:[entry],bundle:true,write:true,outfile:path.join(out,'client.js'),platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},minify:true});
for (const scene of scenes) for (const width of [320,390,1440]) {
  const html = renderToString(React.createElement(KitPreview,{scene}));
  fs.writeFileSync(path.join(out,`${scene}-${width}.html`),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UI kit · ${scene} · ${width}</title><style>${css}</style></head><body data-scene="${scene}"><div id="root">${html}</div><script src="client.js"></script></body></html>`);
}
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UI kit previews</title><style>${css}</style><main class="mma-ui fixture"><h2>UI kit · populated fixtures</h2><p>Set the browser to the width named in the link. Every page hydrates for keyboard/callback checks.</p><nav>${scenes.flatMap(scene=>[320,390,1440].map(width=>`<a class="fixture-link" href="${scene}-${width}.html">${scene} · ${width}px</a>`)).join('')}</nav></main></html>`);
function luminance(hex) { const rgb=hex.replace('#','').match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722; }
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
const { tokens } = load(path.join(root,'src/ui-kit/tokens.ts'));
const { readableTextOn } = load(path.join(root,'src/ui-kit/PlayerIdentity.tsx'));
const pairs=[];
for(const fg of ['text','muted','info','gain','loss','warning','neutral'])for(const bg of ['canvas','surface','raised'])pairs.push({foreground:fg,background:bg,ratio:contrast(tokens.colors[fg],tokens.colors[bg])});
for(const bg of ['info','gain','loss','warning'])pairs.push({foreground:'ink',background:bg,ratio:contrast(tokens.colors.ink,tokens.colors[bg])});
for(const color of ['#06b6d4','#f43f5e','#f59e0b','#10b981','#8b5cf6','#3b82f6','#ec4899','#f97316'])pairs.push({foreground:readableTextOn(color),background:color,ratio:contrast(readableTextOn(color),color)});
const failures=pairs.filter(p=>p.ratio<4.5);
fs.writeFileSync(path.join(out,'contrast.json'),JSON.stringify({minimum:Math.min(...pairs.map(p=>p.ratio)),failures,pairs},null,2));
console.log(`Rendered ${scenes.length*3} populated pages. Contrast: ${pairs.length} pairs, minimum ${Math.min(...pairs.map(p=>p.ratio)).toFixed(2)}:1, ${failures.length} failures.`);
if(failures.length)process.exitCode=1;
if(process.argv.includes('--serve'))require('node:http').createServer((req,res)=>{const filename=path.resolve(out,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!filename.startsWith(out+path.sep)){res.writeHead(403);return res.end();}const target=filename.endsWith(path.sep)?path.join(filename,'index.html'):filename;fs.readFile(target,(err,data)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',target.endsWith('.js')?'text/javascript':target.endsWith('.json')?'application/json':'text/html; charset=utf-8');res.end(data);});}).listen(4174,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:4174/index.html'));
