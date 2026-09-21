/** The hands and narrative particles share these scroll landmarks. */
export const sparkStory={approach:.12,guideEnd:.42,contact:.58,tailEnd:.70,holdEnd:.78,fadeEnd:.92,end:1} as const;
export const sparkParticles={ambientRatio:.65,gatherRatio:.30,seed:41731,coreRadius:7} as const;
export const smoother=(value:number)=>{const t=Math.max(0,Math.min(1,value));return t*t*t*(t*(t*6-15)+10);};
export function sparkPosition(index:number,home:{x:number;y:number},focus:{x:number;y:number},size:{width:number;height:number},progress:number){
 const lane=index%6,side=home.x<.5?-1:1,tail=index%7===0;
 const start=sparkStory.approach+(lane/5)*.15,end=tail?sparkStory.tailEnd:sparkStory.contact;
 const q=smoother((progress-start)/(end-start)),v=1-q;
 const sx=home.x*size.width,sy=home.y*size.height,ex=focus.x*size.width,ey=focus.y*size.height;
 const c1x=sx+side*size.width*.08,c1y=sy-size.height*(.06+lane*.025);
 const c2x=ex+side*size.width*(.09+lane*.015),c2y=ey+size.height*(lane-2.5)*.025;
 return {x:v*v*v*sx+3*v*v*q*c1x+3*v*q*q*c2x+q*q*q*ex,y:v*v*v*sy+3*v*v*q*c1y+3*v*q*q*c2y+q*q*q*ey,alpha:1-smoother((q-.92)/.08)*.94};
}
