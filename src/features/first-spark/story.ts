/** One reversible score for hands and every visible colored point. */
export const sparkStory={approach:.12,guideEnd:.42,contact:.58,tailEnd:.70,holdEnd:.78,fadeEnd:.92,end:1} as const;
export const sparkParticles={seed:41731,coreRadius:7} as const;
export const smoother=(value:number)=>{const t=Math.max(0,Math.min(1,value));return t*t*t*(t*(t*6-15)+10);};
export function sparkPosition(index:number,home:{x:number;y:number},focus:{x:number;y:number},size:{width:number;height:number},progress:number){
 const lane=index%6,side=home.x<.5?-1:1,tail=index%10===0,highlight=index%23===0;
 const end=tail?sparkStory.tailEnd:sparkStory.contact-(index%5)*.006;
 // Guidance begins at zero for every group; no frozen ambient or delayed visible cohort.
 const q=smoother(progress/end),v=1-q,angle=index*2.3999632297,r=sparkParticles.coreRadius*Math.sqrt(((index*17)%101)/101);
 const sx=home.x*size.width,sy=home.y*size.height,ex=focus.x*size.width+Math.cos(angle)*r,ey=focus.y*size.height+Math.sin(angle)*r;
 const c1x=sx+side*size.width*.08,c1y=sy-size.height*(.06+lane*.025),c2x=ex+side*size.width*(.09+lane*.015),c2y=ey+size.height*(lane-2.5)*.025;
 return {x:v*v*v*sx+3*v*v*q*c1x+3*v*q*q*c2x+q*q*q*ex,y:v*v*v*sy+3*v*v*q*c1y+3*v*q*q*c2y+q*q*q*ey,alpha:(1-smoother((q-.86)/.14))*(highlight?1:.8)};
}
