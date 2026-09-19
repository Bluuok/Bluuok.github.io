// Capture unmodified product UIs in disposable local workspaces. No real account,
// provider, task or external model is used. Only public screenshots leave this job.
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const playwrightPath = require.resolve('playwright');
const output = resolve('product-evidence');
const temp = await mkdtemp(join(tmpdir(), 'studio-evidence-'));
await mkdir(output, { recursive: true });
const versions = { Clawtide: 'e2f091b83df806e7b19e3de69edca0baf0b3a6d8', ThreadCove: 'cd9462a9b52dad708b6f3a03edbdef57c2952553' };
const children = [];
async function download(repo) {
  const dir = join(temp, repo);
  await mkdir(dir);
  const response = await fetch(`https://codeload.github.com/Bluuok/${repo}/tar.gz/${versions[repo]}`);
  if (!response.ok) throw new Error(`${repo}: download ${response.status}`);
  const file = join(temp, `${repo}.tar.gz`);
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
  execFileSync('tar', ['-xzf', file, '--strip-components=1', '-C', dir]);
  await rm(join(dir, 'data-dbg-tmp'), { recursive: true, force: true });
  return dir;
}
async function run(command, args, cwd, env = {}) {
  await new Promise((ok, fail) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ELECTRON_SKIP_BINARY_DOWNLOAD: '1', ...env }, stdio: 'inherit' });
    child.on('error', fail);
    child.on('exit', code => code === 0 ? ok() : fail(new Error(`${command} exited ${code}`)));
  });
}
try {
  const claw = await download('Clawtide');
  await run('npm', ['ci', '--ignore-scripts'], claw);
  await run('npm', ['run', 'build:web'], claw);
  const vite = spawn('node', [join(claw, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '5173'], { cwd: join(claw, 'web'), stdio: 'inherit' });
  children.push(vite);
  await new Promise(resolve => setTimeout(resolve, 1800));
  let script = await readFile(join(claw, 'scripts/visual-check.mjs'), 'utf8');
  script = script.slice(0, script.indexOf("for (const route of ['chat'"));
  if (!script.includes('routeWebSocket')) throw new Error('Unexpected Clawtide fixture layout');
  script = script.replace("headless: true, channel: 'msedge'", 'headless: true');
  script += `\nfor (const name of ['chat', 'tasks']) {\n  await page.goto('http://127.0.0.1:5173/' + name);\n  await page.waitForTimeout(700);\n  await page.screenshot({ path: output + '/clawtide-' + name + '.jpg', type: 'jpeg', quality: 84 });\n}\nassert.equal(errors.length, 0, errors.join('\\n'));\nawait browser.close();\n`;
  const clawScript = join(claw, 'scripts/capture-studio.mjs');
  await writeFile(clawScript, script);
  await run('node', [clawScript, playwrightPath, output], claw);
  vite.kill();

  const thread = await download('ThreadCove');
  await run('bun', ['install', '--frozen-lockfile'], thread);
  await run('bun', ['run', '--cwd', 'apps/webui', 'build'], thread);
  script = await readFile(join(thread, 'scripts/verify-ui.cjs'), 'utf8');
  script = script.slice(0, script.indexOf('  let holdFileReads = false;'));
  if (!script.includes('startBackend(rpcPort')) throw new Error('Unexpected ThreadCove fixture layout');
  script = script.replace("require('playwright')", `require(${JSON.stringify(playwrightPath)})`);
  script += `\n  page.on('pageerror', error => faults.push(error.message));\n  await page.goto('http://127.0.0.1:' + webPort + '/#server=' + encodeURIComponent('ws://127.0.0.1:' + rpcPort) + '&token=local-qa-token');\n  await page.getByRole('button', { name: '新建研究任务' }).waitFor();\n  await page.screenshot({ path: join(output, 'threadcove-empty.jpg'), type: 'jpeg', quality: 84 });\n  await page.getByRole('button', { name: '新建研究任务' }).click();\n  await page.locator('.task.active').waitFor();\n  await send(page, '演示：请整理一次研究任务的步骤。');\n  await idle(page);\n  await page.getByText('完整回答：历史与模型配置均已接入真实应用。', { exact: false }).first().waitFor();\n  await page.screenshot({ path: join(output, 'threadcove-conversation.jpg'), type: 'jpeg', quality: 84 });\n  assert.equal(faults.length, 0, faults.join('\\n'));\n  await browser.close();\n  await stopChild(backend);\n  for (const s of servers) await new Promise(r => s.close(r));\n})().catch(error => { console.error(error); process.exit(1); });\n`;
  const threadScript = join(thread, 'scripts/capture-studio.cjs');
  await writeFile(threadScript, script);
  await run('node', [threadScript], thread, { THREADCOVE_QA_OUTPUT: output });
  await writeFile(join(output, 'manifest.json'), JSON.stringify({ capturedAt: new Date().toISOString(), versions, mode: 'Actual product UI with local synthetic test data. ThreadCove model output is from a local SSE stub, not a live AI model.', license: 'Product source: MIT; screenshots of owner repositories.', files: ['clawtide-chat.jpg', 'clawtide-tasks.jpg', 'threadcove-empty.jpg', 'threadcove-conversation.jpg'] }, null, 2));
} finally {
  children.forEach(child => child.kill());
  await rm(temp, { recursive: true, force: true });
}
