#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const repoRoot = process.cwd();
const sourceRoot = join(repoRoot, 'server', 'src');
const allowedPrefixes = [
  join('server', 'src', 'config') + sep,
  join('server', 'src', 'services') + sep,
];

const awsSdkImportPattern = /from\s+['"]@aws-sdk\/[^'"]+['"]|require\(\s*['"]@aws-sdk\/[^'"]+['"]\s*\)/;
const awsClientInstantiationPattern = /\bnew\s+[A-Za-z0-9_]*Client\s*\(/;

const listJsFiles = (dir) => {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      files.push(...listJsFiles(path));
    } else if (entry.endsWith('.js')) {
      files.push(path);
    }
  }
  return files;
};

const isAllowedBoundary = (relativePath) => allowedPrefixes.some((prefix) => (
  relativePath.startsWith(prefix)
));

const violations = [];
for (const file of listJsFiles(sourceRoot)) {
  const relativePath = relative(repoRoot, file);
  const source = readFileSync(file, 'utf8');
  if (!awsSdkImportPattern.test(source) && !awsClientInstantiationPattern.test(source)) {
    continue;
  }
  if (isAllowedBoundary(relativePath)) {
    continue;
  }
  violations.push(relativePath);
}

if (violations.length > 0) {
  console.error('[tb-aws] AWS SDK provider boundary violations found:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('[tb-aws] AWS SDK provider boundary audit passed.');
