/** Original bounded integer spatial hash. Exact cells and distances filter hash collisions. */
export class SpatialHash {
 private heads:Int32Array;private next:Int32Array;private cells:Int32Array;
 constructor(readonly capacity:number){this.heads=new Int32Array(capacity*2+1);this.next=new Int32Array(capacity);this.cells=new Int32Array(capacity*3);this.clear();}
 private hash(x:number,y:number,z:number){return ((Math.imul(x,73856093)^Math.imul(y,19349663)^Math.imul(z,83492791))>>>0)%this.heads.length;}
 clear(){this.heads.fill(-1);}
 add(id:number,x:number,y:number,z:number){if(id>=this.capacity)throw new RangeError('Spatial hash capacity');const k=id*3;this.cells[k]=x;this.cells[k+1]=y;this.cells[k+2]=z;const h=this.hash(x,y,z);this.next[id]=this.heads[h];this.heads[h]=id;}
 first(x:number,y:number,z:number){return this.heads[this.hash(x,y,z)];}
 nextId(id:number){return this.next[id];}
 matches(id:number,x:number,y:number,z:number){const k=id*3;return this.cells[k]===x&&this.cells[k+1]===y&&this.cells[k+2]===z;}
}
