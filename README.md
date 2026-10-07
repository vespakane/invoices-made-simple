# Invoices Made Simple

A simple, fast invoicing and estimates app that runs on iPhone as a Home Screen web app. All data stays on the device.

## Features

- Invoices and estimates with All / Outstanding / Paid and All / Open / Closed filters, scoped search, status badges and swipe actions
- Multiple businesses (with logo) and clients, clients can be added inline while creating a document
- Line items with long multi-line descriptions, bullet and numbered lists, section headings with subtotals, drag to reorder, items library
- Discount (percent or amount), tax with editable label, live totals, autosave
- Clean multi-page PDF with repeated table headers, page numbers, PAID stamp, accent color and Letter/A4 page size
- Preview that matches the PDF, Send through the share sheet to Mail or any email app with the PDF attached and the subject and message prefilled
- Share, Print, Save to Files, and downloads as PDF, Excel (.xlsx) or CSV, plus bulk exports and full JSON backup and restore
- Light and dark mode, Dynamic Type, safe areas, works offline

No build step and no server. The only third-party code is jsPDF and the Open Sans font files in `vendor/`.

## Run locally

```
npm run serve
```

Then open http://127.0.0.1:8090 in a browser. For a phone-like view in Chrome, use the device toolbar and pick an iPhone, or add `?sim=iphone` to the URL to simulate the iPhone safe areas.

## Tests

```
npm test
```

## Screenshots (headless Chrome)

```
node dev/shot.mjs --shot home
node dev/shot.mjs --dark --shot home-dark
```

Screenshots are saved in `dev/shots/`.

## Deploy to GitHub Pages

1. Create a GitHub repository and push this folder to its `main` branch.
2. In the repository, open Settings, then Pages, and set Source to "Deploy from a branch", branch `main`, folder `/ (root)`.
3. After a minute the app is live at `https://<your-user>.github.io/<repo>/`.
4. On the iPhone, open that link in Safari, tap Share, then "Add to Home Screen".

Every later `git push` to `main` updates the app. The installed app refreshes its cached files in the background, so a change shows up on the second launch after it was published. To force every file to refresh on the next launch, change the `VERSION` string at the top of `sw.js` before pushing.
