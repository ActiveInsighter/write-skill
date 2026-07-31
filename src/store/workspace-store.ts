import type { JSONContent } from "@tiptap/core"
import { create } from "zustand"
import { persist } from "zustand/middleware"

import { initialWorkspaceNodes } from "@/data/initial-documents"
import {
  findFirstDocumentId,
  MAX_NODE_NAME_LENGTH,
  normalizeWorkspaceSnapshot,
} from "@/lib/workspace-snapshot"
import type {
  CloudSyncStatus,
  WorkspaceNode,
  WorkspaceNodes,
  WorkspaceSnapshot,
} from "@/types/document"

const createId = (prefix: string) => {
  const randomId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  return `${prefix}-${randomId}`
}

const cloneInitialNodes = (): WorkspaceNodes => structuredClone(initialWorkspaceNodes)

const createInitialWorkspaceSnapshot = (): WorkspaceSnapshot => ({
  nodes: cloneInitialNodes(),
  activeDocumentId: "doc-product-brief",
  expandedItems: ["folder-product", "folder-research"],
  lastSavedAt: null,
})

const collectDescendantIds = (nodes: WorkspaceNodes, nodeId: string): string[] => {
  const descendants: string[] = []
  const pending = [nodeId]
  const visited = new Set<string>()

  while (pending.length > 0) {
    const currentId = pending.pop()!
    if (visited.has(currentId)) continue
    visited.add(currentId)

    const node = nodes[currentId]
    if (!node) continue
    descendants.push(currentId)
    pending.push(...node.children)
  }

  return descendants
}

const getTopLevelNodeIds = (nodes: WorkspaceNodes, nodeIds: string[]) => {
  const requestedIds = Array.from(
    new Set(nodeIds.filter((nodeId) => nodeId !== "root" && nodes[nodeId])),
  )
  const requestedSet = new Set(requestedIds)

  return requestedIds.filter((nodeId) => {
    const visited = new Set<string>()
    let parentId = nodes[nodeId]?.parentId

    while (parentId && !visited.has(parentId)) {
      if (requestedSet.has(parentId)) return false
      visited.add(parentId)
      parentId = nodes[parentId]?.parentId ?? null
    }
    return true
  })
}

const isNodeInsideSubtree = (nodes: WorkspaceNodes, nodeId: string, subtreeRootId: string) => {
  const visited = new Set<string>()
  let currentId: string | null = nodeId

  while (currentId && !visited.has(currentId)) {
    if (currentId === subtreeRootId) return true
    visited.add(currentId)
    currentId = nodes[currentId]?.parentId ?? null
  }
  return false
}

const normalizeNodeName = (name: string) => name.trim().slice(0, MAX_NODE_NAME_LENGTH).trimEnd()

const createCopyName = (name: string) => {
  const suffix = " copy"
  const baseName = name.slice(0, MAX_NODE_NAME_LENGTH - suffix.length).trimEnd()
  return `${baseName || "Untitled"}${suffix}`
}

const cloneSubtree = (
  sourceNodes: WorkspaceNodes,
  sourceId: string,
  parentId: string,
  updatedAt: string,
  renameRoot: boolean,
  visited = new Set<string>(),
): { rootId: string; nodes: WorkspaceNodes } | null => {
  const source = sourceNodes[sourceId]
  if (!source || visited.has(sourceId)) return null
  visited.add(sourceId)

  const id = createId(source.type === "folder" ? "folder" : "doc")
  const clonedNodes: WorkspaceNodes = {}
  const clonedNode: WorkspaceNode = {
    ...structuredClone(source),
    id,
    parentId,
    name: renameRoot ? createCopyName(source.name) : source.name,
    children: [],
    updatedAt,
  }

  clonedNodes[id] = clonedNode

  for (const childId of source.children) {
    const childClone = cloneSubtree(sourceNodes, childId, id, updatedAt, false, visited)
    if (!childClone) return null
    clonedNode.children.push(childClone.rootId)
    Object.assign(clonedNodes, childClone.nodes)
  }

  return { rootId: id, nodes: clonedNodes }
}

interface WorkspaceState extends WorkspaceSnapshot {
  searchQuery: string
  remoteRevision: number | null
  cloudStatus: CloudSyncStatus
  cloudError: string | null
  setSearchQuery: (query: string) => void
  setExpandedItems: (items: string[]) => void
  selectDocument: (documentId: string) => void
  renameNode: (nodeId: string, name: string) => void
  createDocument: (parentId?: string) => string
  createFolder: (parentId?: string) => string
  duplicateNode: (nodeId: string) => string | null
  moveNodes: (nodeIds: string[], parentId: string, insertionIndex?: number) => void
  deleteNode: (nodeId: string) => void
  updateDocumentContent: (documentId: string, content: JSONContent) => void
  replaceWorkspace: (snapshot: WorkspaceSnapshot, remoteRevision: number) => void
  setCloudState: (
    cloudStatus: CloudSyncStatus,
    options?: { error?: string | null; revision?: number | null },
  ) => void
  resetWorkspace: () => void
}

const resolveParentFolder = (
  nodes: WorkspaceNodes,
  activeDocumentId: string | null,
  requestedParentId?: string,
) => {
  const requestedNode = requestedParentId ? nodes[requestedParentId] : undefined
  if (requestedNode?.type === "folder") return requestedNode.id

  const activeNode = activeDocumentId ? nodes[activeDocumentId] : undefined
  if (activeNode?.parentId && nodes[activeNode.parentId]?.type === "folder") {
    return activeNode.parentId
  }

  return "root"
}

const emptyDocument = (title: string): JSONContent => ({
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: title }],
    },
    { type: "paragraph" },
  ],
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const normalizeRemoteRevision = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null

export const getWorkspaceSnapshot = (state: WorkspaceSnapshot): WorkspaceSnapshot => ({
  nodes: state.nodes,
  activeDocumentId: state.activeDocumentId,
  expandedItems: state.expandedItems,
  lastSavedAt: state.lastSavedAt,
})

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      ...createInitialWorkspaceSnapshot(),
      searchQuery: "",
      remoteRevision: null,
      cloudStatus: "local",
      cloudError: null,
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setExpandedItems: (items) =>
        set((state) => ({
          expandedItems: Array.from(
            new Set(items.filter((itemId) => state.nodes[itemId]?.type === "folder")),
          ),
        })),
      selectDocument: (documentId) => {
        const state = get()
        const node = state.nodes[documentId]
        if (node?.type === "document" && state.activeDocumentId !== documentId) {
          set({ activeDocumentId: documentId })
        }
      },
      renameNode: (nodeId, name) => {
        const trimmedName = normalizeNodeName(name)
        const currentNode = get().nodes[nodeId]
        if (!trimmedName || !currentNode || currentNode.name === trimmedName) return

        const updatedAt = new Date().toISOString()
        set((state) => {
          const node = state.nodes[nodeId]
          if (!node) return state

          return {
            nodes: {
              ...state.nodes,
              [nodeId]: {
                ...node,
                name: trimmedName,
                updatedAt,
              },
            },
            lastSavedAt: updatedAt,
          }
        })
      },
      createDocument: (requestedParentId) => {
        const state = get()
        const parentId = resolveParentFolder(
          state.nodes,
          state.activeDocumentId,
          requestedParentId,
        )
        const id = createId("doc")
        const updatedAt = new Date().toISOString()
        const node: WorkspaceNode = {
          id,
          parentId,
          type: "document",
          name: "Untitled document",
          children: [],
          content: emptyDocument("Untitled document"),
          updatedAt,
        }

        set((current) => {
          const parent = current.nodes[parentId]
          if (!parent || parent.type !== "folder") return current

          return {
            nodes: {
              ...current.nodes,
              [parentId]: {
                ...parent,
                children: [...parent.children, id],
                updatedAt,
              },
              [id]: node,
            },
            activeDocumentId: id,
            expandedItems: Array.from(new Set([...current.expandedItems, parentId])),
            searchQuery: "",
            lastSavedAt: updatedAt,
          }
        })
        return id
      },
      createFolder: (requestedParentId) => {
        const state = get()
        const parentId = resolveParentFolder(
          state.nodes,
          state.activeDocumentId,
          requestedParentId,
        )
        const id = createId("folder")
        const updatedAt = new Date().toISOString()
        const node: WorkspaceNode = {
          id,
          parentId,
          type: "folder",
          name: "New folder",
          children: [],
          updatedAt,
        }

        set((current) => {
          const parent = current.nodes[parentId]
          if (!parent || parent.type !== "folder") return current

          return {
            nodes: {
              ...current.nodes,
              [parentId]: {
                ...parent,
                children: [...parent.children, id],
                updatedAt,
              },
              [id]: node,
            },
            expandedItems: Array.from(new Set([...current.expandedItems, parentId, id])),
            searchQuery: "",
            lastSavedAt: updatedAt,
          }
        })
        return id
      },
      duplicateNode: (nodeId) => {
        if (nodeId === "root") return null
        const state = get()
        const source = state.nodes[nodeId]
        const parentId = source?.parentId
        if (!source || !parentId || state.nodes[parentId]?.type !== "folder") return null

        const updatedAt = new Date().toISOString()
        const cloned = cloneSubtree(state.nodes, nodeId, parentId, updatedAt, true)
        if (!cloned) return null

        const parentChildren = state.nodes[parentId].children
        const sourceIndex = parentChildren.indexOf(nodeId)
        const insertionIndex = sourceIndex < 0 ? parentChildren.length : sourceIndex + 1
        const nextChildren = [...parentChildren]
        nextChildren.splice(insertionIndex, 0, cloned.rootId)

        set({
          nodes: {
            ...state.nodes,
            ...cloned.nodes,
            [parentId]: {
              ...state.nodes[parentId],
              children: nextChildren,
              updatedAt,
            },
          },
          activeDocumentId: source.type === "document" ? cloned.rootId : state.activeDocumentId,
          expandedItems: Array.from(
            new Set([
              ...state.expandedItems,
              parentId,
              ...(source.type === "folder" ? [cloned.rootId] : []),
            ]),
          ),
          searchQuery: "",
          lastSavedAt: updatedAt,
        })

        return cloned.rootId
      },
      moveNodes: (nodeIds, requestedParentId, insertionIndex) => {
        const state = get()
        const targetParent = state.nodes[requestedParentId]
        const movedIds = getTopLevelNodeIds(state.nodes, nodeIds)

        if (targetParent?.type !== "folder" || movedIds.length === 0) return
        if (
          movedIds.some(
            (nodeId) =>
              nodeId === requestedParentId ||
              isNodeInsideSubtree(state.nodes, requestedParentId, nodeId),
          )
        ) {
          return
        }

        const nextNodes = { ...state.nodes }
        const affectedParentIds = new Set<string>([requestedParentId])

        for (const nodeId of movedIds) {
          const parentId = nextNodes[nodeId]?.parentId
          if (parentId && nextNodes[parentId]) affectedParentIds.add(parentId)
        }

        for (const parentId of affectedParentIds) {
          nextNodes[parentId] = {
            ...nextNodes[parentId],
            children: nextNodes[parentId].children.filter((childId) => !movedIds.includes(childId)),
          }
        }

        const targetChildren = [...nextNodes[requestedParentId].children]
        // Headless Tree's insertionIndex already accounts for items removed from the same parent.
        const safeInsertionIndex =
          insertionIndex === undefined
            ? targetChildren.length
            : Math.max(0, Math.min(insertionIndex, targetChildren.length))

        targetChildren.splice(safeInsertionIndex, 0, ...movedIds)

        const isNoOp =
          affectedParentIds.size === 1 &&
          targetChildren.length === targetParent.children.length &&
          targetChildren.every((childId, index) => childId === targetParent.children[index])
        if (isNoOp) return

        const updatedAt = new Date().toISOString()
        for (const parentId of affectedParentIds) {
          nextNodes[parentId] = {
            ...nextNodes[parentId],
            updatedAt,
          }
        }
        nextNodes[requestedParentId] = {
          ...nextNodes[requestedParentId],
          children: targetChildren,
          updatedAt,
        }

        for (const nodeId of movedIds) {
          const node = nextNodes[nodeId]
          if (!node) continue
          nextNodes[nodeId] = {
            ...node,
            parentId: requestedParentId,
            updatedAt,
          }
        }

        set({
          nodes: nextNodes,
          expandedItems: Array.from(new Set([...state.expandedItems, requestedParentId])),
          searchQuery: "",
          lastSavedAt: updatedAt,
        })
      },
      deleteNode: (nodeId) => {
        if (nodeId === "root") return
        const state = get()
        const node = state.nodes[nodeId]
        if (!node) return

        const updatedAt = new Date().toISOString()
        const deletedIds = new Set(collectDescendantIds(state.nodes, nodeId))
        const nextNodes = { ...state.nodes }
        deletedIds.forEach((id) => delete nextNodes[id])

        if (node.parentId && nextNodes[node.parentId]) {
          nextNodes[node.parentId] = {
            ...nextNodes[node.parentId],
            children: nextNodes[node.parentId].children.filter((id) => id !== nodeId),
            updatedAt,
          }
        }

        const nextActiveDocumentId =
          state.activeDocumentId && deletedIds.has(state.activeDocumentId)
            ? findFirstDocumentId(nextNodes)
            : state.activeDocumentId

        set({
          nodes: nextNodes,
          activeDocumentId: nextActiveDocumentId,
          expandedItems: state.expandedItems.filter((id) => !deletedIds.has(id)),
          searchQuery: "",
          lastSavedAt: updatedAt,
        })
      },
      updateDocumentContent: (documentId, content) => {
        set((state) => {
          const node = state.nodes[documentId]
          if (node?.type !== "document" || node.content === content) return state

          const updatedAt = new Date().toISOString()
          return {
            nodes: {
              ...state.nodes,
              [documentId]: {
                ...node,
                content,
                updatedAt,
              },
            },
            lastSavedAt: updatedAt,
          }
        })
      },
      replaceWorkspace: (snapshot, remoteRevision) => {
        const normalized = normalizeWorkspaceSnapshot(snapshot)
        if (!normalized) {
          set({
            cloudStatus: "error",
            cloudError: "The cloud workspace returned invalid data. The local copy was kept.",
          })
          return
        }

        set({
          ...normalized,
          searchQuery: "",
          remoteRevision,
          cloudStatus: "synced",
          cloudError: null,
        })
      },
      setCloudState: (cloudStatus, options) =>
        set((state) => ({
          cloudStatus,
          cloudError: options?.error === undefined ? state.cloudError : options.error,
          remoteRevision:
            options?.revision === undefined ? state.remoteRevision : options.revision,
        })),
      resetWorkspace: () =>
        set({
          ...createInitialWorkspaceSnapshot(),
          searchQuery: "",
          remoteRevision: null,
          cloudStatus: "local",
          cloudError: null,
        }),
    }),
    {
      name: "write-skill-workspace-v1",
      version: 3,
      migrate: (persistedState) => persistedState as WorkspaceState,
      merge: (persistedState, currentState) => {
        const normalizedSnapshot = normalizeWorkspaceSnapshot(persistedState)
        const persistedRecord = isRecord(persistedState) ? persistedState : {}

        return {
          ...currentState,
          ...(normalizedSnapshot ?? createInitialWorkspaceSnapshot()),
          searchQuery: "",
          remoteRevision: normalizeRemoteRevision(persistedRecord.remoteRevision),
          cloudStatus: "local",
          cloudError: null,
        }
      },
      partialize: (state) => ({
        nodes: state.nodes,
        activeDocumentId: state.activeDocumentId,
        expandedItems: state.expandedItems,
        lastSavedAt: state.lastSavedAt,
        remoteRevision: state.remoteRevision,
      }),
    },
  ),
)
