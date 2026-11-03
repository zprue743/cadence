import { Hono } from 'hono'
import { fetchWorkItemSignal, GitlabError } from '../gitlab'
import { emailFromHeaders } from '../identity'

export function gitlabRoutes() {
  const app = new Hono()

  app.get('/signal', async (c) => {
    const email = emailFromHeaders({
      get(name) {
        return c.req.header(name)
      },
    })
    if (!email) return c.json({ message: 'Sign-in required' }, 401)
    const url = c.req.query('url')?.trim() ?? ''
    if (!url) return c.json({ message: 'Missing work item link' }, 400)
    try {
      return c.json(await fetchWorkItemSignal(url))
    } catch (error) {
      if (error instanceof GitlabError) return c.json({ message: error.message }, error.status as 400 | 404 | 502 | 503)
      return c.json({ message: 'GitLab request failed' }, 502)
    }
  })

  return app
}
