# PWA Icons

StockFlow currently ships with a single SVG app icon at `/app-icon.svg`. For
production PWA submission and better OS integration, generate PNG icons in the
following sizes:

- `icon-72.png` (72x72)
- `icon-96.png` (96x96)
- `icon-128.png` (128x128)
- `icon-192.png` (192x192)
- `icon-512.png` (512x512)
- `apple-touch-icon.png` (180x180)

Once generated, update `public/manifest.json` to reference the PNG files with
`purpose: "any maskable"`.

Example command with `sharp` installed:

```bash
npx sharp public/app-icon.svg --resize 192 public/icons/icon-192.png
npx sharp public/app-icon.svg --resize 512 public/icons/icon-512.png
```
