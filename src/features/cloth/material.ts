import type * as Three from 'three';

/** Periodic woven normal map, authored in code. Linear data, not a color image.
 * Each crossing alternates warp/weft height. Mipmaps prevent distant moire. */
export function createWeaveNormal(T: typeof Three): Three.DataTexture {
  const size = 128, data = new Uint8Array(size * size * 4);
  const height = (x: number, y: number) => {
    const px = x * Math.PI / 8, py = y * Math.PI / 8;
    return .45*Math.cos(px)*Math.cos(py) + .08*Math.sin(px*4) + .06*Math.sin(py*4);
  };
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const dx=(height(x+1,y)-height(x-1,y))*.45, dy=(height(x,y+1)-height(x,y-1))*.45;
    const length=Math.hypot(dx,dy,1), i=(x+y*size)*4;
    data[i]=Math.round((-dx/length*.5+.5)*255);
    data[i+1]=Math.round((-dy/length*.5+.5)*255);
    data[i+2]=Math.round((1/length*.5+.5)*255); data[i+3]=255;
  }
  const texture=new T.DataTexture(data,size,size,T.RGBAFormat);
  texture.wrapS=texture.wrapT=T.RepeatWrapping;
  texture.repeat.set(16,12); texture.generateMipmaps=true;
  texture.minFilter=T.LinearMipmapLinearFilter; texture.magFilter=T.LinearFilter;
  texture.needsUpdate=true;
  return texture;
}
