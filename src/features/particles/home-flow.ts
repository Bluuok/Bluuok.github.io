/** Original advected dust: positions integrate flow, never spring back to individual homes. */
export interface FlowParticle{x:number;y:number;vx:number;vy:number;depth:number}
export interface FlowSample{x:number;y:number;t:number}
export interface FlowSegment{a:FlowSample;b:FlowSample}
export const homeFlowConfig={radius:160,halfLife:.42,maxSpeed:260,backgroundSpeed:14,maxSamples:64};
export class PointerTrail{
 readonly diagnostics={received:0,dropped:0,consumed:0};
 private samples:FlowSample[]=[];private previous:FlowSample|null=null;
 add(sample:FlowSample){if(this.previous&&sample.t<this.previous.t)return;this.diagnostics.received++;this.samples.push(sample);if(this.samples.length>homeFlowConfig.maxSamples)this.samples.shift();}
 consume(now:number){const segments:FlowSegment[]=[];for(const sample of this.samples){if(now-sample.t>250){this.diagnostics.dropped++;this.previous=null;continue;}this.diagnostics.consumed++;if(this.previous&&sample.t-this.previous.t<180&&Math.hypot(sample.x-this.previous.x,sample.y-this.previous.y)>.1)segments.push({a:this.previous,b:sample});this.previous=sample;}this.samples.length=0;return segments;}
 clear(){this.samples.length=0;this.previous=null;}
}
export function advanceDust(p:FlowParticle,dt:number,time:number,width:number,height:number,segments:readonly FlowSegment[]){
 for(const {a,b} of segments){const sx=b.x-a.x,sy=b.y-a.y,len=Math.hypot(sx,sy);if(len<.1)continue;
  const along=Math.max(0,Math.min(1,((p.x-a.x)*sx+(p.y-a.y)*sy)/(len*len))),dx=p.x-a.x-along*sx,dy=p.y-a.y-along*sy,d=Math.hypot(dx,dy),fall=Math.max(0,1-d/homeFlowConfig.radius),weight=fall*fall*(3-2*fall);
  p.vx+=(sx*1.1+dx/Math.max(8,d)*len*.65-dy/Math.max(8,d)*len*.12)*weight;
  p.vy+=(sy*1.1+dy/Math.max(8,d)*len*.65+dx/Math.max(8,d)*len*.12)*weight;
 }
 const speed=Math.hypot(p.vx,p.vy);if(speed>homeFlowConfig.maxSpeed){p.vx*=homeFlowConfig.maxSpeed/speed;p.vy*=homeFlowConfig.maxSpeed/speed;}
 const decay=Math.exp(-Math.LN2*dt/homeFlowConfig.halfLife),integral=homeFlowConfig.halfLife/Math.LN2*(1-decay);
 const flowX=homeFlowConfig.backgroundSpeed*(.7+Math.cos(p.y/210+time*.12)*.45),flowY=8*Math.sin(p.x/270+time*.09);
 p.x+=flowX*dt+p.vx*integral;p.y+=flowY*dt+p.vy*integral;p.vx*=decay;p.vy*=decay;
 const margin=65;if(p.x>width+margin)p.x=-margin;if(p.x<-margin)p.x=width+margin;if(p.y>height+margin)p.y=-margin;if(p.y<-margin)p.y=height+margin;
 return Math.max(0,Math.min(1,(Math.min(p.x,width-p.x,p.y,height-p.y)+margin)/margin));
}
