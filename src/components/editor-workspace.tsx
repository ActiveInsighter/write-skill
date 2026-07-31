import * as React from "react"
import type { JSONContent } from "@tiptap/core"
import {
  Check,
  ChevronRight,
  CircleAlert,
  Cloud,
  CloudDownload,
  CloudOff,
  CloudUpload,
  FilePlus2,
  Folder,
  LoaderCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react"
import { useShallow } from "zustand/react/shallow"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  overwriteCloudWorkspace,
  reloadCloudWorkspace,
  retryCloudSync,
} from "@/lib/cloud-sync"
import { cn } from "@/lib/utils"
import { MAX_NODE_NAME_LENGTH } from "@/lib/workspace-snapshot"
import { useWorkspaceStore } from "@/store/workspace-store"
import type { CloudSyncStatus, WorkspaceNodes } from "@/types/document"

const SimpleEditor = React.lazy(async () => {
  const editorModule = await import("@/components/tiptap-templates/simple/simple-editor")
  return { default: editorModule.SimpleEditor }
})

const formatSavedTime = (value: string | null) => {
  if (!value) return "Saved locally"

  const savedAt = new Date(value)
  if (Number.isNaN(savedAt.getTime())) return "Saved locally"

  return `Saved ${new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(savedAt)}`
}

const getDocumentPath = (nodes: WorkspaceNodes, documentId: string) => {
  const path: string[] = []
  const visited = new Set<string>()
  let parentId = nodes[documentId]?.parentId ?? null

  while (parentId && parentId !== "root" && !visited.has(parentId)) {
    visited.add(parentId)
    const parent = nodes[parentId]
    if (!parent) break
    path.unshift(parent.name)
    parentId = parent.parentId
  }

  return path
}

const cloudStatusDetails: Record<
  CloudSyncStatus,
  { label: string; icon: typeof Cloud; className?: string }
> = {
  local: { label: "Local only", icon: CloudOff },
  connecting: { label: "Connecting", icon: LoaderCircle },
  syncing: { label: "Syncing", icon: LoaderCircle },
  synced: { label: "Cloud synced", icon: Cloud, className: "text-success" },
  offline: { label: "Offline", icon: CloudOff, className: "text-warning" },
  conflict: { label: "Sync conflict", icon: CircleAlert, className: "text-warning" },
  error: { label: "Sync error", icon: CircleAlert, className: "text-destructive" },
}

function EditorLoadingState() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background" role="status" aria-live="polite">
      <div className="flex h-12 shrink-0 items-center justify-center border-b px-4">
        <div className="h-7 w-full max-w-xl animate-pulse rounded-md bg-muted" />
      </div>
      <div className="mx-auto w-full max-w-[780px] flex-1 px-6 py-12 sm:px-10">
        <div className="h-8 w-2/3 animate-pulse rounded-md bg-muted" />
        <div className="mt-7 space-y-3">
          <div className="h-3 w-full animate-pulse rounded bg-muted/80" />
          <div className="h-3 w-11/12 animate-pulse rounded bg-muted/80" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-muted/80" />
        </div>
        <span className="sr-only">Loading editor</span>
      </div>
    </div>
  )
}

interface EditorErrorBoundaryProps {
  children: React.ReactNode
  resetKey: string
}

interface EditorErrorBoundaryState {
  error: Error | null
}

class EditorErrorBoundary extends React.Component<
  EditorErrorBoundaryProps,
  EditorErrorBoundaryState
> {
  state: EditorErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): EditorErrorBoundaryState {
    return { error }
  }

  componentDidUpdate(previousProps: EditorErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-background p-6" role="alert">
        <div className="w-full max-w-md rounded-2xl border bg-card p-7 text-center shadow-sm">
          <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <CircleAlert className="size-4" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-base font-semibold tracking-tight">Editor could not be opened</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Your document remains saved. Reload the application to retry loading the editor.
          </p>
          <Button type="button" className="mt-5" onClick={() => window.location.reload()}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Reload editor
          </Button>
        </div>
      </div>
    )
  }
}

const ActiveDocumentEditor = React.memo(function ActiveDocumentEditor({
  documentId,
}: {
  documentId: string
}) {
  const content = useWorkspaceStore((state) => {
    const node = state.nodes[documentId]
    return node?.type === "document" ? node.content : undefined
  })
  const updateDocumentContent = useWorkspaceStore((state) => state.updateDocumentContent)
  const handleUpdate = React.useCallback(
    (nextContent: JSONContent) => updateDocumentContent(documentId, nextContent),
    [documentId, updateDocumentContent],
  )

  if (!content) return null

  return (
    <EditorErrorBoundary resetKey={documentId}>
      <React.Suspense fallback={<EditorLoadingState />}>
        <SimpleEditor key={documentId} content={content} onUpdate={handleUpdate} />
      </React.Suspense>
    </EditorErrorBoundary>
  )
})

export function EditorWorkspace() {
  const activeDocument = useWorkspaceStore(
    useShallow((state) => {
      const documentId = state.activeDocumentId
      const node = documentId ? state.nodes[documentId] : undefined

      return node?.type === "document"
        ? { id: node.id, name: node.name }
        : null
    }),
  )
  const documentPath = useWorkspaceStore(
    useShallow((state) =>
      activeDocument ? getDocumentPath(state.nodes, activeDocument.id) : [],
    ),
  )
  const lastSavedAt = useWorkspaceStore((state) => state.lastSavedAt)
  const cloudStatus = useWorkspaceStore((state) => state.cloudStatus)
  const cloudError = useWorkspaceStore((state) => state.cloudError)
  const remoteRevision = useWorkspaceStore((state) => state.remoteRevision)
  const createDocument = useWorkspaceStore((state) => state.createDocument)
  const renameNode = useWorkspaceStore((state) => state.renameNode)

  const [title, setTitle] = React.useState(activeDocument?.name ?? "")
  const cloudDetails = cloudStatusDetails[cloudStatus]
  const CloudIcon = cloudDetails.icon
  const isCloudBusy = cloudStatus === "connecting" || cloudStatus === "syncing"

  React.useEffect(() => {
    setTitle(activeDocument?.name ?? "")
  }, [activeDocument?.id, activeDocument?.name])

  const commitTitle = () => {
    if (!activeDocument) return
    const nextTitle = title.trim()
    if (nextTitle) renameNode(activeDocument.id, nextTitle)
    else setTitle(activeDocument.name)
  }

  const useCloudCopy = () => {
    const confirmed = window.confirm(
      "Replace the local workspace with the cloud copy? Local changes that are not in the cloud will be discarded.",
    )
    if (confirmed) void reloadCloudWorkspace()
  }

  const keepLocalCopy = () => {
    const confirmed = window.confirm(
      "Replace the cloud workspace with this browser's local copy? The current cloud copy will be archived as a revision.",
    )
    if (confirmed) void overwriteCloudWorkspace()
  }

  if (!activeDocument) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur md:px-4">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <Separator orientation="vertical" className="mx-1 h-4 shrink-0" />
          <span className="text-sm font-medium tracking-[-0.01em]">Write Skill</span>
        </header>
        <main className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-muted/30 p-5 sm:p-6">
          <div className="w-full max-w-sm rounded-2xl border bg-background p-7 text-center shadow-sm sm:p-8">
            <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="size-4" aria-hidden="true" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">Choose a document</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Select a document in the sidebar or create a new one to start writing.
            </p>
            <Button type="button" className="mt-5" onClick={() => createDocument()}>
              <FilePlus2 className="size-4" aria-hidden="true" />
              Create document
            </Button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <span role="status" aria-live="polite" className="sr-only">
        {cloudError ? `${cloudDetails.label}: ${cloudError}` : cloudDetails.label}
      </span>

      <header className="flex h-16 min-w-0 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur md:px-4">
        <SidebarTrigger className="-ml-1 shrink-0" />
        <Separator orientation="vertical" className="mx-1 h-5 shrink-0" />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <div
            className="hidden min-w-0 items-center gap-1 overflow-hidden px-2 text-[0.68rem] text-muted-foreground sm:flex"
            aria-label="Document location"
          >
            <Folder className="size-3 shrink-0" aria-hidden="true" />
            <span className="shrink-0">Workspace</span>
            {documentPath.map((segment, index) => (
              <React.Fragment key={`${segment}-${index}`}>
                <ChevronRight className="size-3 shrink-0 opacity-55" aria-hidden="true" />
                <span className="truncate">{segment}</span>
              </React.Fragment>
            ))}
          </div>
          <input
            value={title}
            maxLength={MAX_NODE_NAME_LENGTH}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur()
              if (event.key === "Escape") {
                setTitle(activeDocument.name)
                event.currentTarget.blur()
              }
            }}
            aria-label="Document title"
            className="block h-7 w-full min-w-0 truncate rounded-md bg-transparent px-2 text-sm font-semibold tracking-[-0.01em] outline-none transition-colors hover:bg-muted/60 focus:bg-muted md:max-w-xl"
          />
        </div>

        <div className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground xl:flex">
          <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-background px-2.5 py-1">
            <Check className="size-3.5 text-success" aria-hidden="true" />
            {formatSavedTime(lastSavedAt)}
          </span>
          <button
            type="button"
            onClick={retryCloudSync}
            disabled={isCloudBusy || cloudStatus === "conflict"}
            title={
              cloudError ??
              (remoteRevision ? `Cloud revision ${remoteRevision}` : "Cloud workspace not created yet")
            }
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-background px-2.5 py-1 transition-colors hover:bg-muted disabled:cursor-default disabled:opacity-70"
          >
            <CloudIcon
              className={cn(
                "size-3.5",
                cloudDetails.className,
                isCloudBusy && "animate-spin",
              )}
              aria-hidden="true"
            />
            {cloudDetails.label}
          </button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 xl:hidden"
          aria-label={cloudDetails.label}
          title={cloudError ?? cloudDetails.label}
          onClick={retryCloudSync}
          disabled={isCloudBusy || cloudStatus === "conflict"}
        >
          <CloudIcon
            className={cn(
              "size-4",
              cloudDetails.className,
              isCloudBusy && "animate-spin",
            )}
            aria-hidden="true"
          />
        </Button>
      </header>

      {cloudStatus === "conflict" && (
        <div
          role="alert"
          className="flex shrink-0 flex-col gap-3 border-b border-warning/30 bg-warning/10 px-4 py-3 text-foreground sm:flex-row sm:items-center"
        >
          <CircleAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Local and cloud copies both changed</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Choose a copy explicitly. Nothing will be overwritten automatically.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={useCloudCopy}
            >
              <CloudDownload className="size-3.5" aria-hidden="true" />
              Use cloud
            </Button>
            <Button
              type="button"
              size="sm"
              className="w-full sm:w-auto"
              onClick={keepLocalCopy}
            >
              <CloudUpload className="size-3.5" aria-hidden="true" />
              Keep local
            </Button>
          </div>
        </div>
      )}

      <main className="editor-stage min-h-0 min-w-0 flex-1 overflow-hidden p-2 sm:p-3 lg:p-4">
        <section className="editor-frame mx-auto h-full min-h-0 w-full min-w-0 max-w-[1240px] overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_12px_40px_-24px_rgba(28,25,23,0.28)]">
          <ActiveDocumentEditor documentId={activeDocument.id} />
        </section>
      </main>
    </div>
  )
}
