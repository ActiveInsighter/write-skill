type D1Value = string | number | null | ArrayBuffer

interface D1Result<T = Record<string, unknown>> {
  results: T[]
  success: boolean
  meta: Record<string, unknown>
}

interface D1PreparedStatement {
  bind(...values: D1Value[]): D1PreparedStatement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>
}

interface D1Database {
  prepare(query: string): D1PreparedStatement
}

interface Fetcher {
  fetch(input: Request | string | URL, init?: RequestInit): Promise<Response>
}

interface Env {
  DB: D1Database
  ASSETS: Fetcher
  ENVIRONMENT: string
}

type WorkspaceNodeType = "folder" | "document"

interface WorkspaceNode {
  id: string
  parentId: string | null
  type: WorkspaceNodeType
  name: string
  children: string[]
  content?: Record<string, unknown>
  updatedAt: string
}

interface WorkspaceSnapshot {
  nodes: Record<string, WorkspaceNode>
  activeDocumentId: string | null
  expandedItems: string[]
  lastSavedAt: string | null
}

interface WorkspaceRow {
  id: string
  name: string
  revision: number
  snapshot_json: string
  updated_at: string
}

interface RevisionRow {
  revision: number
  created_at: string
}

const MAX_BODY_BYTES = 2_000_000
const MAX_WORKSPACE_NODES = 1_000
const MAX_NAME_LENGTH = 200

class HttpError extends Error {
  readonly status: number
  readonly details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = "HttpError"
    this.status = status
    this.details = details
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const json = (data: unknown, status = 200, requestId?: string) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...(requestId ? { "x-request-id": requestId } : {}),
    },
  })

const empty = (status: number, headers?: HeadersInit) => new Response(null, { status, headers })

const readJson = async (request: Request): Promise<unknown> => {
  const declaredLength = Number(request.headers.get("content-length") ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new HttpError(413, "Request body is too large.")
  }

  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new HttpError(413, "Request body is too large.")
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.")
  }
}

const validateName = (value: unknown, fallback = "My workspace") => {
  if (value === undefined) return fallback
  if (typeof value !== "string") throw new HttpError(400, "Workspace name must be a string.")

  const name = value.trim()
  if (!name || name.length > MAX_NAME_LENGTH) {
    throw new HttpError(400, `Workspace name must contain 1-${MAX_NAME_LENGTH} characters.`)
  }

  return name
}

const validateTimestamp = (value: unknown, fieldName: string): string | null => {
  if (value === null) return null
  if (typeof value !== "string" || value.length > 64 || Number.isNaN(Date.parse(value))) {
    throw new HttpError(400, `${fieldName} must be an ISO timestamp or null.`)
  }
  return value
}

const validateSnapshot = (value: unknown): WorkspaceSnapshot => {
  if (!isRecord(value) || !isRecord(value.nodes)) {
    throw new HttpError(400, "A workspace snapshot with a nodes object is required.")
  }

  const nodeEntries = Object.entries(value.nodes)
  if (nodeEntries.length === 0 || nodeEntries.length > MAX_WORKSPACE_NODES) {
    throw new HttpError(
      400,
      `A workspace must contain between 1 and ${MAX_WORKSPACE_NODES} nodes.`,
    )
  }

  const nodes: Record<string, WorkspaceNode> = {}

  for (const [key, rawNode] of nodeEntries) {
    if (!isRecord(rawNode)) throw new HttpError(400, `Node ${key} must be an object.`)

    const id = rawNode.id
    const parentId = rawNode.parentId
    const type = rawNode.type
    const name = rawNode.name
    const children = rawNode.children
    const updatedAt = rawNode.updatedAt

    if (typeof id !== "string" || id !== key || id.length > 160) {
      throw new HttpError(400, `Node ${key} has an invalid id.`)
    }
    if (parentId !== null && (typeof parentId !== "string" || parentId.length > 160)) {
      throw new HttpError(400, `Node ${id} has an invalid parentId.`)
    }
    if (type !== "folder" && type !== "document") {
      throw new HttpError(400, `Node ${id} has an invalid type.`)
    }
    if (typeof name !== "string" || !name.trim() || name.trim().length > MAX_NAME_LENGTH) {
      throw new HttpError(400, `Node ${id} has an invalid name.`)
    }
    if (!Array.isArray(children) || children.some((child) => typeof child !== "string")) {
      throw new HttpError(400, `Node ${id} has invalid children.`)
    }
    if (new Set(children).size !== children.length) {
      throw new HttpError(400, `Node ${id} contains duplicate child ids.`)
    }
    if (type === "document" && children.length > 0) {
      throw new HttpError(400, `Document node ${id} cannot contain children.`)
    }
    if (typeof updatedAt !== "string" || Number.isNaN(Date.parse(updatedAt))) {
      throw new HttpError(400, `Node ${id} has an invalid updatedAt timestamp.`)
    }

    let content: Record<string, unknown> | undefined
    if (type === "document") {
      if (!isRecord(rawNode.content) || rawNode.content.type !== "doc") {
        throw new HttpError(400, `Document node ${id} must contain Tiptap JSON.`)
      }
      content = rawNode.content
    }

    nodes[id] = {
      id,
      parentId,
      type,
      name: name.trim(),
      children: [...children],
      ...(content ? { content } : {}),
      updatedAt,
    }
  }

  const root = nodes.root
  if (!root || root.type !== "folder" || root.parentId !== null) {
    throw new HttpError(400, "The workspace must contain a root folder with a null parentId.")
  }

  for (const node of Object.values(nodes)) {
    for (const childId of node.children) {
      const child = nodes[childId]
      if (!child) throw new HttpError(400, `Node ${node.id} references a missing child.`)
      if (child.parentId !== node.id) {
        throw new HttpError(400, `Node ${child.id} does not reference its containing parent.`)
      }
    }

    if (node.id !== "root") {
      const parent = node.parentId ? nodes[node.parentId] : undefined
      if (!parent || parent.type !== "folder" || !parent.children.includes(node.id)) {
        throw new HttpError(400, `Node ${node.id} is not connected to a valid folder parent.`)
      }
    }
  }

  const visited = new Set<string>()
  const pending = ["root"]
  while (pending.length > 0) {
    const nodeId = pending.pop()!
    if (visited.has(nodeId)) throw new HttpError(400, "The workspace tree contains a cycle.")
    visited.add(nodeId)
    pending.push(...nodes[nodeId].children)
  }
  if (visited.size !== nodeEntries.length) {
    throw new HttpError(400, "Every workspace node must be reachable from the root folder.")
  }

  const activeDocumentId = value.activeDocumentId
  if (
    activeDocumentId !== null &&
    (typeof activeDocumentId !== "string" || nodes[activeDocumentId]?.type !== "document")
  ) {
    throw new HttpError(400, "activeDocumentId must reference a document or be null.")
  }

  if (
    !Array.isArray(value.expandedItems) ||
    value.expandedItems.some(
      (itemId) => typeof itemId !== "string" || nodes[itemId]?.type !== "folder",
    )
  ) {
    throw new HttpError(400, "expandedItems must only reference folder nodes.")
  }

  return {
    nodes,
    activeDocumentId,
    expandedItems: Array.from(new Set(value.expandedItems as string[])),
    lastSavedAt: validateTimestamp(value.lastSavedAt, "lastSavedAt"),
  }
}

const createAccessToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "")
}

const hashToken = async (token: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

const getBearerToken = (request: Request) => {
  const authorization = request.headers.get("authorization")
  const match = authorization?.match(/^Bearer\s+(.+)$/iu)
  if (!match || match[1].length < 32 || match[1].length > 256) {
    throw new HttpError(401, "A valid workspace access token is required.")
  }
  return match[1]
}

const authenticateWorkspace = async (request: Request, env: Env, workspaceId: string) => {
  const tokenHash = await hashToken(getBearerToken(request))
  const workspace = await env.DB.prepare(
    `SELECT id, name, revision, snapshot_json, updated_at
     FROM workspaces
     WHERE id = ? AND access_token_hash = ?`,
  )
    .bind(workspaceId, tokenHash)
    .first<WorkspaceRow>()

  if (!workspace) throw new HttpError(404, "Workspace not found.")
  return { workspace, tokenHash }
}

const parseStoredSnapshot = (workspace: WorkspaceRow): WorkspaceSnapshot => {
  try {
    return JSON.parse(workspace.snapshot_json) as WorkspaceSnapshot
  } catch {
    throw new HttpError(500, "Stored workspace data is invalid.")
  }
}

const createWorkspace = async (request: Request, env: Env, requestId: string) => {
  const body = await readJson(request)
  if (!isRecord(body)) throw new HttpError(400, "Request body must be an object.")

  const name = validateName(body.name)
  const snapshot = validateSnapshot(body.snapshot)
  const workspaceId = crypto.randomUUID()
  const accessToken = createAccessToken()
  const tokenHash = await hashToken(accessToken)
  const now = new Date().toISOString()

  await env.DB.prepare(
    `INSERT INTO workspaces (
       id, name, access_token_hash, revision, snapshot_json, created_at, updated_at
     ) VALUES (?, ?, ?, 1, ?, ?, ?)`,
  )
    .bind(workspaceId, name, tokenHash, JSON.stringify(snapshot), now, now)
    .run()

  return json(
    {
      workspaceId,
      accessToken,
      name,
      revision: 1,
      updatedAt: now,
      snapshot,
    },
    201,
    requestId,
  )
}

const getWorkspace = async (
  request: Request,
  env: Env,
  workspaceId: string,
  requestId: string,
) => {
  const { workspace } = await authenticateWorkspace(request, env, workspaceId)
  return json(
    {
      workspaceId: workspace.id,
      name: workspace.name,
      revision: workspace.revision,
      updatedAt: workspace.updated_at,
      snapshot: parseStoredSnapshot(workspace),
    },
    200,
    requestId,
  )
}

const updateWorkspace = async (
  request: Request,
  env: Env,
  workspaceId: string,
  requestId: string,
) => {
  const { workspace, tokenHash } = await authenticateWorkspace(request, env, workspaceId)
  const body = await readJson(request)
  if (!isRecord(body)) throw new HttpError(400, "Request body must be an object.")

  const baseRevision = body.baseRevision
  if (!Number.isInteger(baseRevision) || Number(baseRevision) < 1) {
    throw new HttpError(400, "baseRevision must be a positive integer.")
  }
  if (workspace.revision !== baseRevision) {
    throw new HttpError(409, "Workspace revision conflict.", {
      currentRevision: workspace.revision,
    })
  }

  const name = validateName(body.name, workspace.name)
  const snapshot = validateSnapshot(body.snapshot)
  const now = new Date().toISOString()

  const updated = await env.DB.prepare(
    `UPDATE workspaces
     SET name = ?, snapshot_json = ?, revision = revision + 1, updated_at = ?
     WHERE id = ? AND access_token_hash = ? AND revision = ?
     RETURNING revision, updated_at`,
  )
    .bind(name, JSON.stringify(snapshot), now, workspaceId, tokenHash, Number(baseRevision))
    .first<{ revision: number; updated_at: string }>()

  if (!updated) {
    const current = await env.DB.prepare(
      `SELECT revision FROM workspaces WHERE id = ? AND access_token_hash = ?`,
    )
      .bind(workspaceId, tokenHash)
      .first<{ revision: number }>()
    throw new HttpError(409, "Workspace revision conflict.", {
      currentRevision: current?.revision ?? workspace.revision,
    })
  }

  return json(
    {
      workspaceId,
      revision: updated.revision,
      updatedAt: updated.updated_at,
    },
    200,
    requestId,
  )
}

const deleteWorkspace = async (request: Request, env: Env, workspaceId: string) => {
  const { tokenHash } = await authenticateWorkspace(request, env, workspaceId)
  await env.DB.prepare(`DELETE FROM workspaces WHERE id = ? AND access_token_hash = ?`)
    .bind(workspaceId, tokenHash)
    .run()
  return empty(204)
}

const listRevisions = async (
  request: Request,
  env: Env,
  workspaceId: string,
  requestId: string,
) => {
  const { workspace } = await authenticateWorkspace(request, env, workspaceId)
  const result = await env.DB.prepare(
    `SELECT revision, created_at
     FROM workspace_revisions
     WHERE workspace_id = ?
     ORDER BY revision DESC
     LIMIT 50`,
  )
    .bind(workspaceId)
    .all<RevisionRow>()

  return json(
    {
      workspaceId,
      currentRevision: workspace.revision,
      revisions: result.results.map((revision) => ({
        revision: revision.revision,
        createdAt: revision.created_at,
      })),
    },
    200,
    requestId,
  )
}

const routeApiRequest = async (request: Request, env: Env, requestId: string) => {
  const url = new URL(request.url)
  const segments = url.pathname.split("/").filter(Boolean)

  if (request.method === "OPTIONS") {
    return empty(204, { Allow: "GET, POST, PUT, DELETE, OPTIONS" })
  }

  if (url.pathname === "/api/health" && request.method === "GET") {
    const database = await env.DB.prepare("SELECT 1 AS healthy").first<{ healthy: number }>()
    return json(
      {
        ok: database?.healthy === 1,
        service: "write-skill",
        environment: env.ENVIRONMENT,
        timestamp: new Date().toISOString(),
      },
      200,
      requestId,
    )
  }

  if (url.pathname === "/api/workspaces" && request.method === "POST") {
    return createWorkspace(request, env, requestId)
  }

  if (segments[0] === "api" && segments[1] === "workspaces" && segments[2]) {
    const workspaceId = decodeURIComponent(segments[2])

    if (segments.length === 3) {
      if (request.method === "GET") return getWorkspace(request, env, workspaceId, requestId)
      if (request.method === "PUT") return updateWorkspace(request, env, workspaceId, requestId)
      if (request.method === "DELETE") return deleteWorkspace(request, env, workspaceId)
    }

    if (segments.length === 4 && segments[3] === "revisions" && request.method === "GET") {
      return listRevisions(request, env, workspaceId, requestId)
    }
  }

  throw new HttpError(404, "API route not found.")
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request)

    const requestId = crypto.randomUUID()
    try {
      return await routeApiRequest(request, env, requestId)
    } catch (error) {
      if (error instanceof HttpError) {
        return json(
          {
            error: error.message,
            ...(error.details === undefined ? {} : { details: error.details }),
          },
          error.status,
          requestId,
        )
      }

      console.error("Unhandled Worker error", { requestId, error })
      return json({ error: "Internal server error." }, 500, requestId)
    }
  },
}
