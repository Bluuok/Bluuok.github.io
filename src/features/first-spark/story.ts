/** One reversible score for hands and every visible colored point. */
export const sparkStory={approach:.12,guideEnd:.42,contact:.58,tailEnd:.70,holdEnd:.78,fadeEnd:.92,end:1} as const;
export const sparkParticles={seed:41731,coreRadius:7} as const;
export const smoother=(value:number)=>{const t=Math.max(0,Math.min(1,value));return t*t*t*(t*(t*6-15)+10);};
const TABLE_SIZE = 12288;
const CORE_OFFSETS = new Float64Array(TABLE_SIZE * 2);
for (let i = 0; i < TABLE_SIZE; i++) {
  const a = i * 2.3999632297;
  const rad = sparkParticles.coreRadius * Math.sqrt(((i * 17) % 101) / 101);
  CORE_OFFSETS[i * 2] = Math.cos(a) * rad;
  CORE_OFFSETS[i * 2 + 1] = Math.sin(a) * rad;
}

export function sparkPosition(index:number,home:{x:number;y:number},focus:{x:number;y:number},size:{width:number;height:number},progress:number){
 const tail=index%10===0,highlight=index%23===0;
 const end=tail?sparkStory.tailEnd:sparkStory.contact-(index%5)*.006;
 // Seeded speed variation diffuses the rectangular initial boundary without
 // splitting space into lanes or adding an intermediate attraction point.
 const base=smoother(progress/end),variation=(((index*613)%997)/996-.5)*1.6;
 const q=base+base*(1-base)*variation,v=1-q;
 let offX:number,offY:number;
 if(index<TABLE_SIZE){offX=CORE_OFFSETS[index*2]!;offY=CORE_OFFSETS[index*2+1]!;}
 else{const angle=index*2.3999632297,r=sparkParticles.coreRadius*Math.sqrt(((index*17)%101)/101);offX=Math.cos(angle)*r;offY=Math.sin(angle)*r;}
 const sx=home.x*size.width,sy=home.y*size.height,ex=focus.x*size.width+offX,ey=focus.y*size.height+offY;
 const dx=ex-sx,dy=ey-sy;
 const curve=((index%5)-2)*0.02;
 const c1x=sx+dx*0.36-dy*curve,c1y=sy+dy*0.36+dx*curve;
 const c2x=sx+dx*0.72-dy*(curve*0.2),c2y=sy+dy*0.72+dx*(curve*0.2);
 return {x:v*v*v*sx+3*v*v*q*c1x+3*v*q*q*c2x+q*q*q*ex,y:v*v*v*sy+3*v*v*q*c1y+3*v*q*q*c2y+q*q*q*ey,alpha:(1-smoother((q-.86)/.14))*(highlight?1:.8)};
}
