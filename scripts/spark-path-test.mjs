import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile('src/features/first-spark/story.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {sparkPosition,sparkStory}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const focus={x:.5,y:.61},size={width:1440,height:900};
for(let i=0;i<1000;i++){
 const home={x:i%2?.17:.83,y:.2+(i%5)*.1};const at=p=>sparkPosition(i,home,focus,size,p);
 assert.ok(Math.hypot(at(.45).x-at(.3).x,at(.45).y-at(.3).y)>.01,'every group moves');const expected=at(.45);for(const progress of [0,.9,.1,1,.58,.45])at(progress);assert.deepEqual(at(.45),expected,'reverse and fast seek must not depend on frame history');
 const end=at(i%10===0?sparkStory.tailEnd:sparkStory.contact);assert.ok(Math.hypot(end.x-focus.x*size.width,end.y-focus.y*size.height)<=7.001,'energy reaches bounded fingertip core');
 assert.ok(Math.hypot(at(.45).x-focus.x*size.width,at(.45).y-focus.y*size.height)<Math.hypot(at(.2).x-focus.x*size.width,at(.2).y-focus.y*size.height)+2,'continuous convergence towards single focus without outward bifurcation');
 const endpoint=at(1);let lastDistance=Infinity;
 for(let step=0;step<=140;step++){
  const point=at(step/200),distance=Math.hypot(point.x-endpoint.x,point.y-endpoint.y);
  assert.ok(distance<=lastDistance+1e-8,'each path contracts continuously, including its first steps');lastDistance=distance;
 }
 assert.equal(at(.70).alpha,0,'absorbed points never pile up');for(const progress of [0,.12,.42,.58,.70,.78,.92,1]){const p=at(progress);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.alpha>=0&&p.alpha<=1);}
}
console.log('1000 fixed paths: continuous convergence, reversible seeks, finite positions, and contact/tail arrival passed.');
