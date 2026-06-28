import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { renderToString } from 'react-dom/server'
import { LandingApp } from '../src/features/marketing/PrerenderApp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '../dist')
const indexPath = path.join(distDir, 'index.html')
const template = fs.readFileSync(indexPath, 'utf8')

const routes = [
  '/',
  '/pricing',
  '/features/inventory',
  '/features/pos-cashier',
  '/features/invoicing',
  '/features/offline',
  '/features/analytics',
]

const demoScript = `<script type="module">
  const open = document.getElementById('demo-open');
  const close = document.getElementById('demo-close');
  const dialog = document.getElementById('demo-dialog');
  if (open && dialog) open.addEventListener('click', () => dialog.showModal());
  if (close && dialog) close.addEventListener('click', () => dialog.close());
</script>
`

for (const route of routes) {
  const markup = renderToString(<LandingApp initialPath={route} />)

  const page = template
    .replace(new RegExp('<script type="module"[^>]*><\\/script>', 'g'), '')
    .replace(new RegExp('<div id="root"><\\/div>'), `<div id="root">${markup}</div>`)
    .replace(new RegExp('<\\/body>'), `${demoScript}</body>`)

  const outPath =
    route === '/'
      ? indexPath
      : path.join(distDir, `${route}.html`)

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, page)
}

console.log(`Prerendered ${routes.length.toString()} marketing pages into ${distDir}`)
