import { existsSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { openDatabase } from './db'
import { runMigrations } from './migrate'
import { ensureLocalAccess } from './accessBoot'
import { aiRoutes } from './routes/ai'
import { gitlabRoutes } from './routes/gitlab'
import { portfolioRoutes } from './routes/portfolio'
import { roadmapRoutes } from './routes/roadmaps'
import { seedIfEmpty } from './seed'

const { db, sqlite } = openDatabase()
runMigrations(db)
seedIfEmpty(db)
ensureLocalAccess(db)

const app = new Hono()
app.route('/api/roadmaps', roadmapRoutes(db, sqlite))
app.route('/api/portfolio', portfolioRoutes(db))
app.route('/api/ai', aiRoutes(db))
app.route('/api/gitlab', gitlabRoutes())

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
