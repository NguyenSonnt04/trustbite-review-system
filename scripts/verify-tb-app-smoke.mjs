#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const rootDir = process.cwd();
const npmCliPath = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const npmCommand = process.platform === 'win32' && existsSync(npmCliPath)
  ? process.execPath
  : 'npm';

const run = (label, args) => {
  console.log(`[tb-app] ${label}`);
  const npmArgs = npmCommand === process.execPath ? [npmCliPath, ...args] : args;
  const result = spawnSync(npmCommand, npmArgs, {
    cwd: rootDir,
    env: process.env,
    shell: false,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`[tb-app] ${label} failed to start: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`[tb-app] ${label} exited with status ${result.status}`);
    process.exit(result.status ?? 1);
  }
};

const readJson = (relativePath) => {
  const fullPath = join(rootDir, relativePath);
  try {
    return JSON.parse(readFileSync(fullPath, 'utf8'));
  } catch (err) {
    console.error(`[tb-app] failed to parse ${relativePath}: ${err.message}`);
    process.exit(1);
  }
};

const requireFile = (relativePath) => {
  if (!existsSync(join(rootDir, relativePath))) {
    console.error(`[tb-app] missing required install artifact: ${relativePath}`);
    process.exit(1);
  }
};

const requireScript = (manifest, scriptName, manifestPath) => {
  if (!manifest.scripts?.[scriptName]) {
    console.error(`[tb-app] ${manifestPath} is missing required script: ${scriptName}`);
    process.exit(1);
  }
};

const rootPackage = readJson('package.json');
const clientPackage = readJson('client/package.json');
const serverPackage = readJson('server/package.json');

for (const scriptName of ['install:all', 'dev', 'client:dev', 'server:dev', 'client:build', 'server:build']) {
  requireScript(rootPackage, scriptName, 'package.json');
}

requireScript(clientPackage, 'dev', 'client/package.json');
requireScript(clientPackage, 'build', 'client/package.json');
requireScript(serverPackage, 'dev', 'server/package.json');
requireScript(serverPackage, 'build', 'server/package.json');

for (const artifact of [
  'package-lock.json',
  'client/package-lock.json',
  'server/package-lock.json',
  'client/node_modules',
  'server/node_modules',
]) {
  requireFile(artifact);
}

console.log('[tb-app] workspace install and dev/build scripts are present');
run('client production build', ['run', 'client:build']);
run('server syntax build', ['run', 'server:build']);
console.log('[tb-app] app smoke verification passed');
