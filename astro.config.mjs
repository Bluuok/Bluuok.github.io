import { defineConfig } from 'astro/config';
import { execFileSync } from 'node:child_process';
let buildSha='unknown';
try { buildSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()+(execFileSync('git',['diff','--stat'],{encoding:'utf8'}).trim()?'-dirty':''); } catch {}
export default defineConfig({ output:'static', devToolbar:{enabled:false}, vite:{define:{'import.meta.env.PUBLIC_BUILD_SHA':JSON.stringify(buildSha)}} });
