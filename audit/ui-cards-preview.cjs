// Standalone fixture renderer: imports only the new UI kit, React and inline SVG icons.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToString } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const out = path.join(__dirname, 'ui-cards-preview');
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { module:ts.ModuleKind.CommonJS, jsx:ts.JsxEmit.React, target:ts.ScriptTarget.ES2022, esModuleInterop:true } }).outputText;
  vm.runInNewContext(code, { module, exports:module.exports, console: { ...console, error: (...args) => { if (!String(args[0]).includes('useLayoutEffect does nothing on the server')) console.error(...args); } }, require(name) {
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
const { CardsPreview, scenes } = load(path.join(root,'src/ui-kit/cards/preview.tsx'));
const css = fs.readFileSync(path.join(root,'src/ui-kit/tokens.css'),'utf8') + fs.readFileSync(path.join(root,'src/ui-kit/cards/tokens.css'),'utf8') + '\nhtml,body{margin:0;background:#020617;color:#f1f5f9} .cards-fixture{padding:16px;max-width:1100px;margin:auto;display:grid;gap:24px;min-width:0}.cards-fixture h1{font-size:24px;margin:0}.cards-scroll-proof{height:1200px;display:flex;flex-direction:column;justify-content:space-between}.cards-special{display:flex;flex-wrap:wrap;gap:16px}.fixture-link{display:inline-flex;min-height:44px;padding:8px;color:#67e8f9}';
const entry = path.join(out,'client-entry.tsx');
fs.writeFileSync(entry,`import React from 'react';import { hydrateRoot } from 'react-dom/client';import { CardsPreview } from ${JSON.stringify(path.join(root,'src/ui-kit/cards/preview.tsx').replaceAll('\\','/'))};hydrateRoot(document.getElementById('root')!,<CardsPreview scene={document.body.dataset.scene} />);`);
require('esbuild').buildSync({entryPoints:[entry],bundle:true,write:true,outfile:path.join(out,'client.js'),platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"'},minify:true});
for (const scene of scenes) for (const width of [320,390,1440]) {
  const html = renderToString(React.createElement(CardsPreview,{scene}));
  fs.writeFileSync(path.join(out,`${scene}-${width}.html`),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UI kit · ${scene} · ${width}</title><style>${css}</style></head><body data-scene="${scene}"><div id="root">${html}</div><script src="client.js"></script></body></html>`);
}
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UI kit previews</title><style>${css}</style><main class="mma-ui fixture"><h2>UI kit · populated fixtures</h2><p>Set the browser to the width named in the link. Every page hydrates for keyboard/callback checks.</p><nav>${scenes.flatMap(scene=>[320,390,1440].map(width=>`<a class="fixture-link" href="${scene}-${width}.html">${scene} · ${width}px</a>`)).join('')}</nav></main></html>`);
function luminance(hex) { const rgb=hex.replace('#','').match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722; }
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
const { groupColors } = load(path.join(root,'src/ui-kit/cards/CityArt.tsx'));
const { tokens } = load(path.join(root,'src/ui-kit/tokens.ts'));
const { readableTextOn } = load(path.join(root,'src/ui-kit/PlayerIdentity.tsx'));
const pairs=[];
for(const fg of ['text','muted','info','gain','loss','warning','neutral'])for(const bg of ['canvas','surface','raised'])pairs.push({foreground:fg,background:bg,ratio:contrast(tokens.colors[fg],tokens.colors[bg])});
for(const bg of ['info','gain','loss','warning'])pairs.push({foreground:'ink',background:bg,ratio:contrast(tokens.colors.ink,tokens.colors[bg])});
for(const color of ['#06b6d4','#f43f5e','#f59e0b','#10b981','#8b5cf6','#3b82f6','#ec4899','#f97316'])pairs.push({foreground:readableTextOn(color),background:color,ratio:contrast(readableTextOn(color),color)});
for(const color of Object.values(groupColors))pairs.push({foreground:readableTextOn(color),background:color,ratio:contrast(readableTextOn(color),color)});
const failures=pairs.filter(p=>p.ratio<4.5);
fs.writeFileSync(path.join(out,'contrast.json'),JSON.stringify({minimum:Math.min(...pairs.map(p=>p.ratio)),failures,pairs},null,2));
console.log(`Rendered ${scenes.length*3} populated pages. Contrast: ${pairs.length} pairs, minimum ${Math.min(...pairs.map(p=>p.ratio)).toFixed(2)}:1, ${failures.length} failures.`);
if(failures.length)process.exitCode=1;
if(process.argv.includes('--serve'))require('node:http').createServer((req,res)=>{const filename=path.resolve(out,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!filename.startsWith(out+path.sep)){res.writeHead(403);return res.end();}const target=filename.endsWith(path.sep)?path.join(filename,'index.html'):filename;fs.readFile(target,(err,data)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',target.endsWith('.js')?'text/javascript':target.endsWith('.json')?'application/json':'text/html; charset=utf-8');res.end(data);});}).listen(4186,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:4186/index.html'));

if(process.argv.includes('--check'))(async()=>{
 const assert=require('node:assert/strict');
 const toolsRoot=process.env.MONOPOLY_PLAYTEST_TOOLS||path.join(process.env.TEMP,'monopoly-playtest-tools');
 const {chromium}=require(path.join(toolsRoot,'node_modules/playwright'));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage();const results=[];const issues=[];
 try{
 for(const motion of ['no-preference','reduce'])for(const width of [320,390,1440])for(const scene of scenes){
  await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:motion});await page.goto('http://127.0.0.1:4186/'+scene+'-'+width+'.html');await page.waitForTimeout(300);
  const r=await page.evaluate(()=>{const root=document.querySelector('[role=dialog]')||document.body;const small=[],targets=[],contrasts=[],motionFailures=[];const lum=c=>c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
   for(const e of root.querySelectorAll('*')){const b=e.getBoundingClientRect(),st=getComputedStyle(e);if(!b.width||!b.height||e.closest('[aria-hidden=true]')||st.visibility==='hidden'||st.display==='none')continue;const text=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());if(text&&parseFloat(st.fontSize)<(e.closest('.mmc-mini')?9:12))small.push(e.textContent);if(e.matches('button,input,select,a[href]')&&(b.width<43.9||b.height<43.9))targets.push(e.textContent);if(matchMedia('(prefers-reduced-motion:reduce)').matches&&st.animationName!=='none')motionFailures.push(st.animationName);if(text){let bg=st.backgroundColor,p=e.parentElement;while((bg==='transparent'||bg==='rgba(0, 0, 0, 0)')&&p){bg=getComputedStyle(p).backgroundColor;p=p.parentElement;}const a=lum(st.color),b=lum(bg);contrasts.push((Math.max(a,b)+.05)/(Math.min(a,b)+.05));}}
   return {overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,small,targets,motionFailures,minContrast:Math.min(...contrasts),textPairs:contrasts.length,cards:document.querySelectorAll('.mmc-card-trigger').length,nodes:root.querySelectorAll('*').length};});
  results.push({motion,width,scene,...r});if(r.overflow||r.small.length||r.targets.length||r.motionFailures.length||r.minContrast<4.5)issues.push(results.at(-1));
 }
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:844});await page.goto('http://127.0.0.1:4186/portfolio-'+width+'.html');const london=page.getByRole('button',{name:/^London\. brown/});await london.press('ArrowRight');assert.match(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),/^Paris/);await london.press('Enter');await page.getByRole('dialog').waitFor();assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('role')),'dialog');await page.mouse.move(2,800);await page.mouse.wheel(0,500);await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>document.scrollingElement.scrollTop>0));await page.getByRole('button',{name:'Close London inspect',exact:true}).press('Escape');assert.equal(await page.getByRole('dialog').count(),0);assert.match(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),/^London/);
 }
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:4186/chance-back-390.html');await page.getByRole('button',{name:'Reveal card',exact:true}).click();await page.getByRole('button',{name:'Pay',exact:true}).waitFor();assert.equal(await page.getByRole('status').innerText(),'Revealed once');await page.getByRole('button',{name:'Pay',exact:true}).click();assert.equal(await page.getByRole('status').innerText(),'Continue requested');
 for(const [scene,width] of [['inspect-london',390],['inspect-singapore',390],['grid',1440],['community',390]]){await page.setViewportSize({width,height:844});await page.goto('http://127.0.0.1:4186/'+scene+'-'+width+'.html');await page.screenshot({path:path.join(out,scene+'-'+width+'.png')});}
 fs.writeFileSync(path.join(out,'playwright-checks.json'),JSON.stringify({results,issues},null,2));console.log('Browser checks: '+results.length+' pages including real reduced-motion media; '+issues.length+' failures; keyboard, wheel scroll, reveal callback passed.');if(issues.length){console.log(JSON.stringify(issues,null,2));process.exitCode=1;}
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
