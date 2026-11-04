import { spawnSync } from 'node:child_process';

// Modo production conserva la eliminación de herramientas de desarrollo.
const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, VITE_WEB_SAME_ORIGIN: 'true', VITE_DEV_TOOLS: 'false' },
});
process.exit(result.status ?? 1);
