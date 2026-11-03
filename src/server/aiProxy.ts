export function prepareAiBody(incoming: Record<string, unknown>, model: string): Record<string, unknown> {
  const body: Record<string, unknown> = { ...incoming, model }
  delete body.chat_id
  delete body.id
  delete body.session_id
  delete body.tool_ids
  if (body.params && typeof body.params === 'object' && !Array.isArray(body.params)) {
    const params = { ...(body.params as Record<string, unknown>) }
    delete params.function_calling
    if (Object.keys(params).length === 0) delete body.params
    else body.params = params
  }
  return body
}

export function completionsUrl(base = process.env.AI_BASE_URL || 'https://api.openai.com/v1'): string {
  return `${base.replace(/\/$/, '')}/chat/completions`
}

function chartEditsUnavailable(): string {
  return JSON.stringify({
    choices: [
      {
        message: {
          role: 'assistant',
          content: 'Chart edits are unavailable. The model must support tool calls.',
        },
      },
    ],
  })
}

export function normalizeAiResponse(requestBody: Record<string, unknown>, upstreamText: string, status: number): { status: number; text: string } {
  const sentTools = Array.isArray(requestBody.tools) && requestBody.tools.length > 0
  if (!sentTools) return { status, text: upstreamText }
  let parsed: unknown
  try {
    parsed = JSON.parse(upstreamText)
  } catch {
    if (status < 200 || status >= 300) return { status: 200, text: chartEditsUnavailable() }
    return { status, text: upstreamText }
  }
  if (!parsed || typeof parsed !== 'object') return { status: 200, text: chartEditsUnavailable() }
  if ('error' in parsed) return { status: 200, text: chartEditsUnavailable() }
  const choices = (parsed as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) return { status: 200, text: chartEditsUnavailable() }
  const message = (choices[0] as { message?: { content?: unknown; tool_calls?: unknown } }).message
  if (!message) return { status: 200, text: chartEditsUnavailable() }
  const hasTools = Array.isArray(message.tool_calls) && message.tool_calls.length > 0
  const hasContent = typeof message.content === 'string' && message.content.trim() !== ''
  if (!hasTools && !hasContent) return { status: 200, text: chartEditsUnavailable() }
  return { status, text: upstreamText }
}
