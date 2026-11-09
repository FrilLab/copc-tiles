import { spawnSync } from 'node:child_process';
const scripts = [
  'typecheck', 'typecheck:adapter-core', 'build',
  process.env.COPC_TILES_COVERAGE === '1' ? 'test:coverage' : 'test',
  'test:browser', 'test:packed-consumer', 'bench:engine',
];
for (const script of scripts) {
  const r = spawnSync('npm', ['run', script], { stdio: 'inherit' });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status ?? 1);
}
