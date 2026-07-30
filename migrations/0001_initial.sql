PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  access_token_hash TEXT NOT NULL CHECK (length(access_token_hash) = 64),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS workspaces_updated_at_idx
  ON workspaces(updated_at DESC);

CREATE TABLE IF NOT EXISTS workspace_revisions (
  workspace_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  created_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, revision),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS workspace_revisions_created_at_idx
  ON workspace_revisions(workspace_id, created_at DESC);

CREATE TRIGGER IF NOT EXISTS archive_workspace_revision
BEFORE UPDATE OF snapshot_json ON workspaces
WHEN OLD.snapshot_json <> NEW.snapshot_json
BEGIN
  INSERT OR IGNORE INTO workspace_revisions (
    workspace_id,
    revision,
    snapshot_json,
    created_at
  ) VALUES (
    OLD.id,
    OLD.revision,
    OLD.snapshot_json,
    OLD.updated_at
  );
END;

CREATE TRIGGER IF NOT EXISTS prune_workspace_revisions
AFTER INSERT ON workspace_revisions
BEGIN
  DELETE FROM workspace_revisions
  WHERE workspace_id = NEW.workspace_id
    AND revision <= NEW.revision - 50;
END;
