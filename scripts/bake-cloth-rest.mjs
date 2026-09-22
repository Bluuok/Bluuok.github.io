import {readFile,writeFile} from 'node:fs/promises';import {loadTs} from './load-ts.mjs';
const {ClothSolver}=await loadTs('src/features/cloth/solver.ts'),{clothConfig,paperConfig}=await loadTs('src/features/cloth/config.ts'),{poseKey,solverVersion,validPose}=await loadTs('src/features/cloth/pose.ts');
const file='src/features/cloth/baked-poses.json';let data={};try{data=JSON.parse(await readFile(file,'utf8'));}catch{}
const output={};for(const c of [clothConfig,...Array.from({length:4},(_,n)=>({...paperConfig,wind:paperConfig.wind*(1+n*.08)}))]){const key=poseKey(c);if(validPose(c,data[key])){output[key]=data[key];continue;}const s=new ClothSolver(c);s.settle();output[key]={version:solverVersion,positions:Array.from(s.positions,v=>Math.round(v*1e5)/1e5)};}
const text=JSON.stringify(output);if(JSON.stringify(data)!==text)await writeFile(file,text+'\n');console.log('Validated '+Object.keys(output).length+' baked cloth poses');
