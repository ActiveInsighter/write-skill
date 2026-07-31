import type { JSONContent } from "@tiptap/core"

import type { WorkspaceNode, WorkspaceNodes, WorkspaceSnapshot } from "@/types/document"

const MAX_WORKSPACE_NODES = 1_000
const MAX_NODE_ID_LENGTH = 160
export const MAX_NODE_NAME_LENGTH = 200

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isValidTimestamp = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 64 && !Number.isNaN(Date.parse(value))

const isTiptapDocument = (value: unknown): value is JSONContent =>
  isRecord(value) && value.type === "doc"

export const findFirstDocumentId = (
  nodes: WorkspaceNodes,
  startId = "root",
): string | null => {
  const pending = [startId]
  const visited = new Set<string>()

  while (pending.length > 0) {
    const nodeId = pending.pop()!
    if (visited.has(nodeId)) continue
    visited.add(nodeId)

    const node = nodes[nodeId]
    if (!node) continue
    if (node.type === "document") return node.id

    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      pending.push(node.children[index])
    }
  }

  return null
}

export const normalizeWorkspaceSnapshot = (value: unknown): WorkspaceSnapshot | null => {
  if (!isRecord(value) || !isRecord(value.nodes)) return null

  const entries = Object.entries(value.nodes)
  if (entries.length === 0 || entries.length > MAX_WORKSPACE_NODES) return null

  const nodes: WorkspaceNodes = {}

  for (const [key, rawNode] of entries) {
    if (!isRecord(rawNode)) return null

    const { id, parentId, type, name, children, content, updatedAt } = rawNode
    if (
      typeof id !== "string" ||
      id !== key ||
      id.length === 0 ||
      id.length > MAX_NODE_ID_LENGTH
    ) {
      return null
    }
    if (
      parentId !== null &&
      (typeof parentId !== "string" || parentId.length === 0 || parentId.length > MAX_NODE_ID_LENGTH)
    ) {
      return null
    }
    if (type !== "folder" && type !== "document") return null
    if (
      typeof name !== "string" ||
      name.trim().length === 0 ||
      name.trim().length > MAX_NODE_NAME_LENGTH
    ) {
      return null
    }
    if (
      !Array.isArray(children) ||
      children.some((childId) => typeof childId !== "string") ||
      new Set(children).size !== children.length
    ) {
      return null
    }
    if (type === "document" && (children.length > 0 || !isTiptapDocument(content))) {
      return null
    }
    if (!isValidTimestamp(updatedAt)) return null

    const node: WorkspaceNode = {
      id,
      parentId,
      type,
      name: name.trim(),
      children: [...children],
      updatedAt,
      ...(type === "document" ? { content } : {}),
    }
    nodes[id] = node
  }

  const root = nodes.root
  if (!root || root.type !== "folder" || root.parentId !== null) return null

  for (const node of Object.values(nodes)) {
    for (const childId of node.children) {
      const child = nodes[childId]
      if (!child || child.parentId !== node.id) return null
    }

    if (node.id !== "root") {
      const parent = node.parentId ? nodes[node.parentId] : undefined
      if (!parent || parent.type !== "folder" || !parent.children.includes(node.id)) return null
    }
  }

  const visited = new Set<string>()
  const pending = ["root"]
  while (pending.length > 0) {
    const nodeId = pending.pop()!
    if (visited.has(nodeId)) return null

    const node = nodes[nodeId]
    if (!node) return null
    visited.add(nodeId)
    pending.push(...node.children)
  }
  if (visited.size !== entries.length) return null

  const requestedActiveDocumentId = value.activeDocumentId
  const activeDocumentId =
    typeof requestedActiveDocumentId === "string" &&
    nodes[requestedActiveDocumentId]?.type === "document"
      ? requestedActiveDocumentId
      : findFirstDocumentId(nodes)

  const expandedItems = Array.isArray(value.expandedItems)
    ? Array.from(
        new Set(
          value.expandedItems.filter(
            (itemId): itemId is string =>
              typeof itemId === "string" && nodes[itemId]?.type === "folder",
          ),
        ),
      )
    : []

  return {
    nodes,
    activeDocumentId,
    expandedItems,
    lastSavedAt:
      value.lastSavedAt === null || isValidTimestamp(value.lastSavedAt)
        ? value.lastSavedAt
        : null,
  }
}
