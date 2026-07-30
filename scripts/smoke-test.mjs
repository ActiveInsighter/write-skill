import assert from "node:assert/strict"

const baseUrl = process.argv[2]?.replace(/\/$/u, "")
if (!baseUrl) throw new Error("Usage: node scripts/smoke-test.mjs <deployment-url>")

const requestJson = async (path, init = {}) => {
  const response = await fetch(`${baseUrl}${path}`, init)
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(
      `${init.method ?? "GET"} ${path} failed (${response.status}): ${JSON.stringify(payload)}`,
    )
  }
  return { response, payload }
}

const now = new Date().toISOString()
const initialSnapshot = {
  nodes: {
    root: {
      id: "root",
      parentId: null,
      type: "folder",
      name: "Smoke test workspace",
      children: ["doc-smoke"],
      updatedAt: now,
    },
    "doc-smoke": {
      id: "doc-smoke",
      parentId: "root",
      type: "document",
      name: "Smoke test document",
      children: [],
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Revision one" }] }],
      },
      updatedAt: now,
    },
  },
  activeDocumentId: "doc-smoke",
  expandedItems: ["root"],
  lastSavedAt: now,
}

let workspaceId
let accessToken

try {
  const health = await requestJson("/api/health")
  assert.equal(health.payload.ok, true)
  assert.equal(health.payload.service, "write-skill")

  const created = await requestJson("/api/workspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Deployment smoke test",
      snapshot: initialSnapshot,
    }),
  })

  workspaceId = created.payload.workspaceId
  accessToken = created.payload.accessToken
  assert.equal(created.response.status, 201)
  assert.equal(created.payload.revision, 1)
  assert.ok(workspaceId)
  assert.ok(accessToken)

  const authorization = { Authorization: `Bearer ${accessToken}` }
  const fetched = await requestJson(`/api/workspaces/${workspaceId}`, {
    headers: authorization,
  })
  assert.equal(fetched.payload.revision, 1)
  assert.equal(fetched.payload.snapshot.nodes["doc-smoke"].name, "Smoke test document")

  const updatedAt = new Date().toISOString()
  const nextSnapshot = structuredClone(initialSnapshot)
  nextSnapshot.nodes["doc-smoke"].name = "Updated smoke test document"
  nextSnapshot.nodes["doc-smoke"].updatedAt = updatedAt
  nextSnapshot.nodes["doc-smoke"].content.content[0].content[0].text = "Revision two"
  nextSnapshot.nodes.root.updatedAt = updatedAt
  nextSnapshot.lastSavedAt = updatedAt

  const updated = await requestJson(`/api/workspaces/${workspaceId}`, {
    method: "PUT",
    headers: {
      ...authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      baseRevision: 1,
      name: "Deployment smoke test",
      snapshot: nextSnapshot,
    }),
  })
  assert.equal(updated.payload.revision, 2)

  const revisions = await requestJson(`/api/workspaces/${workspaceId}/revisions`, {
    headers: authorization,
  })
  assert.equal(revisions.payload.currentRevision, 2)
  assert.ok(revisions.payload.revisions.some((revision) => revision.revision === 1))

  const removed = await fetch(`${baseUrl}/api/workspaces/${workspaceId}`, {
    method: "DELETE",
    headers: authorization,
  })
  assert.equal(removed.status, 204)
  workspaceId = undefined

  console.log(`Smoke test passed for ${baseUrl}`)
} finally {
  if (workspaceId && accessToken) {
    await fetch(`${baseUrl}/api/workspaces/${workspaceId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => undefined)
  }
}
