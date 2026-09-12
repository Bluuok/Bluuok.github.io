import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('C:/Users/ertstyuqk/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
import fs from 'node:fs/promises';
import path from 'node:path';

// Deterministic cutout extraction from the ImageGen chroma-key assets.
// No repainting of the hands: only background alpha and edge decontamination.
const sourceDir = 'C:/Users/ertstyuqk/.codex/generated_images/01a09408-f51d-7031-9e8f-81c20574a230';
const out = path.resolve('paper-assets');
await fs.mkdir(out, { recursive: true });
const sources = [
  ['paper-hand-upper-left-v1', 'exec-9b81b605-e460-4bc2-89cb-6b1021f0be20.png'],
  ['paper-hand-lower-right-v1', 'exec-40ccbb61-542e-48be-8bfe-430bf2254fe4.png'],
];
for (const [name, source] of sources) {
  const { data, info } = await sharp(path.join(sourceDir, source)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);
  let transparent = 0, opaque = 0;
  for (let p = 0; p < info.width * info.height; p++) {
    const r = data[p*3], g = data[p*3+1], b = data[p*3+2];
    const dominance = Math.max(0, g - Math.max(r,b));
    let a = dominance < 12 ? 1 : Math.max(0, 1-dominance/235);
    if (a < .075) a = 0;
    rgba[p*4] = a ? Math.min(255, Math.round(r/a)) : 0;
    rgba[p*4+1] = a ? Math.min(255, Math.max(0, Math.round((g-(1-a)*235)/a))) : 0;
    rgba[p*4+2] = a ? Math.min(255, Math.round(b/a)) : 0;
    rgba[p*4+3] = Math.round(a*255);
    if (!a) transparent++; else if(a===1) opaque++;
  }
  const png = await sharp(rgba,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
  await fs.writeFile(path.join(out, `${name}.png`),png);
  await sharp(png).webp({quality:92,alphaQuality:100,effort:6}).toFile(path.join(out,`${name}.webp`));
  // QA backgrounds reveal any residual green edge or rectangular background.
  await sharp(png).flatten({background:'#fafbfc'}).resize(960).png().toFile(path.join(out,`${name}-qa.png`));
  let anchor = name.includes('upper') ? { x:0,y:0 } : { x:info.width,y:0 };
  const yRange = name.includes('upper') ? [760,900] : [50,170];
  for(let y=yRange[0];y<yRange[1];y++)for(let x=0;x<info.width;x++) {
    if(rgba[(y*info.width+x)*4+3] > 220 && (name.includes('upper') ? x>anchor.x : x<anchor.x)) anchor={x,y};
  }
  console.log({name,width:info.width,height:info.height,transparent,opaque,anchor});
}
