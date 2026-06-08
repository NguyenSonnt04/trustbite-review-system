import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const mobileDir = join(process.cwd(), 'mobile');
const platformDirs = ['android', 'ios', 'web', 'windows', 'macos', 'linux'];
const hasPlatformRunner = platformDirs.some((dir) => existsSync(join(mobileDir, dir)));

if (!hasPlatformRunner) {
  console.error(
    [
      'No Flutter platform runner folder found in mobile/.',
      'Run the following before npm run mobile:run:',
      '',
      '  cd mobile',
      '  flutter create .',
    ].join('\n'),
  );
  process.exit(1);
}

const flutterCheck = spawnSync('flutter', ['--version'], {
  cwd: mobileDir,
  shell: true,
  stdio: 'ignore',
});

if (flutterCheck.status !== 0) {
  console.error('Flutter SDK was not found in PATH. Install Flutter before running the mobile app.');
  process.exit(flutterCheck.status ?? 1);
}

const result = spawnSync('flutter', ['run'], {
  cwd: mobileDir,
  shell: true,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
