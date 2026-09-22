import assert from 'node:assert/strict';
const {ClothSolver,resolveClothContacts}=await (await import('./load-ts.mjs')).loadTs('src/features/cloth/solver.ts');
for(const [name,bend] of [['cloth',.0008],['paper',.000002]]){
 const cfg={width:4.1,height:2.85,segmentsX:28,segmentsY:22,bendCompliance:bend,wind:0,gravity:-4,damping:1.5};
 const solver=new ClothSolver(cfg),pins=[0,28*3];
 const pinPositions=pins.map(k=>Array.from(solver.positions.slice(k,k+3)));
 for(let i=0;i<240;i++)solver.advance(1/60);
 assert.ok(solver.positions.every(Number.isFinite),name+' settles without NaN');
 const index=(28+1)*18+14,k=index*3,initial=solver.positions.slice();
 solver.beginGrab(solver.positions[k],solver.positions[k+1],solver.positions[k+2]);
 for(let i=0;i<36;i++){solver.moveGrab(initial[k]+i/36*.85,initial[k+1]+i/36*.6,initial[k+2]+i/36*.5);solver.advance(1/60);}
 const displacement=Math.hypot(...[0,1,2].map(a=>solver.positions[k+a]-initial[k+a]));
 assert.ok(displacement>.3,name+' visibly deforms under a grab');
 solver.endGrab();const released=solver.positions.slice();
 for(let i=0;i<15;i++)solver.advance(1/60);
 const afterRelease=Math.hypot(...[0,1,2].map(a=>solver.positions[k+a]-released[k+a]));
 assert.ok(afterRelease>.01,name+' continues moving after release');
 for(let i=0;i<120;i++)solver.advance(i%2?1/30:1/120);
 pins.forEach((k,n)=>assert.ok(Array.from(solver.positions.slice(k,k+3)).every((v,a)=>v===pinPositions[n][a]),name+' fixed supports'));
 assert.ok(solver.positions.every(Number.isFinite),name+' stable under variable frame rate');
 solver.reset();assert.deepEqual(solver.positions,solver.rest);assert.ok(solver.velocity.every(v=>v===0));
 console.log(JSON.stringify({name,displacement,afterRelease,pinsStable:true,finite:true}));
}

const c={width:1.65,height:2.5,segmentsX:16,segmentsY:24,bendCompliance:.000002,wind:0,gravity:-5,damping:2};
const a=new ClothSolver(c),b=new ClothSolver(c);
const surfaces=[{solver:a,x:0,y:0,z:0},{solver:b,x:0,y:0,z:.01}];
for(let i=0;i<5;i++)resolveClothContacts(surfaces,true);
let separated=0;
for(let i=0;i<a.inverseMass.length;i++){if(!a.inverseMass[i])continue;const k=i*3;
 if(Math.hypot(a.positions[k]-b.positions[k],a.positions[k+1]-b.positions[k+1],a.positions[k+2]-b.positions[k+2]-.01)>.04)separated++;}
assert.ok(separated>a.inverseMass.length*.8,'overlapping panels separate at free nodes');
assert.ok(a.positions.every(Number.isFinite)&&b.positions.every(Number.isFinite));
console.log(JSON.stringify({collisionFreeNodesSeparated:separated,totalNodes:a.inverseMass.length}));
