import { HttpError } from "./http"
import type {
  NodeRow,
  NodeUpsertPayload,
  WorkspaceRow,
  WorkspaceSnapshotPayload,
  WorkspaceSnapshotResponse,
} from "./types"

interface TreeLinkRow {
  id: string
  parent_id: string | null
  kind: "folder" | "document"
}

export class WorkspaceRepository {
  constructor(private readonly db: D1Database) {}

  async health(): Promise<void> {
    const row = await this.db.prepare("SELECT 1 AS ok").first<{ ok: number }>()
    if (row?.ok !== 1) throw new Error("D1 health check failed")
  }

  async hasWorkspace(workspaceId: string): Promise<boolean> {
    const row = await this.db
      .prepare("SELECT id FROM workspaces WHERE id = ?1 LIMIT 1")
      .bind(workspaceId)
      .first<{ id: string }>()
    return Boolean(row)
  }

  async getSnapshot(workspaceId: string): Promise<WorkspaceSnapshotResponse> {
    const workspace = await this.db
      .prepare(
        `SELECT id, selected_document_id, revision, created_at, updated_at
         FROM workspaces WHERE id = ?1 LIMIT 1`,
      )
      .bind(workspaceId)
      .first<WorkspaceRow>()

    if (!workspace) {
      throw new HttpError(404, "workspace_not_found", "当前浏览器还没有云端工作区。")
    }

    const result = await this.db
      .prepare(
        `SELECT workspace_id, id, parent_id, kind, name, position, content,
                version, created_at, updated_at
         FROM nodes
         WHERE workspace_id = ?1
         ORDER BY CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END,
                  parent_id, position, created_at`,
      )
      .bind(workspaceId)
      .all<NodeRow>()

    const nodes: WorkspaceSnapshotResponse["nodes"] = {}
    for (const row of result.results) {
      nodes[row.id] = {
        id: row.id,
        name: row.name,
        kind: row.kind,
        ...(row.kind === "folder" ? { children: [] } : { content: row.content ?? "" }),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    }
    for (const row of result.results) {
      if (!row.parent_id) continue
      const parent = nodes[row.parent_id]
      if (parent?.kind === "folder") parent.children?.push(row.id)
    }

    return {
      nodes,
      selectedDocumentId: workspace.selected_document_id,
      revision: workspace.revision,
      createdAt: workspace.created_at,
      updatedAt: workspace.updated_at,
    }
  }

  async replaceWorkspace(
    workspaceId: string,
    snapshot: WorkspaceSnapshotPayload,
  ): Promise<WorkspaceSnapshotResponse> {
    const now = new Date().toISOString()
    const orderedNodes = this.flattenNodes(snapshot)
    const statements: D1PreparedStatement[] = [
      this.db
        .prepare(
          `INSERT INTO workspaces (
             id, selected_document_id, revision, created_at, updated_at
           ) VALUES (?1, ?2, 1, ?3, ?3)
           ON CONFLICT(id) DO UPDATE SET
             selected_document_id = excluded.selected_document_id,
             revision = workspaces.revision + 1,
             updated_at = excluded.updated_at`,
        )
        .bind(workspaceId, snapshot.selectedDocumentId, now),
      this.db
        .prepare("DELETE FROM nodes WHERE workspace_id = ?1")
        .bind(workspaceId),
    ]

    for (const entry of orderedNodes) {
      statements.push(
        this.db
          .prepare(
            `INSERT INTO nodes (
               workspace_id, id, parent_id, kind, name, position, content,
               version, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8, ?9)`,
          )
          .bind(
            workspaceId,
            entry.node.id,
            entry.parentId,
            entry.node.kind,
            entry.node.name,
            entry.position,
            entry.node.kind === "document" ? entry.node.content ?? "" : null,
            entry.node.createdAt,
            entry.node.updatedAt,
          ),
      )
    }

    await this.db.batch(statements)
    return this.getSnapshot(workspaceId)
  }

  async upsertNode(
    workspaceId: string,
    payload: NodeUpsertPayload,
  ): Promise<number> {
    const { node, parentId, position } = payload
    if (!parentId) {
      throw new HttpError(400, "invalid_parent", "父节点不能为空。")
    }
    const treeRows = await this.getTreeLinks(workspaceId)
    const linksById = new Map(treeRows.map((row) => [row.id, row]))
    if (linksById.get(parentId)?.kind !== "folder") {
      throw new HttpError(400, "invalid_parent", "父节点不存在或不是文件夹。")
    }
    if (node.kind === "folder") {
      this.assertNoCycle(linksById, node.id, parentId)
    }

    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO nodes (
             workspace_id, id, parent_id, kind, name, position, content,
             version, created_at, updated_at
           ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8, ?9)
           ON CONFLICT(workspace_id, id) DO UPDATE SET
             parent_id = excluded.parent_id,
             kind = excluded.kind,
             name = excluded.name,
             position = excluded.position,
             content = excluded.content,
             version = nodes.version + 1,
             updated_at = excluded.updated_at`,
        )
        .bind(
          workspaceId,
          node.id,
          parentId,
          node.kind,
          node.name,
          position,
          node.kind === "document" ? node.content ?? "" : null,
          node.createdAt,
          node.updatedAt,
        ),
      this.bumpRevisionStatement(workspaceId),
    ])
    return this.getRevision(workspaceId)
  }

  async deleteNode(workspaceId: string, nodeId: string): Promise<number> {
    if (nodeId === "root") {
      throw new HttpError(400, "root_immutable", "root 节点不能删除。")
    }

    await this.db.batch([
      this.db
        .prepare("DELETE FROM nodes WHERE workspace_id = ?1 AND id = ?2")
        .bind(workspaceId, nodeId),
      this.db
        .prepare(
          `UPDATE workspaces
           SET selected_document_id = CASE
                 WHEN EXISTS (
                   SELECT 1 FROM nodes n
                   WHERE n.workspace_id = ?1
                     AND n.id = workspaces.selected_document_id
                     AND n.kind = 'document'
                 ) THEN workspaces.selected_document_id
                 ELSE COALESCE((
                   SELECT n2.id FROM nodes n2
                   WHERE n2.workspace_id = ?1 AND n2.kind = 'document'
                   ORDER BY n2.updated_at DESC LIMIT 1
                 ), '')
               END,
               revision = revision + 1,
               updated_at = ?2
           WHERE id = ?1`,
        )
        .bind(workspaceId, new Date().toISOString()),
    ])
    return this.getRevision(workspaceId)
  }

  async reorderChildren(
    workspaceId: string,
    parentId: string,
    children: string[],
  ): Promise<number> {
    const treeRows = await this.getTreeLinks(workspaceId)
    const linksById = new Map(treeRows.map((row) => [row.id, row]))
    if (linksById.get(parentId)?.kind !== "folder") {
      throw new HttpError(400, "invalid_parent", "目标节点不存在或不是文件夹。")
    }

    for (const childId of children) {
      const child = linksById.get(childId)
      if (!child || childId === "root") {
        throw new HttpError(400, "invalid_child", `子节点 ${childId} 不存在或不能移动。`)
      }
      if (child.kind === "folder") {
        this.assertNoCycle(linksById, childId, parentId)
      }
    }

    const now = new Date().toISOString()
    const statements = children.map((childId, position) =>
      this.db
        .prepare(
          `UPDATE nodes
           SET parent_id = ?3, position = ?4, updated_at = ?5, version = version + 1
           WHERE workspace_id = ?1 AND id = ?2`,
        )
        .bind(workspaceId, childId, parentId, position, now),
    )
    statements.push(this.bumpRevisionStatement(workspaceId))
    await this.db.batch(statements)
    return this.getRevision(workspaceId)
  }

  async updateSelection(
    workspaceId: string,
    selectedDocumentId: string,
  ): Promise<number> {
    const document = await this.db
      .prepare(
        `SELECT id FROM nodes
         WHERE workspace_id = ?1 AND id = ?2 AND kind = 'document' LIMIT 1`,
      )
      .bind(workspaceId, selectedDocumentId)
      .first<{ id: string }>()
    if (!document) {
      throw new HttpError(400, "invalid_selection", "选中的文档不存在。")
    }

    await this.db
      .prepare(
        `UPDATE workspaces
         SET selected_document_id = ?2, revision = revision + 1, updated_at = ?3
         WHERE id = ?1`,
      )
      .bind(workspaceId, selectedDocumentId, new Date().toISOString())
      .run()
    return this.getRevision(workspaceId)
  }

  private async getTreeLinks(workspaceId: string): Promise<TreeLinkRow[]> {
    const result = await this.db
      .prepare(
        `SELECT id, parent_id, kind
         FROM nodes
         WHERE workspace_id = ?1`,
      )
      .bind(workspaceId)
      .all<TreeLinkRow>()
    return result.results
  }

  private assertNoCycle(
    linksById: Map<string, TreeLinkRow>,
    movingFolderId: string,
    targetParentId: string,
  ): void {
    let cursor: string | null = targetParentId
    const visited = new Set<string>()
    while (cursor) {
      if (cursor === movingFolderId) {
        throw new HttpError(400, "tree_cycle", "移动操作会造成目录循环。")
      }
      if (visited.has(cursor)) {
        throw new HttpError(409, "corrupt_tree", "云端目录树已存在循环引用。")
      }
      visited.add(cursor)
      cursor = linksById.get(cursor)?.parent_id ?? null
    }
  }

  private bumpRevisionStatement(workspaceId: string): D1PreparedStatement {
    return this.db
      .prepare(
        `UPDATE workspaces
         SET revision = revision + 1, updated_at = ?2
         WHERE id = ?1`,
      )
      .bind(workspaceId, new Date().toISOString())
  }

  private async getRevision(workspaceId: string): Promise<number> {
    const row = await this.db
      .prepare("SELECT revision FROM workspaces WHERE id = ?1 LIMIT 1")
      .bind(workspaceId)
      .first<{ revision: number }>()
    if (!row) {
      throw new HttpError(404, "workspace_not_found", "云端工作区不存在。")
    }
    return row.revision
  }

  private flattenNodes(snapshot: WorkspaceSnapshotPayload) {
    const ordered: Array<{
      node: WorkspaceSnapshotPayload["nodes"][string]
      parentId: string | null
      position: number
    }> = []

    const visit = (nodeId: string, parentId: string | null, position: number) => {
      const node = snapshot.nodes[nodeId]
      ordered.push({ node, parentId, position })
      if (node.kind === "folder") {
        node.children?.forEach((childId, childPosition) => {
          visit(childId, node.id, childPosition)
        })
      }
    }
    visit("root", null, 0)
    return ordered
  }
}
