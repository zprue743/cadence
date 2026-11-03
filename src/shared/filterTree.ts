export type TreeNode = {
  id: number
  parentId: number | null
}

export function visibleIds(nodes: TreeNode[], matched: Iterable<number>): Set<number> {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const visible = new Set<number>()
  for (const id of matched) {
    let current = byId.get(id)
    while (current) {
      if (visible.has(current.id)) break
      visible.add(current.id)
      current = current.parentId == null ? undefined : byId.get(current.parentId)
    }
  }
  return visible
}
