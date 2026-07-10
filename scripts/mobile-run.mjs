import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const mobileDir = join(process.cwd(), 'mobile');
const serverEnvPath = join(process.cwd(), 'server', '.env');
const clientEnvPath = join(process.cwd(), 'client', '.env.local');
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

const serverEnv = existsSync(serverEnvPath)
  ? readEnvFile(serverEnvPath)
  : {};
const clientEnv = existsSync(clientEnvPath)
  ? readEnvFile(clientEnvPath)
  : {};
const mobileConfig = {
  TRUSTBITE_AWS_REGION:
    process.env.TRUSTBITE_AWS_REGION ??
    serverEnv.AWS_REGION ??
    clientEnv.NEXT_PUBLIC_AWS_REGION,
  TRUSTBITE_COGNITO_USER_POOL_ID:
    process.env.TRUSTBITE_COGNITO_USER_POOL_ID ??
    serverEnv.AWS_COGNITO_USER_POOL_ID ??
    clientEnv.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
  TRUSTBITE_COGNITO_CLIENT_ID:
    process.env.TRUSTBITE_COGNITO_CLIENT_ID ??
    serverEnv.AWS_COGNITO_CLIENT_ID ??
    clientEnv.NEXT_PUBLIC_COGNITO_CLIENT_ID,
  TRUSTBITE_API_BASE_URL:
    process.env.TRUSTBITE_API_BASE_URL ?? clientEnv.NEXT_PUBLIC_API_BASE_URL,
};

const dartDefines = Object.entries(mobileConfig)
  .filter(([, value]) => typeof value === 'string' && value.trim() !== '')
  .map(([name, value]) => `--dart-define=${name}=${value.trim()}`);

const missingCognitoConfig = [
  'TRUSTBITE_AWS_REGION',
  'TRUSTBITE_COGNITO_USER_POOL_ID',
  'TRUSTBITE_COGNITO_CLIENT_ID',
].filter((name) => !mobileConfig[name]?.trim());

if (missingCognitoConfig.length > 0) {
  console.warn(
    `Cognito mobile configuration is incomplete: ${missingCognitoConfig.join(', ')}`,
  );
  console.warn(
    [
      'Add AWS_COGNITO_USER_POOL_ID and AWS_COGNITO_CLIENT_ID to server/.env,',
      'or run flutter with matching --dart-define values.',
    ].join(' '),
  );
}

const result = spawnSync('flutter', ['run', ...dartDefines], {
  cwd: mobileDir,
  shell: true,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);

function readEnvFile(path) {
  const values = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (!match) continue;

    const [, name, rawValue] = match;
    let value = rawValue.trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[name] = value;
  }
  return values;
}
