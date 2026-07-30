import type { WorkspaceSnapshot } from "@/types/document"

const CREDENTIALS_KEY = "write-skill-cloud-credentials-v1"

export interface WorkspaceCredentials {
  workspaceId: string
  accessToken: string
}

export interface RemoteWorkspace {
  workspaceId: string
  name: string
  revision: number
  updatedAt: string
  snapshot: WorkspaceSnapshot
}

interface CreateWorkspaceResponse extends RemoteWorkspace {
  accessToken: string
}

interface UpdateWorkspaceResponse {
  workspaceId: string
  revision: number
  updatedAt: string
}

export class WorkspaceApiError extends Error {
  readonly status: number
  readonly payload: unknown

  constructor(status: number, message: string, payload?: unknown) {
    super(message)
    this.name = "WorkspaceApiError"
    this.status = status
    this.payload = payload
  }
}

const requestJson = async <T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, {
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String(payload.error)
        : `Request failed with status ${response.status}`
    throw new WorkspaceApiError(response.status, message, payload)
  }

  return payload as T
}

const authHeaders = (credentials: WorkspaceCredentials) => ({
  Authorization: `Bearer ${credentials.accessToken}`,
  "Content-Type": "application/json",
})

export const loadWorkspaceCredentials = (): WorkspaceCredentials | null => {
  try {
    const raw = localStorage.getItem(CREDENTIALS_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<WorkspaceCredentials>
    if (!parsed.workspaceId || !parsed.accessToken) return null

    return {
      workspaceId: parsed.workspaceId,
      accessToken: parsed.accessToken,
    }
  } catch {
    return null
  }
}

export const saveWorkspaceCredentials = (credentials: WorkspaceCredentials) => {
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials))
}

export const clearWorkspaceCredentials = () => {
  localStorage.removeItem(CREDENTIALS_KEY)
}

export const createRemoteWorkspace = async (
  snapshot: WorkspaceSnapshot,
): Promise<CreateWorkspaceResponse> =>
  requestJson<CreateWorkspaceResponse>("/api/workspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "My workspace",
      snapshot,
    }),
  })

export const fetchRemoteWorkspace = async (
  credentials: WorkspaceCredentials,
): Promise<RemoteWorkspace> =>
  requestJson<RemoteWorkspace>(`/api/workspaces/${encodeURIComponent(credentials.workspaceId)}`, {
    headers: authHeaders(credentials),
  })

export const updateRemoteWorkspace = async (
  credentials: WorkspaceCredentials,
  baseRevision: number,
  snapshot: WorkspaceSnapshot,
): Promise<UpdateWorkspaceResponse> =>
  requestJson<UpdateWorkspaceResponse>(
    `/api/workspaces/${encodeURIComponent(credentials.workspaceId)}`,
    {
      method: "PUT",
      headers: authHeaders(credentials),
      body: JSON.stringify({
        baseRevision,
        name: "My workspace",
        snapshot,
      }),
    },
  )
