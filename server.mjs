// Servidor de producción mínimo: sirve la carpeta dist/ en el puerto que asigna
// la plataforma (Railway usa la variable PORT). Sin dependencias externas.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'dist')
const port = Number(process.env.PORT) || 4173

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

async function resolveFile(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^([/\\])+/, '')
  const file = join(root, clean)
  if (!file.startsWith(root + sep) && file !== root) return null // evita salir de dist/
  try {
    const s = await stat(file)
    if (s.isFile()) return file
  } catch {
    // no existe: cae al index.html
  }
  return null
}

createServer(async (req, res) => {
  try {
    const file = (await resolveFile(req.url ?? '/')) ?? join(root, 'index.html')
    const body = await readFile(file)
    const ext = extname(file)
    res.writeHead(200, {
      'Content-Type': types[ext] ?? 'application/octet-stream',
      // los archivos con hash se pueden guardar mucho tiempo; el resto se revalida
      'Cache-Control': file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
    })
    res.end(body)
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Error del servidor')
  }
}).listen(port, '0.0.0.0', () => console.log(`Demo disponible en el puerto ${port}`))
