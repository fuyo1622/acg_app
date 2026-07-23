import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const projectRoot = process.cwd();
const failures = [];
const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));

function requireFile(relativePath) {
  const absolutePath = join(projectRoot, relativePath);
  if (!existsSync(absolutePath)) failures.push(`Missing ${relativePath}`);
  return absolutePath;
}

function readPngDimensions(relativePath) {
  const absolutePath = requireFile(relativePath);
  if (!existsSync(absolutePath)) return null;

  const buffer = readFileSync(absolutePath);
  const pngSignature = '89504e470d0a1a0a';
  if (buffer.subarray(0, 8).toString('hex') !== pngSignature) {
    failures.push(`${relativePath} is not a PNG file`);
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

const expectedIcons = new Map([
  ['pwa-192x192.png', 192],
  ['pwa-512x512.png', 512],
  ['pwa-maskable-512x512.png', 512],
  ['apple-touch-icon.png', 180]
]);

for (const [fileName, expectedSize] of expectedIcons) {
  const dimensions = readPngDimensions(join('public', fileName));
  if (dimensions && (dimensions.width !== expectedSize || dimensions.height !== expectedSize)) {
    failures.push(`${fileName} is ${dimensions.width}x${dimensions.height}; expected ${expectedSize}x${expectedSize}`);
  }
}

for (const removedAsset of [
  'public/pwa-192x192.jpg',
  'public/pwa-512x512.jpg',
  'public/icons.svg',
  'web_crawler',
  'test_scrape.mjs'
]) {
  if (existsSync(join(projectRoot, removedAsset))) {
    failures.push(`Removed third-party or non-core asset still exists: ${removedAsset}`);
  }
}

const manifestPath = requireFile('dist/manifest.webmanifest');
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const manifestIcons = new Map((manifest.icons || []).map(icon => [icon.src, icon]));

  for (const [fileName, expectedSize] of [...expectedIcons].filter(([fileName]) => fileName !== 'apple-touch-icon.png')) {
    const icon = manifestIcons.get(fileName);
    if (!icon) {
      failures.push(`Manifest is missing ${fileName}`);
      continue;
    }
    if (icon.type !== 'image/png' || icon.sizes !== `${expectedSize}x${expectedSize}`) {
      failures.push(`Manifest metadata is incorrect for ${fileName}`);
    }
  }

  if (manifestIcons.get('pwa-maskable-512x512.png')?.purpose !== 'maskable') {
    failures.push('Manifest maskable icon purpose is missing or incorrect');
  }
}

const builtIndexPath = requireFile('dist/index.html');
if (existsSync(builtIndexPath)) {
  const builtIndex = readFileSync(builtIndexPath, 'utf8');
  if (!builtIndex.includes('<html lang="zh-TW">')) failures.push('Built index language is not zh-TW');
  if (builtIndex.includes('user-scalable=no')) failures.push('Built viewport disables user zoom');
  if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(builtIndex)) failures.push('Built app still references Google Fonts');
}

const builtAssetsDirectory = requireFile('dist/assets');
if (existsSync(builtAssetsDirectory)) {
  const builtJavaScript = readdirSync(builtAssetsDirectory)
    .filter(fileName => fileName.endsWith('.js'))
    .map(fileName => readFileSync(join(builtAssetsDirectory, fileName), 'utf8'))
    .join('\n');
  if (!builtJavaScript.includes(packageJson.version)) {
    failures.push(`Built app does not contain version ${packageJson.version}`);
  }
  if (!builtJavaScript.includes('/releases/tag/v')) {
    failures.push('Built app does not contain the GitHub release link');
  }
}

const vercelPath = requireFile('vercel.json');
if (existsSync(vercelPath)) {
  const vercelConfig = JSON.parse(readFileSync(vercelPath, 'utf8'));
  if (!vercelConfig.rewrites?.some(rule => rule.destination === '/index.html')) {
    failures.push('Vercel SPA rewrite is missing');
  }
  const globalHeaders = vercelConfig.headers?.find(rule => rule.source === '/(.*)')?.headers || [];
  const headerNames = new Set(globalHeaders.map(header => header.key.toLowerCase()));
  for (const requiredHeader of [
    'content-security-policy',
    'referrer-policy',
    'strict-transport-security',
    'x-content-type-options',
    'permissions-policy'
  ]) {
    if (!headerNames.has(requiredHeader)) failures.push(`Vercel header is missing: ${requiredHeader}`);
  }
}

for (const policyFile of ['PRIVACY.md', 'SECURITY.md', 'THIRD_PARTY_NOTICES.md']) {
  requireFile(policyFile);
}

if (failures.length) {
  console.error('Release asset verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Release assets, manifest, policies, and Vercel configuration verified.');
