import type { WorkspaceSnapshot } from "@/types/document"
import { normalizeWorkspaceSnapshot } from "@/lib/workspace-snapshot"

const CREDENTIALS_KEY = "write-skill-cloud-credentials-v1"
const REQUEST_TIMEOUT_MS = 15_000
const MAX_WORKSPACE_ID_LENGTH = 160
const MAX_ACCESS_TOKEN_LENGTH = 512

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0

const isValidTimestamp = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 64 && !Number.isNaN(Date.parse(value))

const parseWorkspaceId = (value: unknown) => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_WORKSPACE_ID_LENGTH
  ) {
    throw new WorkspaceApiError(502, "The cloud workspace returned an invalid workspace id.")
  }
  return value
}

const parseRemoteWorkspace = (payload: unknown): RemoteWorkspace => {
  if (!isRecord(payload)) {
    throw new WorkspaceApiError(502, "The cloud workspace returned an invalid response.")
  }

  const snapshot = normalizeWorkspaceSnapshot(payload.snapshot)
  if (!snapshot) {
    throw new WorkspaceApiError(502, "The cloud workspace returned invalid document data.")
  }
  if (typeof payload.name !== "string" || payload.name.trim().length === 0) {
    throw new WorkspaceApiError(502, "The cloud workspace returned an invalid name.")
  }
  if (!isPositiveInteger(payload.revision) || !isValidTimestamp(payload.updatedAt)) {
    throw new WorkspaceApiError(502, "The cloud workspace returned invalid revision metadata.")
  }

  return {
    workspaceId: parseWorkspaceId(payload.workspaceId),
    name: payload.name.trim(),
    revision: payload.revision,
    updatedAt: payload.updatedAt,
    snapshot,
  }
}

const parseCreateWorkspaceResponse = (payload: unknown): CreateWorkspaceResponse => {
  const remote = parseRemoteWorkspace(payload)
  if (!isRecord(payload)) {
    throw new WorkspaceApiError(502, "The cloud workspace returned an invalid response.")
  }

  const accessToken = payload.accessToken
  if (
    typeof accessToken !== "string" ||
    accessToken.length < 32 ||
    accessToken.length > MAX_ACCESS_TOKEN_LENGTH
  ) {
    throw new WorkspaceApiError(502, "The cloud workspace returned an invalid access token.")
  }

  return { ...remote, accessToken }
}

const parseUpdateWorkspaceResponse = (payload: unknown): UpdateWorkspaceResponse => {
  if (
    !isRecord(payload) ||
    !isPositiveInteger(payload.revision) ||
    !isValidTimestamp(payload.updatedAt)
  ) {
    throw new WorkspaceApiError(502, "The cloud workspace returned invalid update metadata.")
  }

  return {
    workspaceId: parseWorkspaceId(payload.workspaceId),
    revision: payload.revision,
    updatedAt: payload.updatedAt,
  }
}

const requestJson = async (input: RequestInfo | URL, init?: RequestInit): Promise<unknown> => {
  const headers = new Headers(init?.headers)
  headers.set("Accept", "application/json")

  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const abortFromParent = () => controller.abort()

  if (init?.signal?.aborted) controller.abort()
  else init?.signal?.addEventListener("abort", abortFromParent, { once: true })

  try {
    const response = await fetch(input, {
      ...init,
      headers,
      signal: controller.signal,
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      const message =
        payload && typeof payload === "object" && "error" in payload
          ? String(payload.error)
          : `Request failed with status ${response.status}`
      throw new WorkspaceApiError(response.status, message, payload)
    }

    return payload
  } catch (error) {
    if (controller.signal.aborted && !init?.signal?.aborted) {
      throw new WorkspaceApiError(408, "The cloud request timed out. Please try again.")
    }
    throw error
  } finally {
    globalThis.clearTimeout(timeoutId)
    init?.signal?.removeEventListener("abort", abortFromParent)
  }
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
    if (
      !parsed.workspaceId ||
      parsed.workspaceId.length > MAX_WORKSPACE_ID_LENGTH ||
      !parsed.accessToken ||
      parsed.accessToken.length < 32 ||
      parsed.accessToken.length > MAX_ACCESS_TOKEN_LENGTH
    ) {
      return null
    }

    return {
      workspaceId: parsed.workspaceId,
      accessToken: parsed.accessToken,
    }
  } catch {
    return null
  }
}

export const saveWorkspaceCredentials = (credentials: WorkspaceCredentials) => {
  try {
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials))
  } catch {
    throw new Error("Browser storage is unavailable, so the cloud workspace cannot be linked safely.")
  }
}

export const clearWorkspaceCredentials = () => {
  try {
    localStorage.removeItem(CREDENTIALS_KEY)
  } catch {
    // The in-memory credentials are still cleared by the synchronization layer.
  }
}

export const createRemoteWorkspace = async (
  snapshot: WorkspaceSnapshot,
): Promise<CreateWorkspaceResponse> =>
  parseCreateWorkspaceResponse(
    await requestJson("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "My workspace",
        snapshot,
      }),
    }),
  )

export const fetchRemoteWorkspace = async (
  credentials: WorkspaceCredentials,
): Promise<RemoteWorkspace> =>
  parseRemoteWorkspace(
    await requestJson(`/api/workspaces/${encodeURIComponent(credentials.workspaceId)}`, {
      headers: authHeaders(credentials),
    }),
  )

export const updateRemoteWorkspace = async (
  credentials: WorkspaceCredentials,
  baseRevision: number,
  snapshot: WorkspaceSnapshot,
): Promise<UpdateWorkspaceResponse> =>
  parseUpdateWorkspaceResponse(
    await requestJson(`/api/workspaces/${encodeURIComponent(credentials.workspaceId)}`, {
      method: "PUT",
      headers: authHeaders(credentials),
      body: JSON.stringify({
        baseRevision,
        name: "My workspace",
        snapshot,
      }),
    }),
  )
