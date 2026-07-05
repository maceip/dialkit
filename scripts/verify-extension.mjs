import { accessSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'extension');

const required = [
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html',
  'popup.js',
  'inject.js',
  'styles.css',
  'icons/icon-16.png',
  'icons/icon-48.png',
  'icons/icon-128.png',
];

for (const file of required) {
  accessSync(join(root, file));
}

const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
if (manifest.manifest_version !== 3) {
  throw new Error('extension manifest must be MV3');
}
if (!manifest.icons?.['128']) {
  throw new Error('extension manifest missing icons');
}
if (!manifest.web_accessible_resources?.some((entry) => entry.resources.includes('inject.js'))) {
  throw new Error('inject.js must be web_accessible');
}

const inject = readFileSync(join(root, 'inject.js'), 'utf8');
if (!inject.includes('__DIALKIT__')) {
  throw new Error('inject.js does not export __DIALKIT__ bootstrap');
}

console.log('Extension package verified.');
