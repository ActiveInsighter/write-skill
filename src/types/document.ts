import type { JSONContent } from "@tiptap/core"

export type WorkspaceNodeType = "folder" | "document"

export interface WorkspaceNode {
  id: string
  parentId: string | null
  type: WorkspaceNodeType
  name: string
  children: string[]
  content?: JSONContent
  updatedAt: string
}

export type WorkspaceNodes = Record<string, WorkspaceNode>

export interface WorkspaceSnapshot {
  nodes: WorkspaceNodes
  activeDocumentId: string | null
  expandedItems: string[]
  lastSavedAt: string | null
}

export type CloudSyncStatus =
  | "local"
  | "connecting"
  | "syncing"
  | "synced"
  | "offline"
  | "conflict"
  | "error"
