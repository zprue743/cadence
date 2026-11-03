export type GitlabSignal = {
  title: string
  state: string
  opened: number | null
  closed: number | null
  dueDate: string | null
  updatedAt: string | null
  webUrl: string
}

export function parseWorkItemUrl(raw: string, gitlabBase: string): { fullPath: string; iid: string } | null {
  let item: URL
  let base: URL
  try {
    item = new URL(raw)
    base = new URL(gitlabBase)
  } catch {
    return null
  }
  if (item.origin !== base.origin) return null
  const match = item.pathname.match(/^(.*)\/-\/(?:work_items|epics)\/(\d+)\/?$/)
  if (!match) return null
  let fullPath = match[1].replace(/^\//, '').replace(/\/$/, '')
  if (fullPath.startsWith('groups/')) fullPath = fullPath.slice('groups/'.length)
  if (!fullPath || fullPath.includes('..')) return null
  return { fullPath, iid: match[2] }
}

type CountBucket = { countsByState?: { opened?: number; closed?: number } }

type Widget = {
  dueDate?: string | null
  milestone?: { dueDate?: string | null } | null
  rolledUpCountsByType?: CountBucket[]
}

type WorkItemPayload = {
  title?: string
  state?: string
  updatedAt?: string | null
  webUrl?: string
  widgets?: Widget[]
}

export function signalFromWorkItem(item: WorkItemPayload, fallbackUrl: string): GitlabSignal {
  let opened = 0
  let closed = 0
  let sawCounts = false
  let dueDate: string | null = null
  for (const widget of item.widgets ?? []) {
    if (widget.dueDate) dueDate = widget.dueDate
    if (widget.milestone?.dueDate) dueDate = widget.milestone.dueDate
    for (const bucket of widget.rolledUpCountsByType ?? []) {
      sawCounts = true
      opened += bucket.countsByState?.opened ?? 0
      closed += bucket.countsByState?.closed ?? 0
    }
  }
  return {
    title: item.title ?? 'Work item',
    state: item.state ?? '',
    opened: sawCounts ? opened : null,
    closed: sawCounts ? closed : null,
    dueDate,
    updatedAt: item.updatedAt ?? null,
    webUrl: item.webUrl || fallbackUrl,
  }
}

const query = `
  query CadenceWorkItem($fullPath: ID!, $iid: String!) {
    namespace(fullPath: $fullPath) {
      workItem(iid: $iid) {
        title
        state
        updatedAt
        webUrl
        widgets {
          ... on WorkItemWidgetHierarchy {
            rolledUpCountsByType { countsByState { opened closed } }
          }
          ... on WorkItemWidgetStartAndDueDate { dueDate }
          ... on WorkItemWidgetMilestone { milestone { dueDate } }
        }
      }
    }
  }
`

export async function fetchWorkItemSignal(rawUrl: string): Promise<GitlabSignal> {
  const base = process.env.GITLAB_URL?.trim() ?? ''
  const token = process.env.GITLAB_TOKEN?.trim() ?? ''
  if (!base || !token) throw new GitlabError('GitLab is not configured', 503)
  const parsed = parseWorkItemUrl(rawUrl, base)
  if (!parsed) throw new GitlabError('Link a GitLab work item on this server', 400)

  let response: Response
  try {
    response = await fetch(new URL('/api/graphql', base), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables: parsed }),
    })
  } catch {
    throw new GitlabError('GitLab request failed', 502)
  }
  if (!response.ok) throw new GitlabError('GitLab request failed', 502)
  const payload = (await response.json()) as {
    data?: { namespace?: { workItem?: WorkItemPayload | null } | null }
  }
  const item = payload.data?.namespace?.workItem
  if (!item) throw new GitlabError('Work item not found', 404)
  return signalFromWorkItem(item, rawUrl)
}

export class GitlabError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'GitlabError'
    this.status = status
  }
}
