import type { JSONContent } from "@tiptap/core"
import { create } from "zustand"
import { persist } from "zustand/middleware"

import { initialWorkspaceNodes } from "@/data/initial-documents"
import type { WorkspaceNode, WorkspaceNodes } from "@/types/document"

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

interface WorkspaceState {
  nodes: WorkspaceNodes
  activeDocumentId: string | null
  expandedItems: string[]
  searchQuery: string
  lastSavedAt: string | null
  setSearchQuery: (query: string) => void
  setExpandedItems: (items: string[]) => void
  selectDocument: (documentId: string) => void
  renameNode: (nodeId: string, name: string) => void
  createDocument: (parentId?: string) => string
  createFolder: (parentId?: string) => string
  deleteNode: (nodeId: string) => void
  updateDocumentContent: (documentId: string, content: JSONContent) => void
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

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      nodes: cloneInitialNodes(),
      activeDocumentId: "doc-product-brief",
      expandedItems: ["folder-product", "folder-research"],
      searchQuery: "",
      lastSavedAt: null,
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
      resetWorkspace: () =>
        set({
          nodes: cloneInitialNodes(),
          activeDocumentId: "doc-product-brief",
          expandedItems: ["folder-product", "folder-research"],
          searchQuery: "",
          lastSavedAt: null,
        }),
    }),
    {
      name: "write-skill-workspace-v1",
      partialize: (state) => ({
        nodes: state.nodes,
        activeDocumentId: state.activeDocumentId,
        expandedItems: state.expandedItems,
        lastSavedAt: state.lastSavedAt,
      }),
    },
  ),
)
