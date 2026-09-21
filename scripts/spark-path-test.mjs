import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile('src/features/first-spark/story.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {sparkPosition,sparkStory}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const focus={x:.5,y:.61},size={width:1440,height:900};
for(let i=65;i<100;i++){
 const home={x:i%2?.17:.83,y:.2+(i%5)*.1};const at=p=>sparkPosition(i,home,focus,size,p);
 const expected=at(.45);for(const progress of [0,.9,.1,1,.58,.45])at(progress);assert.deepEqual(at(.45),expected,'reverse and fast seek must not depend on frame history');
 const end=at(i%7===0?sparkStory.tailEnd:sparkStory.contact);assert.ok(Math.hypot(end.x-focus.x*size.width,end.y-focus.y*size.height)<.001,'energy meets contact');
 for(const progress of [0,.12,.42,.58,.70,.78,.92,1]){const p=at(progress);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.alpha>=0&&p.alpha<=1);}
}
console.log('35 fixed paths: reversible seeks, finite positions, and contact/tail arrival passed.');
