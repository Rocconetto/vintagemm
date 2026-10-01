// Development: rebuilds the app on change and restarts the API server on change.
// Open http://localhost:8787 (reload the page after edits).

import { spawn } from 'node:child_process';

const build = spawn(process.execPath, ['scripts/build.mjs', '--watch'], { stdio: 'inherit' });
const server = spawn(process.execPath, ['--watch-path=server', '--env-file-if-exists=.env', 'server/index.js'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' },
});

const stop = () => {
  build.kill();
  server.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
