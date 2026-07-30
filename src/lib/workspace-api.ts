import type { WorkspaceNode } from "@/features/workspace/workspace-store"

export interface WorkspaceSnapshot {
  nodes: Record<string, WorkspaceNode>
  selectedDocumentId: string
}

export interface CloudWorkspace extends WorkspaceSnapshot {
  revision: number
  createdAt: string
  updatedAt: string
}

interface RevisionResponse {
  revision: number
  syncedAt: string
}

interface ApiErrorBody {
  error?: {
    code?: string
    message?: string
  }
}

export class WorkspaceApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body) headers.set("content-type", "application/json")

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
  })

  const body = (await response.json().catch(() => null)) as T | ApiErrorBody | null
  if (!response.ok) {
    const error = body as ApiErrorBody | null
    throw new WorkspaceApiError(
      response.status,
      error?.error?.code ?? "request_failed",
      error?.error?.message ?? `云端请求失败（${response.status}）。`,
    )
  }
  return body as T
}

export async function bootstrapWorkspace(snapshot: WorkspaceSnapshot) {
  return apiRequest<{ workspace: CloudWorkspace; created: boolean }>(
    "/api/workspaces/bootstrap",
    { method: "POST", body: JSON.stringify(snapshot) },
  )
}

export async function replaceWorkspaceSnapshot(snapshot: WorkspaceSnapshot) {
  return apiRequest<{ workspace: CloudWorkspace }>(
    "/api/workspaces/current/snapshot",
    { method: "PUT", body: JSON.stringify(snapshot) },
  )
}

export async function saveWorkspaceSelection(selectedDocumentId: string) {
  return apiRequest<RevisionResponse>("/api/workspaces/current", {
    method: "PUT",
    body: JSON.stringify({ selectedDocumentId }),
  })
}

export async function saveWorkspaceNode(
  node: WorkspaceNode,
  parentId: string,
  position: number,
) {
  return apiRequest<RevisionResponse>(`/api/nodes/${encodeURIComponent(node.id)}`, {
    method: "PUT",
    body: JSON.stringify({ node, parentId, position }),
  })
}

export async function deleteWorkspaceNode(nodeId: string) {
  return apiRequest<RevisionResponse>(`/api/nodes/${encodeURIComponent(nodeId)}`, {
    method: "DELETE",
  })
}

export async function saveFolderChildren(parentId: string, children: string[]) {
  return apiRequest<RevisionResponse>(
    `/api/folders/${encodeURIComponent(parentId)}?operation=children`,
    { method: "PUT", body: JSON.stringify({ children }) },
  )
}
