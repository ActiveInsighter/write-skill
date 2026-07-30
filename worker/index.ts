import {
  assertSameOrigin,
  getPathId,
  HttpError,
  jsonResponse,
  methodNotAllowed,
  readJson,
} from "./http"
import type { WorkspaceSnapshotPayload } from "./types"
import {
  validateChildren,
  validateNodeUpsert,
  validateSelectedDocument,
  validateSnapshot,
} from "./validation"
import { WorkspaceRepository } from "./workspace-repository"

const WORKSPACE_COOKIE = "__Host-write_skill_workspace"
const WORKSPACE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function readCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie")
  if (!cookie) return null
  for (const pair of cookie.split(";")) {
    const [key, ...value] = pair.trim().split("=")
    if (key === name) return decodeURIComponent(value.join("="))
  }
  return null
}

function getWorkspaceId(request: Request): string | null {
  const value = readCookie(request, WORKSPACE_COOKIE)
  return value && WORKSPACE_ID_PATTERN.test(value) ? value : null
}

function workspaceCookie(workspaceId: string): string {
  return `${WORKSPACE_COOKIE}=${encodeURIComponent(workspaceId)}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`
}

function requireWorkspaceId(request: Request): string {
  const workspaceId = getWorkspaceId(request)
  if (!workspaceId) {
    throw new HttpError(
      401,
      "workspace_not_initialized",
      "请先初始化当前浏览器的云端工作区。",
    )
  }
  return workspaceId
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  assertSameOrigin(request)
  const url = new URL(request.url)
  const repository = new WorkspaceRepository(env.DB)

  if (url.pathname === "/api/health") {
    if (request.method !== "GET") return methodNotAllowed(["GET"])
    await repository.health()
    return jsonResponse({ ok: true, service: "write-skill", database: "connected" })
  }

  if (url.pathname === "/api/workspaces/bootstrap") {
    if (request.method !== "POST") return methodNotAllowed(["POST"])
    const snapshot = validateSnapshot(
      await readJson<WorkspaceSnapshotPayload>(request),
    )
    const existingWorkspaceId = getWorkspaceId(request)
    const workspaceId = existingWorkspaceId ?? crypto.randomUUID()
    const exists = await repository.hasWorkspace(workspaceId)
    const workspace = exists
      ? await repository.getSnapshot(workspaceId)
      : await repository.replaceWorkspace(workspaceId, snapshot)

    return jsonResponse(
      { workspace, created: !exists },
      {
        status: exists ? 200 : 201,
        headers: existingWorkspaceId
          ? undefined
          : { "set-cookie": workspaceCookie(workspaceId) },
      },
    )
  }

  if (url.pathname === "/api/workspaces/current") {
    const workspaceId = requireWorkspaceId(request)
    if (request.method === "GET") {
      return jsonResponse({ workspace: await repository.getSnapshot(workspaceId) })
    }
    if (request.method === "PUT") {
      const selectedDocumentId = validateSelectedDocument(
        await readJson<unknown>(request),
      )
      const revision = await repository.updateSelection(
        workspaceId,
        selectedDocumentId,
      )
      return jsonResponse({ revision, syncedAt: new Date().toISOString() })
    }
    return methodNotAllowed(["GET", "PUT"])
  }

  if (url.pathname === "/api/workspaces/current/snapshot") {
    if (request.method !== "PUT") return methodNotAllowed(["PUT"])
    const workspaceId = requireWorkspaceId(request)
    const snapshot = validateSnapshot(await readJson<unknown>(request))
    const workspace = await repository.replaceWorkspace(workspaceId, snapshot)
    return jsonResponse({ workspace })
  }

  const nodeId = getPathId(url.pathname, "/api/nodes/")
  if (nodeId) {
    const workspaceId = requireWorkspaceId(request)
    if (request.method === "PUT") {
      const payload = validateNodeUpsert(await readJson<unknown>(request))
      if (payload.node.id !== nodeId) {
        throw new HttpError(400, "node_id_mismatch", "路径 ID 与节点 ID 不一致。")
      }
      const revision = await repository.upsertNode(workspaceId, payload)
      return jsonResponse({ revision, syncedAt: new Date().toISOString() })
    }
    if (request.method === "DELETE") {
      const revision = await repository.deleteNode(workspaceId, nodeId)
      return jsonResponse({ revision, syncedAt: new Date().toISOString() })
    }
    return methodNotAllowed(["PUT", "DELETE"])
  }

  const folderId = getPathId(url.pathname, "/api/folders/")
  if (folderId && url.searchParams.get("operation") === "children") {
    if (request.method !== "PUT") return methodNotAllowed(["PUT"])
    const workspaceId = requireWorkspaceId(request)
    const children = validateChildren(await readJson<unknown>(request))
    const revision = await repository.reorderChildren(
      workspaceId,
      folderId,
      children,
    )
    return jsonResponse({ revision, syncedAt: new Date().toISOString() })
  }

  throw new HttpError(404, "not_found", "API 路径不存在。")
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request)
    }

    try {
      return await handleApi(request, env)
    } catch (error) {
      if (error instanceof HttpError) {
        return jsonResponse(
          { error: { code: error.code, message: error.message } },
          { status: error.status },
        )
      }
      console.error("Unhandled Worker error", error)
      return jsonResponse(
        {
          error: {
            code: "internal_error",
            message: "服务器暂时无法处理请求。",
          },
        },
        { status: 500 },
      )
    }
  },
} satisfies ExportedHandler<Env>
