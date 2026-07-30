export type WorkspaceNodeKind = "folder" | "document"

export interface WorkspaceNodePayload {
  id: string
  name: string
  kind: WorkspaceNodeKind
  children?: string[]
  content?: string
  createdAt: string
  updatedAt: string
}

export interface WorkspaceSnapshotPayload {
  nodes: Record<string, WorkspaceNodePayload>
  selectedDocumentId: string
}

export interface WorkspaceSnapshotResponse extends WorkspaceSnapshotPayload {
  revision: number
  createdAt: string
  updatedAt: string
}

export interface NodeUpsertPayload {
  node: WorkspaceNodePayload
  parentId: string | null
  position: number
}

export interface WorkspaceRow {
  id: string
  selected_document_id: string
  revision: number
  created_at: string
  updated_at: string
}

export interface NodeRow {
  workspace_id: string
  id: string
  parent_id: string | null
  kind: WorkspaceNodeKind
  name: string
  position: number
  content: string | null
  version: number
  created_at: string
  updated_at: string
}
