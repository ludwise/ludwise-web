import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const baseUrl = 'http://127.0.0.1:4321';
const backendUrl = 'http://127.0.0.1:8788';
const routes = ['/', '/games', '/sales', '/games/canonical-demo'];
const viteCache = 'node_modules/.vite';
const failurePattern =
  /Internal server error|Uncaught exception|Invalid hook call|Unable to render|getRelativeLocaleUrl.+not a function|Class extends value undefined/;

const start = (command, args, options = {}) => {
  const child = spawn(command, args, {
    ...options,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const capture = (chunk) => {
    output += chunk.toString();
  };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  return { child, output: () => output };
};

const waitForReady = async (url, child) => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Process stopped before ${url} was ready.`);
    try {
      const response = await fetch(url);
      if (response.ok) {
        await response.arrayBuffer();
        return;
      }
    } catch {
      // A connection can fail until the process binds the port.
    }
    await delay(250);
  }
  throw new Error(`Timed out while waiting for ${url}.`);
};

const stop = async (child) => {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([once(child, 'exit'), delay(2_000)]);
  if (child.exitCode === null) {
    child.kill('SIGKILL');
    await once(child, 'exit');
  }
};

const requestRoute = async (path) => {
  const response = await fetch(`${baseUrl}${path}`);
  await response.arrayBuffer();
  if (!response.ok) throw new Error(`${path} returned ${String(response.status)}.`);
};

const clearViteCache = () => rmSync(viteCache, { recursive: true, force: true });

const main = async () => {
  clearViteCache();

  const backend = start(
    process.execPath,
    ['--experimental-strip-types', 'scripts/e2e-backend.ts'],
    {
      env: {
        ...process.env,
        LUDWISE_FAKE_BACKEND_MODE: 'populated',
        LUDWISE_FAKE_BACKEND_PORT: '8788',
      },
    },
  );
  const astro = start(
    process.execPath,
    [resolve('node_modules/astro/bin/astro.mjs'), 'dev', '--host', '127.0.0.1', '--port', '4321'],
    {
      env: { ...process.env, ASTRO_DEV_BACKGROUND: '0' },
    },
  );

  try {
    await Promise.all([
      waitForReady(`${backendUrl}/v1/games`, backend.child),
      waitForReady(`${baseUrl}/api/health`, astro.child),
    ]);

    for (let pass = 1; pass <= 2; pass += 1) {
      console.log(`Cold SSR graph pass ${String(pass)}.`);
      await Promise.all(routes.map(requestRoute));
    }

    await delay(100);
    if (failurePattern.test(astro.output())) {
      throw new Error('The dev SSR log contains a module graph failure.');
    }
  } catch (error) {
    console.error('Fake backend log:\n' + backend.output());
    console.error('Astro dev log:\n' + astro.output());
    throw error;
  } finally {
    await Promise.all([stop(astro.child), stop(backend.child)]);
    clearViteCache();
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
