import { EventEmitter } from 'node:events';

import { describe, expect, it } from 'vitest';

import { runWithI18nWatch } from '../../../scripts/run-with-i18n-watch.mjs';

class ControlledChild extends EventEmitter {
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  readonly kills: NodeJS.Signals[] = [];

  finish(code: number | null): void {
    this.exitCode = code;
    this.emit('exit', code, null);
  }

  kill(signal: NodeJS.Signals): boolean {
    this.kills.push(signal);
    this.signalCode = signal;
    this.emit('exit', null, signal);
    return true;
  }
}

const setup = () => {
  const events = new EventEmitter();
  const calls: { command: string; args: string[] }[] = [];
  const children: ControlledChild[] = [];

  const spawnSync = (command: string, args: string[]) => {
    calls.push({ command, args });
    return { status: 0 };
  };
  const spawn = (command: string, args: string[]) => {
    calls.push({ command, args });
    const child = new ControlledChild();
    children.push(child);
    return child;
  };

  return { events, calls, children, spawnSync, spawn };
};

describe('runWithI18nWatch', () => {
  it('fails before starting children when the initial compile fails', async () => {
    const setupState = setup();
    const result = await runWithI18nWatch(['astro', 'dev'], {
      pnpm: 'pnpm-test',
      process: setupState.events,
      spawnSync: () => ({ status: 9 }),
      spawn: setupState.spawn,
    });

    expect(result).toBe(9);
    expect(setupState.calls).toEqual([]);
    expect(setupState.children).toEqual([]);
  });

  it('starts the watcher with --watch before the application', async () => {
    const setupState = setup();
    const running = runWithI18nWatch(['astro', 'dev'], {
      pnpm: 'pnpm-test',
      process: setupState.events,
      spawnSync: setupState.spawnSync,
      spawn: setupState.spawn,
    });

    expect(setupState.calls).toEqual([
      { command: 'pnpm-test', args: ['run', 'i18n:compile'] },
      { command: 'pnpm-test', args: ['run', 'i18n:compile', '--', '--watch'] },
      { command: 'pnpm-test', args: ['exec', 'astro', 'dev'] },
    ]);

    setupState.children[1]!.finish(0);
    await expect(running).resolves.toBe(0);
    expect(setupState.children[0]!.kills).toEqual(['SIGTERM']);
  });

  it('fails when the watcher exits before the application', async () => {
    const setupState = setup();
    const running = runWithI18nWatch(['vitest'], {
      pnpm: 'pnpm-test',
      process: setupState.events,
      spawnSync: setupState.spawnSync,
      spawn: setupState.spawn,
    });

    setupState.children[0]!.finish(0);
    await expect(running).resolves.toBe(1);
    expect(setupState.children[1]!.kills).toEqual(['SIGTERM']);
  });

  it.each([
    ['SIGINT', 130],
    ['SIGTERM', 143],
  ] as const)('cleans up both children for %s', async (signal, expected) => {
    const setupState = setup();
    const running = runWithI18nWatch(['astro', 'dev'], {
      pnpm: 'pnpm-test',
      process: setupState.events,
      spawnSync: setupState.spawnSync,
      spawn: setupState.spawn,
    });

    setupState.events.emit(signal);
    await expect(running).resolves.toBe(expected);
    expect(setupState.children[0]!.kills).toEqual(['SIGTERM']);
    expect(setupState.children[1]!.kills).toEqual(['SIGTERM']);
  });
});
