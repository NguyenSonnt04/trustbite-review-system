import { spawnSync } from 'node:child_process';

const npmCommand = process.platform === 'win32'
  ? (process.env.ComSpec || 'cmd.exe')
  : 'npm';
const npmArgs = (args) => (
  process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm', ...args]
    : args
);

const commands = [
  ['npm', npmArgs(['run', 'db:migrate'])],
  ['npm', npmArgs(['run', 'test:unit', '--prefix', 'server', '--', 'tests/unit/storage/avatarStorageService.test.js', 'tests/unit/user/userService.test.js', 'tests/unit/config/awsConfig.test.js'])],
  ['npm', npmArgs(['run', 'test:integration', '--prefix', 'server', '--', 'tests/integration/userProfile.integration.test.js'])],
  ['npm', npmArgs(['run', 'server:build'])],
];

for (const [label, args] of commands) {
  console.log(`[tb-user-avatar-upload] ${label} ${args.slice(process.platform === 'win32' ? 4 : 0).join(' ')}`);
  const result = spawnSync(npmCommand, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('[tb-user-avatar-upload] verification passed');
