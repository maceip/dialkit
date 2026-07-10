#!/usr/bin/env bash
# Remove generated declaration artifacts leaked into src/ by tsup/svelte-package.
find src -type f \( -name '*.d.ts.map' -o -name '*.d.ts' \) \
  ! -path 'src/svelte/shims.d.ts' \
  ! -path 'src/annotation/scss.d.ts' \
  -delete 2>/dev/null || true
