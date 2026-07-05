# DialKit Chrome extension

Dev session on any webpage: right-click elements to leave agent notes, edit CSS, and export markdown.

## Build

From the repo root:

```bash
npm install
npm run build:extension
npm run verify:extension
```

This copies `dist/inject/inject.js` and `dist/styles.css` into `extension/`. Both files are required before loading the extension.

## Install (unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this `extension/` folder

## Use

1. Click the DialKit toolbar icon
2. Check **Enable on all pages**
3. Set a **Project key** (groups notes in localStorage per project)
4. On any page, right-click an element → **Leave note** or **Edit styles**
5. Open the DialKit panel → **Agent notes** to review saved notes

Toggle off removes the UI and listeners on the current tab without a full page refresh.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Extension loads but nothing appears | Run `npm run build:extension` first |
| Toggle does nothing | Refresh the tab once after first install |
| Notes missing after reload | Check the project key matches across sessions |
| Panel hidden on production sites | Expected — extension passes `productionEnabled` automatically |

## Architecture

```
popup.js ──storage.sync──► content.js ──inject.js──► __DIALKIT__.mount()
                              │
                              └──► background.js (tab screenshots)
```

- **content.js** — isolated world bridge; injects page script once per tab
- **inject.js** — page-world bundle with full `DialRoot` + dev session
- **background.js** — `captureVisibleTab` for note screenshots
