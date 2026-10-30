import { Hono } from 'hono'

const openaiUrl = 'https://api.openai.com/v1/chat/completions'

function apiKey(): string {
  const key = process.env.OPENAI_API_KEY
  return typeof key === 'string' ? key.trim() : ''
}

export function aiRoutes() {
  const app = new Hono()

  app.get('/', (c) => c.json({ enabled: apiKey() !== '' }))

  app.post('/prompt', async (c) => {
    const key = apiKey()
    if (!key) return c.json({ message: 'AI is not configured' }, 503)

    const incoming: unknown = await c.req.json().catch(() => null)
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      return c.json({ message: 'Invalid prompt' }, 400)
    }

    const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4.1'
    let upstream: Response
    try {
      upstream = await fetch(openaiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...incoming, model }),
      })
    } catch {
      return c.json({ message: 'AI request failed' }, 502)
    }

    const text = await upstream.text()
    return new Response(text, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
      },
    })
  })

  return app
}
