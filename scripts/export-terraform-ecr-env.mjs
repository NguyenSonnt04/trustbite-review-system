#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

const githubEnvPath = process.env.GITHUB_ENV;
const terraformImage = process.env.TERRAFORM_IMAGE || 'hashicorp/terraform:1.14.5';
const terraformWorkdir = process.env.TF_WORKDIR || 'infra/terraform/envs/dev';

if (!githubEnvPath) {
  throw new Error('GITHUB_ENV is required');
}

const readContract = () => {
  if (process.env.CONTRACT_JSON) {
    return readFileSync(process.env.CONTRACT_JSON, 'utf8');
  }

  const result = spawnSync('docker', [
    'run',
    '--rm',
    '-e',
    'AWS_ACCESS_KEY_ID',
    '-e',
    'AWS_SECRET_ACCESS_KEY',
    '-e',
    'AWS_SESSION_TOKEN',
    '-e',
    `AWS_REGION=${process.env.AWS_REGION || ''}`,
    '-v',
    `${process.cwd()}:/workspace`,
    '-v',
    `${process.env.RUNNER_TEMP || process.cwd()}:/runner-temp`,
    '-w',
    '/workspace',
    terraformImage,
    `-chdir=${terraformWorkdir}`,
    'output',
    '-json',
    'environment_contract',
  ], {
    encoding: 'utf8',
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`terraform output exited with status ${result.status}: ${result.stderr}`);
  }
  return result.stdout;
};

const contract = JSON.parse(readContract());
const apiRepositoryUrl = contract.ecr_ids?.api_repository_url;
const workerRepositoryUrl = contract.ecr_ids?.worker_repository_url;

if (!apiRepositoryUrl || !workerRepositoryUrl) {
  throw new Error('ECR repository URLs are missing from Terraform output');
}

appendFileSync(githubEnvPath, `API_ECR_REPOSITORY_URL=${apiRepositoryUrl}\n`);
appendFileSync(githubEnvPath, `WORKER_ECR_REPOSITORY_URL=${workerRepositoryUrl}\n`);
