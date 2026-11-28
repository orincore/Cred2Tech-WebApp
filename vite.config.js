import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

// Stamps this release's file list into dist/sw.js (see the markers at the top of public/sw.js). The list is what
// lets an installed app open instantly and keep working on a weak or dropped connection:
//   - core assets: referenced straight from index.html (the first screen). Install fails, and retries, without them.
//   - other /assets JS/CSS/fonts: other pages' chunks, fetched quietly in the background after install.
//   - shell: index.html, offline page, manifest, icons, logos, the app's own fonts (re-cached as one set per release).
// The build id is a hash of every file's content, so sw.js changes on every real release and browsers update it.
function c2tServiceWorker() {
  let outDir
  const SHELL_FILES = [
    'index.html', 'offline.html', 'manifest.json',
    'icons/icon-192.png', 'icons/icon-512.png', 'icons/splash-mark.png', 'icons/splash-wordmark.png',
    'logos/favicon.png', 'logos/black-logo.png', 'logos/white-logo.png',
  ]
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))
  return {
    name: 'c2t-service-worker',
    apply: 'build',
    configResolved(cfg) { outDir = path.resolve(cfg.root, cfg.build.outDir) },
    closeBundle: {
      order: 'post',
      handler() {
        const swPath = path.join(outDir, 'sw.js')
        if (!fs.existsSync(swPath)) return
        const rel = walk(outDir).map((f) => path.relative(outDir, f).split(path.sep).join('/'))
        const digest = (f) => createHash('sha256').update(fs.readFileSync(path.join(outDir, f))).digest('hex')
        const indexHtml = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8')
        const core = new Set([...indexHtml.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]))

        const entries = []
        const parts = []
        for (const f of rel) {
          const url = `/${f}`
          if (f.startsWith('assets/') && /\.(?:js|css|woff2?|ttf|otf)$/i.test(f)) {
            entries.push({ url, kind: 'asset', core: core.has(url) })
            parts.push(url) // content-hashed filename: the name is the revision
          } else if (SHELL_FILES.includes(f) || /^fonts\/.+\.(?:otf|ttf|woff2?)$/i.test(f)) {
            entries.push({ url, kind: 'shell', core: true })
            parts.push(`${url}@${digest(f)}`)
          }
        }
        const missing = SHELL_FILES.filter((f) => !rel.includes(f))
        if (missing.length) throw new Error(`c2t-service-worker: missing from build output: ${missing.join(', ')}`)
        if (!entries.some((e) => e.core && e.kind === 'asset')) throw new Error('c2t-service-worker: found no entry assets in index.html')

        const build = createHash('sha256').update(parts.sort().join('\n')).digest('hex').slice(0, 12)
        let src = fs.readFileSync(swPath, 'utf8')
        if (!src.includes('__C2T_BUILD__') || !src.includes('/*__C2T_PRECACHE__*/ []')) throw new Error('c2t-service-worker: markers missing in public/sw.js')
        src = src.replace('__C2T_BUILD__', build).replace('/*__C2T_PRECACHE__*/ []', JSON.stringify(entries))
        fs.writeFileSync(swPath, src)
        console.log(`c2t-service-worker: build ${build}, ${entries.length} files (${entries.filter((e) => e.core).length} core)`)
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), c2tServiceWorker()],
  server: {
    port: 3003,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        // Keep the browser's Host header when testing a white-label org locally (acme.localhost:3003): the API picks
        // the organisation from it. Off by default so existing local development is unchanged.
        changeOrigin: process.env.VITE_KEEP_HOST !== '1',
      },
    },
  },
})
