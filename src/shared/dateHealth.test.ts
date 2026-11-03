import assert from 'node:assert/strict'
import test from 'node:test'
import { dateHealth, isMilestone, needsAttention, targetCalendarDate } from './dateHealth'

const today = '2026-11-02'

test('a late completion is Completed', () => {
  const health = dateHealth(
    { status: 'done', duration: 5, start: new Date(2026, 0, 1), end: new Date(2026, 7, 1) },
    today,
  )
  assert.equal(health, 'Completed')
})

test('overdue uses the local calendar date and keeps today on track', () => {
  const endToday = new Date(2026, 10, 3)
  const dueToday = dateHealth({ status: 'in progress', duration: 2, start: new Date(2026, 10, 1), end: endToday }, today)
  assert.equal(targetCalendarDate({ status: 'in progress', duration: 2, start: new Date(2026, 10, 1), end: endToday }), today)
  assert.equal(dueToday, 'On Track')
  const overdue = dateHealth(
    { status: 'in progress', duration: 2, start: new Date(2026, 9, 1), end: new Date(2026, 10, 2) },
    today,
  )
  assert.equal(overdue, 'Overdue')
})

test('a milestone keeps its own day', () => {
  const day = new Date(2026, 10, 2, 0, 0, 0)
  const input = { status: 'proposed', duration: 0, start: day, end: day }
  assert.equal(isMilestone(input), true)
  assert.equal(targetCalendarDate(input), '2026-11-02')
  assert.equal(dateHealth(input, today), 'On Track')
})

test('needs attention is overdue or slipped, not a late completion', () => {
  assert.equal(needsAttention('in progress', 'Overdue'), true)
  assert.equal(needsAttention('slipped', 'On Track'), true)
  assert.equal(needsAttention('done', 'Completed'), false)
  assert.equal(dateHealth({ status: 'planned', duration: null, start: null, end: null }, today), 'No Target')
})
