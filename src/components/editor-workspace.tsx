import * as React from "react"
import {
  Check,
  CircleAlert,
  Cloud,
  CloudOff,
  LoaderCircle,
  MoreHorizontal,
  Share2,
  Sparkles,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor"
import { retryCloudSync } from "@/lib/cloud-sync"
import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/store/workspace-store"
import type { CloudSyncStatus } from "@/types/document"

const formatSavedTime = (value: string | null) => {
  if (!value) return "Saved locally"
  return `Saved ${new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))}`
}

const cloudStatusDetails: Record<
  CloudSyncStatus,
  { label: string; icon: typeof Cloud; className?: string }
> = {
  local: { label: "Local only", icon: CloudOff },
  connecting: { label: "Connecting", icon: LoaderCircle },
  syncing: { label: "Syncing", icon: LoaderCircle },
  synced: { label: "Cloud synced", icon: Cloud, className: "text-emerald-600" },
  offline: { label: "Offline", icon: CloudOff, className: "text-amber-600" },
  conflict: { label: "Sync conflict", icon: CircleAlert, className: "text-amber-600" },
  error: { label: "Sync error", icon: CircleAlert, className: "text-destructive" },
}

export function EditorWorkspace() {
  const activeDocumentId = useWorkspaceStore((state) => state.activeDocumentId)
  const nodes = useWorkspaceStore((state) => state.nodes)
  const lastSavedAt = useWorkspaceStore((state) => state.lastSavedAt)
  const cloudStatus = useWorkspaceStore((state) => state.cloudStatus)
  const cloudError = useWorkspaceStore((state) => state.cloudError)
  const remoteRevision = useWorkspaceStore((state) => state.remoteRevision)
  const renameNode = useWorkspaceStore((state) => state.renameNode)
  const updateDocumentContent = useWorkspaceStore((state) => state.updateDocumentContent)

  const activeDocument = activeDocumentId ? nodes[activeDocumentId] : undefined
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

  if (!activeDocument || activeDocument.type !== "document") {
    return (
      <main className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.92),transparent_42%),linear-gradient(135deg,#f4f2ed,#eeece7)] p-6">
        <div className="max-w-sm rounded-3xl border border-black/5 bg-white/72 p-8 text-center shadow-[0_20px_80px_-45px_rgba(24,24,27,0.45)] backdrop-blur-xl">
          <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-2xl bg-zinc-950 text-white">
            <Sparkles className="size-5" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Choose a document</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Select a document in the sidebar or create a new one to start writing.
          </p>
        </div>
      </main>
    )
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex h-14 min-w-0 shrink-0 items-center gap-2 border-b border-border/70 bg-background/88 px-3 backdrop-blur-xl md:px-4">
        <SidebarTrigger className="-ml-1 shrink-0" />
        <Separator orientation="vertical" className="mx-1 h-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <input
            value={title}
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
            className="block h-8 w-full min-w-0 truncate rounded-lg bg-transparent px-2 text-sm font-medium tracking-[-0.01em] outline-none transition-colors hover:bg-muted/55 focus:bg-muted/70 md:max-w-md"
          />
        </div>

        <div className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground lg:flex">
          <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border/75 bg-background/75 px-2.5 py-1">
            <Check className="size-3.5 text-emerald-600" aria-hidden="true" />
            {formatSavedTime(lastSavedAt)}
          </span>
          <button
            type="button"
            onClick={retryCloudSync}
            title={
              cloudError ??
              (remoteRevision ? `Cloud revision ${remoteRevision}` : "Cloud workspace not created yet")
            }
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border/75 bg-background/75 px-2.5 py-1 transition-colors hover:bg-muted"
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
          className="size-8 shrink-0 lg:hidden"
          aria-label={cloudDetails.label}
          title={cloudError ?? cloudDetails.label}
          onClick={retryCloudSync}
        >
          <CloudIcon
            className={cn(
              "size-4",
              cloudDetails.className,
              isCloudBusy && "animate-spin",
            )}
          />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="hidden shrink-0 gap-1.5 shadow-none xl:inline-flex"
        >
          <Share2 className="size-3.5" />
          Share
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label="More actions"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </header>

      <main className="editor-stage min-h-0 min-w-0 flex-1 overflow-hidden p-2 sm:p-3 lg:p-4">
        <section className="editor-frame mx-auto h-full min-h-0 w-full min-w-0 max-w-[1360px] overflow-hidden rounded-2xl border border-black/5 bg-background shadow-[0_30px_100px_-52px_rgba(24,24,27,0.55)] ring-1 ring-white/70 dark:ring-white/5">
          <SimpleEditor
            key={activeDocument.id}
            content={activeDocument.content}
            onUpdate={(content) => updateDocumentContent(activeDocument.id, content)}
          />
        </section>
      </main>
    </div>
  )
}
