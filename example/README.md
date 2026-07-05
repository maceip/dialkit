# DialKit example

Interactive demo for the maceip DialKit fork.

## Local

```bash
# from repo root
npm install
npm run build:example
cd example && npm run preview
```

Open http://127.0.0.1:4173 — landing page at `/`, live demo at `/demo`.

## Hosted

After GitHub Pages deploys from `main`:

https://maceip.github.io/dialkit/

## Dev session smoke test

1. Open `/demo`
2. Expand **Agent notes** in the DialKit panel
3. Type a note, click **Tag element**, click the page title, **Save note**
4. Reload — the note should still be listed
