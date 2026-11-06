const fs=require('node:fs'),path=require('node:path'),read=n=>fs.readFileSync(path.join(__dirname,n),'utf8');
const html=read('page.html').replace('/*STYLES*/',read('ui.css')).replace('/*WORKER*/',read('engine.js')+'\n'+read('worker.js')).replace('/*APP*/',read('engine.js')+'\n'+['charts.js','settings.js','network-panel.js','app.js'].map(read).join('\n'));
fs.writeFileSync(path.join(__dirname,'index.html'),html);console.log(`Built ${Buffer.byteLength(html)} byte offline HTML`);
