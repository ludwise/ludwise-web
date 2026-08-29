import { spawn, spawnSync } from 'node:child_process';

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const target = process.argv.slice(2);

if (target[0] === '--') target.shift();
if (target.length === 0) {
  console.error('Expected a command to run with the localization watcher.');
  process.exit(2);
}

const compiled = spawnSync(pnpm, ['run', 'i18n:compile'], { stdio: 'inherit' });
if (compiled.status !== 0) process.exit(compiled.status ?? 1);

const watcher = spawn(pnpm, ['run', 'i18n:compile', '--', '--watch'], { stdio: 'inherit' });
const application = spawn(pnpm, ['exec', ...target], { stdio: 'inherit' });
const children = [watcher, application];
let signalExitCode = null;

const stop = () => {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  }
};

process.once('SIGINT', () => {
  signalExitCode = 130;
  stop();
});
process.once('SIGTERM', () => {
  signalExitCode = 143;
  stop();
});

const result = await Promise.race([
  new Promise((resolve) =>
    application.once('exit', (code) => resolve({ owner: 'application', code: code ?? 1 })),
  ),
  new Promise((resolve) =>
    watcher.once('exit', (code) => resolve({ owner: 'watcher', code: code ?? 1 })),
  ),
]);

stop();
await Promise.all(
  children.map((child) =>
    child.exitCode === null
      ? new Promise((resolve) => child.once('exit', resolve))
      : Promise.resolve(),
  ),
);

if (signalExitCode !== null) {
  process.exitCode = signalExitCode;
} else if (result.owner === 'watcher') {
  console.error('The localization watcher stopped before the application.');
  process.exitCode = result.code || 1;
} else {
  process.exitCode = result.code;
}
