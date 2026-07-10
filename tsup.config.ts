import { defineConfig } from 'tsup';
import { solidPlugin } from 'esbuild-plugin-solid';
import * as sass from 'sass';
import postcss from 'postcss';
import postcssModules from 'postcss-modules';
import * as path from 'path';
import type { Plugin } from 'esbuild';

const externalPackageStorePlugin = {
  name: 'external-package-store',
  setup(build: { onResolve: (options: { filter: RegExp }, callback: () => { path: string; external: boolean }) => void }) {
    build.onResolve({ filter: /^\.\/store\/DialStore$/ }, () => ({
      path: 'dialkit/store',
      external: true,
    }));
  },
};

/** SCSS CSS Modules with SSR-safe style injection (vendored annotation toolbar). */
function scssModulesPlugin(): Plugin {
  return {
    name: 'scss-modules',
    setup(build) {
      build.onLoad({ filter: /\.scss$/ }, async (args) => {
        const isModule = args.path.includes('.module.');
        const parentDir = path.basename(path.dirname(args.path));
        const baseName = path.basename(args.path, isModule ? '.module.scss' : '.scss');
        const styleId = `dialkit-annotation-${parentDir}-${baseName}`;

        const result = sass.compile(args.path);
        let css = result.css;

        if (isModule) {
          let classNames: Record<string, string> = {};
          const postcssResult = await postcss([
            postcssModules({
              getJSON(_cssFileName, json) {
                classNames = json;
              },
              generateScopedName: 'dkann__[local]___[hash:base64:5]',
            }),
          ]).process(css, { from: args.path });

          css = postcssResult.css;

          const contents = `
const css = ${JSON.stringify(css)};
const classNames = ${JSON.stringify(classNames)};
if (typeof document !== 'undefined') {
  let style = document.getElementById(${JSON.stringify(styleId)});
  if (!style) {
    style = document.createElement('style');
    style.id = ${JSON.stringify(styleId)};
    document.head.appendChild(style);
  }
  style.textContent = css;
}
export default classNames;
`;
          return { contents, loader: 'js' };
        }

        const contents = `
const css = ${JSON.stringify(css)};
if (typeof document !== 'undefined') {
  let style = document.getElementById(${JSON.stringify(styleId)});
  if (!style) {
    style = document.createElement('style');
    style.id = ${JSON.stringify(styleId)};
    document.head.appendChild(style);
  }
  style.textContent = css;
}
export default {};
`;
        return { contents, loader: 'js' };
      });
    },
  };
}

export default defineConfig([
  // Store build (shared across all framework entries)
  {
    entry: { index: 'src/store/DialStore.ts' },
    outDir: 'dist/store',
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
  },
  // Shared modules referenced by the packaged Svelte components.
  {
    entry: {
      icons: 'src/icons.ts',
      'dropdown-position': 'src/dropdown-position.ts',
      'panel-drag': 'src/panel-drag.ts',
      'shortcut-utils': 'src/shortcut-utils.ts',
    },
    format: ['esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    esbuildPlugins: [externalPackageStorePlugin],
  },
  // React build
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: {
      resolve: true,
      compilerOptions: {
        skipLibCheck: true,
        noImplicitAny: false,
        strict: false,
      },
    },
    splitting: false,
    sourcemap: true,
    external: ['react', 'react-dom', 'motion'],
    esbuildPlugins: [scssModulesPlugin()],
    define: {
      __VERSION__: JSON.stringify('1.4.0'),
    },
    esbuildOptions(options) {
      options.banner = {
        js: '"use client";',
      };
    },
    onSuccess: 'cp src/styles/theme.css dist/styles.css',
  },
  // Solid build
  {
    entry: { index: 'src/solid/index.ts' },
    outDir: 'dist/solid',
    format: ['esm', 'cjs'],
    dts: {
      compilerOptions: {
        jsx: 'preserve',
        jsxImportSource: 'solid-js',
        skipLibCheck: true,
        noImplicitAny: false,
      },
    },
    splitting: false,
    sourcemap: true,
    external: ['solid-js', 'solid-js/web', 'motion'],
    tsconfig: 'tsconfig.solid.json',
    esbuildPlugins: [solidPlugin()],
    loader: {
      '.css': 'text',
    },
    esbuildOptions(options) {
      // Inject CSS text as a side-effect style tag for the Solid annotation toolbar
      options.plugins = options.plugins ?? [];
    },
    onSuccess: 'cp src/solid/annotation/styles/annotation.css dist/solid/annotation.css && cp src/styles/theme.css dist/styles.css 2>/dev/null || true',
  },
  // Vue build
  {
    entry: { index: 'src/vue/index.ts' },
    outDir: 'dist/vue',
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    external: ['vue', 'motion-v'],
    tsconfig: 'tsconfig.vue.json',
  },
  // Inject / extension bootstrap (stubbed this sprint — see extension/NEXT-SPRINT.md)
  {
    entry: { inject: 'src/inject/extension-bootstrap.tsx' },
    outDir: 'dist/inject',
    format: ['esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    platform: 'browser',
    noExternal: ['react', 'react-dom'],
    esbuildPlugins: [scssModulesPlugin()],
    define: {
      __VERSION__: JSON.stringify('1.4.0'),
    },
    esbuildOptions(options) {
      options.jsx = 'automatic';
    },
  },
]);
