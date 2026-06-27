#!/usr/bin/env node
// Pre-push gate: run typecheck and lint in parallel (independent, CPU-bound),
// print their output sequentially, then run tests only if both passed.
import { spawn } from 'node:child_process';

function run(cmd, args) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { shell: false });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (out += d));
    p.on('close', (code) => resolve({ code: code ?? 1, out }));
  });
}

const [tc, lint] = await Promise.all([
  run('npx', ['tsc', '--noEmit']),
  run('npx', ['eslint', '.']),
]);

process.stdout.write('=== typecheck ===\n' + (tc.out || 'ok\n'));
process.stdout.write('=== lint ===\n' + (lint.out || 'ok\n'));

if (tc.code !== 0 || lint.code !== 0) process.exit(tc.code || lint.code);

const test = await run('npx', ['vitest', 'run']);
process.stdout.write('=== test ===\n' + test.out);
process.exit(test.code);
