import type { JSONContent } from "@tiptap/core"
import { create } from "zustand"
import { persist } from "zustand/middleware"

import { initialWorkspaceNodes } from "@/data/initial-documents"
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

const collectDescendantIds = (nodes: WorkspaceNodes, nodeId: string): string[] => {
  const node = nodes[nodeId]
  if (!node) return []
  return [nodeId, ...node.children.flatMap((childId) => collectDescendantIds(nodes, childId))]
}

const findFirstDocument = (nodes: WorkspaceNodes): string | null =>
  Object.values(nodes).find((node) => node.type === "document")?.id ?? null

const getTopLevelNodeIds = (nodes: WorkspaceNodes, nodeIds: string[]) => {
  const requestedIds = Array.from(
    new Set(nodeIds.filter((nodeId) => nodeId !== "root" && nodes[nodeId])),
  )
  const requestedSet = new Set(requestedIds)

  return requestedIds.filter((nodeId) => {
    let parentId = nodes[nodeId]?.parentId
    while (parentId) {
      if (requestedSet.has(parentId)) return false
      parentId = nodes[parentId]?.parentId ?? null
    }
    return true
  })
}

const isNodeInsideSubtree = (nodes: WorkspaceNodes, nodeId: string, subtreeRootId: string) => {
  let currentId: string | null = nodeId
  while (currentId) {
    if (currentId === subtreeRootId) return true
    currentId = nodes[currentId]?.parentId ?? null
  }
  return false
}

const cloneSubtree = (
  sourceNodes: WorkspaceNodes,
  sourceId: string,
  parentId: string,
  updatedAt: string,
  renameRoot: boolean,
): { rootId: string; nodes: WorkspaceNodes } => {
  const source = sourceNodes[sourceId]
  const id = createId(source.type === "folder" ? "folder" : "doc")
  const clonedNodes: WorkspaceNodes = {}
  const clonedNode: WorkspaceNode = {
    ...structuredClone(source),
    id,
    parentId,
    name: renameRoot ? `${source.name} copy` : source.name,
    children: [],
    updatedAt,
  }

  clonedNodes[id] = clonedNode

  for (const childId of source.children) {
    const childClone = cloneSubtree(sourceNodes, childId, id, updatedAt, false)
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

export const getWorkspaceSnapshot = (state: WorkspaceSnapshot): WorkspaceSnapshot => ({
  nodes: state.nodes,
  activeDocumentId: state.activeDocumentId,
  expandedItems: state.expandedItems,
  lastSavedAt: state.lastSavedAt,
})

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      nodes: cloneInitialNodes(),
      activeDocumentId: "doc-product-brief",
      expandedItems: ["folder-product", "folder-research"],
      searchQuery: "",
      lastSavedAt: null,
      remoteRevision: null,
      cloudStatus: "local",
      cloudError: null,
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setExpandedItems: (expandedItems) => set({ expandedItems }),
      selectDocument: (documentId) => {
        const node = get().nodes[documentId]
        if (node?.type === "document") set({ activeDocumentId: documentId })
      },
      renameNode: (nodeId, name) => {
        const trimmedName = name.trim()
        if (!trimmedName || !get().nodes[nodeId]) return
        const updatedAt = new Date().toISOString()
        set((state) => ({
          nodes: {
            ...state.nodes,
            [nodeId]: {
              ...state.nodes[nodeId],
              name: trimmedName,
              updatedAt,
            },
          },
          lastSavedAt: updatedAt,
        }))
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

        set((current) => ({
          nodes: {
            ...current.nodes,
            [parentId]: {
              ...current.nodes[parentId],
              children: [...current.nodes[parentId].children, id],
              updatedAt,
            },
            [id]: node,
          },
          activeDocumentId: id,
          expandedItems: Array.from(new Set([...current.expandedItems, parentId])),
          lastSavedAt: updatedAt,
        }))
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

        set((current) => ({
          nodes: {
            ...current.nodes,
            [parentId]: {
              ...current.nodes[parentId],
              children: [...current.nodes[parentId].children, id],
              updatedAt,
            },
            [id]: node,
          },
          expandedItems: Array.from(new Set([...current.expandedItems, parentId, id])),
          lastSavedAt: updatedAt,
        }))
        return id
      },
      duplicateNode: (nodeId) => {
        if (nodeId === "root") return null
        const state = get()
        const source = state.nodes[nodeId]
        const parentId = source?.parentId
        if (!source || !parentId || !state.nodes[parentId]) return null

        const updatedAt = new Date().toISOString()
        const cloned = cloneSubtree(state.nodes, nodeId, parentId, updatedAt, true)
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
          activeDocumentId:
            source.type === "document" ? cloned.rootId : state.activeDocumentId,
          expandedItems: Array.from(
            new Set([
              ...state.expandedItems,
              parentId,
              ...(source.type === "folder" ? [cloned.rootId] : []),
            ]),
          ),
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

        const updatedAt = new Date().toISOString()
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
            updatedAt,
          }
        }

        const targetChildren = [...nextNodes[requestedParentId].children]
        const safeInsertionIndex =
          insertionIndex === undefined
            ? targetChildren.length
            : Math.max(0, Math.min(insertionIndex, targetChildren.length))
        targetChildren.splice(safeInsertionIndex, 0, ...movedIds)
        nextNodes[requestedParentId] = {
          ...nextNodes[requestedParentId],
          children: targetChildren,
          updatedAt,
        }

        for (const nodeId of movedIds) {
          nextNodes[nodeId] = {
            ...nextNodes[nodeId],
            parentId: requestedParentId,
            updatedAt,
          }
        }

        set({
          nodes: nextNodes,
          expandedItems: Array.from(new Set([...state.expandedItems, requestedParentId])),
          lastSavedAt: updatedAt,
        })
      },
      deleteNode: (nodeId) => {
        if (nodeId === "root") return
        const state = get()
        const node = state.nodes[nodeId]
        if (!node) return

        const deletedIds = new Set(collectDescendantIds(state.nodes, nodeId))
        const nextNodes = { ...state.nodes }
        deletedIds.forEach((id) => delete nextNodes[id])

        if (node.parentId && nextNodes[node.parentId]) {
          nextNodes[node.parentId] = {
            ...nextNodes[node.parentId],
            children: nextNodes[node.parentId].children.filter((id) => id !== nodeId),
            updatedAt: new Date().toISOString(),
          }
        }

        const nextActiveDocumentId =
          state.activeDocumentId && deletedIds.has(state.activeDocumentId)
            ? findFirstDocument(nextNodes)
            : state.activeDocumentId

        set({
          nodes: nextNodes,
          activeDocumentId: nextActiveDocumentId,
          expandedItems: state.expandedItems.filter((id) => !deletedIds.has(id)),
          lastSavedAt: new Date().toISOString(),
        })
      },
      updateDocumentContent: (documentId, content) => {
        const node = get().nodes[documentId]
        if (node?.type !== "document") return
        const updatedAt = new Date().toISOString()
        set((state) => ({
          nodes: {
            ...state.nodes,
            [documentId]: {
              ...node,
              content,
              updatedAt,
            },
          },
          lastSavedAt: updatedAt,
        }))
      },
      replaceWorkspace: (snapshot, remoteRevision) =>
        set({
          ...snapshot,
          remoteRevision,
          cloudStatus: "synced",
          cloudError: null,
        }),
      setCloudState: (cloudStatus, options) =>
        set((state) => ({
          cloudStatus,
          cloudError: options?.error === undefined ? state.cloudError : options.error,
          remoteRevision:
            options?.revision === undefined ? state.remoteRevision : options.revision,
        })),
      resetWorkspace: () =>
        set({
          nodes: cloneInitialNodes(),
          activeDocumentId: "doc-product-brief",
          expandedItems: ["folder-product", "folder-research"],
          searchQuery: "",
          lastSavedAt: null,
          remoteRevision: null,
          cloudStatus: "local",
          cloudError: null,
        }),
    }),
    {
      name: "write-skill-workspace-v1",
      version: 2,
      migrate: (persistedState) => ({
        ...(persistedState as WorkspaceState),
        remoteRevision: null,
        cloudStatus: "local",
        cloudError: null,
      }),
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
