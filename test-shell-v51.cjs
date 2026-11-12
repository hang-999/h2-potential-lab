const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,p),'utf8');
const html=read('page.html'),css=read('ui.css')+read('workbench.css')+read('display.css');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size,'duplicate IDs break shell controls');
for(const id of ['more-nav','mode-controls','share-experiment','share-dialog','share-pending','share-summary','share-error','load-shared','discard-shared','share-url','copy-share','download-share','share-file','chapter-train-link'])assert(ids.includes(id),'missing '+id);
assert(!/\.mode-controls\s*\{[^}]*position\s*:\s*fixed/.test(css),'chapter mode must occupy normal layout flow');
assert(!/margin-right\s*:\s*286px/.test(css),'removed navigation spacer must not return');
for(const media of ['min-width:1200px','min-width:900px','max-width:899px'])assert(css.includes(media));
assert(/<details id="more-nav"/.test(html)&&/<summary>更多<\/summary>/.test(html));
assert(/id="share-url"[^>]*readonly/.test(html));
assert(html.includes('METHODS LAB · v5.2')&&html.includes('INTERACTIVE METHODS / v5.2'));
const scene=read('scene.js');assert(scene.includes('二维投影：拖动旋转视角'));assert(scene.includes("setEdit(false);const observer=new ResizeObserver"));
// Bundle from source without rewriting tracked artifacts. Catches missing imports,
// duplicate lexical declarations and accidental browser imports of Node modules.
const result=require('esbuild').buildSync({entryPoints:[path.join(__dirname,'app.js')],bundle:true,write:false,format:'iife',platform:'browser',target:['chrome110','edge110'],logLevel:'silent'});
assert(result.outputFiles[0].text.includes('mlip-experiment'));
assert(result.outputFiles[0].text.includes('H2Config'));
console.log('Shell contract passed: unique controls, normal-flow mode switch, responsive menu, accessible share surface, browser source bundle.');
