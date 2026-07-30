const MAX_JSON_BODY_BYTES = 12 * 1024 * 1024

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export function jsonResponse(
  data: unknown,
  init: ResponseInit = {},
): Response {
  const headers = new Headers(init.headers)
  headers.set("content-type", "application/json; charset=utf-8")
  headers.set("cache-control", "no-store")
  headers.set("x-content-type-options", "nosniff")
  return new Response(JSON.stringify(data), { ...init, headers })
}

export async function readJson<T>(request: Request): Promise<T> {
  const lengthHeader = request.headers.get("content-length")
  const contentLength = lengthHeader ? Number(lengthHeader) : 0
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BODY_BYTES) {
    throw new HttpError(413, "payload_too_large", "请求数据超过 12 MB 限制。")
  }

  const contentType = request.headers.get("content-type") ?? ""
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "unsupported_media_type", "请求必须使用 application/json。")
  }

  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BODY_BYTES) {
    throw new HttpError(413, "payload_too_large", "请求数据超过 12 MB 限制。")
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new HttpError(400, "invalid_json", "JSON 请求体格式无效。")
  }
}

export function assertSameOrigin(request: Request): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin) {
    throw new HttpError(403, "origin_not_allowed", "不允许跨站修改工作区。")
  }
}

export function getPathId(pathname: string, prefix: string): string | null {
  if (!pathname.startsWith(prefix)) return null
  const encoded = pathname.slice(prefix.length)
  if (!encoded || encoded.includes("/")) return null
  try {
    return decodeURIComponent(encoded)
  } catch {
    throw new HttpError(400, "invalid_path", "路径参数格式无效。")
  }
}

export function methodNotAllowed(allowed: string[]): Response {
  return jsonResponse(
    { error: { code: "method_not_allowed", message: "请求方法不受支持。" } },
    { status: 405, headers: { allow: allowed.join(", ") } },
  )
}
