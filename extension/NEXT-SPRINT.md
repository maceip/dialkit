# Extension — next sprint

This sprint cut Chrome extension feature work while vendoring the in-app annotation toolbar.

## Current state

- `src/inject/extension-bootstrap.tsx` is a **stub** so `npm run build` / `build:extension` still produce `extension/inject.js`.
- Calling `__DIALKIT__.mount()` logs a console info message and does **not** mount DialRoot or the annotation toolbar.

## Next sprint goals

1. Re-wire inject to mount React `DialRoot` with `devSession` (annotation toolbar + slim CSS/dial/move host).
2. Keep extension screenshot provider for optional captures.
3. Verify popup toggle enable/disable + project key against new `dialkit:annotations:v1:*` storage.
4. E2E or manual checklist for unpacked load on a sample page.

## In-app path (works now)

```tsx
<DialRoot productionEnabled devSession={{ projectKey: 'my-app' }} />
```
