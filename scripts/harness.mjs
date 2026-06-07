#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = dirname(scriptDir);
const candidates = process.platform === 'win32'
  ? [
      join(scriptDir, 'bin', 'harness-cli.exe'),
      join(scriptDir, 'bin', 'harness-cli')
    ]
  : [
      join(scriptDir, 'bin', 'harness-cli'),
      join(scriptDir, 'bin', 'harness-cli.exe')
    ];

const binary = candidates.find((path) => existsSync(path));

if (!binary) {
  console.error('Harness CLI binary not found.');
  console.error('Install or refresh it with one of these commands:');
  console.error('');
  console.error('  # macOS/Linux/Git Bash');
  console.error('  curl -fsSL "https://raw.githubusercontent.com/hoangnb24/repository-harness/main/scripts/install-harness.sh?$(date +%s)" | bash -s -- --merge --yes');
  console.error('');
  console.error('  # Windows PowerShell');
  console.error('  & ([scriptblock]::Create((irm "https://raw.githubusercontent.com/hoangnb24/repository-harness/main/scripts/install-harness.ps1"))) -Merge -Yes');
  process.exit(1);
}

const result = spawnSync(binary, process.argv.slice(2), {
  cwd: rootDir,
  stdio: 'inherit',
  shell: false
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
