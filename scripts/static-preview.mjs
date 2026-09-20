import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
export async function startStaticPreview(){
 const root=resolve('dist');
 const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.json':'application/json'};
 const server=createServer(async(req,res)=>{try{
  let file=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403).end();return;}
  if((await stat(file)).isDirectory())file=resolve(file,'index.html');
  res.setHeader('Content-Type',mime[extname(file)]??'application/octet-stream');res.end(await readFile(file));
 }catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {base:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>server.close(resolve))};
}
