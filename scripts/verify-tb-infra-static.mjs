#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const rootDir = process.cwd();
const npmCliPath = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const npmCommand = process.platform === 'win32' && existsSync(npmCliPath)
  ? process.execPath
  : 'npm';

const run = (label, command, args, options = {}) => {
  console.log(`[tb-infra] ${label}`);
  const result = spawnSync(command, args, {
    cwd: rootDir,
    env: options.env ?? process.env,
    shell: false,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`[tb-infra] ${label} failed to start: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`[tb-infra] ${label} exited with status ${result.status}`);
    process.exit(result.status ?? 1);
  }
};

const runNpm = (label, args) => {
  const npmArgs = npmCommand === process.execPath ? [npmCliPath, ...args] : args;
  run(label, npmCommand, npmArgs);
};

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

const runGitWhitespaceCheck = () => {
  if (!isGitHubActions) {
    run('git whitespace check (working tree)', 'git', ['diff', '--check']);
    run('git whitespace check (staged)', 'git', ['diff', '--cached', '--check']);
    return;
  }

  const eventName = process.env.GITHUB_EVENT_NAME ?? '';
  const baseRef = process.env.GITHUB_BASE_REF ?? '';

  if ((eventName === 'pull_request' || eventName === 'pull_request_target') && baseRef) {
    run('git fetch PR base for whitespace check', 'git', [
      'fetch',
      '--no-tags',
      'origin',
      `${baseRef}:refs/remotes/origin/${baseRef}`,
    ]);
    const mergeBase = spawnSync('git', ['merge-base', 'HEAD', `origin/${baseRef}`], {
      cwd: rootDir,
      encoding: 'utf8',
      shell: false,
    });

    if (mergeBase.error) {
      console.error(`[tb-infra] git merge-base failed to start: ${mergeBase.error.message}`);
      process.exit(1);
    }

    if (mergeBase.status !== 0) {
      console.error('[tb-infra] git merge-base exited with status ' + mergeBase.status);
      process.exit(mergeBase.status ?? 1);
    }

    run('git whitespace check (PR committed diff)', 'git', [
      'diff',
      '--check',
      `${mergeBase.stdout.trim()}...HEAD`,
    ]);
    return;
  }

  run('git whitespace check (HEAD commit)', 'git', [
    'diff-tree',
    '--check',
    '--no-commit-id',
    '-r',
    'HEAD',
  ]);
};

const runTerraform = (label, args, options = {}) => {
  const dockerEnvArgs = (options.dockerEnv ?? []).flatMap(([name, value]) => ['-e', `${name}=${value}`]);
  const workspaceDir = options.workspaceDir ?? rootDir;
  run(label, 'docker', [
    'run',
    '--rm',
    ...dockerEnvArgs,
    '-v',
    `${workspaceDir}:/workspace`,
    '-w',
    '/workspace',
    'hashicorp/terraform:1.14.5',
    ...args,
  ]);
};

const createStaticTerraformWorkspace = () => {
  const tempRoot = join(tmpdir(), `trustbite-tf-static-${process.pid}`);
  const terraformSource = join(rootDir, 'infra', 'terraform');
  const terraformWorkspace = join(tempRoot, 'terraform');

  cpSync(terraformSource, terraformWorkspace, {
    recursive: true,
    filter: (source) => {
      const normalized = source.replaceAll('\\', '/');
      return !normalized.endsWith('/.terraform') && !normalized.includes('/.terraform/');
    },
  });

  const versionsPath = join(terraformWorkspace, 'envs', 'dev', 'versions.tf');
  const versions = readFileSync(versionsPath, 'utf8');
  const localBackendVersions = versions.replace(/\n\s+backend "s3" \{\}\r?\n/, '\n');

  if (versions === localBackendVersions) {
    console.error('[tb-infra] static Terraform workspace could not remove the S3 backend declaration');
    process.exit(1);
  }

  writeFileSync(versionsPath, localBackendVersions);
  return { tempRoot, terraformWorkspace };
};

const staticPlanEnv = {
  AWS_ACCESS_KEY_ID: 'static-placeholder',
  AWS_SECRET_ACCESS_KEY: 'static-placeholder',
  AWS_EC2_METADATA_DISABLED: 'true',
};

runTerraform('terraform fmt check', [
  '-chdir=infra/terraform',
  'fmt',
  '-check',
  '-recursive',
]);

runTerraform('terraform init without backend', [
  '-chdir=infra/terraform/envs/dev',
  'init',
  '-backend=false',
  '-input=false',
]);

runTerraform('terraform validate', [
  '-chdir=infra/terraform/envs/dev',
  'validate',
]);

const staticTerraform = createStaticTerraformWorkspace();
try {
  runTerraform('terraform static init without live backend', [
    '-chdir=envs/dev',
    'init',
    '-backend=false',
    '-input=false',
  ], {
    workspaceDir: staticTerraform.terraformWorkspace,
  });

  runTerraform('terraform static no-live plan', [
    '-chdir=envs/dev',
    'plan',
    '-refresh=false',
    '-input=false',
    '-no-color',
    '-var-file=low-cost.dev.tfvars.example',
  ], {
    dockerEnv: [
      ['AWS_ACCESS_KEY_ID', staticPlanEnv.AWS_ACCESS_KEY_ID],
      ['AWS_SECRET_ACCESS_KEY', staticPlanEnv.AWS_SECRET_ACCESS_KEY],
      ['AWS_EC2_METADATA_DISABLED', staticPlanEnv.AWS_EC2_METADATA_DISABLED],
    ],
    workspaceDir: staticTerraform.terraformWorkspace,
  });
} finally {
  rmSync(staticTerraform.tempRoot, { recursive: true, force: true });
}

runNpm('server syntax build', ['run', 'server:build']);
run('server Docker image build', 'docker', ['build', '-t', 'trustbite-server:tb-infra-static', 'server']);
runGitWhitespaceCheck();

console.log('[tb-infra] static infrastructure verification passed');
