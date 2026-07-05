import { createDialKit, createDialKitController } from './createDialKit';
import type { CreateDialOptions } from './createDialKit';
import type { DialConfig, ResolvedValues } from '../store/DialStore';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'panel';
}

export function createDevDialKit<T extends DialConfig>(
  name: string,
  config: T,
  options?: Omit<CreateDialOptions, 'persist'> & { id?: string; persist?: CreateDialOptions['persist'] }
): import('solid-js').Accessor<ResolvedValues<T>> {
  return createDevDialKitController(name, config, options).values;
}

export function createDevDialKitController<T extends DialConfig>(
  name: string,
  config: T,
  options?: Omit<CreateDialOptions, 'persist'> & { id?: string; persist?: CreateDialOptions['persist'] }
) {
  const stableId = options?.id ?? slugify(name);
  return createDialKitController(name, config, {
    ...options,
    id: stableId,
    persist: options?.persist ?? {
      key: `dialkit:dev:${stableId}`,
      storage: 'localStorage',
      presets: true,
    },
  });
}
