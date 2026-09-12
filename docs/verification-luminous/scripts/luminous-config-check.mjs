import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
const root='E:/zzzz/personal-site';
const config=`${root}/src/config/features.ts`;
const original=await fs.readFile(config,'utf8');
if(!original.includes('intro: true')||!original.includes('particles: true')||!original.includes("sections: ['projects', 'about', 'contact']"))throw new Error('Unexpected feature defaults; preserving file.');
const results=[];
const check=(name,pass)=>{results.push({name,pass});if(!pass)console.error('FAIL',name);};
const build=()=>exec(process.execPath,['node_modules/astro/bin/astro.mjs','build'],{cwd:root,env:{...process.env,ASTRO_TELEMETRY_DISABLED:'1'},maxBuffer:1024*1024});
try {
  await fs.writeFile(config,original.replace('intro: true','intro: false').replace("sections: ['projects', 'about', 'contact']",'sections: []'));
  await build();
  let html=await fs.readFile(`${root}/dist/index.html`,'utf8');
  check('empty sections and intro off build successfully',html.includes('<main')&&!html.includes('data-intro')&&!html.includes('<particle-field'));
  const detail=await fs.readFile(`${root}/dist/projects/clawtide/index.html`,'utf8');
  check('project detail without project section returns home',detail.includes('返回首页')&&!detail.includes('href="/#projects"'));
  await fs.writeFile(config,original.replace('particles: true','particles: false'));
  await build();
  html=await fs.readFile(`${root}/dist/index.html`,'utf8');
  check('particles can be disabled while paper hands remain',!html.includes('<particle-field')&&html.includes('hand-art')&&html.includes('data-intro'));
} finally {
  await fs.writeFile(config,original);
  await build();
}
const restored=await fs.readFile(config,'utf8');
const html=await fs.readFile(`${root}/dist/index.html`,'utf8');
check('default source and build are restored',restored===original&&html.includes('<particle-field'));
await fs.mkdir('verification-luminous',{recursive:true});
await fs.writeFile('verification-luminous/config-results.json',JSON.stringify({results},null,2));
console.log(JSON.stringify({passed:results.filter(r=>r.pass).length,total:results.length,failures:results.filter(r=>!r.pass)},null,2));
if(results.some(r=>!r.pass))process.exitCode=1;
