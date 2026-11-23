import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { Readable } from 'node:stream'
import { fileURLToPath, URL } from 'node:url'

/** Serves /api/<name> from api/<name>.js, like Vercel does in production. */
function apiMiddleware(loadModule, logger) {
  return async (req, res) => {
    const name = new URL(req.url, 'http://localhost').pathname.replace(/^\/+|\/+$/g, '')
    if (!/^[a-z0-9-]+$/.test(name)) {
      res.statusCode = 404
      return res.end()
    }
    try {
      const mod = await loadModule(name)
      const handler = mod[req.method]
      if (typeof handler !== 'function') {
        res.statusCode = 405
        return res.end()
      }
      const hasBody = !['GET', 'HEAD'].includes(req.method)
      const request = new Request(new URL(req.originalUrl, `http://${req.headers.host}`), {
        method: req.method,
        headers: req.headers,
        body: hasBody ? Readable.toWeb(req) : undefined,
        duplex: hasBody ? 'half' : undefined,
      })
      const response = await handler(request)
      res.statusCode = response.status
      response.headers.forEach((value, key) => res.setHeader(key, value))
      res.end(Buffer.from(await response.arrayBuffer()))
    } catch (err) {
      const missing = ['ERR_LOAD_URL', 'ERR_MODULE_NOT_FOUND'].includes(err?.code)
      if (!missing) logger.error(`/api/${name} failed: ${err?.stack ?? err}`)
      if (!res.headersSent) res.statusCode = missing ? 404 : 500
      res.end()
    }
  }
}

/**
 * Local stand-in for Vercel's /api functions.
 *  * `vite` (dev): handlers are loaded through Vite, so edits apply without a restart.
 *  * `vite preview` (production build, used by the end-to-end tests): handlers are loaded
 *    with Node's own import, and every response gets the security headers from vercel.json,
 *    so the tests run under the same Content-Security-Policy as the live site.
 * Handlers use the Web standard shape: `export async function POST(request) { return Response }`.
 */
function apiRoutes() {
  return {
    name: 'local-api-routes',
    configureServer(server) {
      server.middlewares.use('/api', apiMiddleware((name) => server.ssrLoadModule(`/api/${name}.js`), server.config.logger))
    },
    configurePreviewServer(server) {
      const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'))
      const headers = (vercel.headers ?? []).find((rule) => rule.source === '/(.*)')?.headers ?? []
      server.middlewares.use((req, res, next) => {
        for (const { key, value } of headers) res.setHeader(key, value)
        next()
      })
      const load = (name) => import(new URL(`./api/${name}.js`, import.meta.url).href)
      server.middlewares.use('/api', apiMiddleware(load, server.config.logger))
    },
  }
}

export default defineConfig(({ mode }) => {
  // Make server-only variables from .env.local visible to the /api handlers in dev.
  // (Vite only exposes VITE_* to the browser bundle; this does not change that.)
  Object.assign(process.env, { ...loadEnv(mode, process.cwd(), ''), ...process.env })

  return {
    plugins: [react(), tailwindcss(), apiRoutes()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      rolldownOptions: {
        output: {
          // Stable vendor chunks stay cached in browsers across app deploys.
          codeSplitting: {
            groups: [
              { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
              { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            ],
          },
        },
      },
    },
  }
})
