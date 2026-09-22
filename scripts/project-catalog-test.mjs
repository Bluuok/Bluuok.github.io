import assert from 'node:assert/strict';
import {mkdtemp,cp,symlink,readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {chromium} from 'playwright';import {startStaticPreview} from './static-preview.mjs';
const root=process.cwd(),work=await mkdtemp(join(tmpdir(),'portfolio-catalog-')),run=promisify(execFile),out=resolve('review-output/catalog');await mkdir(out,{recursive:true});
for(const name of ['src','public','package.json','tsconfig.json'])await cp(join(root,name),join(work,name),{recursive:true});
await symlink(join(root,'node_modules'),join(work,'node_modules'),process.platform==='win32'?'junction':'dir');
await writeFile(join(work,'astro.config.mjs'),"import {defineConfig} from 'astro/config';export default defineConfig({output:'static',devToolbar:{enabled:false}});");
const data=join(work,'src/data/small-projects.ts'),core=join(work,'src/data/projects.ts'),flags=join(work,'src/config/features.ts');
const original=await readFile(data,'utf8'),coreOriginal=await readFile(core,'utf8'),flagsOriginal=await readFile(flags,'utf8');
await writeFile(data,original+`\nsmallProjects.push({kind:'small',id:'catalog-fixture-a',title:'Catalog fixture A',summary:'仅用于隔离测试',description:'验证通用卡片展开',tags:['fixture'],status:'测试',date:'2026-09-22',sourceUrl:'https://example.test/source',demoUrl:'https://example.test/demo',cover:{src:'images/cases/first-spark-cover.jpg',alt:'测试封面',width:1000,height:600},media:[{kind:'concept',src:'images/cases/first-spark-cover.jpg',alt:'测试媒体',caption:'测试概念图',commit:'',width:1000,height:600,dataMode:'artwork'}]},{kind:'small',id:'catalog-fixture-b',title:'Catalog fixture B',summary:'无媒体条目',description:'没有演示链接',tags:[],status:'测试',sourceUrl:'https://example.test/source'});`);
const build=()=>run(process.execPath,[join(root,'node_modules/astro/bin/astro.mjs'),'build'],{cwd:work,maxBuffer:4e6});
await build();const server=await startStaticPreview(join(work,'dist')),browser=await chromium.launch({headless:true});const checks=[],errors=[];
const check=(name,ok)=>{checks.push({name,pass:!!ok});assert.ok(ok,name);};
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(server.base+'/');check('only two core cards '+width,await page.locator('.project-card').count()===2);check('small entries never enter footer '+width,await page.locator('footer a[href*="catalog-fixture"]').count()===0);
  await page.goto(server.base+'/playground/');check('generic cards '+width,await page.locator('[data-small-project]').count()===2);
  const card=page.locator('#catalog-fixture-a');await card.locator('summary').click();check('native details opens '+width,await card.locator('details').getAttribute('open')!==null);await card.locator('figure img').evaluate(e=>e.decode());check('media loaded '+width,await card.locator('figure img').evaluate(e=>e.complete&&e.naturalWidth>0));check('source/demo links '+width,await card.locator('.small-project-links a').count()===2);check('no invented optional link '+width,await page.locator('#catalog-fixture-b .small-project-links a').count()===1);check('no overflow '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await card.screenshot({path:join(out,'card-'+width+'.png')});await context.close();
 }
 const nojs=await browser.newContext({javaScriptEnabled:false}),p=await nojs.newPage();await p.goto(server.base+'/playground/');await p.locator('#catalog-fixture-a summary').click();check('no-JS details remains usable',await p.locator('#catalog-fixture-a details').getAttribute('open')!==null);await nojs.close();
 check('small entries create no dedicated route',(await readdir(join(work,'dist/projects'))).sort().join(',')==='clawtide,threadcove');
 await writeFile(core,coreOriginal.replaceAll('featured:true','featured:false'));await build();
 const unfeatured=await browser.newContext({reducedMotion:'reduce'}),up=await unfeatured.newPage();await up.goto(server.base+'/');check('featured flag controls selection',await up.locator('.project-card').count()===0);await up.goto(server.base+'/projects/clawtide/');check('unfeatured case keeps dedicated route',await up.locator('h1').textContent()==='Clawtide');check('unfeatured case returns to valid home',await up.locator('.case-next>a').first().getAttribute('href')==='/');await unfeatured.close();
 // The original working tree is never mutated by these negative fixtures.
 await writeFile(data,original.replace(/export const smallProjects:SmallProject\[\]=\[[\s\S]*$/,'export const smallProjects:SmallProject[]=[];'));
 await writeFile(core,coreOriginal.replace(/export const coreProjects:CoreProject\[\]=\[[\s\S]*?\];/,'export const coreProjects:CoreProject[]=[];'));
 await writeFile(flags,flagsOriginal.replace("sections: ['projects', 'about', 'contact']","sections: []").replace('firstSpark: true','firstSpark: false'));
 await build();const empty=await browser.newContext({reducedMotion:'reduce'}),ep=await empty.newPage();await ep.goto(server.base+'/');check('empty selected section omitted',await ep.locator('#projects').count()===0);check('empty footer has no case links',await ep.locator('footer a[href^="/projects/"]').count()===0);check('empty header has no dead selected link',await ep.locator('header a[href="/#projects"]').count()===0);check('empty hero has usable playground return',await ep.locator('main a[href="/playground/"]').count()>0);await ep.goto(server.base+'/playground/');check('disabled stage omitted',await ep.locator('[data-inline-spark]').count()===0);check('empty gallery keeps home link',await ep.locator('main a[href="/"]').count()===1);await empty.close();
 check('no browser errors',errors.length===0);
}finally{await browser.close();await server.close();await writeFile(join(out,'results.json'),JSON.stringify({checks,errors,isolatedWorkspace:work},null,2));}
console.log(JSON.stringify({checks:checks.length,passed:checks.filter(c=>c.pass).length,errors}));
