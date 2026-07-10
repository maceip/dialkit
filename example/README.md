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

## Annotation smoke test

1. Open `/demo`
2. Click the floating annotation toolbar (bottom-right)
3. Click an element, leave a comment, confirm the marker
4. Reload — markers should still appear (localStorage)
5. Right-click an element for Edit styles / Open dial panel / Move
