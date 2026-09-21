import type * as Three from 'three';

/** Periodic woven normal map, authored in code. Linear data, not a color image.
 * Each crossing alternates warp/weft height. Mipmaps prevent distant moire. */
export function createWeaveNormal(T: typeof Three): Three.DataTexture {
  const size = 128, data = new Uint8Array(size * size * 4);
  const height = (x: number, y: number) => {
    const px = x * Math.PI / 8, py = y * Math.PI / 8;
    const twill = .09 * Math.sin((x + y) * Math.PI / 4);
    return .42*Math.cos(px)*Math.cos(py) + .07*Math.sin(px*4) + .06*Math.sin(py*4) + twill;
  };
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const dx=(height(x+1,y)-height(x-1,y))*.5, dy=(height(x,y+1)-height(x,y-1))*.5;
    const length=Math.hypot(dx,dy,1), i=(x+y*size)*4;
    data[i]=Math.round((-dx/length*.5+.5)*255);
    data[i+1]=Math.round((-dy/length*.5+.5)*255);
    data[i+2]=Math.round((1/length*.5+.5)*255); data[i+3]=255;
  }
  const texture=new T.DataTexture(data,size,size,T.RGBAFormat);
  texture.wrapS=texture.wrapT=T.RepeatWrapping;
  texture.repeat.set(18,14); texture.generateMipmaps=true;
  texture.minFilter=T.LinearMipmapLinearFilter; texture.magFilter=T.LinearFilter;
  texture.needsUpdate=true;
  return texture;
}

export const clothMaterials = {
 satin:{color:'#F6F7F8',roughness:.34,clearcoat:.72,clearcoatRoughness:.18,sheen:.18,normalStrength:.035},
 card:{color:'#A9C4EA',roughness:.68,clearcoat:.06,clearcoatRoughness:.4,sheen:.12,normalStrength:.045},
} as const;
export function createStageTexture(T:typeof Three,stage:{label:string;en:string;text:string;color:string},index:number,selected=false){
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=1152;const ctx=canvas.getContext('2d')!;
 ctx.fillStyle=stage.color;ctx.fillRect(0,0,768,1152);ctx.fillStyle='#172332';
 if(selected){ctx.strokeStyle='#f7fbff';ctx.lineWidth=12;ctx.strokeRect(26,26,716,1100);ctx.fillRect(64,72,92,8);}
 ctx.font='500 38px sans-serif';ctx.fillText('0'+(index+1)+' / FIELDNOTES',66,170);
 ctx.font='600 114px sans-serif';ctx.fillText(stage.label,64,420);
 ctx.globalAlpha=.45;ctx.fillRect(66,484,636,2);ctx.globalAlpha=1;
 ctx.font='32px sans-serif';ctx.fillText(stage.en,66,550);
 ctx.font='36px sans-serif';const chars=Array.from(stage.text);for(let i=0;i<chars.length;i+=15)ctx.fillText(chars.slice(i,i+15).join(''),66,710+Math.floor(i/15)*60);
 ctx.font='26px sans-serif';ctx.fillText('SELECT / 选择',66,1005);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;return texture;
}
