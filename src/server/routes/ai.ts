import { Hono } from 'hono'
import type { AppDatabase } from '../db'
import { isEditorOfRoadmap } from '../access'
import { completionsUrl, normalizeAiResponse, prepareAiBody } from '../aiProxy'
import { emailFromHeaders } from '../identity'

function apiKey(): string {
  const key = process.env.OPENAI_API_KEY
  return typeof key === 'string' ? key.trim() : ''
}

function requestEmail(header: (name: string) => string | undefined): string | null {
  return emailFromHeaders({ get: header })
}

export function aiRoutes(db: AppDatabase) {
  const app = new Hono()

  app.get('/', (c) => {
    const email = requestEmail((name) => c.req.header(name))
    if (!email) return c.json({ enabled: false })
    const roadmapId = Number(c.req.query('roadmapId'))
    if (!Number.isInteger(roadmapId) || !isEditorOfRoadmap(db, email, roadmapId)) {
      return c.json({ enabled: false })
    }
    return c.json({ enabled: apiKey() !== '' })
  })

  app.post('/prompt', async (c) => {
    const email = requestEmail((name) => c.req.header(name))
    if (!email) return c.json({ message: 'Sign-in required' }, 401)
    const roadmapId = Number(c.req.query('roadmapId'))
    if (!Number.isInteger(roadmapId) || !isEditorOfRoadmap(db, email, roadmapId)) {
      return c.json({ message: 'Only an editor can change this roadmap' }, 403)
    }
    const key = apiKey()
    if (!key) return c.json({ message: 'AI is not configured' }, 503)

    const incoming: unknown = await c.req.json().catch(() => null)
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      return c.json({ message: 'Invalid prompt' }, 400)
    }

    const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4.1'
    const body = prepareAiBody(incoming as Record<string, unknown>, model)
    let upstream: Response
    try {
      upstream = await fetch(completionsUrl(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
    } catch {
      return c.json({ message: 'AI request failed' }, 502)
    }

    const text = await upstream.text()
    const normalized = normalizeAiResponse(body, text, upstream.status)
    return new Response(normalized.text, {
      status: normalized.status,
      headers: { 'Content-Type': 'application/json' },
    })
  })

  return app
}
