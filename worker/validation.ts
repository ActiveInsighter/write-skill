import { HttpError } from "./http"
import type {
  NodeUpsertPayload,
  WorkspaceNodePayload,
  WorkspaceSnapshotPayload,
} from "./types"

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/
const MAX_NODES = 500
const MAX_NAME_LENGTH = 80
const MAX_DOCUMENT_CONTENT_LENGTH = 2 * 1024 * 1024
const MAX_TOTAL_CONTENT_LENGTH = 12 * 1024 * 1024

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function assertId(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new HttpError(400, "invalid_id", `${field} 不是有效标识符。`)
  }
}

function normalizeTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback
}

function normalizeNode(value: unknown, now: string): WorkspaceNodePayload {
  if (!isRecord(value)) {
    throw new HttpError(400, "invalid_node", "节点数据格式无效。")
  }

  assertId(value.id, "节点 ID")
  if (value.kind !== "folder" && value.kind !== "document") {
    throw new HttpError(400, "invalid_node_kind", "节点类型必须是 folder 或 document。")
  }

  if (typeof value.name !== "string") {
    throw new HttpError(400, "invalid_node_name", "节点名称格式无效。")
  }
  const name = value.name.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH)
  if (!name) {
    throw new HttpError(400, "invalid_node_name", "节点名称不能为空。")
  }

  const createdAt = normalizeTimestamp(value.createdAt, now)
  const updatedAt = normalizeTimestamp(value.updatedAt, now)

  if (value.kind === "folder") {
    if (value.children !== undefined && !Array.isArray(value.children)) {
      throw new HttpError(400, "invalid_children", "文件夹 children 必须是数组。")
    }
    const children = (value.children ?? []).map((childId) => {
      assertId(childId, "子节点 ID")
      return childId
    })
    if (new Set(children).size !== children.length) {
      throw new HttpError(400, "duplicate_children", "文件夹中不能出现重复子节点。")
    }
    return {
      id: value.id,
      name,
      kind: "folder",
      children,
      createdAt,
      updatedAt,
    }
  }

  if (value.children !== undefined && Array.isArray(value.children) && value.children.length) {
    throw new HttpError(400, "document_has_children", "文档节点不能包含子节点。")
  }
  const content = typeof value.content === "string" ? value.content : ""
  if (content.length > MAX_DOCUMENT_CONTENT_LENGTH) {
    throw new HttpError(413, "document_too_large", "单篇文档内容不能超过 2 MB。")
  }

  return {
    id: value.id,
    name,
    kind: "document",
    content,
    createdAt,
    updatedAt,
  }
}

export function validateSnapshot(value: unknown): WorkspaceSnapshotPayload {
  if (!isRecord(value) || !isRecord(value.nodes)) {
    throw new HttpError(400, "invalid_snapshot", "工作区快照格式无效。")
  }

  const entries = Object.entries(value.nodes)
  if (entries.length === 0 || entries.length > MAX_NODES) {
    throw new HttpError(400, "invalid_node_count", `工作区节点数量必须在 1 到 ${MAX_NODES} 之间。`)
  }

  const now = new Date().toISOString()
  const nodes = Object.fromEntries(
    entries.map(([key, rawNode]) => {
      const node = normalizeNode(rawNode, now)
      if (key !== node.id) {
        throw new HttpError(400, "node_key_mismatch", "节点键必须与节点 ID 一致。")
      }
      return [key, node]
    }),
  )

  const root = nodes.root
  if (!root || root.kind !== "folder") {
    throw new HttpError(400, "missing_root", "工作区必须包含 root 文件夹。")
  }

  const parentById = new Map<string, string>()
  let totalContentLength = 0
  for (const node of Object.values(nodes)) {
    if (node.kind === "document") {
      totalContentLength += node.content?.length ?? 0
      continue
    }
    for (const childId of node.children ?? []) {
      if (!nodes[childId]) {
        throw new HttpError(400, "missing_child", `找不到子节点 ${childId}。`)
      }
      if (childId === "root") {
        throw new HttpError(400, "invalid_root_parent", "root 节点不能成为兞他节点的子节点。")
      }
      if (parentById.has(childId)) {
        throw new HttpError(400, "multiple_parents", `节点 ${childId} 不能同旞属于多个文件夹。`)
      }
      parentById.set(childId, node.id)
    }
  }

  if (totalContentLength > MAX_TOTAL_CONTENT_LENGTH) {
    throw new HttpError(413, "workspace_too_large", "工作区文档总内容不能超过 12 MB。")
  }

  for (const nodeId of Object.keys(nodes)) {
    if (nodeId !== "root" && !parentById.has(nodeId)) {
      throw new HttpError(400, "orphan_node", `节点 ${nodeId} 没有父文件夹。`)
    }
  }

  const visited = new Set<string>()
  const visiting = new Set<string>()
  const walk = (nodeId: string) => {
    if (visiting.has(nodeId)) {
      throw new HttpError(400, "tree_cycle", "目录树中存在循环引用。")
    }
    if (visited.has(nodeId)) return
    visiting.add(nodeId)
    const node = nodes[nodeId]
    if (node.kind === "folder") {
      for (const childId of node.children ?? []) walk(childId)
    }
    visiting.delete(nodeId)
    visited.add(nodeId)
  }
  walk("root")

  if (visited.size !== entries.length) {
    throw new HttpError(400, "unreachable_node", "目录树中存在无法从 root 访问的节点。")
  }

  assertId(value.selectedDocumentId, "选中文档 ID")
  if (nodes[value.selectedDocumentId]?.kind !== "document") {
    throw new HttpError(400, "invalid_selection", "选中的节点必须是文档。")
  }

  return { nodes, selectedDocumentId: value.selectedDocumentId }
}

export function validateNodeUpsert(value: unknown): NodeUpsertPayload {
  if (!isRecord(value)) {
    throw new HttpError(400, "invalid_node_payload", "节点请求格式无效。")
  }
  const now = new Date().toISOString()
  const node = normalizeNode(value.node, now)
  if (node.id === "root") {
    throw new HttpError(400, "root_immutable", "root 节点不能通过此接口修改。")
  }

  if (value.parentId !== null) assertId(value.parentId, "父节点 ID")
  if (value.parentId === null) {
    throw new HttpError(400, "missing_parent", "普通节点必须包含父文件夹。")
  }
  if (value.parentId === node.id) {
    throw new HttpError(400, "self_parent", "节点不能成为自己的父节点。")
  }
  if (!Number.isInteger(value.position) || Number(value.position) < 0) {
    throw new HttpError(400, "invalid_position", "节点位置必须是非负整数。")
  }

  return { node, parentId: value.parentId, position: Number(value.position) }
}

export function validateChildren(value: unknown): string[] {
  if (!isRecord(value) || !Array.isArray(value.children)) {
    throw new HttpError(400, "invalid_children", "children 必须是数组。")
  }
  if (value.children.length > MAX_NODES) {
    throw new HttpError(400, "too_many_children", "单个文件夹的子节点数量过多。")
  }
  const children = value.children.map((childId) => {
    assertId(childId, "子节点 ID")
    return childId
  })
  if (new Set(children).size !== children.length) {
    throw new HttpError(40, "duplicate_children", "children 不能包含重复节点。")
  }
  return children
}

export function validateSelectedDocument(value: unknown): string {
  if (!isRecord(value)) {
    throw new HttpError(400, "invalid_selection", "选中文档请求格式无效。")
  }
  assertId(value.selectedDocumentId, "选中文档 ID")
  return value.selectedDocumentId
}
