import { accessSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const extensionRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'extension');

describe('extension package', () => {
  it('includes required built assets after build:extension', () => {
    for (const file of [
      'manifest.json',
      'content.js',
      'background.js',
      'popup.js',
      'inject.js',
      'styles.css',
      'icons/icon-128.png',
    ]) {
      expect(() => accessSync(join(extensionRoot, file))).not.toThrow();
    }
  });
});
