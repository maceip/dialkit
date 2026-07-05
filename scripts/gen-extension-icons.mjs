import { mkdirSync, accessSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const iconsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'extension', 'icons');
const assetsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'extension', 'assets');
const exampleIconsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'example', 'public', 'icons');

const variants = [
  { name: 'dark', file: 'icon-dark.png' },
  { name: 'light', file: 'icon-light.png' },
];

const sizes = [16, 48, 128];

mkdirSync(iconsDir, { recursive: true });

for (const variant of variants) {
  const source = join(assetsDir, variant.file);
  accessSync(source);
  for (const size of sizes) {
    const out = join(iconsDir, `icon-${variant.name}-${size}.png`);
    await sharp(source)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(out);
  }
}

// Chrome manifest defaults to the dark set (reads well on light browser chrome).
for (const size of sizes) {
  await sharp(join(assetsDir, 'icon-dark.png'))
    .resize(size, size, { fit: 'cover' })
    .png()
    .toFile(join(iconsDir, `icon-${size}.png`));
}

mkdirSync(exampleIconsDir, { recursive: true });
for (const variant of variants) {
  copyFileSync(
    join(iconsDir, `icon-${variant.name}-128.png`),
    join(exampleIconsDir, `icon-${variant.name}-128.png`),
  );
}

console.log('Wrote extension icons from extension/assets masters.');
