import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {loadTs} from './load-ts.mjs';
const {PointerTrail,advanceDust}=await loadTs('src/features/particles/home-flow.ts');
const {ClothSolver,resolveClothContacts}=await loadTs('src/features/cloth/solver.ts');
const {clothConfig}=await loadTs('src/features/cloth/config.ts');
const {poseKey,validPose}=await loadTs('src/features/cloth/pose.ts');
const poses=JSON.parse(await readFile('src/features/cloth/baked-poses.json','utf8'));
const pose=validPose(clothConfig,poses[poseKey(clothConfig)]);assert.ok(pose);
const flat=new ClothSolver(clothConfig),baked=new ClothSolver(clothConfig,pose);
assert.deepEqual(flat.constraints.map(c=>c.rest),baked.constraints.map(c=>c.rest),'baking must preserve material rest lengths');
assert.notEqual(poseKey(clothConfig),poseKey({...clothConfig,wind:0}));assert.equal(validPose(clothConfig,{version:2,positions:[NaN]}),undefined);
const signal=new AbortController();signal.abort();await assert.rejects(flat.prepareRest(signal.signal),{name:'AbortError'});

const {SpatialHash}=await loadTs('src/features/cloth/spatial-hash.ts');
const hash=new SpatialHash(2);hash.add(0,0,0,0);hash.add(1,5,0,0);const candidates=[];for(let id=hash.first(0,0,0);id>=0;id=hash.nextId(id))if(hash.matches(id,0,0,0))candidates.push(id);assert.deepEqual(candidates,[0],'hash bucket collisions are filtered by exact cells');assert.throws(()=>hash.add(2,0,0,0),RangeError);const heads=hash.heads;hash.clear();assert.equal(hash.heads,heads);assert.equal(hash.first(0,0,0),-1);
const firstPositions=baked.positions.slice(),secondPositions=flat.positions.slice();resolveClothContacts([{solver:baked,x:0,y:0,z:0},{solver:flat,x:100,y:0,z:0}],true);assert.deepEqual(baked.positions,firstPositions);assert.deepEqual(flat.positions,secondPositions);
const fallback=new ClothSolver({...clothConfig,segmentsX:8,segmentsY:6});let heartbeats=0;const timer=setInterval(()=>heartbeats++,0);await fallback.prepareRest(new AbortController().signal);clearInterval(timer);assert.ok(heartbeats>=20,'pose fallback yields actual tasks');assert.ok(fallback.velocity.every(v=>v===0));

const trail=new PointerTrail();trail.add({x:0,y:0,t:0});trail.add({x:10,y:5,t:10});assert.equal(trail.consume(10).length,1);assert.equal(trail.consume(11).length,0);trail.add({x:500,y:500,t:20});assert.equal(trail.consume(500).length,0);
const samples=Array.from({length:241},(_,i)=>({x:200+800*i/240,y:400+70*Math.sin(i/240*Math.PI*4),t:i/240*1000}));
const seed=()=>Array.from({length:200},(_,i)=>({x:250+(i%20)*35,y:340+Math.floor(i/20)*14,vx:0,vy:0,depth:.5}));
function replay(hz){const particles=seed(),queue=new PointerTrail();let next=0;for(let frame=1;frame<=hz*2;frame++){const now=frame/hz*1000;while(next<samples.length&&samples[next].t<=now)queue.add(samples[next++]);const segments=queue.consume(now);for(const p of particles)advanceDust(p,1/hz,now/1000,1440,1000,segments);}return particles;}
const reference=replay(120),fps=[30,60,120,144].map(hz=>{const got=replay(hz);const errors=got.map((p,i)=>Math.hypot(p.x-reference[i].x,p.y-reference[i].y));const mean=errors.reduce((a,b)=>a+b)/errors.length;assert.ok(mean<12,'same timestamp path has comparable displacement at '+hz+'Hz: '+mean);return {hz,meanPositionDifference:mean,maxPositionDifference:Math.max(...errors)};});
const particles=seed(),original=seed();let peak=0;for(let f=0;f<1800;f++){const t=f/60,previous={x:200+900*(.5+.5*Math.sin((t-1/60)*2)),y:450+150*Math.sin((t-1/60)*3),t:(t-1/60)*1000},next={x:200+900*(.5+.5*Math.sin(t*2)),y:450+150*Math.sin(t*3),t:t*1000};for(const p of particles){advanceDust(p,1/60,t,1440,1000,[{a:previous,b:next}]);peak=Math.max(peak,Math.hypot(p.vx,p.vy));assert.ok(Number.isFinite(p.x)&&p.x>=-65&&p.x<=1505&&p.y>=-65&&p.y<=1065);}}
const inside=particles.filter(p=>p.x>0&&p.x<1440&&p.y>0&&p.y<1000).length;assert.ok(inside>particles.length*.75,'repeated motion retains visible density');
const report={fps,peak,inside,total:particles.length,meanThirtySecondDisplacement:particles.reduce((s,p,i)=>s+Math.hypot(p.x-original[i].x,p.y-original[i].y),0)/particles.length};await mkdir('review-output/review-5263461859',{recursive:true});await writeFile('review-output/review-5263461859/regression.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
