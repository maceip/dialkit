# DialKit Chrome extension

> **Deferred this sprint.** Inject is a stub so package builds keep working.
> See [NEXT-SPRINT.md](./NEXT-SPRINT.md) for the re-wire plan (DialRoot + annotation toolbar).

## Build

From the repo root:

```bash
npm install
npm run build:extension
```

This copies `dist/inject/inject.js` and `dist/styles.css` into `extension/`.

## Current inject behavior

`__DIALKIT__.mount()` logs that the extension is stubbed and does not mount UI.

Use the in-app path instead:

```tsx
<DialRoot productionEnabled devSession={{ projectKey: 'my-app' }} />
```
