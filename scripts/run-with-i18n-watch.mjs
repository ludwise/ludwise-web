import { spawn as defaultSpawn, spawnSync as defaultSpawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const defaultPnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const isRunning = (child) => child.exitCode === null && child.signalCode === null;

const waitForExit = (child) =>
  new Promise((resolve) => {
    if (!isRunning(child)) {
      resolve();
      return;
    }

    const onExit = () => resolve();
    child.once('exit', onExit);

    // A child can finish between the first check and listener registration.
    // Do not leave a promise waiting for an event that already happened.
    if (!isRunning(child)) {
      child.removeListener('exit', onExit);
      resolve();
    }
  });

const stopChildren = async (children) => {
  const waits = children.map(waitForExit);
  for (const child of children) {
    if (isRunning(child)) child.kill('SIGTERM');
  }
  await Promise.all(waits);
};

/**
 * Compile messages, watch them, and run one application command.
 *
 * The process adapters keep this lifecycle deterministic in unit tests. The
 * returned number is suitable for assigning to `process.exitCode`.
 */
export async function runWithI18nWatch(target, adapters = {}) {
  if (target.length === 0) return 2;

  const spawnSync = adapters.spawnSync ?? defaultSpawnSync;
  const spawn = adapters.spawn ?? defaultSpawn;
  const processApi = adapters.process ?? process;
  const pnpm = adapters.pnpm ?? defaultPnpm;

  const processOptions = {
    stdio: 'inherit',
    ...(pnpm.endsWith('.cmd') ? { shell: true } : {}),
  };
  const compiled = spawnSync(pnpm, ['run', 'i18n:compile'], processOptions);
  if (compiled.status !== 0) return compiled.status ?? 1;

  const watcher = spawn(pnpm, ['run', 'i18n:compile', '--', '--watch'], processOptions);
  const application = spawn(pnpm, ['exec', ...target], processOptions);
  const children = [watcher, application];

  const result = await new Promise((resolve) => {
    let completed = false;
    const signalHandlers = new Map([
      ['SIGINT', () => complete({ owner: 'signal', code: 130 })],
      ['SIGTERM', () => complete({ owner: 'signal', code: 143 })],
    ]);

    const removeSignalHandlers = () => {
      if (typeof processApi.removeListener !== 'function') return;
      for (const [signal, handler] of signalHandlers) {
        processApi.removeListener(signal, handler);
      }
    };

    const complete = async (outcome) => {
      if (completed) return;
      completed = true;
      await stopChildren(children);
      removeSignalHandlers();
      resolve(outcome);
    };

    watcher.once('exit', (code) => {
      void complete({ owner: 'watcher', code: code ?? 1 });
    });
    application.once('exit', (code) => {
      void complete({ owner: 'application', code: code ?? 1 });
    });
    for (const [signal, handler] of signalHandlers) processApi.once(signal, handler);
  });

  if (result.owner === 'signal') return result.code;
  if (result.owner === 'watcher') {
    console.error('The localization watcher stopped before the application.');
    return result.code || 1;
  }
  return result.code;
}

const isMain = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const target = process.argv.slice(2);
  if (target[0] === '--') target.shift();
  if (target.length === 0) {
    console.error('Expected a command to run with the localization watcher.');
    process.exitCode = 2;
  } else {
    process.exitCode = await runWithI18nWatch(target);
  }
}
