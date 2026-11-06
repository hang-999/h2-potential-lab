const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const server=http.createServer((req,res)=>{const file=path.join(__dirname,'index.html');res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});fs.createReadStream(file).pipe(res);});
server.listen(4184,'127.0.0.1',()=>console.log('MLIP Lab: http://127.0.0.1:4184'));
