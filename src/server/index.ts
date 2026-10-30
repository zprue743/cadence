import { existsSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { openDatabase } from './db'
import { runMigrations } from './migrate'
import { aiRoutes } from './routes/ai'
import { roadmapRoutes } from './routes/roadmaps'
import { seedIfEmpty } from './seed'

const { db, sqlite } = openDatabase()
runMigrations(db)
seedIfEmpty(db)

const app = new Hono()
app.route('/api/roadmaps', roadmapRoutes(db, sqlite))
app.route('/api/ai', aiRoutes())

app.use('*', async (c, next) => {
  if (c.req.path.startsWith('/api')) return c.json({ message: 'Not found' }, 404)
  await next()
})

if (existsSync('dist/index.html')) {
  app.use('*', serveStatic({ root: './dist' }))
  app.get('*', serveStatic({ path: './dist/index.html' }))
}

const port = 8080
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API listening on ${info.port}`)
})
