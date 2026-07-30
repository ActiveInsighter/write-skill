PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  selected_document_id TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nodes (
  workspace_id TEXT NOT NULL,
  id TEXT NOT NULL,
  parent_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('folder', 'document')),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  content TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, parent_id)
    REFERENCES nodes(workspace_id, id)
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED,
  CHECK (
    (kind = 'folder' AND content IS NULL) OR
    (kind = 'document' AND content IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_nodes_parent_position
  ON nodes(workspace_id, parent_id, position);

CREATE INDEX IF NOT EXISTS idx_nodes_kind_updated
  ON nodes(workspace_id, kind, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspaces_updated
  ON workspaces(updated_at DESC);
