import type { FlowSample } from './home-flow';
/** Map browser event times into the simulation clock, preserving coalesced spacing.
 * The explicit clock also lets browser probes replay input without runner latency.
 */
export function pointerSamples(event: Pick<PointerEvent, 'clientX'|'clientY'|'timeStamp'> & {getCoalescedEvents?:()=>PointerEvent[]}, origin:{left:number;top:number}, now:number):FlowSample[]{
 const coalesced=event.getCoalescedEvents?.()??[];
 const samples=coalesced.length?coalesced:[event];
 const end=samples[samples.length-1]!.timeStamp;
 return samples.map(s=>({x:s.clientX-origin.left,y:s.clientY-origin.top,t:now-Math.max(0,end-s.timeStamp)}));
}
