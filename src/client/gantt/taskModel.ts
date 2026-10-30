export const taskFields = ['status', 'owner', 'outcome'] as const

export type TaskField = (typeof taskFields)[number]

export type CadenceTaskFields = {
  status: string
  owner: string
  outcome: string
}
