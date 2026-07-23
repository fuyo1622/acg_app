import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const packageJson = readJson('package.json');
const packageLock = readJson('package-lock.json');
const changelog = readFileSync('CHANGELOG.md', 'utf8');
const version = packageJson.version;
const failures = [];

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  failures.push(`package.json version is not stable semantic versioning: ${version}`);
}

if (packageLock.version !== version || packageLock.packages?.['']?.version !== version) {
  failures.push('package-lock.json root version does not match package.json');
}

if (!changelog.includes(`## [${version}] - `)) {
  failures.push(`CHANGELOG.md has no release heading for ${version}`);
}

const gitTag = process.env.GITHUB_REF_TYPE === 'tag'
  ? process.env.GITHUB_REF_NAME
  : null;

if (gitTag && gitTag !== `v${version}`) {
  failures.push(`Git tag ${gitTag} does not match package version v${version}`);
}

if (!gitTag) {
  try {
    const exactTag = execFileSync('git', ['describe', '--tags', '--exact-match'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (exactTag && exactTag !== `v${version}`) {
      failures.push(`Current commit tag ${exactTag} does not match package version v${version}`);
    }
  } catch {
    // Most development commits are intentionally not tagged.
  }
}

if (failures.length) {
  console.error('Version verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Version ${version} is consistent across package metadata and changelog.`);
