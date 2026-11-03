import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveEmail } from './identity'
import { prepareAiBody, completionsUrl, normalizeAiResponse } from './aiProxy'
import { parseWorkItemUrl, signalFromWorkItem } from './gitlab'
import { diffTasks } from './snapshots'
import { visibleIds } from '../shared/filterTree'

test('production ignores a bare email header', () => {
  assert.equal(
    resolveEmail({ production: true, secret: '', presentedSecret: '', headerEmail: 'ada@example.com', devEmail: 'ada@example.com' }),
    null,
  )
})

test('a matching proxy secret trusts the header', () => {
  assert.equal(
    resolveEmail({
      production: true,
      secret: 'proxy-secret',
      presentedSecret: 'proxy-secret',
      headerEmail: 'Ada@Example.com',
      devEmail: '',
    }),
    'ada@example.com',
  )
})

test('local dev uses DEV_EMAIL only when no secret is configured', () => {
  assert.equal(
    resolveEmail({ production: false, secret: '', presentedSecret: '', headerEmail: 'other@example.com', devEmail: 'Dev@Example.com' }),
    'dev@example.com',
  )
})

test('Open WebUI requests keep tool results and drop server-side execution fields', () => {
  const first = prepareAiBody(
    {
      chat_id: 'chat',
      id: 'assistant',
      session_id: 's',
      tool_ids: ['web'],
      params: { function_calling: 'legacy', temperature: 0 },
      tools: [{ type: 'function' }],
      messages: [{ role: 'user', content: 'Add a milestone' }],
    },
    'local-model',
  )
  assert.equal(first.model, 'local-model')
  assert.equal('chat_id' in first, false)
  assert.equal('id' in first, false)
  assert.equal('tool_ids' in first, false)
  assert.deepEqual(first.params, { temperature: 0 })
  const second = prepareAiBody(
    {
      model: 'browser-picked',
      tools: [{ type: 'function' }],
      messages: [
        { role: 'assistant', tool_calls: [{ id: 'call-1' }] },
        { role: 'tool', tool_call_id: 'call-1', content: '{"id":9}' },
        { role: 'user', content: 'Set its owner to Sam' },
      ],
    },
    'local-model',
  )
  assert.equal(Array.isArray(second.messages), true)
  assert.equal((second.messages as { role: string }[])[1]?.role, 'tool')
  assert.equal(completionsUrl('https://openwebui.internal/api/'), 'https://openwebui.internal/api/chat/completions')
})

test('an empty tool response becomes a chart-edit error and a readout is kept', () => {
  const tools = { tools: [{ type: 'function' }] }
  const empty = normalizeAiResponse(tools, JSON.stringify({ choices: [{ message: {} }] }), 200)
  assert.match(empty.text, /Chart edits are unavailable/)
  const readout = normalizeAiResponse(tools, JSON.stringify({ choices: [{ message: { content: 'Q3 is mostly on track.' } }] }), 200)
  assert.match(readout.text, /Q3 is mostly on track/)
})

test('work item links stay on the configured GitLab origin', () => {
  const parsed = parseWorkItemUrl('https://gitlab.example.com/groups/platform/app/-/work_items/42', 'https://gitlab.example.com')
  assert.deepEqual(parsed, { fullPath: 'platform/app', iid: '42' })
  assert.equal(parseWorkItemUrl('https://evil.example/group/app/-/work_items/1', 'https://gitlab.example.com'), null)
  const signal = signalFromWorkItem(
    {
      title: 'Reporting',
      state: 'opened',
      updatedAt: '2026-11-01T00:00:00Z',
      widgets: [
        { rolledUpCountsByType: [{ countsByState: { opened: 3, closed: 5 } }] },
        { dueDate: '2026-11-15' },
      ],
    },
    'https://gitlab.example.com/group/app/-/work_items/42',
  )
  assert.equal(signal.opened, 3)
  assert.equal(signal.closed, 5)
  assert.equal(signal.dueDate, '2026-11-15')
})

test('snapshot diff matches the original task id', () => {
  const changes = diffTasks(
    [{ sourceTaskId: 4, name: 'Billing', startDate: '2026-09-01', endDate: '2026-09-16', status: 'planned', owner: 'Riley', outcome: 'Invoices', successCriteria: 'One day' }],
    [{ sourceTaskId: 4, name: 'Billing', startDate: '2026-09-01', endDate: '2026-10-31', status: 'slipped', owner: 'Riley', outcome: 'Invoices', successCriteria: 'One day' }],
  )
  assert.equal(changes.some((change) => change.kind === 'date' && change.sourceTaskId === 4), true)
  assert.equal(changes.some((change) => change.kind === 'status'), true)
})

test('a filtered milestone keeps its initiative', () => {
  const visible = visibleIds(
    [
      { id: 1, parentId: null },
      { id: 2, parentId: 1 },
      { id: 3, parentId: 2 },
    ],
    [3],
  )
  assert.deepEqual([...visible].sort(), [1, 2, 3])
})
