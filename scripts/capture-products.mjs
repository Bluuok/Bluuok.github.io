// Actual product UI, disposable local fixtures. Never uses a real account/key.
import { mkdtemp, mkdir, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, extname, sep } from 'node:path';
import { createServer } from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const playwrightPath = require.resolve('playwright');
const { chromium } = require(playwrightPath);
const output = resolve('product-evidence');
const temp = await mkdtemp(join(tmpdir(), 'studio-evidence-'));
await mkdir(output, { recursive:true });
const versions = { Clawtide:'e2f091b83df806e7b19e3de69edca0baf0b3a6d8', ThreadCove:'cd9462a9b52dad708b6f3a03edbdef57c2952553' };
const servers = [];
async function download(repo) {
  const dir = join(temp,repo); await mkdir(dir);
  const response = await fetch(`https://codeload.github.com/Bluuok/${repo}/tar.gz/${versions[repo]}`);
  if(!response.ok)throw new Error(`${repo}: HTTP ${response.status}`);
  const file = join(temp,repo+'.tgz'); await writeFile(file,Buffer.from(await response.arrayBuffer()));
  execFileSync('tar',['-xzf',file,'--strip-components=1','-C',dir]);
  await rm(join(dir,'data-dbg-tmp'),{recursive:true,force:true});
  return dir;
}
async function run(command,args,cwd,env={}) {
  await new Promise((ok,fail) => {
    let tail = '';
    const child = spawn(command,args,{cwd,env:{...process.env,ELECTRON_SKIP_BINARY_DOWNLOAD:'1',...env},stdio:['ignore','pipe','pipe']});
    for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{process.stdout.write(data);tail=(tail+data).slice(-6000);});
    child.on('error',fail);child.on('exit',code=>code===0?ok():fail(new Error(`${command}: ${code}\n${tail}`)));
  });
}
async function serve(dir,port) {
  const root = resolve(dir), mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
  const server = createServer(async(request,response)=>{
    try {
      const path=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
      let file=resolve(root,'.'+path);
      if(!file.startsWith(root+sep)&&file!==root){response.writeHead(403);response.end();return;}
      try{if(!(await stat(file)).isFile())file=join(root,'index.html');}catch{file=join(root,'index.html');}
      const bytes=await readFile(file);response.writeHead(200,{'content-type':mime[extname(file)]??'application/octet-stream'});response.end(bytes);
    }catch{response.writeHead(500);response.end();}
  });
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));servers.push(server);
}
try {
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1000,height:600}});
  const left=(await readFile('public/images/hands/paper-hand-upper-left-v1.webp')).toString('base64');
  const right=(await readFile('public/images/hands/paper-hand-lower-right-v1.webp')).toString('base64');
  await page.setContent(`<style>*{box-sizing:border-box}body{margin:0;background:#fafbfc}main{position:relative;width:1000px;height:600px;overflow:hidden;background:radial-gradient(ellipse at 50% 50%,#ebe9f45c,transparent 56%)}img{position:absolute}.l{width:800px;left:-280px;top:-144px}.r{width:770px;left:492px;top:261px}</style><main><img class=l src="data:image/webp;base64,${left}"><img class=r src="data:image/webp;base64,${right}"></main>`);
  await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
  await page.screenshot({path:join(output,'first-spark-cover.jpg'),type:'jpeg',quality:84});await browser.close();

  const claw=await download('Clawtide');
  await run('npm',['ci','--ignore-scripts'],claw);await run('npm',['run','build:web'],claw);
  await serve(join(claw,'web/dist'),5173);
  let script=await readFile(join(claw,'scripts/visual-check.mjs'),'utf8');
  script=script.slice(0,script.indexOf("for (const route of ['chat'"));
  if(!script.includes('routeWebSocket'))throw new Error('Clawtide fixture changed');
  script=script.replace("const { chromium } = await import(pathToFileURL(process.argv[2]).href);","const pm = await import(pathToFileURL(process.argv[2]).href); const { chromium } = pm.default ?? pm;");
  script=script.replace("headless: true, channel: 'msedge'",'headless: true');
  script+=`\nfor(const name of ['chat','tasks']) { const response=await page.goto('http://127.0.0.1:5173/'+name); assert.equal(response.status(),200); await page.locator('nav').first().waitFor(); await page.waitForTimeout(800); assert.match(await page.locator('body').innerText(),/clawtide/i); await page.screenshot({path:output+'/clawtide-'+name+'.jpg',type:'jpeg',quality:84}); }\nassert.equal(errors.length,0,errors.join('\\n'));await browser.close();\n`;
  const cs=join(claw,'scripts/capture-studio.mjs');await writeFile(cs,script);await run('node',[cs,playwrightPath,output],claw);

  const thread=await download('ThreadCove');
  await run('bun',['install','--frozen-lockfile'],thread);await run('bun',['run','--cwd','apps/webui','build'],thread);
  script=await readFile(join(thread,'scripts/verify-ui.cjs'),'utf8');
  script=script.slice(0,script.indexOf('  let holdFileReads = false;'));
  if(!script.includes('startBackend(rpcPort'))throw new Error('ThreadCove fixture changed');
  script=script.replace("require('playwright')",`require(${JSON.stringify(playwrightPath)})`);
  script+=`\npage.on('pageerror',e=>faults.push(e.message));\nawait page.goto('http://127.0.0.1:'+webPort+'/#server='+encodeURIComponent('ws://127.0.0.1:'+rpcPort)+'&token=local-qa-token');\nawait page.getByRole('button',{name:'新建研究任务'}).waitFor();\nawait page.screenshot({path:join(output,'threadcove-empty.jpg'),type:'jpeg',quality:84});\nawait page.getByRole('button',{name:'新建研究任务'}).click();await page.locator('.task.active').waitFor();\nawait send(page,'演示：请整理一次研究任务的步骤。');await idle(page);\nawait page.getByText('完整回答：历史与模型配置均已接入真实应用。',{exact:false}).first().waitFor();\nawait page.screenshot({path:join(output,'threadcove-conversation.jpg'),type:'jpeg',quality:84});\nassert.equal(faults.length,0,faults.join('\\n'));await browser.close();await stopChild(backend);for(const s of servers)await new Promise(r=>s.close(r));\n})().catch(e=>{console.error(e);process.exit(1)});\n`;
  const ts=join(thread,'scripts/capture-studio.cjs');await writeFile(ts,script);await run('node',[ts],thread,{THREADCOVE_QA_OUTPUT:output});
  await writeFile(join(output,'manifest.json'),JSON.stringify({capturedAt:new Date().toISOString(),versions,bun:execFileSync('bun',['--version'],{encoding:'utf8'}).trim(),mode:'Actual product UI, local synthetic test data. ThreadCove reply is a local SSE fixture, not a live model.',poster:'Original paper-hand artwork composed as a static preview.',files:['clawtide-chat.jpg','clawtide-tasks.jpg','threadcove-empty.jpg','threadcove-conversation.jpg','first-spark-cover.jpg']},null,2));
}catch(error){await writeFile(join(output,'capture-error.txt'),String(error));throw error;}
finally{for(const server of servers)await new Promise(resolve=>server.close(resolve));await rm(temp,{recursive:true,force:true});}
